import json
import math
import subprocess
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
from app.config import settings

SUPPORTED_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".avi"}

class VideoAnalysisService:
    def __init__(self):
        self.ffprobe_bin = settings.FFPROBE_BIN
        self.ffmpeg_bin = settings.FFMPEG_BIN

    def validate_file_format(self, filename: str) -> Tuple[bool, str]:
        ext = Path(filename).suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            allowed = ", ".join(sorted(SUPPORTED_EXTENSIONS))
            return False, f"Unsupported format '{ext}'. Supported video formats are: {allowed}"
        return True, "Valid format"

    def probe_video(self, file_path: Path) -> Dict[str, Any]:
        """Use FFprobe to extract technical stream metadata."""
        if not file_path.exists():
            raise FileNotFoundError(f"Video file not found at {file_path}")

        cmd = [
            self.ffprobe_bin,
            "-v", "error",
            "-show_format",
            "-show_streams",
            "-print_format", "json",
            str(file_path)
        ]

        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            if res.returncode != 0:
                raise RuntimeError(f"FFprobe failed (code {res.returncode}): {res.stderr.strip()}")
            data = json.loads(res.stdout)
        except subprocess.TimeoutExpired:
            raise RuntimeError("FFprobe metadata extraction timed out")
        except json.JSONDecodeError:
            raise RuntimeError("Failed to parse FFprobe JSON output")

        format_info = data.get("format", {})
        streams = data.get("streams", [])

        video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
        audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

        if not video_stream:
            raise ValueError("The provided file does not contain a valid video stream")

        # Parse duration
        duration = float(format_info.get("duration") or video_stream.get("duration") or 0.0)

        # Parse width and height
        width = int(video_stream.get("width") or 0)
        height = int(video_stream.get("height") or 0)

        # Calculate Aspect Ratio
        aspect_ratio = "16:9"
        if width > 0 and height > 0:
            gcd = math.gcd(width, height)
            simplified_w = width // gcd
            simplified_h = height // gcd
            # Standard labels if close
            ratio = width / height
            if abs(ratio - 16 / 9) < 0.05:
                aspect_ratio = "16:9"
            elif abs(ratio - 9 / 16) < 0.05:
                aspect_ratio = "9:16"
            elif abs(ratio - 1.0) < 0.05:
                aspect_ratio = "1:1"
            elif abs(ratio - 4 / 3) < 0.05:
                aspect_ratio = "4:3"
            else:
                aspect_ratio = f"{simplified_w}:{simplified_h}"

        # Parse FPS
        fps = 30.0
        r_fps = video_stream.get("r_frame_rate", "30/1")
        if "/" in r_fps:
            num, den = r_fps.split("/")
            if float(den) > 0:
                fps = round(float(num) / float(den), 2)
        elif r_fps:
            try:
                fps = round(float(r_fps), 2)
            except ValueError:
                fps = 30.0

        # Codecs
        video_codec = video_stream.get("codec_name", "unknown")
        audio_codec = audio_stream.get("codec_name") if audio_stream else None
        has_audio = audio_stream is not None

        file_size = int(format_info.get("size") or file_path.stat().st_size)

        return {
            "duration": duration,
            "width": width,
            "height": height,
            "fps": fps,
            "aspect_ratio": aspect_ratio,
            "video_codec": video_codec,
            "audio_codec": audio_codec,
            "has_audio": has_audio,
            "file_size": file_size
        }

    def generate_thumbnail(self, video_path: Path, output_thumb_path: Path, target_time: Optional[float] = None) -> bool:
        """Extract a high-quality thumbnail frame from the video using FFmpeg."""
        output_thumb_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Default capture position: 1.0 second or 10% through
        seek_sec = 1.0
        if target_time is not None:
            seek_sec = target_time

        cmd = [
            self.ffmpeg_bin,
            "-y",
            "-ss", str(seek_sec),
            "-i", str(video_path),
            "-vframes", "1",
            "-q:v", "2",
            "-vf", "scale=640:-1",
            str(output_thumb_path)
        ]

        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        # If seek was past video duration, try at 0 seconds
        if res.returncode != 0 or not output_thumb_path.exists() or output_thumb_path.stat().st_size == 0:
            cmd[2] = "0.0"
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)

        return output_thumb_path.exists() and output_thumb_path.stat().st_size > 0

video_analysis_service = VideoAnalysisService()
