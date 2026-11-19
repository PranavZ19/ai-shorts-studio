import os
import shutil
from pathlib import Path
from typing import Optional, Tuple
from app.config import settings

class StorageService:
    def __init__(self):
        settings.ensure_directories()

    def get_source_video_path(self, filename: str) -> Path:
        return settings.SOURCE_VIDEOS_DIR / filename

    def get_clip_path(self, filename: str) -> Path:
        return settings.CLIPS_DIR / filename

    def get_thumbnail_path(self, filename: str) -> Path:
        return settings.THUMBNAILS_DIR / filename

    def get_export_path(self, filename: str) -> Path:
        return settings.EXPORTS_DIR / filename

    def get_temp_path(self, filename: str) -> Path:
        return settings.TEMP_DIR / filename

    def clean_temp_files(self):
        """Clean all temporary files in temp directory."""
        for item in settings.TEMP_DIR.glob("*"):
            try:
                if item.is_file():
                    item.unlink()
                elif item.is_dir():
                    shutil.rmtree(item)
            except Exception:
                pass

storage_service = StorageService()
