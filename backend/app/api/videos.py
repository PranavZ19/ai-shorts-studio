from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import shutil
import uuid
from pathlib import Path
from app.database import get_db
from app.models.source_video import SourceVideo
from app.models.project import Project
from app.config import settings

router = APIRouter(prefix="/api/videos", tags=["Videos"])

@router.get("/")
def list_videos(project_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(SourceVideo)
    if project_id:
        query = query.filter(SourceVideo.project_id == project_id)
    videos = query.order_by(SourceVideo.created_at.desc()).all()
    
    return [
        {
            "id": v.id,
            "project_id": v.project_id,
            "title": v.title,
            "source_type": v.source_type,
            "source_url": v.source_url,
            "duration": v.duration_seconds,
            "width": v.width,
            "height": v.height,
            "fps": v.fps,
            "file_size": v.file_size_bytes,
            "status": v.status,
            "thumbnail_url": f"/media/thumbnails/{v.id}.jpg" if v.thumbnail_path else None,
            "created_at": v.created_at.isoformat() if v.created_at else None
        }
        for v in videos
    ]

@router.get("/{video_id}")
def get_video(video_id: str, db: Session = Depends(get_db)):
    video = db.query(SourceVideo).filter(SourceVideo.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return {
        "id": video.id,
        "project_id": video.project_id,
        "title": video.title,
        "source_type": video.source_type,
        "source_url": video.source_url,
        "duration": video.duration_seconds,
        "width": video.width,
        "height": video.height,
        "fps": video.fps,
        "file_size": video.file_size_bytes,
        "status": video.status,
        "thumbnail_url": f"/media/thumbnails/{video.id}.jpg" if video.thumbnail_path else None,
        "created_at": video.created_at.isoformat() if video.created_at else None
    }
