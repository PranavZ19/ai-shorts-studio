import uuid
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from app.database import get_db
from app.models.clip import Clip
from app.models.source_video import SourceVideo
from app.models.transcript import Transcript, TranscriptSegment
from app.services.clip_finder_service import ClipFinderService

router = APIRouter(prefix="/api/clips", tags=["Clips"])

class AnalyzeClipsRequest(BaseModel):
    video_id: str
    target_count: Optional[int] = 5
    target_duration: Optional[float] = 45.0
    min_duration: Optional[float] = 20.0
    max_duration: Optional[float] = 75.0
    model_name: Optional[str] = None
    force_heuristic: Optional[bool] = False

class ClipStatusUpdate(BaseModel):
    is_approved: bool

class ClipEditConfigUpdate(BaseModel):
    title: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    target_audience: Optional[str] = None
    edit_config: Optional[dict] = None
    ai_metadata: Optional[dict] = None

@router.get("/status")
def get_clip_engine_status():
    """Check Ollama connectivity and available models for clip selection."""
    service = ClipFinderService()
    ollama_ok, models = service.is_ollama_available()
    return {
        "ollama_available": ollama_ok,
        "available_models": models,
        "recommended_model": "qwen2.5:3b",
        "heuristic_fallback_available": True
    }

@router.post("/analyze")
def analyze_video_for_clips(req: AnalyzeClipsRequest, db: Session = Depends(get_db)):
    """
    Run intelligent short clip candidate identification on a video's transcript.
    Snaps boundaries to natural speech boundaries, scores viral rubric, formulation of titles/descriptions.
    """
    # 1. Fetch SourceVideo
    video = db.query(SourceVideo).filter(SourceVideo.id == req.video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail=f"Source video '{req.video_id}' not found")

    # 2. Fetch Transcript
    transcript = db.query(Transcript).filter(Transcript.video_id == req.video_id).order_by(Transcript.created_at.desc()).first()
    if not transcript:
        raise HTTPException(
            status_code=400,
            detail=f"Video '{video.title}' has not been transcribed yet. Please run transcription in Phase 3 first."
        )

    # 3. Assemble transcript data with segments and word timestamps
    segments_db = db.query(TranscriptSegment).filter(TranscriptSegment.transcript_id == transcript.id).order_by(TranscriptSegment.segment_index.asc()).all()
    if not segments_db:
        raise HTTPException(status_code=400, detail="Transcript contains no segments")

    segments_data = []
    for s in segments_db:
        words = []
        if s.words_json:
            try:
                words = json.loads(s.words_json)
            except Exception:
                words = []
        segments_data.append({
            "segment_index": s.segment_index,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "text": s.text,
            "words": words,
            "speaker": s.speaker or "Speaker 1"
        })

    transcript_payload = {
        "language": transcript.language,
        "language_probability": transcript.language_probability,
        "full_text": transcript.full_text,
        "segments": segments_data
    }

    # 4. Run clip finder
    service = ClipFinderService()
    try:
        candidates = service.find_clips(
            transcript_data=transcript_payload,
            model_name=req.model_name,
            target_count=req.target_count or 5,
            target_duration=req.target_duration or 45.0,
            min_duration=req.min_duration or 20.0,
            max_duration=req.max_duration or 75.0,
            force_heuristic=bool(req.force_heuristic),
            video_metadata={"title": video.title, "duration": video.duration_seconds}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clip selection failed: {str(e)}")

    if not candidates:
        raise HTTPException(status_code=400, detail="No suitable short clip moments could be identified from the transcript.")

    # 5. Persist candidates into database
    created_clips = []
    for c in candidates:
        clip_row = Clip(
            project_id=video.project_id,
            video_id=video.id,
            title=c["title"],
            main_topic=c.get("main_topic", "Highlight"),
            start_time=c["start_time"],
            end_time=c["end_time"],
            duration=c["duration"],
            overall_score=c.get("overall_score", 70.0),
            hook_score=c.get("hook_score", 70.0),
            emotional_score=c.get("emotional_score", 70.0),
            curiosity_score=c.get("curiosity_score", 70.0),
            story_score=c.get("story_score", 70.0),
            information_score=c.get("information_score", 70.0),
            shareability_score=c.get("shareability_score", 70.0),
            ending_score=c.get("ending_score", 70.0),
            clarity_score=c.get("clarity_score", 70.0),
            hook_summary=c.get("hook_summary", ""),
            target_audience=c.get("target_audience", "Social Media Viewers"),
            score_explanation=c.get("score_explanation", ""),
            analysis_mode=c.get("analysis_mode", "heuristic_fallback"),
            status="candidate",
            is_approved=False,
            ai_metadata_json=json.dumps(c.get("ai_metadata", {}))
        )
        db.add(clip_row)
        created_clips.append(clip_row)

    db.commit()

    # Re-query and serialize
    response_items = []
    for row in created_clips:
        db.refresh(row)
        response_items.append(_serialize_clip(row))

    return {
        "success": True,
        "video_id": video.id,
        "video_title": video.title,
        "clips_found": len(response_items),
        "analysis_mode": created_clips[0].analysis_mode if created_clips else "none",
        "clips": response_items
    }

@router.get("/")
def list_clips(
    video_id: Optional[str] = None,
    project_id: Optional[str] = None,
    approved_only: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(Clip)
    if video_id:
        query = query.filter(Clip.video_id == video_id)
    if project_id:
        query = query.filter(Clip.project_id == project_id)
    if approved_only:
        query = query.filter(Clip.is_approved == True)
    
    clips = query.order_by(Clip.overall_score.desc()).all()
    return [_serialize_clip(c) for c in clips]

@router.get("/{clip_id}")
def get_clip(clip_id: str, db: Session = Depends(get_db)):
    c = db.query(Clip).filter(Clip.id == clip_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Clip not found")
    return _serialize_clip(c)

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
    if data.title is not None:
        c.title = data.title.strip()
    if data.target_audience is not None:
        c.target_audience = data.target_audience.strip()
    if data.start_time is not None:
        c.start_time = round(data.start_time, 2)
    if data.end_time is not None:
        c.end_time = round(data.end_time, 2)
    if c.start_time is not None and c.end_time is not None:
        c.duration = round(c.end_time - c.start_time, 2)
    if data.edit_config is not None:
        c.edit_config_json = json.dumps(data.edit_config)
    if data.ai_metadata is not None:
        c.ai_metadata_json = json.dumps(data.ai_metadata)
    
    db.commit()
    return {"success": True, "clip_id": c.id, "clip": _serialize_clip(c)}

@router.delete("/{clip_id}")
def delete_clip(clip_id: str, db: Session = Depends(get_db)):
    c = db.query(Clip).filter(Clip.id == clip_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Clip not found")
    db.delete(c)
    db.commit()
    return {"success": True, "deleted_clip_id": clip_id}

def _serialize_clip(c: Clip) -> Dict[str, Any]:
    ai_meta = {}
    if c.ai_metadata_json:
        try:
            ai_meta = json.loads(c.ai_metadata_json)
        except Exception:
            ai_meta = {}

    edit_cfg = {}
    if c.edit_config_json:
        try:
            edit_cfg = json.loads(c.edit_config_json)
        except Exception:
            edit_cfg = {}

    return {
        "id": c.id,
        "project_id": c.project_id,
        "video_id": c.video_id,
        "title": c.title,
        "main_topic": c.main_topic,
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
        "ending_score": c.ending_score,
        "clarity_score": c.clarity_score,
        "hook_summary": c.hook_summary,
        "target_audience": c.target_audience,
        "score_explanation": c.score_explanation,
        "analysis_mode": c.analysis_mode,
        "status": c.status,
        "is_approved": c.is_approved,
        "thumbnail_url": f"/media/thumbnails/{c.id}.jpg" if c.thumbnail_path else None,
        "video_url": f"/media/clips/{c.id}.mp4" if c.output_path else None,
        "ai_metadata": ai_meta,
        "edit_config": edit_cfg,
        "created_at": c.created_at.isoformat() if c.created_at else None
    }
