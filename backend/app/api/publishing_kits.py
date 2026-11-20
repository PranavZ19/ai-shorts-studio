import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.clip import Clip
from app.models.project import Project
from app.models.publishing_kit import PublishingKit
from app.models.strategy import ScheduledPost
from app.services.publishing_service import PublishingService

router = APIRouter(prefix="/api/publishing-kits", tags=["Publishing Kit"])

# ----------------- PYDANTIC SCHEMAS -----------------

class GenerateKitRequest(BaseModel):
    clip_id: str
    channel_profile_id: Optional[str] = None
    model_name: Optional[str] = "qwen2.5:3b"
    regenerate_platform: Optional[str] = None  # None, "youtube", or "instagram"

class RegeneratePartRequest(BaseModel):
    platform: str = Field(..., pattern="^(youtube|instagram|both)$")
    field_name: Optional[str] = None  # e.g. "titles", "description", "captions", "hashtags"
    model_name: Optional[str] = "qwen2.5:3b"

class UpdatePublishingKitRequest(BaseModel):
    yt_primary_title_index: Optional[int] = None
    yt_titles_json: Optional[str] = None
    yt_description_short: Optional[str] = None
    yt_description_alt: Optional[str] = None
    yt_description_seo: Optional[str] = None
    yt_selected_description: Optional[str] = None
    yt_hashtags_json: Optional[str] = None
    yt_tags_csv: Optional[str] = None
    yt_pinned_comment: Optional[str] = None
    yt_cta: Optional[str] = None

    ig_selected_caption_index: Optional[int] = None
    ig_captions_json: Optional[str] = None
    ig_hashtags_json: Optional[str] = None
    ig_first_line_hook: Optional[str] = None
    ig_cta: Optional[str] = None
    ig_audio_direction: Optional[str] = None

    status: Optional[str] = None
    published_url: Optional[str] = None
    scheduled_post_id: Optional[str] = None

class MarkPublishedRequest(BaseModel):
    published_url: Optional[str] = None
    published_at: Optional[str] = None

# ----------------- ENDPOINTS -----------------

@router.get("/")
def list_publishing_kits(
    project_id: Optional[str] = None,
    clip_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Lists saved publishing kits with clip and project metadata."""
    query = db.query(PublishingKit)
    if project_id:
        query = query.filter(PublishingKit.project_id == project_id)
    if clip_id:
        query = query.filter(PublishingKit.clip_id == clip_id)
    if status:
        query = query.filter(PublishingKit.status == status)

    kits = query.order_by(PublishingKit.updated_at.desc()).all()

    results = []
    for k in kits:
        clip = db.query(Clip).filter(Clip.id == k.clip_id).first()
        yt_titles = json.loads(k.yt_titles_json or "[]")
        primary_title = yt_titles[k.yt_primary_title_index]["title"] if yt_titles and len(yt_titles) > k.yt_primary_title_index else (clip.title if clip else "Untitled Short")

        if search:
            search_lower = search.lower()
            if search_lower not in primary_title.lower() and search_lower not in (clip.title or "").lower():
                continue

        results.append({
            "id": k.id,
            "clip_id": k.clip_id,
            "project_id": k.project_id,
            "video_id": k.video_id,
            "primary_title": primary_title,
            "clip_title": clip.title if clip else None,
            "thumbnail_url": f"/media/thumbnails/{clip.thumbnail_path.split('/')[-1]}" if clip and clip.thumbnail_path else None,
            "duration": clip.duration if clip else 30.0,
            "status": k.status,
            "language": k.language,
            "published_url": k.published_url,
            "scheduled_post_id": k.scheduled_post_id,
            "created_at": k.created_at.isoformat() if k.created_at else None,
            "updated_at": k.updated_at.isoformat() if k.updated_at else None
        })

    return results

@router.get("/{kit_id}")
def get_publishing_kit(kit_id: str, db: Session = Depends(get_db)):
    """Retrieves full platform details for a publishing kit."""
    kit = db.query(PublishingKit).filter(PublishingKit.id == kit_id).first()
    if not kit:
        raise HTTPException(status_code=404, detail="Publishing kit not found")

    clip = db.query(Clip).filter(Clip.id == kit.clip_id).first()
    service = PublishingService(db)

    return {
        "id": kit.id,
        "clip_id": kit.clip_id,
        "project_id": kit.project_id,
        "video_id": kit.video_id,
        "channel_profile_id": kit.channel_profile_id,
        "scheduled_post_id": kit.scheduled_post_id,
        "status": kit.status,
        "language": kit.language,
        "published_url": kit.published_url,
        "clip_transcript_used": kit.clip_transcript_used,
        "clip": {
            "title": clip.title if clip else "Untitled",
            "duration": clip.duration if clip else 30.0,
            "overall_score": clip.overall_score if clip else 70.0,
            "thumbnail_url": f"/media/thumbnails/{clip.thumbnail_path.split('/')[-1]}" if clip and clip.thumbnail_path else None,
            "stream_url": f"/api/downloads/clip/{clip.id}/stream" if clip else None,
            "output_path": clip.output_path if clip else None,
            "aspect_ratio": "9:16",
            "resolution": "1080x1920"
        } if clip else None,
        "youtube": {
            "primary_title_index": kit.yt_primary_title_index,
            "titles": json.loads(kit.yt_titles_json or "[]"),
            "description_short": kit.yt_description_short,
            "description_alt": kit.yt_description_alt,
            "description_seo": kit.yt_description_seo,
            "selected_description": kit.yt_selected_description,
            "hashtags": json.loads(kit.yt_hashtags_json or "{}"),
            "tags_csv": kit.yt_tags_csv,
            "category": kit.yt_category,
            "pinned_comment": kit.yt_pinned_comment,
            "thumbnail_texts": json.loads(kit.yt_thumbnail_texts_json or "[]"),
            "playlist_topic": kit.yt_playlist_topic,
            "audience_positioning": kit.yt_audience_positioning,
            "cta": kit.yt_cta
        },
        "instagram": {
            "selected_caption_index": kit.ig_selected_caption_index,
            "captions": json.loads(kit.ig_captions_json or "[]"),
            "hashtags": json.loads(kit.ig_hashtags_json or "{}"),
            "cover_texts": json.loads(kit.ig_cover_texts_json or "[]"),
            "first_line_hook": kit.ig_first_line_hook,
            "cta": kit.ig_cta,
            "keywords_csv": kit.ig_keywords_csv,
            "target_audience": kit.ig_target_audience,
            "posting_category": kit.ig_posting_category,
            "audio_direction": kit.ig_audio_direction
        },
        "brand_settings_applied": json.loads(kit.brand_settings_applied_json or "{}"),
        "created_at": kit.created_at.isoformat() if kit.created_at else None,
        "updated_at": kit.updated_at.isoformat() if kit.updated_at else None
    }

@router.get("/by-clip/{clip_id}")
def get_publishing_kit_by_clip(clip_id: str, db: Session = Depends(get_db)):
    """Retrieves publishing kit associated with a specific clip ID."""
    kit = db.query(PublishingKit).filter(PublishingKit.clip_id == clip_id).first()
    if not kit:
        raise HTTPException(status_code=404, detail="Publishing kit not found for this clip")
    return get_publishing_kit(kit.id, db)

@router.post("/generate")
def generate_publishing_kit(req: GenerateKitRequest, db: Session = Depends(get_db)):
    """Generate or retrieve platform-specific publishing kit for a rendered clip."""
    clip = db.query(Clip).filter(Clip.id == req.clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    service = PublishingService(db)
    kit = service.generate_publishing_kit(
        clip=clip,
        channel_profile_id=req.channel_profile_id,
        model_name=req.model_name or "qwen2.5:3b",
        regenerate_platform=req.regenerate_platform
    )
    return get_publishing_kit(kit.id, db)

@router.put("/{kit_id}")
def update_publishing_kit(kit_id: str, data: UpdatePublishingKitRequest, db: Session = Depends(get_db)):
    """Persists manual user edits across titles, descriptions, captions, and hashtags."""
    kit = db.query(PublishingKit).filter(PublishingKit.id == kit_id).first()
    if not kit:
        raise HTTPException(status_code=404, detail="Publishing kit not found")

    for field, val in data.model_dump(exclude_unset=True).items():
        if val is not None:
            if field == "yt_tags_csv" and isinstance(val, str):
                val = val[:500]
            elif field in ["yt_hashtags_json", "ig_hashtags_json"] and isinstance(val, str):
                try:
                    h_dict = json.loads(val)
                    if isinstance(h_dict, dict):
                        seen = set()
                        cleaned_dict = {}
                        for group_name, tag_list in h_dict.items():
                            if isinstance(tag_list, list):
                                unique_group = []
                                for tag in tag_list:
                                    t_str = str(tag).strip()
                                    t_norm = t_str.lower()
                                    if t_norm and t_norm not in seen:
                                        seen.add(t_norm)
                                        unique_group.append(t_str)
                                cleaned_dict[group_name] = unique_group
                            else:
                                cleaned_dict[group_name] = tag_list
                        val = json.dumps(cleaned_dict)
                except Exception:
                    pass
            setattr(kit, field, val)

    kit.updated_at = datetime.utcnow()
    db.commit()
    return get_publishing_kit(kit.id, db)

@router.post("/{kit_id}/regenerate")
def regenerate_platform_kit(kit_id: str, req: RegeneratePartRequest, db: Session = Depends(get_db)):
    """Regenerates specific platform (YouTube only, Instagram only, or both) while preserving other edits."""
    kit = db.query(PublishingKit).filter(PublishingKit.id == kit_id).first()
    if not kit:
        raise HTTPException(status_code=404, detail="Publishing kit not found")

    clip = db.query(Clip).filter(Clip.id == kit.clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Associated clip not found")

    service = PublishingService(db)
    regen_arg = None if req.platform == "both" else req.platform

    updated_kit = service.generate_publishing_kit(
        clip=clip,
        channel_profile_id=kit.channel_profile_id,
        model_name=req.model_name or "qwen2.5:3b",
        regenerate_platform=regen_arg,
        field_name=req.field_name
    )
    return get_publishing_kit(updated_kit.id, db)

@router.post("/{kit_id}/mark-ready")
def mark_kit_ready(kit_id: str, db: Session = Depends(get_db)):
    """Marks kit as ready for manual publishing."""
    kit = db.query(PublishingKit).filter(PublishingKit.id == kit_id).first()
    if not kit:
        raise HTTPException(status_code=404, detail="Publishing kit not found")

    kit.status = "ready"
    kit.updated_at = datetime.utcnow()
    db.commit()
    return {"success": True, "id": kit.id, "status": "ready"}

@router.post("/{kit_id}/mark-published")
def mark_kit_published(kit_id: str, data: MarkPublishedRequest, db: Session = Depends(get_db)):
    """User manual confirmation that the video was published on social media."""
    kit = db.query(PublishingKit).filter(PublishingKit.id == kit_id).first()
    if not kit:
        raise HTTPException(status_code=404, detail="Publishing kit not found")

    kit.status = "published"
    if data.published_url:
        kit.published_url = data.published_url.strip()
    kit.published_at = datetime.utcnow()
    kit.updated_at = datetime.utcnow()

    # If linked to calendar entry, also mark scheduled post as published
    if kit.scheduled_post_id:
        post = db.query(ScheduledPost).filter(ScheduledPost.id == kit.scheduled_post_id).first()
        if post:
            post.status = "published"

    db.commit()
    return {"success": True, "id": kit.id, "status": "published", "published_url": kit.published_url}

@router.get("/{kit_id}/export")
def export_publishing_kit(
    kit_id: str,
    format: str = Query("txt", pattern="^(txt|json|zip)$"),
    db: Session = Depends(get_db)
):
    """Exports publishing kit as human-readable TXT, structured JSON, or complete ZIP package."""
    kit = db.query(PublishingKit).filter(PublishingKit.id == kit_id).first()
    if not kit:
        raise HTTPException(status_code=404, detail="Publishing kit not found")

    service = PublishingService(db)

    if format == "json":
        data = service.generate_json_export(kit)
        return Response(
            content=json.dumps(data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="publishing_kit_{kit.clip_id[:8]}.json"'}
        )
    elif format == "zip":
        zip_path = service.generate_zip_export(kit)
        return FileResponse(
            path=str(zip_path),
            filename=zip_path.name,
            media_type="application/zip"
        )
    else:  # txt
        txt_content = service.generate_txt_export(kit)
        return Response(
            content=txt_content,
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="publishing_kit_{kit.clip_id[:8]}.txt"'}
        )

@router.delete("/{kit_id}")
def delete_publishing_kit(kit_id: str, db: Session = Depends(get_db)):
    """Deletes publishing kit record (does NOT touch original clip, video, or project)."""
    kit = db.query(PublishingKit).filter(PublishingKit.id == kit_id).first()
    if not kit:
        raise HTTPException(status_code=404, detail="Publishing kit not found")

    db.delete(kit)
    db.commit()
    return {"success": True, "deleted_id": kit_id}
