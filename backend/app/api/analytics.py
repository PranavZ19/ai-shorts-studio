from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pathlib import Path
from typing import List, Dict, Any
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
    total_source_videos = db.query(SourceVideo).count()
    total_clips = db.query(Clip).count()
    approved_clips = db.query(Clip).filter(Clip.is_approved == True).count()
    pending_clips = db.query(Clip).filter(Clip.status == "candidate", Clip.is_approved == False).count()
    rejected_clips = db.query(Clip).filter(Clip.status == "rejected").count()
    
    # Downloadable clips (rendered and file exists)
    rendered_clips_db = db.query(Clip).filter(Clip.output_path != None).all()
    downloadable_clips_count = 0
    total_downloadable_bytes = 0
    for c in rendered_clips_db:
        if c.output_path and Path(c.output_path).exists():
            downloadable_clips_count += 1
            size = c.file_size_bytes or Path(c.output_path).stat().st_size
            total_downloadable_bytes += size

    total_downloadable_mb = round(total_downloadable_bytes / (1024 * 1024), 2)

    failed_jobs = db.query(ProcessingJob).filter(ProcessingJob.status == "failed").count()
    failed_clips = db.query(Clip).filter(Clip.status == "error").count()
    total_failed_renders = failed_jobs + failed_clips
    active_jobs = db.query(ProcessingJob).filter(ProcessingJob.status.in_(["pending", "running"])).all()

    # Calculate actual storage used in storage root on Drive D:
    total_storage_bytes = 0
    if settings.STORAGE_DIR.exists():
        for f in settings.STORAGE_DIR.rglob("*"):
            try:
                if f.is_file():
                    total_storage_bytes += f.stat().st_size
            except Exception:
                pass
    storage_used_mb = round(total_storage_bytes / (1024 * 1024), 2)
    storage_used_gb = round(total_storage_bytes / (1024 * 1024 * 1024), 2)

    # Recent items
    recent_projects = db.query(Project).order_by(Project.created_at.desc()).limit(5).all()
    recent_clips = db.query(Clip).order_by(Clip.created_at.desc()).limit(8).all()
    recent_jobs = db.query(ProcessingJob).order_by(ProcessingJob.created_at.desc()).limit(8).all()
    recent_videos = db.query(SourceVideo).order_by(SourceVideo.created_at.desc()).limit(5).all()

    # Unified Recent Activity Stream
    activities: List[Dict[str, Any]] = []

    for v in recent_videos:
        activities.append({
            "id": f"vid_{v.id}",
            "type": "upload",
            "action": "Video Uploaded",
            "title": v.title,
            "description": f"{v.width}x{v.height} @ {int(v.fps)}fps — {int(v.duration_seconds or 0)}s ({round((v.file_size_bytes or 0) / (1024*1024), 1)} MB)",
            "status": "completed",
            "timestamp": v.created_at.isoformat() if v.created_at else None
        })

    for c in recent_clips:
        is_rendered = bool(c.output_path and Path(c.output_path).exists())
        activities.append({
            "id": f"clp_{c.id}",
            "type": "render" if is_rendered else "clip_found",
            "action": "Vertical Short Rendered" if is_rendered else "AI Clip Identified",
            "title": c.title,
            "description": f"Score {c.overall_score}/100 — Duration: {int(round(c.duration))}s",
            "status": "completed" if is_rendered else ("approved" if c.is_approved else c.status),
            "timestamp": (c.updated_at or c.created_at).isoformat() if (c.updated_at or c.created_at) else None
        })

    for j in recent_jobs:
        if j.status == "failed":
            activities.append({
                "id": f"job_{j.id}",
                "type": "error",
                "action": "Processing Failed",
                "title": f"Job: {j.job_type}",
                "description": j.error_details or j.message or "Pipeline failure",
                "status": "failed",
                "timestamp": (j.completed_at or j.created_at).isoformat() if (j.completed_at or j.created_at) else None
            })

    # Sort activities by timestamp desc
    activities.sort(key=lambda x: x["timestamp"] or "", reverse=True)
    recent_activities = activities[:10]

    return {
        "stats": {
            "total_projects": total_projects,
            "total_source_videos": total_source_videos,
            "videos_processed": total_source_videos,
            "total_clips_generated": total_clips,
            "total_rendered_clips": downloadable_clips_count,
            "approved_clips": approved_clips,
            "pending_clips": pending_clips,
            "rejected_clips": rejected_clips,
            "failed_renders": total_failed_renders,
            "failed_processing_jobs": failed_jobs,
            "active_queue_count": len(active_jobs),
            "storage_used_mb": storage_used_mb,
            "storage_used_gb": storage_used_gb,
            "total_downloadable_video_bytes": total_downloadable_bytes,
            "total_downloadable_video_mb": total_downloadable_mb,
            "storage_root": str(settings.STORAGE_ROOT)
        },
        "recent_activities": recent_activities,
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
                "has_rendered_video": bool(c.output_path and Path(c.output_path).exists()),
                "thumbnail_url": f"/api/downloads/clip/{c.id}/thumbnail" if c.thumbnail_path else None,
                "created_at": c.created_at.isoformat() if c.created_at else None
            }
            for c in recent_clips
        ],
        "recent_jobs": [
            {
                "id": j.id,
                "project_id": j.project_id,
                "job_type": j.job_type,
                "stage": j.stage,
                "progress_pct": j.progress_pct,
                "status": j.status,
                "message": j.message,
                "created_at": j.created_at.isoformat() if j.created_at else None
            }
            for j in recent_jobs
        ]
    }
