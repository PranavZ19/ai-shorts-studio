import uuid
import json
import logging
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from app.database import get_db, SessionLocal
from app.models.clip import Clip
from app.models.source_video import SourceVideo
from app.models.transcript import Transcript, TranscriptSegment
from app.models.job import ProcessingJob
from app.services.clip_finder_service import ClipFinderService
from app.services.caption_service import CaptionService
from app.services.video_render_service import video_render_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/clips", tags=["Clips"])

# In-memory live rendering progress tracker
_active_render_jobs: Dict[str, Dict[str, Any]] = {}

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

class RenderClipRequest(BaseModel):
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    aspect_ratio: Optional[str] = "9:16"
    framing: Optional[str] = "auto_face"
    manual_position: Optional[float] = 0.5
    caption_enabled: Optional[bool] = True
    caption_preset: Optional[str] = "bold_creator"
    font_size: Optional[int] = 28
    text_color: Optional[str] = "#FFFFFF"
    highlight_color: Optional[str] = "#FFCC00"
    outline_color: Optional[str] = "#000000"
    outline_width: Optional[float] = 4.0
    position_y: Optional[float] = 72.0
    audio_volume: Optional[float] = 1.0

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

@router.get("/presets")
def get_caption_presets():
    """Return all available animated caption presets and default styling."""
    return CaptionService.PRESETS

@router.post("/analyze")
def analyze_video_for_clips(req: AnalyzeClipsRequest, db: Session = Depends(get_db)):
    """
    Run intelligent short clip candidate identification on a video's transcript.
    Snaps boundaries to natural speech boundaries, scores viral rubric, formulation of titles/descriptions.
    """
    video = db.query(SourceVideo).filter(SourceVideo.id == req.video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail=f"Source video '{req.video_id}' not found")

    transcript = db.query(Transcript).filter(Transcript.video_id == req.video_id).order_by(Transcript.created_at.desc()).first()
    if not transcript:
        raise HTTPException(
            status_code=400,
            detail=f"Video '{video.title}' has not been transcribed yet. Please run transcription in Phase 3 first."
        )

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
    
    # Cancel rendering if running
    video_render_service.cancel_render(clip_id)
    
    # Remove files if exist
    if c.output_path:
        Path(c.output_path).unlink(missing_ok=True)
    if c.thumbnail_path:
        Path(c.thumbnail_path).unlink(missing_ok=True)
    if c.srt_path:
        Path(c.srt_path).unlink(missing_ok=True)

    db.delete(c)
    db.commit()
    return {"success": True, "deleted_clip_id": clip_id}

# -------------------------------------------------------------
# Phase 5 Video Rendering Endpoints
# -------------------------------------------------------------

def _execute_render_task(
    clip_id: str,
    source_path: Path,
    start_time: float,
    end_time: float,
    segments: List[Dict[str, Any]],
    edit_config: Dict[str, Any],
    job_id: str
):
    """Background execution worker for rendering a clip."""
    def progress_callback(stage: str, pct: int, msg: str):
        _active_render_jobs[clip_id] = {
            "status": "running" if pct < 100 else "completed",
            "stage": stage,
            "progress_pct": pct,
            "message": msg
        }
        # Update job row in SQLite
        db = SessionLocal()
        try:
            job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
            if job:
                job.stage = stage
                job.progress_pct = pct
                job.message = msg
                job.status = "running" if pct < 100 else "completed"
                if pct == 100:
                    job.completed_at = datetime.utcnow()
                db.commit()
        except Exception:
            pass
        finally:
            db.close()

    try:
        render_result = video_render_service.render_clip(
            clip_id=clip_id,
            source_video_path=source_path,
            start_time=start_time,
            end_time=end_time,
            transcript_segments=segments,
            edit_config=edit_config,
            progress_callback=progress_callback
        )

        # Update Clip record in DB
        db = SessionLocal()
        try:
            c = db.query(Clip).filter(Clip.id == clip_id).first()
            if c:
                c.output_path = render_result["output_path"]
                c.thumbnail_path = render_result["thumbnail_path"]
                c.srt_path = render_result["srt_path"]
                c.file_size_bytes = render_result["file_size_bytes"]
                c.duration = render_result["duration"]
                c.status = "exported"
                c.edit_config_json = json.dumps(edit_config)
                db.commit()
        finally:
            db.close()

        _active_render_jobs[clip_id] = {
            "status": "completed",
            "stage": "completed",
            "progress_pct": 100,
            "message": "Rendering complete — ready for download!",
            "result": render_result
        }
    except Exception as e:
        logger.error(f"Render failed for clip {clip_id}: {e}", exc_info=True)
        _active_render_jobs[clip_id] = {
            "status": "failed",
            "stage": "error",
            "progress_pct": 0,
            "message": f"Rendering failed: {str(e)}"
        }
        db = SessionLocal()
        try:
            job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
            if job:
                job.status = "failed"
                job.error_details = str(e)
                job.message = f"Failed: {str(e)}"
                db.commit()
            c = db.query(Clip).filter(Clip.id == clip_id).first()
            if c:
                c.status = "error"
                db.commit()
        finally:
            db.close()

@router.post("/{clip_id}/render")
def render_clip_endpoint(
    clip_id: str,
    req: RenderClipRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Trigger vertical video rendering for an approved or candidate clip.
    Runs face tracking, animated synchronized captions, and NVENC/FFmpeg encoding.
    """
    c = db.query(Clip).filter(Clip.id == clip_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Clip not found")

    video = db.query(SourceVideo).filter(SourceVideo.id == c.video_id).first()
    if not video or not video.file_path or not Path(video.file_path).exists():
        raise HTTPException(status_code=400, detail="Source video file is missing or not found on disk")

    # Fetch transcript segments for captions
    segments_data = []
    transcript = db.query(Transcript).filter(Transcript.video_id == c.video_id).order_by(Transcript.created_at.desc()).first()
    if transcript:
        segments_db = db.query(TranscriptSegment).filter(TranscriptSegment.transcript_id == transcript.id).order_by(TranscriptSegment.segment_index.asc()).all()
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
                "words": words
            })

    # Prepare edit config
    edit_config = {
        "aspect_ratio": req.aspect_ratio or "9:16",
        "framing": req.framing or "auto_face",
        "manual_position": req.manual_position if req.manual_position is not None else 0.5,
        "caption_enabled": bool(req.caption_enabled),
        "caption_preset": req.caption_preset or "bold_creator",
        "font_size": req.font_size or 28,
        "text_color": req.text_color or "#FFFFFF",
        "highlight_color": req.highlight_color or "#FFCC00",
        "outline_color": req.outline_color or "#000000",
        "outline_width": req.outline_width or 4.0,
        "position_y": req.position_y or 72.0,
        "audio_volume": req.audio_volume or 1.0
    }

    start_time = req.start_time if req.start_time is not None else c.start_time
    end_time = req.end_time if req.end_time is not None else c.end_time

    # Update clip parameters in DB
    c.start_time = round(start_time, 2)
    c.end_time = round(end_time, 2)
    c.duration = round(end_time - start_time, 2)
    c.status = "exporting"
    c.edit_config_json = json.dumps(edit_config)

    # Create Job record
    job = ProcessingJob(
        project_id=c.project_id,
        job_type="render_clip",
        stage="preparing_source",
        stage_index=9,
        total_stages=15,
        progress_pct=5.0,
        status="running",
        message="Queued for vertical 9:16 video rendering"
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    _active_render_jobs[clip_id] = {
        "status": "running",
        "stage": "preparing_source",
        "progress_pct": 5,
        "message": "Initializing rendering pipeline..."
    }

    # Execute in background
    background_tasks.add_task(
        _execute_render_task,
        clip_id=c.id,
        source_path=Path(video.file_path),
        start_time=start_time,
        end_time=end_time,
        segments=segments_data,
        edit_config=edit_config,
        job_id=job.id
    )

    return {
        "success": True,
        "clip_id": c.id,
        "job_id": job.id,
        "status": "rendering_started",
        "message": "Vertical video rendering job started in background."
    }

@router.get("/{clip_id}/render-status")
def get_render_status(clip_id: str, db: Session = Depends(get_db)):
    """Poll live rendering status, progress percentage, and stage for a clip."""
    c = db.query(Clip).filter(Clip.id == clip_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Clip not found")

    live_status = _active_render_jobs.get(clip_id)
    if live_status:
        return {
            "clip_id": clip_id,
            "status": live_status["status"],
            "stage": live_status["stage"],
            "progress_pct": live_status["progress_pct"],
            "message": live_status["message"],
            "output_ready": bool(c.output_path and Path(c.output_path).exists()),
            "clip": _serialize_clip(c) if live_status["progress_pct"] == 100 else None
        }

    # If not actively in memory, return persistent database status
    is_ready = bool(c.output_path and Path(c.output_path).exists())
    return {
        "clip_id": clip_id,
        "status": "completed" if is_ready else c.status,
        "stage": "completed" if is_ready else ("error" if c.status == "error" else "idle"),
        "progress_pct": 100 if is_ready else 0,
        "message": "Ready for download" if is_ready else f"Status: {c.status}",
        "output_ready": is_ready,
        "clip": _serialize_clip(c) if is_ready else None
    }

@router.post("/{clip_id}/cancel-render")
def cancel_render_endpoint(clip_id: str, db: Session = Depends(get_db)):
    """Cancel an ongoing rendering job."""
    c = db.query(Clip).filter(Clip.id == clip_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Clip not found")

    cancelled = video_render_service.cancel_render(clip_id)
    _active_render_jobs[clip_id] = {
        "status": "cancelled",
        "stage": "cancelled",
        "progress_pct": 0,
        "message": "Rendering was cancelled by user."
    }
    c.status = "candidate"
    db.commit()

    return {"success": True, "clip_id": clip_id, "cancelled": cancelled}

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

    has_video = bool(c.output_path and Path(c.output_path).exists())
    has_thumb = bool(c.thumbnail_path and Path(c.thumbnail_path).exists())

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
        "status": "exported" if has_video else c.status,
        "is_approved": c.is_approved,
        "has_rendered_video": has_video,
        "file_size_bytes": c.file_size_bytes or (Path(c.output_path).stat().st_size if has_video else 0),
        "thumbnail_url": f"/api/downloads/clip/{c.id}/thumbnail" if has_thumb else (f"/media/thumbnails/{c.id}.jpg" if c.thumbnail_path else None),
        "video_url": f"/api/downloads/clip/{c.id}/mp4" if has_video else None,
        "download_url": f"/api/downloads/clip/{c.id}/mp4" if has_video else None,
        "srt_download_url": f"/api/downloads/clip/{c.id}/srt" if c.srt_path else None,
        "ai_metadata": ai_meta,
        "edit_config": edit_cfg,
        "created_at": c.created_at.isoformat() if c.created_at else None
    }
