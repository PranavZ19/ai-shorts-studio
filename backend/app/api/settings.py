from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional
import json
from pathlib import Path
from app.database import get_db
from app.models.settings import StudioSetting
from app.config import settings

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
