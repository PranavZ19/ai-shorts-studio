from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import json
from app.database import get_db
from app.models.clip import Clip

router = APIRouter(prefix="/api/clips", tags=["Clips"])

class ClipStatusUpdate(BaseModel):
    is_approved: bool

class ClipEditConfigUpdate(BaseModel):
    title: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    edit_config: Optional[dict] = None

@router.get("/")
def list_clips(project_id: Optional[str] = None, approved_only: bool = False, db: Session = Depends(get_db)):
    query = db.query(Clip)
    if project_id:
        query = query.filter(Clip.project_id == project_id)
    if approved_only:
        query = query.filter(Clip.is_approved == True)
    
    clips = query.order_by(Clip.overall_score.desc()).all()
    
    return [
        {
            "id": c.id,
            "project_id": c.project_id,
            "title": c.title,
            "start_time": c.start_time,
            "end_time": c.end_time,
            "duration": c.duration,
            "overall_score": c.overall_score,
            "hook_score": c.hook_score,
            "emotional_score": c.emotional_score,
            "curiosity_score": c.curiosity_score,
            "story_score": c.story_score,
            "information_score": c.information_score,
            "shareability_score": c.shareability_score,
            "score_explanation": c.score_explanation,
            "status": c.status,
            "is_approved": c.is_approved,
            "thumbnail_url": f"/media/thumbnails/{c.id}.jpg" if c.thumbnail_path else None,
            "video_url": f"/media/clips/{c.id}.mp4" if c.output_path else None,
            "ai_metadata": json.loads(c.ai_metadata_json) if c.ai_metadata_json else None,
            "edit_config": json.loads(c.edit_config_json) if c.edit_config_json else None,
            "created_at": c.created_at.isoformat() if c.created_at else None
        }
        for c in clips
    ]

@router.get("/{clip_id}")
def get_clip(clip_id: str, db: Session = Depends(get_db)):
    c = db.query(Clip).filter(Clip.id == clip_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Clip not found")
    return {
        "id": c.id,
        "project_id": c.project_id,
        "title": c.title,
        "start_time": c.start_time,
        "end_time": c.end_time,
        "duration": c.duration,
        "overall_score": c.overall_score,
        "hook_score": c.hook_score,
        "emotional_score": c.emotional_score,
        "curiosity_score": c.curiosity_score,
        "story_score": c.story_score,
        "information_score": c.information_score,
        "shareability_score": c.shareability_score,
        "score_explanation": c.score_explanation,
        "status": c.status,
        "is_approved": c.is_approved,
        "thumbnail_url": f"/media/thumbnails/{c.id}.jpg" if c.thumbnail_path else None,
        "video_url": f"/media/clips/{c.id}.mp4" if c.output_path else None,
        "ai_metadata": json.loads(c.ai_metadata_json) if c.ai_metadata_json else None,
        "edit_config": json.loads(c.edit_config_json) if c.edit_config_json else None,
        "created_at": c.created_at.isoformat() if c.created_at else None
    }

@router.patch("/{clip_id}/approval")
def toggle_clip_approval(clip_id: str, data: ClipStatusUpdate, db: Session = Depends(get_db)):
    c = db.query(Clip).filter(Clip.id == clip_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Clip not found")
    c.is_approved = data.is_approved
    c.status = "approved" if data.is_approved else "rejected"
    db.commit()
    return {"success": True, "clip_id": c.id, "is_approved": c.is_approved, "status": c.status}

@router.put("/{clip_id}")
def update_clip(clip_id: str, data: ClipEditConfigUpdate, db: Session = Depends(get_db)):
    c = db.query(Clip).filter(Clip.id == clip_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Clip not found")
    if data.title:
        c.title = data.title.strip()
    if data.start_time is not None:
        c.start_time = data.start_time
    if data.end_time is not None:
        c.end_time = data.end_time
        c.duration = c.end_time - c.start_time
    if data.edit_config:
        c.edit_config_json = json.dumps(data.edit_config)
    db.commit()
    return {"success": True, "clip_id": c.id}
