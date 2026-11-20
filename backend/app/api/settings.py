from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import json
import os
import shutil
from pathlib import Path
from app.database import get_db
from app.models.settings import StudioSetting
from app.config import settings
from app.services.backup_service import BackupService

router = APIRouter(prefix="/api/settings", tags=["Settings"])

DEFAULT_SETTINGS = {
    "whisper_model": "base",
    "ollama_model": "qwen2.5:3b",
    "ollama_url": "http://127.0.0.1:11434",
    "default_clip_duration": 45,
    "target_resolution": "1080x1920",
    "aspect_ratio": "9:16",
    "default_framing": "auto_face",
    "caption_preset": "bold_creator",
    "hardware_acceleration": "cuda",  # cuda, cpu, auto
    "export_include_subtitles": True,
    "export_include_thumbnails": True,
    "export_include_metadata": True
}

class SettingsUpdate(BaseModel):
    settings: Dict[str, Any]

@router.get("/")
def get_settings(db: Session = Depends(get_db)):
    stored = db.query(StudioSetting).all()
    results = dict(DEFAULT_SETTINGS)
    for s in stored:
        try:
            results[s.key] = json.loads(s.value)
        except Exception:
            results[s.key] = s.value
            
    results["storage_path"] = str(settings.STORAGE_ROOT)
    results["database_path"] = str(settings.DATABASE_PATH)
    results["ffmpeg_bin"] = settings.FFMPEG_BIN
    results["ffprobe_bin"] = settings.FFPROBE_BIN
    results["supported_whisper_models"] = ["tiny", "base", "small"]
    results["supported_framing_modes"] = ["auto_face", "center", "manual"]
    results["supported_caption_presets"] = [
        "bold_creator",
        "karaoke_highlight",
        "clean_minimal",
        "podcast_style",
        "minimal_subtitle"
    ]
    return results

@router.post("/")
def update_settings(data: SettingsUpdate, db: Session = Depends(get_db)):
    # Validate settings before saving
    incoming = data.settings
    if "whisper_model" in incoming:
        if incoming["whisper_model"] not in ["tiny", "base", "small"]:
            raise HTTPException(status_code=400, detail="Invalid Whisper model. Choose from: tiny, base, small.")
    
    if "caption_preset" in incoming:
        if incoming["caption_preset"] not in ["bold_creator", "karaoke_highlight", "clean_minimal", "podcast_style", "minimal_subtitle"]:
            raise HTTPException(status_code=400, detail="Invalid caption preset.")

    if "default_framing" in incoming:
        if incoming["default_framing"] not in ["auto_face", "center", "manual"]:
            raise HTTPException(status_code=400, detail="Invalid framing mode.")

    if "hardware_acceleration" in incoming:
        if incoming["hardware_acceleration"] not in ["cuda", "cpu", "auto"]:
            raise HTTPException(status_code=400, detail="Invalid hardware acceleration setting.")

    for key, val in incoming.items():
        existing = db.query(StudioSetting).filter(StudioSetting.key == key).first()
        serialized = json.dumps(val) if isinstance(val, (dict, list, bool, int, float)) else str(val)
        if existing:
            existing.value = serialized
        else:
            db.add(StudioSetting(key=key, value=serialized))
    db.commit()
    return {"success": True, "message": "Settings saved successfully", "updated_keys": list(incoming.keys())}

# ----------------- STORAGE DIAGNOSTICS & CLEANUP (PHASE 10) -----------------

def get_path_size(path: Path) -> int:
    """Recursively computes size of a path in bytes."""
    if not path.exists():
        return 0
    if path.is_file():
        return path.stat().st_size
    total = 0
    for root, _, files in os.walk(path):
        for f in files:
            fp = os.path.join(root, f)
            try:
                total += os.path.getsize(fp)
            except Exception:
                pass
    return total

@router.get("/storage-stats")
def get_storage_stats():
    """Returns actual storage usage breakdown across source videos, clips, models, temp, exports, and DB."""
    source_bytes = get_path_size(settings.SOURCE_VIDEOS_DIR)
    clips_bytes = get_path_size(settings.CLIPS_DIR)
    models_bytes = get_path_size(settings.MODELS_DIR)
    temp_bytes = get_path_size(settings.TEMP_DIR)
    thumbs_bytes = get_path_size(settings.THUMBNAILS_DIR)
    exports_bytes = get_path_size(settings.EXPORTS_DIR)
    db_bytes = get_path_size(settings.DATABASE_PATH)
    total_bytes = source_bytes + clips_bytes + models_bytes + temp_bytes + thumbs_bytes + exports_bytes + db_bytes

    disk_info = {"total_gb": 0.0, "free_gb": 0.0, "used_percent": 0.0}
    try:
        usage = shutil.disk_usage(str(settings.STORAGE_ROOT))
        disk_info = {
            "total_gb": round(usage.total / (1024**3), 2),
            "free_gb": round(usage.free / (1024**3), 2),
            "used_percent": round((usage.used / usage.total) * 100, 1)
        }
    except Exception:
        pass

    return {
        "storage_root": str(settings.STORAGE_ROOT),
        "total_studio_bytes": total_bytes,
        "total_studio_mb": round(total_bytes / (1024 * 1024), 2),
        "breakdown": {
            "source_videos_bytes": source_bytes,
            "clips_bytes": clips_bytes,
            "models_bytes": models_bytes,
            "temp_bytes": temp_bytes,
            "thumbnails_bytes": thumbs_bytes,
            "exports_bytes": exports_bytes,
            "database_bytes": db_bytes
        },
        "disk": disk_info,
        "is_low_space_warning": disk_info["free_gb"] < 5.0
    }

@router.post("/cleanup-temp")
def cleanup_temp_files():
    """Safely cleans up stale upload chunks and intermediate files from storage/temp."""
    freed_bytes = 0
    cleaned_count = 0

    if settings.TEMP_DIR.exists():
        for item in settings.TEMP_DIR.iterdir():
            # Never delete active model directories or databases
            try:
                size = get_path_size(item)
                if item.is_file():
                    item.unlink(missing_ok=True)
                    freed_bytes += size
                    cleaned_count += 1
                elif item.is_dir() and item.name in ["upload_chunks", "intermediates"]:
                    shutil.rmtree(item, ignore_errors=True)
                    freed_bytes += size
                    cleaned_count += 1
            except Exception as e:
                pass

    # Ensure upload_chunks directory exists for future uploads
    (settings.TEMP_DIR / "upload_chunks").mkdir(parents=True, exist_ok=True)

    return {
        "success": True,
        "freed_bytes": freed_bytes,
        "freed_mb": round(freed_bytes / (1024 * 1024), 2),
        "cleaned_count": cleaned_count,
        "message": f"Successfully cleaned {cleaned_count} temporary items ({round(freed_bytes / (1024 * 1024), 2)} MB freed)."
    }

# ----------------- BACKUP & RESTORE (PHASE 10) -----------------

class CreateBackupRequest(BaseModel):
    include_media: Optional[bool] = False
    notes: Optional[str] = "Manual Studio Backup"

class RestoreBackupRequest(BaseModel):
    filename: str
    confirm: bool = False

@router.post("/backup")
def create_studio_backup(data: CreateBackupRequest, db: Session = Depends(get_db)):
    """Creates a timestamped studio backup zip in storage/exports/backups."""
    service = BackupService(db)
    result = service.create_backup(include_media=bool(data.include_media), notes=data.notes)
    return result

@router.get("/backups")
def list_studio_backups(db: Session = Depends(get_db)):
    """Lists available backup archives with metadata manifest summaries."""
    service = BackupService(db)
    return service.list_backups()

@router.get("/backups/{filename}/download")
def download_studio_backup(filename: str):
    """Downloads a backup ZIP archive."""
    target = settings.EXPORTS_DIR / "backups" / filename
    if not target.exists():
        raise HTTPException(status_code=404, detail="Backup file not found")
    return FileResponse(
        path=str(target),
        filename=filename,
        media_type="application/zip"
    )

@router.post("/validate-backup")
def validate_studio_backup(data: RestoreBackupRequest, db: Session = Depends(get_db)):
    """Validates archive integrity and database structure before restoration."""
    service = BackupService(db)
    res = service.validate_backup(data.filename)
    if not res.get("valid"):
        raise HTTPException(status_code=400, detail=res.get("error", "Validation failed"))
    return res

@router.post("/restore")
def restore_studio_backup(data: RestoreBackupRequest, db: Session = Depends(get_db)):
    """Restores database and media from a validated backup archive."""
    if not data.confirm:
        raise HTTPException(status_code=400, detail="Restore confirmation required before overwriting database.")
    service = BackupService(db)
    try:
        res = service.restore_backup(data.filename)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restore backup: {e}")

