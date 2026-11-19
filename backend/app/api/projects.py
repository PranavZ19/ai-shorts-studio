from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.database import get_db
from app.models.project import Project
from app.models.source_video import SourceVideo
from app.models.clip import Clip
from app.models.job import ProcessingJob

router = APIRouter(prefix="/api/projects", tags=["Projects"])

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

@router.get("/")
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    results = []
    for p in projects:
        results.append({
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            "video_count": len(p.videos),
            "clip_count": len(p.clips),
            "approved_clip_count": len([c for c in p.clips if c.is_approved])
        })
    return results

@router.post("/")
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    proj = Project(
        name=data.name.strip(),
        description=data.description.strip() if data.description else None
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return {
        "id": proj.id,
        "name": proj.name,
        "description": proj.description,
        "status": proj.status,
        "created_at": proj.created_at.isoformat() if proj.created_at else None
    }

@router.get("/{project_id}")
def get_project(project_id: str, db: Session = Depends(get_db)):
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    
    videos = []
    for v in proj.videos:
        videos.append({
            "id": v.id,
            "title": v.title,
            "duration": v.duration_seconds,
            "width": v.width,
            "height": v.height,
            "fps": v.fps,
            "status": v.status,
            "thumbnail_url": f"/media/thumbnails/{v.id}.jpg" if v.thumbnail_path else None
        })

    clips = []
    for c in proj.clips:
        clips.append({
            "id": c.id,
            "title": c.title,
            "duration": c.duration,
            "start_time": c.start_time,
            "end_time": c.end_time,
            "overall_score": c.overall_score,
            "status": c.status,
            "is_approved": c.is_approved,
            "thumbnail_url": f"/media/thumbnails/{c.id}.jpg" if c.thumbnail_path else None,
            "video_url": f"/media/clips/{c.id}.mp4" if c.output_path else None
        })

    return {
        "id": proj.id,
        "name": proj.name,
        "description": proj.description,
        "status": proj.status,
        "created_at": proj.created_at.isoformat() if proj.created_at else None,
        "videos": videos,
        "clips": clips
    }

@router.delete("/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(proj)
    db.commit()
    return {"success": True, "message": "Project deleted"}
