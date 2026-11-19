from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import json
from app.database import get_db
from app.models.transcript import Transcript, TranscriptSegment

router = APIRouter(prefix="/api/transcripts", tags=["Transcripts"])

class SegmentUpdate(BaseModel):
    segment_id: str
    text: str
    speaker: Optional[str] = None

@router.get("/video/{video_id}")
def get_transcript_for_video(video_id: str, db: Session = Depends(get_db)):
    transcript = db.query(Transcript).filter(Transcript.video_id == video_id).first()
    if not transcript:
        return {"found": False, "segments": []}
    
    segments = db.query(TranscriptSegment).filter(
        TranscriptSegment.transcript_id == transcript.id
    ).order_by(TranscriptSegment.start_time.asc()).all()

    return {
        "found": True,
        "transcript_id": transcript.id,
        "language": transcript.language,
        "full_text": transcript.full_text,
        "segments": [
            {
                "id": s.id,
                "segment_index": s.segment_index,
                "start_time": s.start_time,
                "end_time": s.end_time,
                "text": s.text,
                "speaker": s.speaker,
                "words": json.loads(s.words_json) if s.words_json else []
            }
            for s in segments
        ]
    }

@router.put("/segments/{segment_id}")
def update_transcript_segment(segment_id: str, data: SegmentUpdate, db: Session = Depends(get_db)):
    seg = db.query(TranscriptSegment).filter(TranscriptSegment.id == segment_id).first()
    if not seg:
        raise HTTPException(status_code=404, detail="Segment not found")
    seg.text = data.text.strip()
    if data.speaker:
        seg.speaker = data.speaker.strip()
    db.commit()
    return {"success": True, "segment_id": seg.id, "text": seg.text, "speaker": seg.speaker}
