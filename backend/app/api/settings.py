from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional
import json
from app.database import get_db
from app.models.settings import StudioSetting
from app.config import settings

router = APIRouter(prefix="/api/settings", tags=["Settings"])

DEFAULT_SETTINGS = {
    "whisper_model": "base",
    "ollama_model": "llama3.2:3b",
    "ollama_url": "http://127.0.0.1:11434",
    "default_clip_duration": "60",
    "target_resolution": "1080x1920",
    "aspect_ratio": "9:16",
    "scoring_weights": {
        "hook": 20,
        "emotion": 15,
        "curiosity": 15,
        "story": 15,
        "information": 10,
        "audience": 10,
        "shareability": 10,
        "quality": 5
    },
    "caption_preset": "karaoke_bold",
    "hardware_acceleration": "auto"  # auto, cuda, cpu
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
    return results

@router.post("/")
def update_settings(data: SettingsUpdate, db: Session = Depends(get_db)):
    for key, val in data.settings.items():
        existing = db.query(StudioSetting).filter(StudioSetting.key == key).first()
        serialized = json.dumps(val) if isinstance(val, (dict, list, bool, int, float)) else str(val)
        if existing:
            existing.value = serialized
        else:
            db.add(StudioSetting(key=key, value=serialized))
    db.commit()
    return {"success": True, "message": "Settings saved successfully"}
