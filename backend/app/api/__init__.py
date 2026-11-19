from app.api.hardware import router as hardware_router
from app.api.projects import router as projects_router
from app.api.videos import router as videos_router
from app.api.transcripts import router as transcripts_router
from app.api.clips import router as clips_router
from app.api.jobs import router as jobs_router
from app.api.downloads import router as downloads_router
from app.api.analytics import router as analytics_router
from app.api.settings import router as settings_router

__all__ = [
    "hardware_router",
    "projects_router",
    "videos_router",
    "transcripts_router",
    "clips_router",
    "jobs_router",
    "downloads_router",
    "analytics_router",
    "settings_router"
]
