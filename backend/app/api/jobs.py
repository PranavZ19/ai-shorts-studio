import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.job import ProcessingJob
from app.services.job_queue import job_queue

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])

@router.get("/")
def list_jobs(project_id: str = None, db: Session = Depends(get_db)):
    q = db.query(ProcessingJob)
    if project_id:
        q = q.filter(ProcessingJob.project_id == project_id)
    jobs = q.order_by(ProcessingJob.created_at.desc()).limit(50).all()
    return [
        {
            "id": j.id,
            "project_id": j.project_id,
            "job_type": j.job_type,
            "stage": j.stage,
            "stage_index": j.stage_index,
            "total_stages": j.total_stages,
            "progress_pct": j.progress_pct,
            "status": j.status,
            "message": j.message,
            "error_details": j.error_details,
            "created_at": j.created_at.isoformat() if j.created_at else None
        }
        for j in jobs
    ]

@router.post("/{job_id}/cancel")
def cancel_job(job_id: str, db: Session = Depends(get_db)):
    """Cancel a running processing job."""
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.status = "cancelled"
    job.message = "Cancelled by user"
    db.commit()
    job_queue.publish(job_id, {
        "status": "cancelled",
        "progress_pct": 0,
        "message": "Cancelled by user"
    })
    return {"success": True, "job_id": job_id, "status": "cancelled"}

@router.post("/{job_id}/retry")
def retry_job(job_id: str, db: Session = Depends(get_db)):
    """Reset a failed or interrupted job for re-execution."""
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.status = "pending"
    job.progress_pct = 0.0
    job.message = "Queued for retry"
    job.error_details = None
    db.commit()
    return {"success": True, "job_id": job_id, "status": "pending"}
async def stream_job_progress(job_id: str):
    """Server-Sent Events (SSE) stream for real-time progress updates across the 15 stages."""
    async def event_generator():
        q = job_queue.subscribe(job_id)
        try:
            while True:
                data = await q.get()
                yield f"data: {json.dumps(data)}\n\n"
                if data.get("status") in ["completed", "failed", "cancelled"]:
                    break
        finally:
            job_queue.unsubscribe(job_id, q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
