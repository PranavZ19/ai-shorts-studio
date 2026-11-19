from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.config import settings
from app.database import engine, Base
import app.models  # ensure models are registered
from app.api import (
    hardware_router,
    projects_router,
    videos_router,
    transcripts_router,
    clips_router,
    jobs_router,
    downloads_router,
    analytics_router,
    settings_router
)

# Initialize SQLite database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Professional Local AI Shorts & Reels Studio"
)

# Enable CORS for local web interface
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount media static directories for previews
app.mount("/media/thumbnails", StaticFiles(directory=str(settings.THUMBNAILS_DIR)), name="thumbnails")
app.mount("/media/clips", StaticFiles(directory=str(settings.CLIPS_DIR)), name="clips")
app.mount("/media/source", StaticFiles(directory=str(settings.SOURCE_VIDEOS_DIR)), name="source")

# Register API Routers
app.include_router(hardware_router)
app.include_router(projects_router)
app.include_router(videos_router)
app.include_router(transcripts_router)
app.include_router(clips_router)
app.include_router(jobs_router)
app.include_router(downloads_router)
app.include_router(analytics_router)
app.include_router(settings_router)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "storage_root": str(settings.STORAGE_ROOT),
        "ffmpeg": settings.FFMPEG_BIN
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
