from sqlalchemy import Column, String, Text, Integer, Float
from app.database import Base

class StudioSetting(Base):
    __tablename__ = "studio_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)
    description = Column(String(255), nullable=True)
