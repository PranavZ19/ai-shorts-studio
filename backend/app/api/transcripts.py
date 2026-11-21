import json
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.transcript import Transcript, TranscriptSegment
from app.models.source_video import SourceVideo
from app.services.transcription_service import transcription_service

router = APIRouter(prefix="/api/transcripts", tags=["Transcripts"])

# In-memory real-time transcription progress tracker
_active_transcription_jobs: Dict[str, Dict[str, Any]] = {}

class TranscribeRequest(BaseModel):
    model_name: Optional[str] = "base"
    language: Optional[str] = "auto"
    force_cpu: Optional[bool] = False

class SegmentUpdate(BaseModel):
    text: str
    speaker: Optional[str] = None

@router.get("/video/{video_id}")
def get_transcript_for_video(video_id: str, db: Session = Depends(get_db)):
    video = db.query(SourceVideo).filter(SourceVideo.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    transcript = db.query(Transcript).filter(Transcript.video_id == video_id).first()
    if not transcript:
        return {
            "found": False,
            "video_id": video.id,
            "video_title": video.title,
            "segments": []
        }

    segments = db.query(TranscriptSegment).filter(
        TranscriptSegment.transcript_id == transcript.id
    ).order_by(TranscriptSegment.start_time.asc()).all()

    return {
        "found": True,
        "transcript_id": transcript.id,
        "video_id": video.id,
        "video_title": video.title,
        "language": transcript.language,
        "language_probability": transcript.language_probability,
        "model_name": transcript.model_name,
        "device_used": transcript.device_used,
        "is_edited": transcript.is_edited,
        "full_text": transcript.full_text,
        "created_at": transcript.created_at.isoformat() if transcript.created_at else None,
        "segments": [
            {
                "id": s.id,
                "segment_index": s.segment_index,
                "start_time": s.start_time,
                "end_time": s.end_time,
                "text": s.text,
                "original_text": s.original_text,
                "is_edited": s.is_edited,
                "speaker": s.speaker,
                "words": json.loads(s.words_json) if s.words_json else []
            }
            for s in segments
        ]
    }

@router.get("/video/{video_id}/progress")
def get_transcription_progress(video_id: str):
    """Retrieve real-time transcription progress percentage and status message."""
    return _active_transcription_jobs.get(video_id, {
        "status": "idle",
        "progress_pct": 0,
        "stage": "idle",
        "message": ""
    })

@router.post("/video/{video_id}/transcribe")
def transcribe_video_endpoint(
    video_id: str,
    data: TranscribeRequest,
    db: Session = Depends(get_db)
):
    video = db.query(SourceVideo).filter(SourceVideo.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if not video.file_path or not Path(video.file_path).exists():
        raise HTTPException(status_code=400, detail="Video file is missing on storage disk")

    if not video.has_audio:
        raise HTTPException(status_code=400, detail="This video does not have an audio stream to transcribe")

    video_path = Path(video.file_path)

    _active_transcription_jobs[video_id] = {
        "status": "running",
        "progress_pct": 5,
        "stage": "starting",
        "message": "Initializing local speech pipeline..."
    }

    def on_progress(stage: str, pct: int, msg: str):
        _active_transcription_jobs[video_id] = {
            "status": "running",
            "progress_pct": pct,
            "stage": stage,
            "message": msg
        }

    try:
        # Run local Faster-Whisper transcription with progress callback
        result = transcription_service.transcribe_video(
            video_path=video_path,
            model_name=data.model_name or "base",
            language=data.language if data.language != "auto" else None,
            force_cpu=data.force_cpu or False,
            progress_callback=on_progress
        )
    except Exception as e:
        _active_transcription_jobs[video_id] = {
            "status": "failed",
            "progress_pct": 0,
            "stage": "error",
            "message": f"Transcription failed: {str(e)}"
        }
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    # Clean existing transcript if re-transcribing
    existing = db.query(Transcript).filter(Transcript.video_id == video_id).first()
    if existing:
        db.delete(existing)
        db.commit()

    # Save to SQLite
    transcript = Transcript(
        video_id=video.id,
        language=result["language"],
        language_probability=result["language_probability"],
        model_name=result["model_name"],
        device_used=result["device_used"],
        full_text=result["full_text"],
        is_edited=False
    )
    db.add(transcript)
    db.commit()
    db.refresh(transcript)

    # Save segments
    for s in result["segments"]:
        seg_rec = TranscriptSegment(
            transcript_id=transcript.id,
            segment_index=s["segment_index"],
            start_time=s["start_time"],
            end_time=s["end_time"],
            text=s["text"],
            original_text=s["text"],
            is_edited=False,
            speaker=s["speaker"],
            words_json=json.dumps(s["words"])
        )
        db.add(seg_rec)

    video.status = "transcribed"
    db.commit()

    _active_transcription_jobs[video_id] = {
        "status": "completed",
        "progress_pct": 100,
        "stage": "completed",
        "message": "Transcription complete!"
    }

    return {
        "success": True,
        "transcript_id": transcript.id,
        "language": transcript.language,
        "language_probability": transcript.language_probability,
        "model_name": transcript.model_name,
        "device_used": transcript.device_used,
        "segment_count": len(result["segments"]),
        "full_text": transcript.full_text
    }

@router.put("/segments/{segment_id}")
def update_transcript_segment(
    segment_id: str,
    data: SegmentUpdate,
    db: Session = Depends(get_db)
):
    seg = db.query(TranscriptSegment).filter(TranscriptSegment.id == segment_id).first()
    if not seg:
        raise HTTPException(status_code=404, detail="Transcript segment not found")

    new_text = data.text.strip()
    if not seg.original_text:
        seg.original_text = seg.text

    seg.text = new_text
    seg.is_edited = (new_text != seg.original_text)
    if data.speaker:
        seg.speaker = data.speaker.strip()

    # Mark transcript as edited
    transcript = db.query(Transcript).filter(Transcript.id == seg.transcript_id).first()
    if transcript:
        transcript.is_edited = True
        # Rebuild full text
        all_segs = db.query(TranscriptSegment).filter(
            TranscriptSegment.transcript_id == transcript.id
        ).order_by(TranscriptSegment.start_time.asc()).all()
        transcript.full_text = " ".join([s.text for s in all_segs])

    db.commit()

    return {
        "success": True,
        "segment_id": seg.id,
        "text": seg.text,
        "original_text": seg.original_text,
        "is_edited": seg.is_edited,
        "speaker": seg.speaker
    }

@router.get("/{transcript_id}/export")
def export_subtitles(
    transcript_id: str,
    format: str = Query("srt", pattern="^(srt|vtt)$"),
    db: Session = Depends(get_db)
):
    transcript = db.query(Transcript).filter(Transcript.id == transcript_id).first()
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    segments = db.query(TranscriptSegment).filter(
        TranscriptSegment.transcript_id == transcript.id
    ).order_by(TranscriptSegment.start_time.asc()).all()

    segs_data = [
        {"start_time": s.start_time, "end_time": s.end_time, "text": s.text}
        for s in segments
    ]

    if format == "vtt":
        content = transcription_service.generate_vtt(segs_data)
        media_type = "text/vtt"
        filename = f"subtitles_{transcript_id[:8]}.vtt"
    else:
        content = transcription_service.generate_srt(segs_data)
        media_type = "application/x-subrip"
        filename = f"subtitles_{transcript_id[:8]}.srt"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
