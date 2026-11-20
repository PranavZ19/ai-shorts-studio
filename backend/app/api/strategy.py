import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.project import Project
from app.models.clip import Clip
from app.models.source_video import SourceVideo
from app.models.strategy import (
    ChannelProfile,
    TrendSnapshot,
    TrendTopic,
    ContentIdea,
    ScheduledPost,
    PostPerformance
)
from app.services.trend_discovery_service import TrendDiscoveryService, SUPPORTED_NICHES
from app.services.strategy_ai_service import StrategyAIService
from app.services.scheduler_service import SchedulerService

router = APIRouter(prefix="/api/strategy", tags=["Creator Strategy"])

# ----------------- PYDANTIC SCHEMAS -----------------

class ChannelProfileCreate(BaseModel):
    name: str
    platform: Optional[str] = "youtube"
    niche: Optional[str] = "Technology"
    target_audience_region: Optional[str] = "US"
    timezone: Optional[str] = "UTC"
    preferred_frequency_per_week: Optional[int] = 5
    posting_days_csv: Optional[str] = "mon,tue,wed,thu,fri"
    preferred_hours_csv: Optional[str] = "12:00,15:00,18:00,20:00"
    max_uploads_per_day: Optional[int] = 2

class ChannelProfileUpdate(BaseModel):
    name: Optional[str] = None
    platform: Optional[str] = None
    niche: Optional[str] = None
    target_audience_region: Optional[str] = None
    timezone: Optional[str] = None
    preferred_frequency_per_week: Optional[int] = None
    posting_days_csv: Optional[str] = None
    preferred_hours_csv: Optional[str] = None
    max_uploads_per_day: Optional[int] = None

class TrendAnalysisRequest(BaseModel):
    topic_name: str
    niche: str
    source_indicator: Optional[str] = ""
    model_name: Optional[str] = "qwen2.5:3b"

class GenerateIdeasRequest(BaseModel):
    niche: str
    trending_topics: Optional[List[str]] = None
    project_id: Optional[str] = None
    count: Optional[int] = 4
    model_name: Optional[str] = "qwen2.5:3b"

class ContentIdeaCreate(BaseModel):
    niche: str
    topic: str
    concept: str
    suggested_title: str
    opening_hook: str
    short_description: Optional[str] = None
    target_audience: Optional[str] = None
    keywords: Optional[List[str]] = []
    hashtags: Optional[List[str]] = []
    recommended_duration_seconds: Optional[float] = 35.0
    why_create: Optional[str] = None
    project_id: Optional[str] = None
    associated_clip_id: Optional[str] = None

class IdeaStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(suggested|saved|in_production|completed|dismissed)$")

class GenerateScheduleRequest(BaseModel):
    profile_id: Optional[str] = None
    platform: Optional[str] = "youtube_shorts"
    start_date: Optional[str] = None  # YYYY-MM-DD
    days_ahead: Optional[int] = 7
    frequency_per_week: Optional[int] = None
    posting_days: Optional[List[str]] = None
    preferred_hours: Optional[List[str]] = None
    timezone: Optional[str] = "UTC"

class CommitScheduleRequest(BaseModel):
    posts: List[Dict[str, Any]]

class ScheduledPostCreate(BaseModel):
    channel_profile_id: Optional[str] = None
    clip_id: Optional[str] = None
    content_idea_id: Optional[str] = None
    platform: str = "youtube_shorts"
    title: str
    topic: Optional[str] = None
    scheduled_date: str  # YYYY-MM-DD
    scheduled_time: str  # HH:MM
    timezone: Optional[str] = "UTC"
    priority: Optional[str] = "medium"
    recommendation_reason: Optional[str] = None
    status: Optional[str] = "scheduled"
    notes: Optional[str] = None

class ScheduledPostUpdate(BaseModel):
    title: Optional[str] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    platform: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class PostStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(scheduled|published|skipped|draft)$")

class PerformanceMetricCreate(BaseModel):
    scheduled_post_id: Optional[str] = None
    clip_id: Optional[str] = None
    platform: str = "youtube_shorts"
    topic: Optional[str] = None
    video_duration: float = 30.0
    upload_day_of_week: str
    upload_hour: int = Field(..., ge=0, le=23)
    views_count: int = Field(..., ge=0)
    retention_pct: float = Field(0.0, ge=0.0, le=100.0)
    likes_count: Optional[int] = 0
    shares_count: Optional[int] = 0
    comments_count: Optional[int] = 0
    hook_text: Optional[str] = None

# ----------------- CHANNEL PROFILES -----------------

@router.get("/profiles")
def get_channel_profiles(db: Session = Depends(get_db)):
    """Retrieve all channel profiles."""
    profiles = db.query(ChannelProfile).order_by(ChannelProfile.created_at.asc()).all()
    if not profiles:
        # Create default initial profile
        default_profile = ChannelProfile(
            name="Default Shorts Channel",
            platform="youtube",
            niche="Technology",
            target_audience_region="US",
            timezone="UTC",
            preferred_frequency_per_week=5,
            posting_days_csv="mon,tue,wed,thu,fri",
            preferred_hours_csv="12:00,15:00,18:00,20:00",
            max_uploads_per_day=2
        )
        db.add(default_profile)
        db.commit()
        db.refresh(default_profile)
        profiles = [default_profile]

    return [{
        "id": p.id,
        "name": p.name,
        "platform": p.platform,
        "niche": p.niche,
        "target_audience_region": p.target_audience_region,
        "timezone": p.timezone,
        "preferred_frequency_per_week": p.preferred_frequency_per_week,
        "posting_days": [d.strip() for d in (p.posting_days_csv or "").split(",") if d.strip()],
        "preferred_hours": [h.strip() for h in (p.preferred_hours_csv or "").split(",") if h.strip()],
        "max_uploads_per_day": p.max_uploads_per_day,
        "created_at": p.created_at.isoformat() if p.created_at else None
    } for p in profiles]

@router.post("/profiles")
def create_channel_profile(data: ChannelProfileCreate, db: Session = Depends(get_db)):
    """Create a new channel profile with dedicated niche and posting preferences."""
    profile = ChannelProfile(
        name=data.name.strip(),
        platform=data.platform,
        niche=data.niche.strip(),
        target_audience_region=data.target_audience_region,
        timezone=data.timezone,
        preferred_frequency_per_week=data.preferred_frequency_per_week,
        posting_days_csv=data.posting_days_csv,
        preferred_hours_csv=data.preferred_hours_csv,
        max_uploads_per_day=data.max_uploads_per_day
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return {
        "success": True,
        "id": profile.id,
        "name": profile.name,
        "niche": profile.niche
    }

@router.put("/profiles/{profile_id}")
def update_channel_profile(profile_id: str, data: ChannelProfileUpdate, db: Session = Depends(get_db)):
    """Update channel profile settings."""
    profile = db.query(ChannelProfile).filter(ChannelProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Channel profile not found")

    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(profile, field, val)

    profile.updated_at = datetime.utcnow()
    db.commit()
    return {"success": True, "id": profile.id}

@router.delete("/profiles/{profile_id}")
def delete_channel_profile(profile_id: str, db: Session = Depends(get_db)):
    """Delete a channel profile."""
    profile = db.query(ChannelProfile).filter(ChannelProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Channel profile not found")

    db.delete(profile)
    db.commit()
    return {"success": True, "deleted_id": profile_id}

# ----------------- NICHES & TRENDS -----------------

@router.get("/niches")
def get_supported_niches():
    """Return list of supported creator niches and their subcategories."""
    return SUPPORTED_NICHES

@router.get("/trends")
def get_trends(
    niche: str = Query("Technology"),
    region: str = Query("US"),
    force_refresh: bool = Query(False),
    db: Session = Depends(get_db)
):
    """
    Fetch trending topics for a niche.
    Utilizes local SQLite caching and falls back seamlessly when offline.
    """
    service = TrendDiscoveryService(db)
    return service.fetch_trends_for_niche(
        niche=niche,
        region=region,
        force_refresh=force_refresh
    )

@router.post("/trends/analyze")
def analyze_trend(req: TrendAnalysisRequest):
    """Deep AI analysis of a trending topic using Ollama or intelligent heuristic engine."""
    service = StrategyAIService()
    return service.analyze_trend_topic(
        topic_name=req.topic_name,
        niche=req.niche,
        source_indicator=req.source_indicator or "",
        model_name=req.model_name or "qwen2.5:3b"
    )

# ----------------- PERSONALIZED CONTENT IDEAS -----------------

@router.get("/ideas")
def get_content_ideas(
    niche: Optional[str] = None,
    status: Optional[str] = None,
    project_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List generated or saved content ideas with filtering."""
    query = db.query(ContentIdea)
    if niche:
        query = query.filter(ContentIdea.niche == niche)
    if status:
        query = query.filter(ContentIdea.status == status)
    if project_id:
        query = query.filter(ContentIdea.project_id == project_id)

    ideas = query.order_by(ContentIdea.created_at.desc()).all()
    return [{
        "id": i.id,
        "niche": i.niche,
        "topic": i.topic,
        "concept": i.concept,
        "suggested_title": i.suggested_title,
        "opening_hook": i.opening_hook,
        "short_description": i.short_description,
        "target_audience": i.target_audience,
        "keywords": json.loads(i.keywords_json or "[]"),
        "hashtags": json.loads(i.hashtags_json or "[]"),
        "recommended_duration_seconds": i.recommended_duration_seconds,
        "why_create": i.why_create,
        "status": i.status,
        "project_id": i.project_id,
        "associated_source_video_id": i.associated_source_video_id,
        "associated_clip_id": i.associated_clip_id,
        "created_at": i.created_at.isoformat() if i.created_at else None
    } for i in ideas]

@router.post("/ideas/generate")
def generate_content_ideas(req: GenerateIdeasRequest, db: Session = Depends(get_db)):
    """Generate personalized content ideas combining trends with existing transcripts."""
    trend_service = TrendDiscoveryService(db)
    trend_data = trend_service.fetch_trends_for_niche(niche=req.niche, force_refresh=False)
    topics = req.trending_topics or [t["topic_name"] for t in trend_data.get("topics", [])]

    ai_service = StrategyAIService()
    generated = ai_service.generate_content_ideas(
        db=db,
        niche=req.niche,
        trending_topics=topics,
        project_id=req.project_id,
        count=req.count or 4,
        model_name=req.model_name or "qwen2.5:3b"
    )

    created_ideas = []
    for item in generated:
        # Check duplicate
        existing = db.query(ContentIdea).filter(
            ContentIdea.suggested_title == item["suggested_title"]
        ).first()
        if existing:
            created_ideas.append(existing)
            continue

        idea = ContentIdea(
            project_id=req.project_id,
            niche=req.niche,
            topic=item["topic"],
            concept=item["concept"],
            suggested_title=item["suggested_title"],
            opening_hook=item["opening_hook"],
            short_description=item.get("short_description", ""),
            target_audience=item.get("target_audience", ""),
            keywords_json=json.dumps(item.get("keywords", [])),
            hashtags_json=json.dumps(item.get("hashtags", [])),
            recommended_duration_seconds=float(item.get("recommended_duration_seconds", 35.0)),
            why_create=item.get("why_create", ""),
            status="suggested",
            associated_source_video_id=item.get("associated_source_video_id"),
            associated_clip_id=item.get("associated_clip_id")
        )
        db.add(idea)
        created_ideas.append(idea)

    db.commit()
    for ci in created_ideas:
        db.refresh(ci)

    return {
        "success": True,
        "ideas_count": len(created_ideas),
        "ideas": [{
            "id": i.id,
            "topic": i.topic,
            "concept": i.concept,
            "suggested_title": i.suggested_title,
            "opening_hook": i.opening_hook,
            "short_description": i.short_description,
            "target_audience": i.target_audience,
            "recommended_duration_seconds": i.recommended_duration_seconds,
            "why_create": i.why_create,
            "status": i.status,
            "associated_clip_id": i.associated_clip_id
        } for i in created_ideas]
    }

@router.post("/ideas")
def save_custom_idea(data: ContentIdeaCreate, db: Session = Depends(get_db)):
    """Save a user-created or refined content idea."""
    idea = ContentIdea(
        project_id=data.project_id,
        niche=data.niche,
        topic=data.topic,
        concept=data.concept,
        suggested_title=data.suggested_title,
        opening_hook=data.opening_hook,
        short_description=data.short_description,
        target_audience=data.target_audience,
        keywords_json=json.dumps(data.keywords or []),
        hashtags_json=json.dumps(data.hashtags or []),
        recommended_duration_seconds=data.recommended_duration_seconds or 35.0,
        why_create=data.why_create,
        status="saved",
        associated_clip_id=data.associated_clip_id
    )
    db.add(idea)
    db.commit()
    db.refresh(idea)
    return {"success": True, "id": idea.id}

@router.patch("/ideas/{idea_id}/status")
def update_idea_status(idea_id: str, data: IdeaStatusUpdate, db: Session = Depends(get_db)):
    """Update status of a content idea."""
    idea = db.query(ContentIdea).filter(ContentIdea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Content idea not found")

    idea.status = data.status
    idea.updated_at = datetime.utcnow()
    db.commit()
    return {"success": True, "id": idea.id, "status": idea.status}

@router.post("/ideas/{idea_id}/convert-to-project")
def convert_idea_to_project(idea_id: str, db: Session = Depends(get_db)):
    """Creates a new Project initialized with the content idea's title and description."""
    idea = db.query(ContentIdea).filter(ContentIdea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Content idea not found")

    new_project = Project(
        name=f"Project: {idea.suggested_title[:45]}",
        description=f"Generated from Creator Strategy idea '{idea.topic}'. Hook: {idea.opening_hook}"
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    idea.project_id = new_project.id
    idea.status = "in_production"
    db.commit()

    return {
        "success": True,
        "project_id": new_project.id,
        "project_name": new_project.name,
        "idea_id": idea.id
    }

# ----------------- INTELLIGENT UPLOAD SCHEDULE & CALENDAR -----------------

@router.post("/schedule/recommend")
def get_schedule_recommendations(req: GenerateScheduleRequest, db: Session = Depends(get_db)):
    """Generates an optimized schedule allocation based on platform baselines and channel history."""
    scheduler = SchedulerService(db)
    recommendations = scheduler.generate_recommended_schedule(
        profile_id=req.profile_id,
        platform=req.platform or "youtube_shorts",
        start_date=req.start_date,
        days_ahead=req.days_ahead or 7,
        frequency_per_week=req.frequency_per_week,
        posting_days=req.posting_days,
        preferred_hours=req.preferred_hours,
        timezone=req.timezone or "UTC"
    )
    return {
        "success": True,
        "platform": req.platform or "youtube_shorts",
        "recommendations_count": len(recommendations),
        "schedule": recommendations
    }

@router.post("/schedule/commit")
def commit_schedule(req: CommitScheduleRequest, db: Session = Depends(get_db)):
    """Persists approved schedule entries to the SQLite calendar."""
    scheduler = SchedulerService(db)
    saved = scheduler.save_schedule_posts(req.posts)
    return {
        "success": True,
        "saved_count": len(saved),
        "scheduled_ids": [p.id for p in saved]
    }

@router.get("/calendar")
def get_calendar(
    start_date: Optional[str] = None,  # YYYY-MM-DD
    end_date: Optional[str] = None,    # YYYY-MM-DD
    platform: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Retrieve scheduled posts with filtering."""
    query = db.query(ScheduledPost)
    if start_date:
        query = query.filter(ScheduledPost.scheduled_date >= start_date)
    if end_date:
        query = query.filter(ScheduledPost.scheduled_date <= end_date)
    if platform:
        query = query.filter(ScheduledPost.platform == platform)
    if status:
        query = query.filter(ScheduledPost.status == status)

    posts = query.order_by(ScheduledPost.scheduled_date.asc(), ScheduledPost.scheduled_time.asc()).all()

    # Hydrate clip thumbnails if available
    results = []
    for p in posts:
        thumb = None
        duration = 30.0
        if p.clip_id:
            clip = db.query(Clip).filter(Clip.id == p.clip_id).first()
            if clip:
                thumb = clip.thumbnail_path
                duration = clip.duration or 30.0

        results.append({
            "id": p.id,
            "channel_profile_id": p.channel_profile_id,
            "clip_id": p.clip_id,
            "content_idea_id": p.content_idea_id,
            "platform": p.platform,
            "title": p.title,
            "topic": p.topic,
            "scheduled_date": p.scheduled_date,
            "scheduled_time": p.scheduled_time,
            "timezone": p.timezone,
            "priority": p.priority,
            "recommendation_reason": p.recommendation_reason,
            "status": p.status,
            "notes": p.notes,
            "thumbnail_path": thumb,
            "duration": duration,
            "created_at": p.created_at.isoformat() if p.created_at else None
        })
    return results

@router.post("/calendar")
def add_calendar_post(data: ScheduledPostCreate, db: Session = Depends(get_db)):
    """Add a new scheduled post to the calendar."""
    # Check duplicate
    if data.clip_id:
        existing = db.query(ScheduledPost).filter(
            ScheduledPost.clip_id == data.clip_id,
            ScheduledPost.platform == data.platform,
            ScheduledPost.scheduled_date == data.scheduled_date
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"This clip is already scheduled for {data.scheduled_date} on {data.platform}."
            )

    post = ScheduledPost(
        channel_profile_id=data.channel_profile_id,
        clip_id=data.clip_id,
        content_idea_id=data.content_idea_id,
        platform=data.platform,
        title=data.title,
        topic=data.topic,
        scheduled_date=data.scheduled_date,
        scheduled_time=data.scheduled_time,
        timezone=data.timezone or "UTC",
        priority=data.priority or "medium",
        recommendation_reason=data.recommendation_reason or "Manually scheduled upload",
        status=data.status or "scheduled",
        notes=data.notes
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return {"success": True, "id": post.id}

@router.put("/calendar/{post_id}")
def update_calendar_post(post_id: str, data: ScheduledPostUpdate, db: Session = Depends(get_db)):
    """Update scheduled post (reschedule date/time, change platform, edit notes)."""
    post = db.query(ScheduledPost).filter(ScheduledPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Scheduled post not found")

    for field, val in data.model_dump(exclude_unset=True).items():
        if val is not None:
            setattr(post, field, val)

    post.updated_at = datetime.utcnow()
    db.commit()
    return {"success": True, "id": post.id}

@router.delete("/calendar/{post_id}")
def delete_calendar_post(post_id: str, db: Session = Depends(get_db)):
    """Delete a scheduled post from the calendar."""
    post = db.query(ScheduledPost).filter(ScheduledPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Scheduled post not found")

    db.delete(post)
    db.commit()
    return {"success": True, "deleted_id": post_id}

@router.patch("/calendar/{post_id}/status")
def update_post_status(post_id: str, data: PostStatusUpdate, db: Session = Depends(get_db)):
    """Mark a post as published, skipped, or scheduled."""
    post = db.query(ScheduledPost).filter(ScheduledPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Scheduled post not found")

    post.status = data.status
    post.updated_at = datetime.utcnow()
    db.commit()
    return {"success": True, "id": post.id, "status": post.status}

# ----------------- PERFORMANCE INSIGHTS & LEARNING -----------------

@router.get("/performance")
def get_performance_insights(platform: Optional[str] = None, db: Session = Depends(get_db)):
    """Return AI performance learning calculations based on logged uploads."""
    scheduler = SchedulerService(db)
    return scheduler.calculate_performance_insights(platform=platform)

@router.post("/performance")
def log_performance_metrics(data: PerformanceMetricCreate, db: Session = Depends(get_db)):
    """Manually log performance metrics for an uploaded video to train schedule recommendations."""
    # Calculate engagement rate: (likes + comments + shares) / max(views, 1) * 100
    eng_rate = 0.0
    if data.views_count > 0:
        total_eng = (data.likes_count or 0) + (data.shares_count or 0) + (data.comments_count or 0)
        eng_rate = round((total_eng / data.views_count) * 100, 2)

    perf = PostPerformance(
        scheduled_post_id=data.scheduled_post_id,
        clip_id=data.clip_id,
        platform=data.platform,
        topic=data.topic,
        video_duration=data.video_duration,
        upload_day_of_week=data.upload_day_of_week.capitalize(),
        upload_hour=data.upload_hour,
        views_count=data.views_count,
        retention_pct=data.retention_pct,
        likes_count=data.likes_count or 0,
        shares_count=data.shares_count or 0,
        comments_count=data.comments_count or 0,
        engagement_rate=eng_rate,
        hook_text=data.hook_text
    )
    db.add(perf)

    # If scheduled_post_id provided, mark post as published
    if data.scheduled_post_id:
        post = db.query(ScheduledPost).filter(ScheduledPost.id == data.scheduled_post_id).first()
        if post:
            post.status = "published"

    db.commit()
    db.refresh(perf)
    return {"success": True, "id": perf.id, "engagement_rate": eng_rate}

# ----------------- OVERVIEW SUMMARY -----------------

@router.get("/overview")
def get_strategy_overview(db: Session = Depends(get_db)):
    """Aggregated statistics for Creator Strategy Overview dashboard."""
    # Active profile
    profile = db.query(ChannelProfile).first()
    niche = profile.niche if profile else "Technology"

    # Trends
    trend_service = TrendDiscoveryService(db)
    trends_data = trend_service.fetch_trends_for_niche(niche=niche, force_refresh=False)
    topics = trends_data.get("topics", [])
    top_trends = topics[:4]

    # Ideas count
    ideas_count = db.query(ContentIdea).filter(ContentIdea.status.in_(["saved", "suggested"])).count()
    top_ideas = db.query(ContentIdea).filter(ContentIdea.status.in_(["saved", "suggested"])).order_by(ContentIdea.created_at.desc()).limit(3).all()

    # Upcoming posts in next 7 days
    today_str = datetime.utcnow().date().isoformat()
    upcoming_posts = db.query(ScheduledPost).filter(
        ScheduledPost.scheduled_date >= today_str,
        ScheduledPost.status == "scheduled"
    ).order_by(ScheduledPost.scheduled_date.asc(), ScheduledPost.scheduled_time.asc()).limit(5).all()

    # Content opportunities from existing clips
    ready_clips = db.query(Clip).filter(Clip.status == "exported").order_by(Clip.overall_score.desc()).limit(4).all()

    # Performance
    scheduler = SchedulerService(db)
    perf_insights = scheduler.calculate_performance_insights()

    return {
        "active_profile": {
            "name": profile.name if profile else "Default Profile",
            "niche": niche,
            "platform": profile.platform if profile else "youtube",
            "region": profile.target_audience_region if profile else "US",
            "frequency_per_week": profile.preferred_frequency_per_week if profile else 5
        },
        "trends_summary": {
            "source": trends_data.get("source", "Curated Reference"),
            "fetched_at": trends_data.get("fetched_at"),
            "is_fallback": trends_data.get("is_fallback", False),
            "top_trends": top_trends
        },
        "ideas_summary": {
            "total_in_pipeline": ideas_count,
            "top_ideas": [{
                "id": i.id,
                "topic": i.topic,
                "suggested_title": i.suggested_title,
                "opening_hook": i.opening_hook,
                "recommended_duration_seconds": i.recommended_duration_seconds
            } for i in top_ideas]
        },
        "upcoming_schedule": [{
            "id": p.id,
            "title": p.title,
            "platform": p.platform,
            "scheduled_date": p.scheduled_date,
            "scheduled_time": p.scheduled_time,
            "priority": p.priority
        } for p in upcoming_posts],
        "content_opportunities": [{
            "id": c.id,
            "title": c.title,
            "duration": c.duration,
            "score": c.overall_score,
            "topic": c.main_topic
        } for c in ready_clips],
        "performance_snapshot": {
            "has_enough_data": perf_insights.get("has_enough_data", False),
            "best_days": perf_insights.get("best_days", []),
            "best_hours": perf_insights.get("best_hours", []),
            "optimal_length": perf_insights.get("optimal_length_range", "30-45s")
        }
    }
