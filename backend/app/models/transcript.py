import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Integer, Float, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    video_id = Column(String(36), ForeignKey("source_videos.id", ondelete="CASCADE"), nullable=False)
    language = Column(String(20), default="en")
    language_probability = Column(Float, default=1.0)
    model_name = Column(String(50), default="base")
    device_used = Column(String(20), default="cuda")  # "cuda" or "cpu"
    full_text = Column(Text, nullable=False)
    is_edited = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    video = relationship("SourceVideo", back_populates="transcripts")
    segments = relationship("TranscriptSegment", back_populates="transcript", cascade="all, delete-orphan")

class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transcript_id = Column(String(36), ForeignKey("transcripts.id", ondelete="CASCADE"), nullable=False)
    segment_index = Column(Integer, nullable=False)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    text = Column(Text, nullable=False)
    original_text = Column(Text, nullable=True)
    is_edited = Column(Boolean, default=False)
    speaker = Column(String(50), nullable=True, default="Speaker 1")
    words_json = Column(Text, nullable=True)  # JSON array of {word, start, end, probability}

    # Relationships
    transcript = relationship("Transcript", back_populates="segments")
