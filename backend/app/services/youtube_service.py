import re
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
import yt_dlp
from app.config import settings

YOUTUBE_REGEX = re.compile(
    r'^(https?://)?(www\.|m\.)?(youtube\.com/(watch\?v=|shorts/|embed/)|youtu\.be/)([a-zA-Z0-9_-]{11})([&?].*)?$'
)

class YouTubeService:
    def validate_youtube_url(self, url: str) -> Tuple[bool, Optional[str]]:
        """Validate if the provided string is a legitimate YouTube URL."""
        if not url or not isinstance(url, str):
            return False, "URL is required"
        url = url.strip()
        match = YOUTUBE_REGEX.match(url)
        if not match:
            return False, "Invalid YouTube URL. Please provide a standard watch link or shorts URL (e.g., https://www.youtube.com/watch?v=... or https://youtu.be/...)"
        video_id = match.group(5)
        return True, video_id

    def fetch_metadata(self, url: str) -> Dict[str, Any]:
        """Retrieve publicly available YouTube video metadata without downloading video stream."""
        is_valid, video_id_or_err = self.validate_youtube_url(url)
        if not is_valid:
            raise ValueError(video_id_or_err)

        ydl_opts = {
            'skip_download': True,
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if not info:
                    raise ValueError("Could not extract metadata for this video")

                # Check if livestream
                if info.get('is_live'):
                    raise ValueError("Live streams are not supported. Please provide an uploaded, completed video.")

                duration = float(info.get('duration') or 0.0)
                title = info.get('title') or "Untitled Video"
                channel = info.get('uploader') or info.get('channel') or "Unknown Channel"
                thumbnail = info.get('thumbnail') or ""
                description = (info.get('description') or "")[:500]  # truncate long descriptions
                view_count = int(info.get('view_count') or 0)
                width = int(info.get('width') or 1920)
                height = int(info.get('height') or 1080)
                fps = float(info.get('fps') or 30.0)

                return {
                    "video_id": info.get('id') or video_id_or_err,
                    "title": title,
                    "channel_name": channel,
                    "duration_seconds": duration,
                    "thumbnail_url": thumbnail,
                    "description": description,
                    "view_count": view_count,
                    "width": width,
                    "height": height,
                    "fps": fps,
                    "url": url,
                    "is_accessible": True
                }

        except yt_dlp.utils.DownloadError as e:
            err_msg = str(e)
            if "private" in err_msg.lower():
                raise PermissionError("This video is private and cannot be accessed. If you have the file, please upload it directly.")
            elif "copyright" in err_msg.lower() or "blocked" in err_msg.lower():
                raise PermissionError("This video is restricted or blocked due to copyright restrictions.")
            elif "drm" in err_msg.lower():
                raise PermissionError("This video contains DRM protection and cannot be processed.")
            else:
                raise RuntimeError(f"YouTube metadata extraction failed: {err_msg}")
        except Exception as e:
            raise RuntimeError(f"Failed to inspect YouTube URL: {str(e)}")

    def download_authorized_video(self, url: str, output_path: Path) -> Path:
        """Download authorized YouTube video for processing."""
        output_template = str(output_path.with_suffix('')) + ".%(ext)s"

        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': output_template,
            'quiet': True,
            'no_warnings': True,
            'merge_output_format': 'mp4',
            'ffmpeg_location': str(Path(settings.FFMPEG_BIN).parent),
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                downloaded_file = Path(ydl.prepare_filename(info))
                # Ensure .mp4 extension
                final_mp4 = downloaded_file.with_suffix('.mp4')
                if downloaded_file.exists() and downloaded_file != final_mp4:
                    downloaded_file.rename(final_mp4)
                return final_mp4
        except yt_dlp.utils.DownloadError as e:
            raise PermissionError(f"Cannot download YouTube video lawfully: {str(e)}. Please upload an authorized local file instead.")

youtube_service = YouTubeService()
