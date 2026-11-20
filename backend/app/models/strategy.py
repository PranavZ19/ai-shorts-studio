import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class ChannelProfile(Base):
    __tablename__ = "channel_profiles"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    platform = Column(String, default="youtube")  # youtube, instagram, tiktok, multi
    niche = Column(String, nullable=False, default="Technology")
    target_audience_region = Column(String, default="US")  # US, GLOBAL, IN, GB, etc.
    timezone = Column(String, default="UTC")
    preferred_frequency_per_week = Column(Integer, default=5)
    posting_days_csv = Column(String, default="mon,tue,wed,thu,fri")
    preferred_hours_csv = Column(String, default="12:00,15:00,18:00,20:00")
    max_uploads_per_day = Column(Integer, default=2)
    brand_voice = Column(String(50), default="Conversational")
    content_language = Column(String(50), default="English")
    target_audience_level = Column(String(50), default="General audience")
    default_cta = Column(String(200), default="Subscribe for more")
    creator_name = Column(String(100), nullable=True)
    creator_bio = Column(Text, nullable=True)
    creator_links_json = Column(Text, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class TrendSnapshot(Base):
    __tablename__ = "trend_snapshots"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    niche = Column(String, nullable=False)
    region = Column(String, default="US")
    source = Column(String, nullable=False)  # google_trends_rss, hackernews_api, reddit_rss, youtube_public
    query = Column(String, nullable=True)
    fetched_at = Column(DateTime, default=datetime.utcnow)
    observation_window = Column(String, default="past_24h")
    raw_data_json = Column(Text, nullable=True)
    is_fallback = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class TrendTopic(Base):
    __tablename__ = "trend_topics"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    snapshot_id = Column(String, ForeignKey("trend_snapshots.id"), nullable=True)
    niche = Column(String, nullable=False)
    topic_name = Column(String, nullable=False)
    explanation = Column(Text, nullable=False)
    source = Column(String, nullable=False)
    source_url = Column(String, nullable=True)
    region = Column(String, default="US")
    trend_status = Column(String, default="rising")  # rising, stable, declining
    trend_indicator = Column(String, nullable=True)  # e.g. "+500% search interest", "Top Story"
    opportunity_score = Column(Float, default=75.0)  # 0 to 100
    why_attention = Column(Text, nullable=True)
    target_audience = Column(String, nullable=True)
    related_keywords_json = Column(Text, default="[]")
    suggested_hashtags_json = Column(Text, default="[]")
    content_angles_json = Column(Text, default="[]")
    suggested_titles_json = Column(Text, default="[]")
    suggested_hooks_json = Column(Text, default="[]")
    video_formats_json = Column(Text, default="[]")
    competition_level = Column(String, default="medium")  # low, medium, high
    created_at = Column(DateTime, default=datetime.utcnow)

class ContentIdea(Base):
    __tablename__ = "content_ideas"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    channel_profile_id = Column(String, ForeignKey("channel_profiles.id"), nullable=True)
    niche = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    concept = Column(Text, nullable=False)
    suggested_title = Column(String, nullable=False)
    opening_hook = Column(Text, nullable=False)
    short_description = Column(Text, nullable=True)
    target_audience = Column(String, nullable=True)
    keywords_json = Column(Text, default="[]")
    hashtags_json = Column(Text, default="[]")
    recommended_duration_seconds = Column(Float, default=35.0)
    why_create = Column(Text, nullable=True)
    status = Column(String, default="suggested")  # suggested, saved, in_production, completed, dismissed
    associated_source_video_id = Column(String, ForeignKey("source_videos.id"), nullable=True)
    associated_clip_id = Column(String, ForeignKey("clips.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ScheduledPost(Base):
    __tablename__ = "scheduled_posts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    channel_profile_id = Column(String, ForeignKey("channel_profiles.id"), nullable=True)
    clip_id = Column(String, ForeignKey("clips.id"), nullable=True)
    content_idea_id = Column(String, ForeignKey("content_ideas.id"), nullable=True)
    platform = Column(String, default="youtube_shorts")  # youtube_shorts, instagram_reels
    title = Column(String, nullable=False)
    topic = Column(String, nullable=True)
    scheduled_date = Column(String, nullable=False)  # YYYY-MM-DD
    scheduled_time = Column(String, nullable=False)  # HH:MM
    timezone = Column(String, default="UTC")
    priority = Column(String, default="medium")  # high, medium, normal
    recommendation_reason = Column(Text, nullable=True)
    status = Column(String, default="scheduled")  # recommended, scheduled, published, skipped, draft
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class PostPerformance(Base):
    __tablename__ = "post_performances"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    channel_profile_id = Column(String, ForeignKey("channel_profiles.id"), nullable=True)
    scheduled_post_id = Column(String, ForeignKey("scheduled_posts.id"), nullable=True)
    clip_id = Column(String, ForeignKey("clips.id"), nullable=True)
    platform = Column(String, default="youtube_shorts")
    topic = Column(String, nullable=True)
    video_duration = Column(Float, default=30.0)
    upload_day_of_week = Column(String, nullable=False)  # Monday, Tuesday, ...
    upload_hour = Column(Integer, nullable=False)  # 0 to 23
    views_count = Column(Integer, default=0)
    retention_pct = Column(Float, default=0.0)
    likes_count = Column(Integer, default=0)
    shares_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    engagement_rate = Column(Float, default=0.0)
    hook_text = Column(Text, nullable=True)
    logged_at = Column(DateTime, default=datetime.utcnow)
