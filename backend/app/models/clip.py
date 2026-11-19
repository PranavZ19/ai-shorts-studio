import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Integer, Float, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class Clip(Base):
    __tablename__ = "clips"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    duration = Column(Float, nullable=False)
    
    # 0-100 Heuristic & LLM scores
    overall_score = Column(Float, default=0.0)
    hook_score = Column(Float, default=0.0)
    emotional_score = Column(Float, default=0.0)
    curiosity_score = Column(Float, default=0.0)
    story_score = Column(Float, default=0.0)
    information_score = Column(Float, default=0.0)
    shareability_score = Column(Float, default=0.0)
    score_explanation = Column(Text, nullable=True)
    
    # Status & Review
    status = Column(String(50), default="candidate")  # candidate, approved, rejected, exporting, exported
    is_approved = Column(Boolean, default=False)
    
    # Rendered Media Paths
    output_path = Column(String(1024), nullable=True)
    thumbnail_path = Column(String(1024), nullable=True)
    srt_path = Column(String(1024), nullable=True)
    file_size_bytes = Column(Integer, default=0)
    
    # AI Generated Content (JSON serialized)
    # { titles: [...], descriptions: [...], hashtags: [...], caption: "...", pinned_comment: "..." }
    ai_metadata_json = Column(Text, nullable=True)
    
    # Editing Configuration (JSON serialized)
    # { crop_mode: "auto_face", framing: "center", caption_preset: "karaoke_bold", font_size: 24, text_color: "#ffffff" }
    edit_config_json = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="clips")
