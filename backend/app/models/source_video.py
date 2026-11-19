import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Integer, Float, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class SourceVideo(Base):
    __tablename__ = "source_videos"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    source_type = Column(String(50), default="upload")  # "upload" or "youtube"
    source_url = Column(String(1024), nullable=True)
    channel_name = Column(String(255), nullable=True)
    file_path = Column(String(1024), nullable=True)
    file_size_bytes = Column(Integer, default=0)
    duration_seconds = Column(Float, default=0.0)
    width = Column(Integer, default=0)
    height = Column(Integer, default=0)
    aspect_ratio = Column(String(20), nullable=True)
    fps = Column(Float, default=0.0)
    codec = Column(String(50), nullable=True)
    audio_codec = Column(String(50), nullable=True)
    has_audio = Column(Boolean, default=True)
    thumbnail_path = Column(String(1024), nullable=True)
    status = Column(String(50), default="uploaded")  # uploaded, validated, transcribing, ready, error
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="videos")
    transcripts = relationship("Transcript", back_populates="video", cascade="all, delete-orphan")
