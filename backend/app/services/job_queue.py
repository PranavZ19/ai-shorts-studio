import asyncio
from datetime import datetime
from typing import Dict, List, Callable, Any, Optional
from sqlalchemy.orm import Session
from app.models.job import ProcessingJob
from app.database import SessionLocal

PIPELINE_STAGES = [
    (1, "validating_video", "Validating video format and integrity"),
    (2, "retrieving_metadata", "Extracting video duration, resolution, and codecs"),
    (3, "preparing_source", "Preparing and organizing source video files"),
    (4, "extracting_audio", "Extracting high-fidelity 16kHz audio stream"),
    (5, "transcribing", "Transcribing speech with Faster-Whisper"),
    (6, "analyzing_transcript", "Analyzing conversation dynamics and hooks"),
    (7, "finding_candidates", "Identifying high-engagement candidate moments"),
    (8, "scoring_clips", "Computing heuristic and AI virality scores"),
    (9, "extracting_clips", "Extracting precise cut segments"),
    (10, "cropping_vertical", "Performing AI speaker face tracking & 9:16 vertical cropping"),
    (11, "generating_captions", "Generating synchronized animated captions"),
    (12, "rendering", "Rendering final vertical video with NVENC/FFmpeg"),
    (13, "validating_outputs", "Validating exported clip quality and audio sync"),
    (14, "saving_files", "Generating thumbnails and saving metadata"),
    (15, "ready_for_review", "Processing complete — ready for review and download")
]

class JobQueue:
    def __init__(self):
        self._listeners: Dict[str, List[asyncio.Queue]] = {}

    def subscribe(self, job_id: str) -> asyncio.Queue:
        if job_id not in self._listeners:
            self._listeners[job_id] = []
        q = asyncio.Queue()
        self._listeners[job_id].append(q)
        return q

    def unsubscribe(self, job_id: str, q: asyncio.Queue):
        if job_id in self._listeners:
            try:
                self._listeners[job_id].remove(q)
                if not self._listeners[job_id]:
                    del self._listeners[job_id]
            except ValueError:
                pass

    async def update_job_stage(
        self,
        job_id: str,
        stage_index: int,
        status: str = "running",
        message: Optional[str] = None,
        error_details: Optional[str] = None
    ):
        db: Session = SessionLocal()
        try:
            job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
            if not job:
                return

            if stage_index >= 1 and stage_index <= len(PIPELINE_STAGES):
                idx, stage_code, default_msg = PIPELINE_STAGES[stage_index - 1]
                job.stage = stage_code
                job.stage_index = idx
                job.progress_pct = round((idx / len(PIPELINE_STAGES)) * 100, 1)
                job.message = message or default_msg

            job.status = status
            if status == "running" and not job.started_at:
                job.started_at = datetime.utcnow()
            elif status in ["completed", "failed", "cancelled"]:
                job.completed_at = datetime.utcnow()

            if error_details:
                job.error_details = error_details

            db.commit()

            # Broadcast to SSE listeners
            payload = {
                "job_id": job.id,
                "project_id": job.project_id,
                "stage": job.stage,
                "stage_index": job.stage_index,
                "total_stages": job.total_stages,
                "progress_pct": job.progress_pct,
                "status": job.status,
                "message": job.message,
                "error_details": job.error_details
            }

            if job_id in self._listeners:
                for q in self._listeners[job_id]:
                    await q.put(payload)

        finally:
            db.close()

job_queue = JobQueue()
