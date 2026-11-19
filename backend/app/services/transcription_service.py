import os
import gc
import json
import subprocess
import threading
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable, Tuple
from app.config import settings

# On Windows, register PyTorch CUDA libraries (cublas64_12.dll, cudnn, etc.) for CTranslate2
try:
    import torch
    torch_lib = Path(torch.__file__).parent / "lib"
    if torch_lib.exists():
        if hasattr(os, "add_dll_directory"):
            os.add_dll_directory(str(torch_lib))
        os.environ["PATH"] = str(torch_lib) + ";" + os.environ.get("PATH", "")
except Exception:
    pass

# Force HuggingFace and Faster-Whisper caches to D:\AI-Shorts-Studio\storage\models
models_dir = settings.MODELS_DIR
os.environ["HF_HOME"] = str(models_dir / "huggingface")
os.environ["HUGGINGFACE_HUB_CACHE"] = str(models_dir / "huggingface" / "hub")
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

# Concurrency lock to prevent concurrent GPU-heavy transcription overloading 4GB VRAM
_transcription_lock = threading.Lock()

class TranscriptionService:
    SUPPORTED_MODELS = ["tiny", "base", "small"]
    DEFAULT_MODEL = "base"

    def __init__(self):
        self.download_root = str(settings.MODELS_DIR)
        Path(self.download_root).mkdir(parents=True, exist_ok=True)

    def extract_audio_for_whisper(self, video_path: Path, temp_wav_path: Path) -> Path:
        """Extract high-fidelity 16kHz mono 16-bit PCM WAV using FFmpeg."""
        temp_wav_path.parent.mkdir(parents=True, exist_ok=True)

        cmd = [
            settings.FFMPEG_BIN,
            "-y",
            "-i", str(video_path),
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            str(temp_wav_path)
        ]

        res = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if res.returncode != 0 or not temp_wav_path.exists() or temp_wav_path.stat().st_size == 0:
            raise RuntimeError(f"FFmpeg failed to extract audio: {res.stderr[-300:]}")

        return temp_wav_path

    def transcribe_video(
        self,
        video_path: Path,
        model_name: str = "base",
        language: Optional[str] = None,  # None for auto-detect
        force_cpu: bool = False,
        progress_callback: Optional[Callable[[str, int, str], None]] = None
    ) -> Dict[str, Any]:
        """
        Transcribe video locally using Faster-Whisper with word-level timestamps.
        Includes real stage progress reporting and automatic CPU fallback.
        """
        if model_name not in self.SUPPORTED_MODELS:
            model_name = self.DEFAULT_MODEL

        # Step 1: Audio Extraction
        if progress_callback:
            progress_callback("audio_extraction", 10, "Extracting 16kHz audio stream...")

        temp_wav = settings.TEMP_DIR / f"temp_{video_path.stem}.wav"
        try:
            self.extract_audio_for_whisper(video_path, temp_wav)
        except Exception as e:
            raise RuntimeError(f"Audio extraction failed: {str(e)}")

        # Acquire lock to ensure only 1 GPU job at a time
        acquired = _transcription_lock.acquire(timeout=5)
        if not acquired:
            temp_wav.unlink(missing_ok=True)
            raise RuntimeError("Another transcription job is currently in progress. Please wait for it to finish.")

        try:
            from faster_whisper import WhisperModel
            import ctranslate2

            # Determine device and compute type
            device = "cpu"
            compute_type = "int8"

            if not force_cpu and ctranslate2.get_cuda_device_count() > 0:
                device = "cuda"
                compute_type = "float16"

            if progress_callback:
                progress_callback("loading_model", 20, f"Loading Whisper model '{model_name}' on {device.upper()} ({compute_type})...")

            # Load model with fallback
            model = None
            actual_device = device
            actual_compute = compute_type

            try:
                model = WhisperModel(
                    model_name,
                    device=device,
                    compute_type=compute_type,
                    download_root=self.download_root
                )
            except Exception as cuda_err:
                if device == "cuda":
                    # Fallback to CPU
                    actual_device = "cpu"
                    actual_compute = "int8"
                    if progress_callback:
                        progress_callback("loading_model", 22, f"CUDA initialization failed ({str(cuda_err)[:40]}). Falling back to CPU...")
                    model = WhisperModel(
                        model_name,
                        device="cpu",
                        compute_type="int8",
                        download_root=self.download_root
                    )
                else:
                    raise cuda_err

            if progress_callback:
                progress_callback("transcribing", 30, "Detecting language and transcribing speech...")

            # Run transcription with word timestamps
            # language=None triggers automatic language detection
            segments_generator, info = model.transcribe(
                str(temp_wav),
                language=language if language and language != "auto" else None,
                word_timestamps=True,
                beam_size=5,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500)
            )

            detected_language = info.language
            language_probability = round(info.language_probability, 3)
            total_duration = info.duration or 1.0

            if progress_callback:
                progress_callback("transcribing", 35, f"Detected language: {detected_language.upper()} ({int(language_probability * 100)}%). Generating segments...")

            segments = []
            full_text_parts = []

            for idx, seg in enumerate(segments_generator):
                seg_text = seg.text.strip()
                full_text_parts.append(seg_text)

                words_data = []
                if seg.words:
                    for w in seg.words:
                        words_data.append({
                            "word": w.word.strip(),
                            "start": round(w.start, 2),
                            "end": round(w.end, 2),
                            "probability": round(w.probability, 3)
                        })

                segments.append({
                    "segment_index": idx,
                    "start_time": round(seg.start, 2),
                    "end_time": round(seg.end, 2),
                    "text": seg_text,
                    "speaker": "Speaker 1",
                    "words": words_data
                })

                # Calculate real progress based on audio timestamp processed
                if total_duration > 0 and progress_callback:
                    pct = 35 + int((seg.end / total_duration) * 50)
                    pct = min(pct, 88)
                    progress_callback("transcribing", pct, f"Transcribing {round(seg.end, 1)}s of {round(total_duration, 1)}s...")

            full_transcript_text = " ".join(full_text_parts)

            if progress_callback:
                progress_callback("saving_transcript", 95, "Finalizing timestamped transcript and saving...")

            return {
                "language": detected_language,
                "language_probability": language_probability,
                "model_name": model_name,
                "device_used": actual_device,
                "duration": total_duration,
                "full_text": full_transcript_text,
                "segments": segments
            }

        finally:
            _transcription_lock.release()
            # Clean up temp WAV
            temp_wav.unlink(missing_ok=True)
            # Free memory
            gc.collect()
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except Exception:
                pass

    def generate_srt(self, segments: List[Dict[str, Any]]) -> str:
        """Format transcript segments into standard SubRip (.SRT) subtitle format."""
        def format_time_srt(seconds: float) -> str:
            hours = int(seconds // 3600)
            minutes = int((seconds % 3600) // 60)
            secs = int(seconds % 60)
            millis = int(round((seconds - int(seconds)) * 1000))
            return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

        lines = []
        for i, s in enumerate(segments, 1):
            start = format_time_srt(s["start_time"])
            end = format_time_srt(s["end_time"])
            lines.append(f"{i}\n{start} --> {end}\n{s['text']}\n")
        return "\n".join(lines)

    def generate_vtt(self, segments: List[Dict[str, Any]]) -> str:
        """Format transcript segments into WebVTT (.VTT) format."""
        def format_time_vtt(seconds: float) -> str:
            hours = int(seconds // 3600)
            minutes = int((seconds % 3600) // 60)
            secs = int(seconds % 60)
            millis = int(round((seconds - int(seconds)) * 1000))
            return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"

        lines = ["WEBVTT\n"]
        for i, s in enumerate(segments, 1):
            start = format_time_vtt(s["start_time"])
            end = format_time_vtt(s["end_time"])
            lines.append(f"{start} --> {end}\n{s['text']}\n")
        return "\n".join(lines)

transcription_service = TranscriptionService()
