from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pathlib import Path
from app.database import get_db
from app.models.project import Project
from app.models.source_video import SourceVideo
from app.models.clip import Clip
from app.models.job import ProcessingJob
from app.config import settings

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@router.get("/dashboard")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Computes real, database-backed statistics for the Overview Dashboard."""
    total_projects = db.query(Project).count()
    videos_processed = db.query(SourceVideo).count()
    total_clips = db.query(Clip).count()
    approved_clips = db.query(Clip).filter(Clip.is_approved == True).count()
    downloadable_clips = db.query(Clip).filter(Clip.output_path != None).count()
    failed_jobs = db.query(ProcessingJob).filter(ProcessingJob.status == "failed").count()
    active_jobs = db.query(ProcessingJob).filter(ProcessingJob.status.in_(["pending", "running"])).all()

    # Calculate actual storage used in storage root
    total_storage_bytes = 0
    if settings.STORAGE_DIR.exists():
        for f in settings.STORAGE_DIR.rglob("*"):
            if f.is_file():
                total_storage_bytes += f.stat().st_size
    storage_used_mb = round(total_storage_bytes / (1024 * 1024), 2)

    # Recent items
    recent_projects = db.query(Project).order_by(Project.created_at.desc()).limit(5).all()
    recent_clips = db.query(Clip).order_by(Clip.created_at.desc()).limit(6).all()
    recent_jobs = db.query(ProcessingJob).order_by(ProcessingJob.created_at.desc()).limit(5).all()

    return {
        "stats": {
            "total_projects": total_projects,
            "videos_processed": videos_processed,
            "total_clips_generated": total_clips,
            "approved_clips": approved_clips,
            "downloadable_clips": downloadable_clips,
            "failed_processing_jobs": failed_jobs,
            "active_queue_count": len(active_jobs),
            "storage_used_mb": storage_used_mb,
            "storage_root": str(settings.STORAGE_ROOT)
        },
        "recent_projects": [
            {
                "id": p.id,
                "name": p.name,
                "status": p.status,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "video_count": len(p.videos),
                "clip_count": len(p.clips)
            }
            for p in recent_projects
        ],
        "recent_clips": [
            {
                "id": c.id,
                "project_id": c.project_id,
                "title": c.title,
                "duration": c.duration,
                "overall_score": c.overall_score,
                "is_approved": c.is_approved,
                "thumbnail_url": f"/media/thumbnails/{c.id}.jpg" if c.thumbnail_path else None,
                "created_at": c.created_at.isoformat() if c.created_at else None
            }
            for c in recent_clips
        ],
        "recent_jobs": [
            {
                "id": j.id,
                "project_id": j.project_id,
                "stage": j.stage,
                "progress_pct": j.progress_pct,
                "status": j.status,
                "message": j.message,
                "created_at": j.created_at.isoformat() if j.created_at else None
            }
            for j in recent_jobs
        ]
    }
