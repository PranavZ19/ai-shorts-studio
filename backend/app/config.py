import os
import platform
import shutil
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App Information
    APP_NAME: str = "AI Shorts Studio"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Host & Ports
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:5173"
    
    # Operating System detection
    IS_WINDOWS: bool = platform.system().lower() == "windows"
    IS_MACOS: bool = platform.system().lower() == "darwin"
    IS_LINUX: bool = platform.system().lower() == "linux"
    
    # Storage Root Directory (D:\AI-Shorts-Studio preferred on Windows, fallback to project root / home on macOS/Linux)
    STORAGE_ROOT: Path = Path("D:/AI-Shorts-Studio") if (platform.system().lower() == "windows" and Path("D:/").exists()) else Path.home() / ".ai_shorts_studio"
    
    @property
    def STORAGE_DIR(self) -> Path:
        return self.STORAGE_ROOT / "storage"
        
    @property
    def SOURCE_VIDEOS_DIR(self) -> Path:
        return self.STORAGE_DIR / "source_videos"
        
    @property
    def CLIPS_DIR(self) -> Path:
        return self.STORAGE_DIR / "clips"
        
    @property
    def TEMP_DIR(self) -> Path:
        return self.STORAGE_DIR / "temp"
        
    @property
    def MODELS_DIR(self) -> Path:
        return self.STORAGE_DIR / "models"
        
    @property
    def EXPORTS_DIR(self) -> Path:
        return self.STORAGE_DIR / "exports"
        
    @property
    def THUMBNAILS_DIR(self) -> Path:
        return self.STORAGE_DIR / "thumbnails"
        
    @property
    def DATABASE_PATH(self) -> Path:
        return self.STORAGE_DIR / "studio.db"
        
    @property
    def DATABASE_URL(self) -> str:
        return f"sqlite:///{self.DATABASE_PATH.as_posix()}"
        
    # FFmpeg / FFprobe resolution
    @property
    def FFMPEG_BIN(self) -> str:
        custom_ffmpeg = self.STORAGE_ROOT / "tools" / "ffmpeg" / "bin" / ("ffmpeg.exe" if self.IS_WINDOWS else "ffmpeg")
        if custom_ffmpeg.exists():
            return str(custom_ffmpeg)
        sys_ffmpeg = shutil.which("ffmpeg")
        return sys_ffmpeg if sys_ffmpeg else "ffmpeg"
        
    @property
    def FFPROBE_BIN(self) -> str:
        custom_ffprobe = self.STORAGE_ROOT / "tools" / "ffmpeg" / "bin" / ("ffprobe.exe" if self.IS_WINDOWS else "ffprobe")
        if custom_ffprobe.exists():
            return str(custom_ffprobe)
        sys_ffprobe = shutil.which("ffprobe")
        return sys_ffprobe if sys_ffprobe else "ffprobe"

    # AI Defaults (Lightweight)
    DEFAULT_WHISPER_MODEL: str = "base"
    DEFAULT_OLLAMA_MODEL: str = "llama3.2:3b"
    OLLAMA_API_URL: str = "http://127.0.0.1:11434"

    def ensure_directories(self):
        """Create all storage directories safely."""
        for d in [
            self.STORAGE_ROOT,
            self.STORAGE_DIR,
            self.SOURCE_VIDEOS_DIR,
            self.CLIPS_DIR,
            self.TEMP_DIR,
            self.MODELS_DIR,
            self.EXPORTS_DIR,
            self.THUMBNAILS_DIR
        ]:
            d.mkdir(parents=True, exist_ok=True)

settings = Settings()
settings.ensure_directories()
