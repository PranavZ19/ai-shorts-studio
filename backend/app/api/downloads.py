import os
import io
import zipfile
import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.clip import Clip
from app.models.project import Project
from app.config import settings

router = APIRouter(prefix="/api/downloads", tags=["Downloads"])

@router.get("/clip/{clip_id}/mp4")
def download_clip_mp4(clip_id: str, db: Session = Depends(get_db)):
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip or not clip.output_path or not Path(clip.output_path).exists():
        raise HTTPException(status_code=404, detail="Rendered clip MP4 not found")
    safe_name = f"{clip.title.replace(' ', '_')[:50]}.mp4"
    return FileResponse(
        path=clip.output_path,
        media_type="video/mp4",
        filename=safe_name
    )

@router.get("/clip/{clip_id}/srt")
def download_clip_srt(clip_id: str, db: Session = Depends(get_db)):
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip or not clip.srt_path or not Path(clip.srt_path).exists():
        raise HTTPException(status_code=404, detail="Subtitle SRT file not found")
    return FileResponse(
        path=clip.srt_path,
        media_type="application/x-subrip",
        filename=f"{clip.title.replace(' ', '_')[:50]}.srt"
    )

@router.get("/clip/{clip_id}/thumbnail")
def download_clip_thumbnail(clip_id: str, db: Session = Depends(get_db)):
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip or not clip.thumbnail_path or not Path(clip.thumbnail_path).exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    return FileResponse(
        path=clip.thumbnail_path,
        media_type="image/jpeg",
        filename=f"{clip.title.replace(' ', '_')[:50]}_thumb.jpg"
    )

@router.get("/project/{project_id}/zip")
def download_project_zip(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    clips = db.query(Clip).filter(Clip.project_id == project_id).all()
    if not clips:
        raise HTTPException(status_code=400, detail="No clips available in this project")

    # Build ZIP package in memory or temp file
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        metadata_summary = {
            "project_name": project.name,
            "project_id": project.id,
            "created_at": project.created_at.isoformat() if project.created_at else None,
            "clips": []
        }

        for idx, c in enumerate(clips, start=1):
            clip_meta = {
                "index": idx,
                "title": c.title,
                "duration": c.duration,
                "overall_score": c.overall_score,
                "score_explanation": c.score_explanation,
                "is_approved": c.is_approved,
                "ai_content": json.loads(c.ai_metadata_json) if c.ai_metadata_json else {}
            }
            metadata_summary["clips"].append(clip_meta)

            prefix = f"clip_{idx:02d}_{c.title.replace(' ', '_')[:30]}"
            if c.output_path and Path(c.output_path).exists():
                zf.write(c.output_path, arcname=f"{prefix}/{prefix}.mp4")
            if c.srt_path and Path(c.srt_path).exists():
                zf.write(c.srt_path, arcname=f"{prefix}/{prefix}.srt")
            if c.thumbnail_path and Path(c.thumbnail_path).exists():
                zf.write(c.thumbnail_path, arcname=f"{prefix}/{prefix}_thumb.jpg")

            # Write clip metadata
            zf.writestr(f"{prefix}/metadata.json", json.dumps(clip_meta, indent=2))

        zf.writestr("project_manifest.json", json.dumps(metadata_summary, indent=2))

    zip_buffer.seek(0)
    safe_filename = f"{project.name.replace(' ', '_')[:40]}_Shorts_Package.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'}
    )
