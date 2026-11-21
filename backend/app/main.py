from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.config import settings
from app.database import engine, Base, run_migrations
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
    settings_router,
    strategy_router,
    publishing_kits_router,
    ai_editor_router
)

# Initialize SQLite database tables and migrations
Base.metadata.create_all(bind=engine)
run_migrations()

def recover_dangling_jobs():
    """Detect and safely mark any dangling in-progress jobs from previous server sessions."""
    from app.database import SessionLocal
    from app.models.job import ProcessingJob
    from app.models.clip import Clip
    db = SessionLocal()
    try:
        dangling_jobs = db.query(ProcessingJob).filter(ProcessingJob.status.in_(["running", "pending"])).all()
        for j in dangling_jobs:
            j.status = "interrupted"
            j.message = "Process was interrupted by system restart. Ready to retry."
            j.error_details = "Server restarted while job was active."

        dangling_clips = db.query(Clip).filter(Clip.status == "exporting").all()
        for c in dangling_clips:
            if c.output_path and Path(c.output_path).exists():
                c.status = "exported"
            else:
                c.status = "candidate"
        db.commit()
    except Exception as e:
        print(f"Error during job recovery: {e}")
    finally:
        db.close()

recover_dangling_jobs()

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
app.include_router(strategy_router)
app.include_router(publishing_kits_router)
app.include_router(ai_editor_router)

@app.get("/health")
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
