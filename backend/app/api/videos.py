import os
import shutil
import uuid
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.source_video import SourceVideo
from app.models.project import Project
from app.config import settings
from app.services.video_analysis_service import video_analysis_service, SUPPORTED_EXTENSIONS
from app.services.upload_service import upload_service
from app.services.youtube_service import youtube_service

router = APIRouter(prefix="/api/videos", tags=["Videos"])

class ChunkInitRequest(BaseModel):
    project_id: str
    filename: str
    total_size: int
    total_chunks: int

class ChunkCompleteRequest(BaseModel):
    upload_id: str

class YouTubeInspectRequest(BaseModel):
    url: str

class YouTubeImportRequest(BaseModel):
    project_id: str
    url: str
    user_authorized: bool  # User confirms they own or have authorization to use this content

@router.get("/")
def list_videos(
    project_id: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = "date_desc",
    db: Session = Depends(get_db)
):
    query = db.query(SourceVideo)
    if project_id:
        query = query.filter(SourceVideo.project_id == project_id)
    if search:
        query = query.filter(SourceVideo.title.ilike(f"%{search.strip()}%"))

    if sort_by == "duration_desc":
        query = query.order_by(SourceVideo.duration_seconds.desc())
    elif sort_by == "duration_asc":
        query = query.order_by(SourceVideo.duration_seconds.asc())
    elif sort_by == "title_asc":
        query = query.order_by(SourceVideo.title.asc())
    elif sort_by == "size_desc":
        query = query.order_by(SourceVideo.file_size_bytes.desc())
    else:  # default date_desc
        query = query.order_by(SourceVideo.created_at.desc())

    videos = query.all()
    results = []
    for v in videos:
        # Determine preview URL
        file_name = Path(v.file_path).name if v.file_path else f"{v.id}.mp4"
        thumb_name = Path(v.thumbnail_path).name if v.thumbnail_path else f"{v.id}.jpg"
        results.append({
            "id": v.id,
            "project_id": v.project_id,
            "title": v.title,
            "source_type": v.source_type,
            "source_url": v.source_url,
            "channel_name": v.channel_name,
            "duration": v.duration_seconds,
            "width": v.width,
            "height": v.height,
            "aspect_ratio": v.aspect_ratio or "16:9",
            "fps": v.fps,
            "codec": v.codec,
            "audio_codec": v.audio_codec,
            "has_audio": v.has_audio,
            "file_size": v.file_size_bytes,
            "status": v.status,
            "thumbnail_url": f"/media/thumbnails/{thumb_name}" if v.thumbnail_path and Path(v.thumbnail_path).exists() else None,
            "preview_url": f"/media/source/{file_name}" if v.file_path and Path(v.file_path).exists() else None,
            "created_at": v.created_at.isoformat() if v.created_at else None
        })
    return results

@router.get("/{video_id}")
def get_video(video_id: str, db: Session = Depends(get_db)):
    v = db.query(SourceVideo).filter(SourceVideo.id == video_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Video not found")

    file_name = Path(v.file_path).name if v.file_path else f"{v.id}.mp4"
    thumb_name = Path(v.thumbnail_path).name if v.thumbnail_path else f"{v.id}.jpg"

    return {
        "id": v.id,
        "project_id": v.project_id,
        "title": v.title,
        "source_type": v.source_type,
        "source_url": v.source_url,
        "channel_name": v.channel_name,
        "duration": v.duration_seconds,
        "width": v.width,
        "height": v.height,
        "aspect_ratio": v.aspect_ratio or "16:9",
        "fps": v.fps,
        "codec": v.codec,
        "audio_codec": v.audio_codec,
        "has_audio": v.has_audio,
        "file_size": v.file_size_bytes,
        "status": v.status,
        "file_path": v.file_path,
        "thumbnail_url": f"/media/thumbnails/{thumb_name}" if v.thumbnail_path and Path(v.thumbnail_path).exists() else None,
        "preview_url": f"/media/source/{file_name}" if v.file_path and Path(v.file_path).exists() else None,
        "created_at": v.created_at.isoformat() if v.created_at else None
    }

# ----------------- UPLOAD ENDPOINTS -----------------

@router.post("/upload/init")
def init_chunked_upload(data: ChunkInitRequest, db: Session = Depends(get_db)):
    proj = db.query(Project).filter(Project.id == data.project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        res = upload_service.init_chunked_upload(
            project_id=data.project_id,
            filename=data.filename,
            total_size=data.total_size,
            total_chunks=data.total_chunks
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/upload/chunk")
async def upload_chunk(
    upload_id: str = Form(...),
    chunk_index: int = Form(...),
    file: UploadFile = File(...)
):
    try:
        chunk_bytes = await file.read()
        res = upload_service.save_chunk(upload_id=upload_id, chunk_index=chunk_index, chunk_bytes=chunk_bytes)
        return res
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save chunk: {str(e)}")

@router.post("/upload/complete")
def complete_chunked_upload(data: ChunkCompleteRequest, db: Session = Depends(get_db)):
    try:
        final_video_path, orig_filename, project_id = upload_service.finalize_chunked_upload(data.upload_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Chunk assembly failed: {str(e)}")

    return _process_and_register_video(final_video_path, orig_filename, project_id, "upload", None, None, db)

@router.post("/upload/direct")
async def direct_stream_upload(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Direct streaming upload for files. Streams chunks of 1MB directly to disk to prevent RAM bloat."""
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    is_valid, msg = video_analysis_service.validate_file_format(file.filename or "")
    if not is_valid:
        raise HTTPException(status_code=400, detail=msg)

    ext = Path(file.filename).suffix.lower()
    video_id = str(uuid.uuid4())
    dest_path = settings.SOURCE_VIDEOS_DIR / f"{video_id}{ext}"

    try:
        # Stream chunks to disk
        with open(dest_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                buffer.write(chunk)
    except Exception as e:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Failed to write uploaded file: {str(e)}")

    return _process_and_register_video(dest_path, file.filename or "uploaded_video.mp4", project_id, "upload", None, None, db)

# ----------------- YOUTUBE ENDPOINTS -----------------

@router.post("/youtube/inspect")
def inspect_youtube_url(data: YouTubeInspectRequest):
    """Inspect YouTube URL and return available metadata without downloading video stream."""
    try:
        info = youtube_service.fetch_metadata(data.url)
        return info
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/youtube/import")
def import_youtube_video(data: YouTubeImportRequest, db: Session = Depends(get_db)):
    """Download and ingest authorized YouTube video."""
    proj = db.query(Project).filter(Project.id == data.project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    if not data.user_authorized:
        raise HTTPException(
            status_code=400,
            detail="You must confirm you own or have permission/authorization to use this content before processing."
        )

    # First fetch metadata to get video title & info
    try:
        meta = youtube_service.fetch_metadata(data.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    video_id = str(uuid.uuid4())
    temp_target = settings.SOURCE_VIDEOS_DIR / f"{video_id}.mp4"

    try:
        final_video_path = youtube_service.download_authorized_video(data.url, temp_target)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return _process_and_register_video(
        final_video_path,
        meta["title"],
        data.project_id,
        "youtube",
        data.url,
        meta.get("channel_name"),
        db
    )

# ----------------- DELETE ENDPOINT -----------------

@router.delete("/{video_id}")
def delete_video(video_id: str, db: Session = Depends(get_db)):
    video = db.query(SourceVideo).filter(SourceVideo.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Safely remove source video file from D:
    if video.file_path and Path(video.file_path).exists():
        try:
            Path(video.file_path).unlink()
        except Exception:
            pass

    # Safely remove thumbnail from D:
    if video.thumbnail_path and Path(video.thumbnail_path).exists():
        try:
            Path(video.thumbnail_path).unlink()
        except Exception:
            pass

    db.delete(video)
    db.commit()
    return {"success": True, "message": "Video and associated files deleted safely."}

# ----------------- HELPER FUNCTION -----------------

def _process_and_register_video(
    file_path: Path,
    original_title: str,
    project_id: str,
    source_type: str,
    source_url: Optional[str],
    channel_name: Optional[str],
    db: Session
) -> dict:
    """Run FFprobe analysis, generate thumbnail, and persist record to SQLite."""
    # 1. FFprobe analysis
    try:
        probe = video_analysis_service.probe_video(file_path)
    except Exception as e:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Video analysis failed: {str(e)}")

    video_id = file_path.stem
    thumb_path = settings.THUMBNAILS_DIR / f"{video_id}.jpg"

    # 2. Thumbnail extraction
    try:
        seek_time = min(1.0, probe["duration"] * 0.1) if probe["duration"] > 0 else 0.0
        video_analysis_service.generate_thumbnail(file_path, thumb_path, seek_time)
    except Exception:
        pass

    # 3. Persist record in SQLite
    video_rec = SourceVideo(
        id=video_id,
        project_id=project_id,
        title=original_title,
        source_type=source_type,
        source_url=source_url,
        channel_name=channel_name,
        file_path=str(file_path),
        file_size_bytes=probe["file_size"],
        duration_seconds=probe["duration"],
        width=probe["width"],
        height=probe["height"],
        aspect_ratio=probe["aspect_ratio"],
        fps=probe["fps"],
        codec=probe["video_codec"],
        audio_codec=probe["audio_codec"],
        has_audio=probe["has_audio"],
        thumbnail_path=str(thumb_path) if thumb_path.exists() else None,
        status="validated"
    )

    db.add(video_rec)
    db.commit()
    db.refresh(video_rec)

    return {
        "id": video_rec.id,
        "project_id": video_rec.project_id,
        "title": video_rec.title,
        "source_type": video_rec.source_type,
        "duration": video_rec.duration_seconds,
        "width": video_rec.width,
        "height": video_rec.height,
        "aspect_ratio": video_rec.aspect_ratio,
        "fps": video_rec.fps,
        "codec": video_rec.codec,
        "audio_codec": video_rec.audio_codec,
        "has_audio": video_rec.has_audio,
        "file_size": video_rec.file_size_bytes,
        "status": video_rec.status,
        "thumbnail_url": f"/media/thumbnails/{thumb_path.name}" if thumb_path.exists() else None,
        "preview_url": f"/media/source/{file_path.name}"
    }
