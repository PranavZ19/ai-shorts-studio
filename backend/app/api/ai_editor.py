import os
import uuid
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.models.source_video import SourceVideo
from app.models.clip import Clip
from app.services.ai_editor_service import ai_editor_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai-editor", tags=["AI Video Editor"])

class AIEditorCommandRequest(BaseModel):
    prompt: str
    video_id: Optional[str] = None
    clip_id: Optional[str] = None
    current_config: Optional[Dict[str, Any]] = None

class AIEditorRenderRequest(BaseModel):
    video_id: Optional[str] = None
    clip_id: Optional[str] = None
    config: Dict[str, Any]

@router.post("/command")
def process_editor_command(data: AIEditorCommandRequest, db: Session = Depends(get_db)):
    """Processes natural language chat commands to edit video, enhance quality, or add Hindi calligraphy."""
    if not data.prompt or not data.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt is required")

    video_meta = {}
    if data.video_id:
        v = db.query(SourceVideo).filter(SourceVideo.id == data.video_id).first()
        if v:
            video_meta = {"title": v.title, "duration": v.duration_seconds}
    elif data.clip_id:
        c = db.query(Clip).filter(Clip.id == data.clip_id).first()
        if c:
            video_meta = {"title": c.title, "duration": c.duration}

    res = ai_editor_service.process_command(
        prompt=data.prompt,
        current_config=data.current_config,
        video_metadata=video_meta
    )
    return res

@router.post("/render")
def render_ai_video(data: AIEditorRenderRequest, db: Session = Depends(get_db)):
    """Executes FFmpeg with hardware acceleration to render the enhanced video with calligraphy and filters."""
    input_path = None
    title_slug = "edited_video"

    if data.clip_id:
        c = db.query(Clip).filter(Clip.id == data.clip_id).first()
        if not c:
            raise HTTPException(status_code=404, detail="Clip not found")
        # If clip has rendered video use it, otherwise use source video with start/end
        if c.output_path and os.path.exists(c.output_path):
            input_path = c.output_path
        else:
            v = db.query(SourceVideo).filter(SourceVideo.id == c.video_id).first()
            if v and v.file_path and os.path.exists(v.file_path):
                input_path = v.file_path
        title_slug = f"clip_{c.id[:8]}"

    elif data.video_id:
        v = db.query(SourceVideo).filter(SourceVideo.id == data.video_id).first()
        if not v:
            raise HTTPException(status_code=404, detail="Video not found")
        if v.file_path and os.path.exists(v.file_path):
            input_path = v.file_path
        title_slug = f"video_{v.id[:8]}"

    if not input_path or not os.path.exists(input_path):
        raise HTTPException(status_code=400, detail="Source video media file is missing on disk")

    out_filename = f"ai_edit_{title_slug}_{uuid.uuid4().hex[:6]}.mp4"
    out_dir = str(settings.EXPORTS_DIR / "ai_edits")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, out_filename)

    try:
        render_res = ai_editor_service.render_edited_video(
            input_video_path=input_path,
            config=data.config,
            output_video_path=out_path
        )
    except Exception as e:
        logger.error(f"Render failed: {e}")
        raise HTTPException(status_code=500, detail=f"Rendering failed: {str(e)}")

    # Relative download/stream url
    video_url = f"/api/downloads/media-file?path={out_path}"

    return {
        "success": True,
        "output_path": out_path,
        "filename": out_filename,
        "file_size_bytes": render_res.get("file_size_bytes", 0),
        "video_url": video_url,
        "config_applied": data.config
    }
