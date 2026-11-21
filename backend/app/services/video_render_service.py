import os
import re
import json
import time
import shutil
import logging
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable, Tuple

from app.config import settings
from app.services.face_tracker_service import face_tracker
from app.services.caption_service import caption_service

logger = logging.getLogger(__name__)

class VideoRenderService:
    def __init__(self):
        self.ffmpeg_bin = settings.FFMPEG_BIN
        self.ffprobe_bin = settings.FFPROBE_BIN
        self.active_processes: Dict[str, subprocess.Popen] = {}

    @staticmethod
    def escape_filter_path(path: Path) -> str:
        """Escape Windows file paths for FFmpeg filtergraph usage."""
        p_str = str(path.resolve()).replace("\\", "/")
        # Escape colon after drive letter: C:/ -> C\:/
        if len(p_str) > 1 and p_str[1] == ":":
            p_str = p_str[0] + "\\:" + p_str[2:]
        return p_str

    def cancel_render(self, clip_id: str) -> bool:
        """Cancel an ongoing rendering job safely."""
        proc = self.active_processes.get(clip_id)
        if proc:
            try:
                proc.terminate()
                proc.kill()
                del self.active_processes[clip_id]
                logger.info(f"Render job for clip {clip_id} was successfully cancelled.")
                return True
            except Exception as e:
                logger.warning(f"Error cancelling process for {clip_id}: {e}")
        return False

    def probe_video(self, video_path: Path) -> Dict[str, Any]:
        """Probe technical stream metadata using FFprobe."""
        cmd = [
            self.ffprobe_bin,
            "-v", "error",
            "-show_entries", "format=duration,size:stream=width,height,codec_name,r_frame_rate",
            "-of", "json",
            str(video_path)
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if res.returncode != 0:
            raise RuntimeError(f"FFprobe failed: {res.stderr}")
        return json.loads(res.stdout)

    def render_clip(
        self,
        clip_id: str,
        source_video_path: Path,
        start_time: float,
        end_time: float,
        transcript_segments: Optional[List[Dict[str, Any]]] = None,
        edit_config: Optional[Dict[str, Any]] = None,
        progress_callback: Optional[Callable[[str, int, str], None]] = None
    ) -> Dict[str, Any]:
        """
        Complete video processing & rendering engine:
        1. Prepares cut segment with stream audio synchronization.
        2. Detects subjects & calculates smoothed 9:16 vertical crop.
        3. Generates synchronized word-by-word animated captions.
        4. Encodes using NVENC hardware acceleration (with auto CPU fallback).
        5. Extracts poster thumbnail and validates final MP4.
        """
        edit_config = edit_config or {}
        duration = max(0.5, end_time - start_time)

        # Output paths
        clips_dir = settings.CLIPS_DIR
        thumbnails_dir = settings.THUMBNAILS_DIR
        temp_dir = settings.TEMP_DIR

        clips_dir.mkdir(parents=True, exist_ok=True)
        thumbnails_dir.mkdir(parents=True, exist_ok=True)
        temp_dir.mkdir(parents=True, exist_ok=True)

        output_mp4 = clips_dir / f"{clip_id}.mp4"
        output_thumb = thumbnails_dir / f"{clip_id}.jpg"
        output_srt = clips_dir / f"{clip_id}.srt"
        output_vtt = clips_dir / f"{clip_id}.vtt"
        temp_ass = temp_dir / f"sub_{clip_id}.ass"

        # Configuration options
        target_aspect = edit_config.get("aspect_ratio", "9:16")
        framing_mode = edit_config.get("framing", "auto_face")
        manual_pos = float(edit_config.get("manual_position", 0.5))
        caption_enabled = edit_config.get("caption_enabled", True)
        caption_preset = edit_config.get("caption_preset", "bold_creator")
        audio_volume = float(edit_config.get("audio_volume", 1.0))

        # Free VRAM before GPU rendering
        try:
            import gc
            gc.collect()
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass

        # -------------------------------------------------------------
        # Step 1: Subject Detection & Framing (Face Tracking)
        # -------------------------------------------------------------
        if progress_callback:
            progress_callback("tracking_faces", 10, "Analyzing frames for speaker face tracking & framing...")

        crop_info = face_tracker.analyze_crop_trajectory(
            video_path=source_video_path,
            start_time=start_time,
            end_time=end_time,
            target_aspect_ratio=target_aspect,
            framing_mode=framing_mode,
            manual_position=manual_pos
        )
        crop_filter = crop_info.get("filter_str", "crop=in_w:in_h:0:0")
        logger.info(f"Framing analysis complete: {crop_info.get('mode')} -> {crop_filter}")

        # -------------------------------------------------------------
        # Step 2: Animated Subtitle Generation (ASS & SRT)
        # -------------------------------------------------------------
        has_subtitles = False
        if caption_enabled and transcript_segments:
            if progress_callback:
                progress_callback("generating_captions", 20, "Generating word-synchronized animated captions...")

            excluded_phrases = edit_config.get("excluded_phrases", [])
            clip_words = caption_service.extract_clip_words(
                transcript_segments,
                start_time,
                end_time,
                excluded_phrases=excluded_phrases
            )
            if clip_words:
                caption_service.generate_ass_subtitle(
                    words=clip_words,
                    output_ass_path=temp_ass,
                    preset_name=caption_preset,
                    custom_config=edit_config
                )
                caption_service.generate_srt_subtitle(
                    words=clip_words,
                    output_srt_path=output_srt
                )
                caption_service.generate_vtt_subtitle(
                    words=clip_words,
                    output_vtt_path=output_vtt
                )
                has_subtitles = temp_ass.exists() and temp_ass.stat().st_size > 0

        # -------------------------------------------------------------
        # Step 3: Build FFmpeg Filter Graph
        # -------------------------------------------------------------
        # Target canvas size: 1080x1920 (9:16) or 1080x1080 (1:1) or 1920x1080 (16:9)
        if target_aspect == "9:16":
            scale_filter = "scale=1080:1920:flags=lanczos"
        elif target_aspect == "1:1":
            scale_filter = "scale=1080:1080:flags=lanczos"
        else:
            scale_filter = "scale=1920:1080:flags=lanczos"

        video_filter_chain = [crop_filter, scale_filter, "format=yuv420p"]
        if has_subtitles:
            escaped_ass = self.escape_filter_path(temp_ass)
            video_filter_chain.append(f"ass='{escaped_ass}'")

        vf_str = ",".join(video_filter_chain)

        # Audio filters: resampling for perfect lip sync and optional volume
        af_chain = ["aresample=async=1000"]
        if audio_volume != 1.0:
            af_chain.append(f"volume={audio_volume}")
        af_str = ",".join(af_chain)

        # -------------------------------------------------------------
        # Step 4: Encode Video with NVENC & Automatic CPU Fallback
        # -------------------------------------------------------------
        if progress_callback:
            progress_callback("rendering", 30, "Rendering vertical video with hardware acceleration...")

        # Construct primary NVENC command
        def build_cmd(use_nvenc: bool) -> List[str]:
            cmd = [
                self.ffmpeg_bin,
                "-y",
                "-ss", str(round(start_time, 3)),
                "-t", str(round(duration, 3)),
                "-i", str(source_video_path),
                "-vf", vf_str,
                "-af", af_str,
                "-r", "30"
            ]

            if use_nvenc:
                cmd.extend([
                    "-c:v", "h264_nvenc",
                    "-preset", "p4",
                    "-cq", "22",
                    "-rc", "vbr",
                    "-b:v", "6500k",
                    "-maxrate", "9500k",
                    "-bufsize", "14000k"
                ])
            else:
                cmd.extend([
                    "-c:v", "libx264",
                    "-preset", "medium",
                    "-crf", "22",
                    "-pix_fmt", "yuv420p"
                ])

            cmd.extend([
                "-c:a", "aac",
                "-b:a", "192k",
                "-ar", "48000",
                "-movflags", "+faststart",
                str(output_mp4)
            ])
            return cmd

        # Try NVENC first, fallback to CPU if needed (or force CPU if requested)
        force_cpu = bool(edit_config.get("force_cpu", False))
        encoder_preference = edit_config.get("encoder")
        if force_cpu or encoder_preference == "libx264":
            attempts = [False]
        else:
            attempts = [True, False]

        used_encoder = "libx264" if (force_cpu or encoder_preference == "libx264") else "h264_nvenc"
        success = False
        error_msg = ""

        for attempt_nvenc in attempts:
            cmd = build_cmd(use_nvenc=attempt_nvenc)
            used_encoder = "h264_nvenc" if attempt_nvenc else "libx264"

            try:
                proc = subprocess.Popen(
                    cmd,
                    stderr=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    text=True,
                    universal_newlines=True,
                    bufsize=1
                )
                self.active_processes[clip_id] = proc

                # Monitor stderr line-by-line for actual time progress
                time_pattern = re.compile(r"time=(\d+):(\d+):(\d+\.\d+)")
                for line in proc.stderr:
                    match = time_pattern.search(line)
                    if match:
                        hours, mins, secs = match.groups()
                        cur_t = int(hours) * 3600 + int(mins) * 60 + float(secs)
                        pct = 30 + int((cur_t / duration) * 60)
                        pct = min(92, max(30, pct))
                        if progress_callback:
                            progress_callback(
                                "rendering",
                                pct,
                                f"Encoding with {used_encoder} ({round(cur_t, 1)}s / {round(duration, 1)}s)..."
                            )

                proc.wait()
                if proc.returncode == 0 and output_mp4.exists() and output_mp4.stat().st_size > 0:
                    success = True
                    break
                else:
                    error_msg = f"{used_encoder} failed with exit code {proc.returncode}"
                    logger.warning(f"{error_msg}. Retrying with CPU if applicable...")
            except Exception as e:
                error_msg = str(e)
                logger.warning(f"Encoding attempt with {used_encoder} failed: {e}")
            finally:
                self.active_processes.pop(clip_id, None)

        if not success:
            temp_ass.unlink(missing_ok=True)
            raise RuntimeError(f"Video rendering failed on both NVENC and CPU encoders: {error_msg}")

        # -------------------------------------------------------------
        # Step 5: Generate Poster Thumbnail (1080x1920)
        # -------------------------------------------------------------
        if progress_callback:
            progress_callback("finalizing", 94, "Generating poster thumbnail and verifying MP4 metadata...")

        thumb_cmd = [
            self.ffmpeg_bin,
            "-y",
            "-ss", str(round(min(1.0, duration / 2.0), 3)),
            "-i", str(output_mp4),
            "-vframes", "1",
            "-q:v", "2",
            str(output_thumb)
        ]
        subprocess.run(thumb_cmd, capture_output=True, timeout=15)

        # -------------------------------------------------------------
        # Step 6: Validate Output with FFprobe
        # -------------------------------------------------------------
        info = self.probe_video(output_mp4)
        streams = info.get("streams", [])
        v_stream = next((s for s in streams if s.get("width")), {})
        out_w = int(v_stream.get("width", 0))
        out_h = int(v_stream.get("height", 0))
        out_codec = v_stream.get("codec_name", "h264")
        out_size = int(info.get("format", {}).get("size", output_mp4.stat().st_size))
        out_dur = float(info.get("format", {}).get("duration", duration))

        # Cleanup intermediate ASS
        temp_ass.unlink(missing_ok=True)

        if progress_callback:
            progress_callback("completed", 100, "Rendering complete — ready for download and publishing!")

        return {
            "clip_id": clip_id,
            "output_path": str(output_mp4),
            "thumbnail_path": str(output_thumb) if output_thumb.exists() else None,
            "srt_path": str(output_srt) if output_srt.exists() else None,
            "vtt_path": str(output_vtt) if output_vtt.exists() else None,
            "file_size_bytes": out_size,
            "width": out_w,
            "height": out_h,
            "duration": round(out_dur, 2),
            "codec": out_codec,
            "encoder_used": used_encoder,
            "framing_mode": crop_info.get("mode"),
            "caption_preset": caption_preset,
            "has_captions": has_subtitles
        }

video_render_service = VideoRenderService()
