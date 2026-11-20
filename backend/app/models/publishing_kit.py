import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text, ForeignKey
from app.database import Base

class PublishingKit(Base):
    __tablename__ = "publishing_kits"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    video_id = Column(String, ForeignKey("source_videos.id"), nullable=False)
    clip_id = Column(String, ForeignKey("clips.id"), nullable=False, unique=True)
    channel_profile_id = Column(String, ForeignKey("channel_profiles.id"), nullable=True)
    scheduled_post_id = Column(String, ForeignKey("scheduled_posts.id"), nullable=True)

    # Core Video Context & Language
    clip_transcript_used = Column(Text, nullable=True)
    language = Column(String(20), default="English")
    status = Column(String(30), default="draft")  # draft, ready, published
    published_url = Column(String(1024), nullable=True)
    published_at = Column(DateTime, nullable=True)

    # YouTube Shorts Kit
    yt_primary_title_index = Column(Integer, default=0)
    yt_titles_json = Column(Text, default="[]")  # 5 variations: title, strategy, explanation, char_count
    yt_description_short = Column(Text, nullable=True)
    yt_description_alt = Column(Text, nullable=True)
    yt_description_seo = Column(Text, nullable=True)
    yt_selected_description = Column(String(20), default="short")  # short, alt, seo
    yt_hashtags_json = Column(Text, default="{}")  # broad, specific, audience
    yt_tags_csv = Column(Text, default="")  # comma-separated YouTube keywords
    yt_category = Column(String(100), default="Entertainment")
    yt_pinned_comment = Column(Text, nullable=True)
    yt_thumbnail_texts_json = Column(Text, default="[]")  # 3 variations
    yt_playlist_topic = Column(String(200), nullable=True)
    yt_audience_positioning = Column(String(200), nullable=True)
    yt_content_language = Column(String(50), default="English")
    yt_cta = Column(String(200), default="Subscribe for more!")

    # Instagram Reels Kit
    ig_selected_caption_index = Column(Integer, default=0)
    ig_captions_json = Column(Text, default="[]")  # 3 variations: type, text, char_count
    ig_hashtags_json = Column(Text, default="{}")  # niche, topic, community
    ig_cover_texts_json = Column(Text, default="[]")  # 3 options
    ig_first_line_hook = Column(Text, nullable=True)
    ig_cta = Column(String(200), default="Follow for more daily insights!")
    ig_keywords_csv = Column(Text, default="")
    ig_target_audience = Column(String(200), nullable=True)
    ig_posting_category = Column(String(100), default="Creators & Entertainment")
    ig_audio_direction = Column(String(255), default="Energetic, upbeat instrumental beat")

    # Brand Settings Snapshot
    brand_settings_applied_json = Column(Text, default="{}")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
