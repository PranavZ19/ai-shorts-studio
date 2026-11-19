import os
import re
import uuid
import json
import zipfile
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.clip import Clip
from app.models.project import Project
from app.models.source_video import SourceVideo
from app.models.transcript import Transcript, TranscriptSegment
from app.services.caption_service import caption_service
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/downloads", tags=["Downloads"])

def sanitize_filename(name: str, max_length: int = 50) -> str:
    """Sanitize string for safe usage as a filename across Windows and macOS."""
    if not name:
        return "untitled"
    # Replace illegal filesystem chars
    clean = re.sub(r'[\\/*?:"<>|\x00-\x1f]', '_', name)
    clean = re.sub(r'[\s_]+', '_', clean).strip(" ._")
    if not clean:
        clean = "clip"
    return clean[:max_length]

def cleanup_file_safely(file_path: Path):
    """Safely remove a temporary file in background."""
    try:
        if file_path.exists():
            file_path.unlink(missing_ok=True)
    except Exception as e:
        logger.warning(f"Could not remove temp file {file_path}: {e}")

def stream_video_file(file_path: Path, range_header: Optional[str] = None):
    """
    Stream video file supporting HTTP 206 Partial Content for smooth seeking
    in web video players without loading whole file.
    """
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")

    file_size = file_path.stat().st_size
    content_type = "video/mp4"

    if not range_header:
        def full_iter():
            with open(file_path, "rb") as f:
                while chunk := f.read(1024 * 512):
                    yield chunk
        return StreamingResponse(
            full_iter(),
            status_code=200,
            headers={
                "Content-Type": content_type,
                "Content-Length": str(file_size),
                "Accept-Ranges": "bytes"
            }
        )

    # Parse Range: bytes=start-end
    range_match = re.match(r"bytes=(\d+)-(\d*)", range_header)
    if not range_match:
        raise HTTPException(status_code=416, detail="Invalid Range header")

    start = int(range_match.group(1))
    end = int(range_match.group(2)) if range_match.group(2) else file_size - 1

    if start >= file_size or end >= file_size or start > end:
        raise HTTPException(
            status_code=416,
            detail="Requested range not satisfiable",
            headers={"Content-Range": f"bytes */{file_size}"}
        )

    content_length = end - start + 1

    def range_iter():
        with open(file_path, "rb") as f:
            f.seek(start)
            bytes_left = content_length
            while bytes_left > 0:
                chunk_to_read = min(1024 * 512, bytes_left)
                data = f.read(chunk_to_read)
                if not data:
                    break
                bytes_left -= len(data)
                yield data

    return StreamingResponse(
        range_iter(),
        status_code=206,
        headers={
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": content_type
        }
    )

def _get_clip_filename(clip: Clip, ext: str, suffix: str = "") -> str:
    """Generate professional, descriptive, sanitized filenames."""
    source_title = "source"
    if clip.project:
        source_title = sanitize_filename(clip.project.name, 25)
    clip_title = sanitize_filename(clip.title, 35)
    dur_str = f"{int(round(clip.duration))}s"
    if suffix:
        return f"{source_title}_{clip_title}_{dur_str}_{suffix}.{ext}"
    return f"{source_title}_{clip_title}_{dur_str}.{ext}"

# -------------------------------------------------------------
# Individual Downloads
# -------------------------------------------------------------

@router.get("/clip/{clip_id}/mp4")
def download_clip_mp4(
    clip_id: str,
    download: bool = Query(False, description="Whether to trigger file download attachment"),
    range: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Download or stream the rendered MP4 video.
    If download=True, sets Content-Disposition attachment.
    If range header is provided, handles HTTP 206 partial streaming.
    """
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip or not clip.output_path or not Path(clip.output_path).exists():
        raise HTTPException(status_code=404, detail="Rendered clip MP4 not found on disk")

    file_path = Path(clip.output_path)
    safe_name = _get_clip_filename(clip, "mp4")

    if download:
        return FileResponse(
            path=str(file_path),
            media_type="video/mp4",
            filename=safe_name,
            headers={"Content-Disposition": f'attachment; filename="{safe_name}"'}
        )

    return stream_video_file(file_path, range_header=range)

@router.get("/clip/{clip_id}/stream")
def stream_clip_video(
    clip_id: str,
    range: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Dedicated endpoint for HTML5 video playback with byte-range seeking."""
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip or not clip.output_path or not Path(clip.output_path).exists():
        raise HTTPException(status_code=404, detail="Rendered clip MP4 not found on disk")

    return stream_video_file(Path(clip.output_path), range_header=range)

@router.get("/clip/{clip_id}/srt")
def download_clip_srt(clip_id: str, db: Session = Depends(get_db)):
    """Download standard .srt subtitle file."""
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip or not clip.srt_path or not Path(clip.srt_path).exists():
        raise HTTPException(status_code=404, detail="Subtitle SRT file not found")

    safe_name = _get_clip_filename(clip, "srt")
    return FileResponse(
        path=clip.srt_path,
        media_type="application/x-subrip",
        filename=safe_name,
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'}
    )

@router.get("/clip/{clip_id}/vtt")
def download_clip_vtt(clip_id: str, db: Session = Depends(get_db)):
    """Download WebVTT .vtt subtitle file (generated or converted on the fly if needed)."""
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    vtt_path = Path(clip.vtt_path) if clip.vtt_path else None
    if not vtt_path or not vtt_path.exists():
        # Check if SRT exists to convert to VTT
        if clip.srt_path and Path(clip.srt_path).exists():
            vtt_target = Path(clip.srt_path).with_suffix(".vtt")
            caption_service.srt_to_vtt(Path(clip.srt_path), vtt_target)
            clip.vtt_path = str(vtt_target)
            db.commit()
            vtt_path = vtt_target
        else:
            raise HTTPException(status_code=404, detail="Subtitle file not found for this clip")

    safe_name = _get_clip_filename(clip, "vtt")
    return FileResponse(
        path=str(vtt_path),
        media_type="text/vtt",
        filename=safe_name,
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'}
    )

@router.get("/clip/{clip_id}/thumbnail")
def download_clip_thumbnail(
    clip_id: str,
    download: bool = Query(False),
    db: Session = Depends(get_db)
):
    """Download or view the clip poster thumbnail image."""
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip or not clip.thumbnail_path or not Path(clip.thumbnail_path).exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")

    safe_name = _get_clip_filename(clip, "jpg", suffix="thumb")
    headers = {}
    if download:
        headers["Content-Disposition"] = f'attachment; filename="{safe_name}"'

    return FileResponse(
        path=clip.thumbnail_path,
        media_type="image/jpeg",
        filename=safe_name,
        headers=headers
    )

@router.get("/clip/{clip_id}/metadata")
def download_clip_metadata(clip_id: str, db: Session = Depends(get_db)):
    """Download complete AI metadata and scoring metrics as a formatted JSON file."""
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    ai_meta = json.loads(clip.ai_metadata_json) if clip.ai_metadata_json else {}
    edit_cfg = json.loads(clip.edit_config_json) if clip.edit_config_json else {}

    data = {
        "id": clip.id,
        "title": clip.title,
        "description": clip.description,
        "tags": clip.tags.split(",") if clip.tags else [],
        "source_project_id": clip.project_id,
        "start_time": clip.start_time,
        "end_time": clip.end_time,
        "duration": clip.duration,
        "resolution": clip.resolution or "1080x1920",
        "aspect_ratio": clip.aspect_ratio or "9:16",
        "status": clip.status,
        "is_approved": clip.is_approved,
        "is_favorite": clip.is_favorite,
        "virality_metrics": {
            "overall_score": clip.overall_score,
            "hook_score": clip.hook_score,
            "emotional_score": clip.emotional_score,
            "curiosity_score": clip.curiosity_score,
            "story_score": clip.story_score,
            "information_score": clip.information_score,
            "shareability_score": clip.shareability_score,
            "ending_score": clip.ending_score,
            "clarity_score": clip.clarity_score,
            "hook_summary": clip.hook_summary,
            "score_explanation": clip.score_explanation
        },
        "social_media_packaging": {
            "target_audience": clip.target_audience,
            "suggested_titles": ai_meta.get("titles", []),
            "descriptions": ai_meta.get("descriptions", []),
            "hashtags": ai_meta.get("hashtags", []),
            "key_takeaways": ai_meta.get("key_takeaways", []),
            "pinned_comment": ai_meta.get("pinned_comment", "")
        },
        "render_configuration": edit_cfg,
        "exported_at": clip.updated_at.isoformat() if clip.updated_at else None
    }

    safe_name = _get_clip_filename(clip, "json", suffix="metadata")
    return Response(
        content=json.dumps(data, indent=2, ensure_ascii=False),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'}
    )

@router.get("/clip/{clip_id}/zip")
def download_single_clip_zip(
    clip_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Download a standalone ZIP package for a single clip with video, subs, thumb & meta."""
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    temp_zip = settings.TEMP_DIR / f"single_{clip.id}_{uuid.uuid4().hex[:8]}.zip"
    settings.TEMP_DIR.mkdir(parents=True, exist_ok=True)

    base_name = sanitize_filename(clip.title, 40)
    dur_str = f"{int(round(clip.duration))}s"

    with zipfile.ZipFile(temp_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        # Video
        if clip.output_path and Path(clip.output_path).exists():
            zf.write(clip.output_path, arcname=f"videos/{base_name}_{dur_str}.mp4")

        # Subtitles
        if clip.srt_path and Path(clip.srt_path).exists():
            zf.write(clip.srt_path, arcname=f"subtitles/srt/{base_name}_{dur_str}.srt")

        vtt_p = Path(clip.vtt_path) if clip.vtt_path else (Path(clip.srt_path).with_suffix(".vtt") if clip.srt_path else None)
        if vtt_p and vtt_p.exists():
            zf.write(str(vtt_p), arcname=f"subtitles/vtt/{base_name}_{dur_str}.vtt")
        elif clip.srt_path and Path(clip.srt_path).exists():
            # Convert and write
            vtt_target = settings.TEMP_DIR / f"{clip.id}_conv.vtt"
            caption_service.srt_to_vtt(Path(clip.srt_path), vtt_target)
            if vtt_target.exists():
                zf.write(str(vtt_target), arcname=f"subtitles/vtt/{base_name}_{dur_str}.vtt")
                vtt_target.unlink(missing_ok=True)

        # Thumbnail
        if clip.thumbnail_path and Path(clip.thumbnail_path).exists():
            zf.write(clip.thumbnail_path, arcname=f"thumbnails/{base_name}_thumb.jpg")

        # Metadata
        meta_dict = {
            "title": clip.title,
            "duration": clip.duration,
            "overall_score": clip.overall_score,
            "hook_summary": clip.hook_summary,
            "ai_metadata": json.loads(clip.ai_metadata_json) if clip.ai_metadata_json else {}
        }
        zf.writestr(f"metadata/{base_name}_metadata.json", json.dumps(meta_dict, indent=2))

        # README
        readme_text = (
            f"AI Shorts Studio Export Package\n"
            f"==============================\n"
            f"Clip Title: {clip.title}\n"
            f"Duration: {clip.duration}s\n"
            f"Overall Virality Score: {clip.overall_score}/100\n\n"
            f"Contents:\n"
            f"- videos/ : 1080x1920 9:16 vertical video rendered with NVENC/FFmpeg\n"
            f"- subtitles/ : SubStation Alpha / SRT / WebVTT synchronized captions\n"
            f"- thumbnails/ : Poster JPEG thumbnail\n"
            f"- metadata/ : AI social media titles, descriptions, hashtags & scores\n"
        )
        zf.writestr("README.txt", readme_text)

    background_tasks.add_task(cleanup_file_safely, temp_zip)
    safe_pkg_name = f"{base_name}_{dur_str}_package.zip"

    return FileResponse(
        path=str(temp_zip),
        media_type="application/zip",
        filename=safe_pkg_name,
        headers={"Content-Disposition": f'attachment; filename="{safe_pkg_name}"'}
    )

# -------------------------------------------------------------
# Bulk Downloads
# -------------------------------------------------------------

class BulkZipRequest(BaseModel):
    clip_ids: List[str]
    include_subtitles: Optional[bool] = True
    include_thumbnails: Optional[bool] = True
    include_metadata: Optional[bool] = True
    package_name: Optional[str] = "Selected_Shorts_Package"

@router.post("/bulk/zip")
def download_bulk_clips_zip(
    req: BulkZipRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Download multiple selected completed clips in one organized ZIP archive.
    Builds the archive on disk in TEMP_DIR and streams cleanly without loading into RAM.
    """
    if not req.clip_ids:
        raise HTTPException(status_code=400, detail="No clip IDs provided for bulk export")

    clips = db.query(Clip).filter(Clip.id.in_(req.clip_ids)).all()
    if not clips:
        raise HTTPException(status_code=404, detail="None of the requested clips were found")

    settings.TEMP_DIR.mkdir(parents=True, exist_ok=True)
    temp_zip = settings.TEMP_DIR / f"bulk_{uuid.uuid4().hex[:10]}.zip"

    manifest_clips = []
    file_count = 0

    with zipfile.ZipFile(temp_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for idx, c in enumerate(clips, start=1):
            base_name = f"clip_{idx:02d}_{sanitize_filename(c.title, 30)}_{int(round(c.duration))}s"
            
            # Video
            if c.output_path and Path(c.output_path).exists():
                zf.write(c.output_path, arcname=f"videos/{base_name}.mp4")
                file_count += 1

            # Subtitles
            if req.include_subtitles:
                if c.srt_path and Path(c.srt_path).exists():
                    zf.write(c.srt_path, arcname=f"subtitles/srt/{base_name}.srt")
                vtt_p = Path(c.vtt_path) if c.vtt_path else (Path(c.srt_path).with_suffix(".vtt") if c.srt_path else None)
                if vtt_p and vtt_p.exists():
                    zf.write(str(vtt_p), arcname=f"subtitles/vtt/{base_name}.vtt")
                elif c.srt_path and Path(c.srt_path).exists():
                    vtt_tmp = settings.TEMP_DIR / f"{c.id}_bulk.vtt"
                    caption_service.srt_to_vtt(Path(c.srt_path), vtt_tmp)
                    if vtt_tmp.exists():
                        zf.write(str(vtt_tmp), arcname=f"subtitles/vtt/{base_name}.vtt")
                        vtt_tmp.unlink(missing_ok=True)

            # Thumbnail
            if req.include_thumbnails and c.thumbnail_path and Path(c.thumbnail_path).exists():
                zf.write(c.thumbnail_path, arcname=f"thumbnails/{base_name}_thumb.jpg")

            # Metadata
            clip_meta = {
                "index": idx,
                "title": c.title,
                "duration": c.duration,
                "overall_score": c.overall_score,
                "hook_summary": c.hook_summary,
                "is_approved": c.is_approved,
                "ai_content": json.loads(c.ai_metadata_json) if c.ai_metadata_json else {}
            }
            manifest_clips.append(clip_meta)

            if req.include_metadata:
                zf.writestr(f"metadata/{base_name}_meta.json", json.dumps(clip_meta, indent=2))

        # Manifest
        manifest = {
            "package_name": req.package_name,
            "exported_at": str(Path(temp_zip).name),
            "total_clips": len(clips),
            "clips": manifest_clips
        }
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))

        # README
        readme_content = (
            f"AI Shorts Studio — Bulk Clips Package\n"
            f"====================================\n"
            f"Total Clips: {len(clips)}\n\n"
            f"Folder Structure:\n"
            f"- videos/         : Rendered vertical 9:16 MP4s (1080x1920, 30fps)\n"
            f"- subtitles/srt/  : Synchronized SRT subtitles\n"
            f"- subtitles/vtt/  : Synchronized WebVTT subtitles\n"
            f"- thumbnails/     : High-quality poster thumbnails\n"
            f"- metadata/       : AI metadata, hook summaries, virality scores & tags\n"
            f"- manifest.json   : Machine-readable summary of this package\n"
        )
        zf.writestr("README.txt", readme_content)

    background_tasks.add_task(cleanup_file_safely, temp_zip)
    safe_pkg_name = f"{sanitize_filename(req.package_name or 'Shorts_Package', 40)}.zip"

    return FileResponse(
        path=str(temp_zip),
        media_type="application/zip",
        filename=safe_pkg_name,
        headers={"Content-Disposition": f'attachment; filename="{safe_pkg_name}"'}
    )

@router.get("/bulk/zip")
def download_bulk_clips_get(
    clip_ids: str = Query(..., description="Comma-separated clip IDs"),
    include_subtitles: bool = Query(True),
    include_thumbnails: bool = Query(True),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db)
):
    """GET convenience route for bulk ZIP downloads from direct browser links."""
    ids = [cid.strip() for cid in clip_ids.split(",") if cid.strip()]
    req = BulkZipRequest(
        clip_ids=ids,
        include_subtitles=include_subtitles,
        include_thumbnails=include_thumbnails
    )
    return download_bulk_clips_zip(req, background_tasks, db)

# -------------------------------------------------------------
# Project Export & Backup
# -------------------------------------------------------------

@router.get("/project/{project_id}/zip")
def download_project_zip(
    project_id: str,
    include_source: bool = Query(False, description="Whether to bundle the original full-length source video"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db)
):
    """
    Export complete project backup archive:
    - Original source video (optional)
    - Full transcription & segments (JSON, SRT, VTT)
    - All candidate & rendered clips
    - Subtitles, thumbnails, rendering configs & metadata
    - Manifest and README
    Streamed safely from disk in TEMP_DIR.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    clips = db.query(Clip).filter(Clip.project_id == project_id).all()
    source_videos = db.query(SourceVideo).filter(SourceVideo.project_id == project_id).all()

    settings.TEMP_DIR.mkdir(parents=True, exist_ok=True)
    temp_zip = settings.TEMP_DIR / f"project_{project.id}_{uuid.uuid4().hex[:8]}.zip"

    with zipfile.ZipFile(temp_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        # 1. Project Manifest
        manifest = {
            "project_id": project.id,
            "project_name": project.name,
            "description": project.description,
            "status": project.status,
            "created_at": project.created_at.isoformat() if project.created_at else None,
            "total_source_videos": len(source_videos),
            "total_clips": len(clips),
            "clips_summary": []
        }

        # 2. Source Videos (optional inclusion)
        for sv in source_videos:
            sv_meta = {
                "id": sv.id,
                "title": sv.title,
                "duration": sv.duration_seconds,
                "width": sv.width,
                "height": sv.height,
                "fps": sv.fps,
                "codec": sv.codec
            }
            zf.writestr(f"source_metadata/{sanitize_filename(sv.title, 30)}_meta.json", json.dumps(sv_meta, indent=2))

            if include_source and sv.file_path and Path(sv.file_path).exists():
                sv_filename = sanitize_filename(sv.title, 40) + Path(sv.file_path).suffix
                zf.write(sv.file_path, arcname=f"source_video/{sv_filename}")

            # Transcripts for this video
            transcripts = db.query(Transcript).filter(Transcript.video_id == sv.id).all()
            for t in transcripts:
                segs = db.query(TranscriptSegment).filter(TranscriptSegment.transcript_id == t.id).order_by(TranscriptSegment.segment_index.asc()).all()
                t_data = {
                    "language": t.language,
                    "language_probability": t.language_probability,
                    "full_text": t.full_text,
                    "segments": [
                        {
                            "index": s.segment_index,
                            "start": s.start_time,
                            "end": s.end_time,
                            "text": s.text,
                            "words": json.loads(s.words_json) if s.words_json else []
                        }
                        for s in segs
                    ]
                }
                t_name = f"transcripts/{sanitize_filename(sv.title, 30)}_transcript.json"
                zf.writestr(t_name, json.dumps(t_data, indent=2, ensure_ascii=False))

        # 3. Clips & Rendered Outputs
        for idx, c in enumerate(clips, start=1):
            base_name = f"clip_{idx:02d}_{sanitize_filename(c.title, 30)}_{int(round(c.duration))}s"
            clip_meta = {
                "index": idx,
                "id": c.id,
                "title": c.title,
                "duration": c.duration,
                "overall_score": c.overall_score,
                "hook_summary": c.hook_summary,
                "is_approved": c.is_approved,
                "status": c.status,
                "ai_content": json.loads(c.ai_metadata_json) if c.ai_metadata_json else {},
                "edit_config": json.loads(c.edit_config_json) if c.edit_config_json else {}
            }
            manifest["clips_summary"].append(clip_meta)

            if c.output_path and Path(c.output_path).exists():
                zf.write(c.output_path, arcname=f"videos/{base_name}.mp4")
            if c.srt_path and Path(c.srt_path).exists():
                zf.write(c.srt_path, arcname=f"subtitles/srt/{base_name}.srt")
            if c.vtt_path and Path(c.vtt_path).exists():
                zf.write(c.vtt_path, arcname=f"subtitles/vtt/{base_name}.vtt")
            elif c.srt_path and Path(c.srt_path).exists():
                vtt_conv = settings.TEMP_DIR / f"{c.id}_proj.vtt"
                caption_service.srt_to_vtt(Path(c.srt_path), vtt_conv)
                if vtt_conv.exists():
                    zf.write(str(vtt_conv), arcname=f"subtitles/vtt/{base_name}.vtt")
                    vtt_conv.unlink(missing_ok=True)
            if c.thumbnail_path and Path(c.thumbnail_path).exists():
                zf.write(c.thumbnail_path, arcname=f"thumbnails/{base_name}_thumb.jpg")

            zf.writestr(f"metadata/{base_name}_meta.json", json.dumps(clip_meta, indent=2))

        zf.writestr("project_manifest.json", json.dumps(manifest, indent=2))

        readme = (
            f"AI Shorts Studio — Project Export Archive\n"
            f"==========================================\n"
            f"Project: {project.name}\n"
            f"Exported At: {str(Path(temp_zip).name)}\n"
            f"Source Videos Included: {'Yes' if include_source else 'No (Excluded to reduce ZIP size)'}\n"
            f"Total Clips: {len(clips)}\n\n"
            f"Folder Contents:\n"
            f"- videos/          : Rendered 1080x1920 MP4 video clips\n"
            f"- subtitles/srt/   : SRT subtitles\n"
            f"- subtitles/vtt/   : WebVTT subtitles\n"
            f"- thumbnails/      : Poster image thumbnails\n"
            f"- metadata/        : AI virality scores, hooks & titles\n"
            f"- transcripts/     : Full transcription with word-level timestamps\n"
            f"- project_manifest.json : Master project configuration\n"
        )
        zf.writestr("README.txt", readme)

    background_tasks.add_task(cleanup_file_safely, temp_zip)
    safe_name = f"{sanitize_filename(project.name, 35)}_Project_Backup.zip"

    return FileResponse(
        path=str(temp_zip),
        media_type="application/zip",
        filename=safe_name,
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'}
    )
