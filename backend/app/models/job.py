import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    job_type = Column(String(50), nullable=False)  # full_pipeline, transcription, clip_finding, render_clip
    
    # 15 Discrete Processing Stages
    stage = Column(String(100), default="validating_video")
    stage_index = Column(Integer, default=1)
    total_stages = Column(Integer, default=15)
    progress_pct = Column(Float, default=0.0)
    
    status = Column(String(50), default="pending")  # pending, running, completed, failed, cancelled
    message = Column(Text, nullable=True)
    error_details = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    project = relationship("Project", back_populates="jobs")
