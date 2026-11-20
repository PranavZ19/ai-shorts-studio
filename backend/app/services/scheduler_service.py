import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.strategy import ChannelProfile, ScheduledPost, PostPerformance, ContentIdea
from app.models.clip import Clip

logger = logging.getLogger(__name__)

PLATFORM_BASELINES = {
    "youtube_shorts": {
        "name": "YouTube Shorts",
        "top_days": ["Thursday", "Friday", "Saturday", "Sunday"],
        "peak_hours": ["12:00", "15:00", "18:00", "20:00"],
        "default_frequency": 5,
        "min_spacing_hours": 4,
        "baseline_reason": "General baseline estimate for YouTube Shorts (not a guaranteed posting time): Early evening and weekend leisure hours capture high vertical mobile viewing."
    },
    "instagram_reels": {
        "name": "Instagram Reels",
        "top_days": ["Tuesday", "Wednesday", "Friday"],
        "peak_hours": ["09:00", "13:00", "19:00", "21:00"],
        "default_frequency": 4,
        "min_spacing_hours": 6,
        "baseline_reason": "General baseline estimate for Instagram Reels (not a guaranteed posting time): Midday lunch breaks and evening prime-time scroll align with peak explore feed activity."
    }
}

DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

class SchedulerService:
    """Intelligently schedules clips and content ideas using platform baselines and empirical channel learning."""

    def __init__(self, db: Session):
        self.db = db

    def generate_recommended_schedule(
        self,
        profile_id: Optional[str] = None,
        platform: str = "youtube_shorts",
        start_date: Optional[str] = None,
        days_ahead: int = 7,
        frequency_per_week: Optional[int] = None,
        posting_days: Optional[List[str]] = None,
        preferred_hours: Optional[List[str]] = None,
        timezone: str = "UTC"
    ) -> List[Dict[str, Any]]:
        """
        Creates an optimized posting schedule for the specified duration,
        slotting unassigned exported clips or high-priority content ideas.
        """
        # Load profile preferences if supplied
        profile = None
        if profile_id:
            profile = self.db.query(ChannelProfile).filter(ChannelProfile.id == profile_id).first()

        target_platform = platform if platform in PLATFORM_BASELINES else "youtube_shorts"
        baseline = PLATFORM_BASELINES[target_platform]

        freq = frequency_per_week or (profile.preferred_frequency_per_week if profile else baseline["default_frequency"])
        if posting_days:
            allowed_days = posting_days
        elif profile and profile.posting_days_csv:
            allowed_days = [d.strip().capitalize() for d in profile.posting_days_csv.split(",") if d.strip()]
        else:
            allowed_days = DAYS_OF_WEEK if freq > len(baseline["top_days"]) else baseline["top_days"]

        avail_hours = preferred_hours or (
            [h.strip() for h in profile.preferred_hours_csv.split(",")] if profile and profile.preferred_hours_csv
            else baseline["peak_hours"]
        )
        tz = timezone or (profile.timezone if profile else "UTC")

        # Check empirical performance history
        performance_insights = self.calculate_performance_insights(platform=target_platform)
        has_empirical_data = performance_insights.get("has_enough_data", False)
        empirical_top_days = performance_insights.get("best_days", [])
        empirical_top_hours = performance_insights.get("best_hours", [])

        # Start date
        if start_date:
            cur_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        else:
            cur_date = datetime.utcnow().date() + timedelta(days=1)

        # Retrieve available clips that are not already scheduled
        scheduled_clip_ids = [
            row[0] for row in self.db.query(ScheduledPost.clip_id).filter(
                ScheduledPost.clip_id.isnot(None),
                ScheduledPost.status.in_(["scheduled", "recommended"])
            ).all()
        ]

        unassigned_clips = self.db.query(Clip).filter(
            Clip.status.in_(["exported", "candidate"]),
            ~Clip.id.in_(scheduled_clip_ids)
        ).order_by(Clip.overall_score.desc()).all()

        # Retrieve saved content ideas
        unassigned_ideas = self.db.query(ContentIdea).filter(
            ContentIdea.status.in_(["saved", "suggested"])
        ).order_by(ContentIdea.created_at.desc()).all()

        schedule_plan: List[Dict[str, Any]] = []
        clip_idx = 0
        idea_idx = 0

        # Determine target days in window
        days_scheduled = 0
        max_passes = max(1, (freq + len(allowed_days) - 1) // max(1, len(allowed_days)))
        for pass_num in range(max_passes):
            if days_scheduled >= freq:
                break
            for day_offset in range(days_ahead):
                if days_scheduled >= freq:
                    break
                eval_date = cur_date + timedelta(days=day_offset)
                day_name = eval_date.strftime("%A")

                # Check if this day is in allowed days
                is_allowed = any(day_name.lower().startswith(d.lower()[:3]) for d in allowed_days)
                if not is_allowed:
                    continue

                # Pick recommended hour
                hour_idx = (pass_num + days_scheduled) % len(avail_hours)
                hour = avail_hours[hour_idx]
                if has_empirical_data and empirical_top_hours:
                    hour = empirical_top_hours[(pass_num + days_scheduled) % len(empirical_top_hours)]

                # Check recommendation reasoning
                if has_empirical_data and day_name in empirical_top_days:
                    reason = f"Personalized: Your channel averages {round(performance_insights.get('top_day_avg_views', 0))} views on {day_name} at {hour}."
                else:
                    reason = f"Platform Benchmark ({baseline['name']}): {day_name} {hour} captures peak vertical video consumption."

                # Assign clip or content idea
                assigned_clip = None
                assigned_idea = None
                title = f"{target_platform.replace('_', ' ').title()} Post #{days_scheduled + 1}"
                topic = "Topical Shorts Highlight"

                if clip_idx < len(unassigned_clips):
                    assigned_clip = unassigned_clips[clip_idx]
                    title = assigned_clip.title or f"Clip {assigned_clip.id[:6]}"
                    topic = assigned_clip.main_topic or "Video Highlight"
                    clip_idx += 1
                elif idea_idx < len(unassigned_ideas):
                    assigned_idea = unassigned_ideas[idea_idx]
                    title = assigned_idea.suggested_title
                    topic = assigned_idea.topic
                    idea_idx += 1

                scheduled_entry = {
                    "id": None,
                    "channel_profile_id": profile.id if profile else None,
                    "platform": target_platform,
                    "clip_id": assigned_clip.id if assigned_clip else None,
                    "content_idea_id": assigned_idea.id if assigned_idea else None,
                    "title": title,
                    "topic": topic,
                    "scheduled_date": eval_date.isoformat(),
                    "scheduled_time": hour,
                    "timezone": tz,
                    "priority": "high" if (assigned_clip and (assigned_clip.overall_score or 0) > 80) else "medium",
                    "recommendation_reason": reason,
                    "status": "recommended"
                }
                schedule_plan.append(scheduled_entry)
                days_scheduled += 1

        return schedule_plan

    def save_schedule_posts(self, posts_data: List[Dict[str, Any]]) -> List[ScheduledPost]:
        """Persists generated schedule entries to SQLite."""
        created_records = []
        for p in posts_data:
            # Check duplicate prevention: same clip on same date & platform
            if p.get("clip_id"):
                existing = self.db.query(ScheduledPost).filter(
                    ScheduledPost.clip_id == p["clip_id"],
                    ScheduledPost.platform == p["platform"],
                    ScheduledPost.scheduled_date == p["scheduled_date"]
                ).first()
                if existing:
                    continue

            post = ScheduledPost(
                channel_profile_id=p.get("channel_profile_id"),
                clip_id=p.get("clip_id"),
                content_idea_id=p.get("content_idea_id"),
                platform=p.get("platform", "youtube_shorts"),
                title=p.get("title", "Untitled Short"),
                topic=p.get("topic", ""),
                scheduled_date=p["scheduled_date"],
                scheduled_time=p["scheduled_time"],
                timezone=p.get("timezone", "UTC"),
                priority=p.get("priority", "medium"),
                recommendation_reason=p.get("recommendation_reason", "Recommended schedule slot"),
                status=p.get("status", "scheduled"),
                notes=p.get("notes", "")
            )
            self.db.add(post)
            created_records.append(post)

        self.db.commit()
        for rec in created_records:
            self.db.refresh(rec)
        return created_records

    def calculate_performance_insights(self, platform: Optional[str] = None, profile_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyzes historical performance to extract real empirical creator insights:
        best days, best times, optimal video length, top performing topics, and engagement patterns.
        """
        query = self.db.query(PostPerformance)
        if profile_id:
            query = query.filter(PostPerformance.channel_profile_id == profile_id)
        if platform:
            query = query.filter(PostPerformance.platform == platform)
        records = query.all()

        if len(records) < 4:
            return {
                "has_enough_data": False,
                "sample_size": len(records),
                "message": "Using general posting-time estimates. Add your publishing performance data to personalize recommendations.",
                "best_days": ["Friday", "Saturday", "Thursday"],
                "best_hours": ["18:00", "12:00", "20:00"],
                "optimal_length_range": "30 - 45 seconds",
                "top_topics": [],
                "day_averages": {},
                "hour_averages": {},
                "duration_averages": {}
            }

        # 1. Day of week averages
        day_views: Dict[str, List[int]] = {}
        for r in records:
            day = r.upload_day_of_week
            if day:
                day_views.setdefault(day, []).append(r.views_count)

        day_stats = {
            day: {"avg_views": sum(views) / len(views), "count": len(views)}
            for day, views in day_views.items()
        }
        sorted_days = sorted(day_stats.keys(), key=lambda d: day_stats[d]["avg_views"], reverse=True)

        # 2. Upload hour averages
        hour_views: Dict[str, List[int]] = {}
        for r in records:
            hr_str = f"{r.upload_hour:02d}:00"
            hour_views.setdefault(hr_str, []).append(r.views_count)

        hour_stats = {
            hr: {"avg_views": sum(views) / len(views), "count": len(views)}
            for hr, views in hour_views.items()
        }
        sorted_hours = sorted(hour_stats.keys(), key=lambda h: hour_stats[h]["avg_views"], reverse=True)

        # 3. Video length performance buckets
        duration_buckets: Dict[str, List[float]] = {
            "Under 25s": [],
            "25s - 40s": [],
            "40s - 60s": [],
            "Over 60s": []
        }
        for r in records:
            dur = r.video_duration or 30.0
            ret = r.retention_pct or 0.0
            if dur < 25.0:
                duration_buckets["Under 25s"].append(ret)
            elif dur <= 40.0:
                duration_buckets["25s - 40s"].append(ret)
            elif dur <= 60.0:
                duration_buckets["40s - 60s"].append(ret)
            else:
                duration_buckets["Over 60s"].append(ret)

        duration_stats = {
            b: round(sum(vals) / len(vals), 1) if vals else 0.0
            for b, vals in duration_buckets.items()
        }
        best_duration = max(duration_stats.keys(), key=lambda b: duration_stats[b])

        # 4. Top topics
        topic_views: Dict[str, List[int]] = {}
        for r in records:
            top = r.topic or "General"
            topic_views.setdefault(top, []).append(r.views_count)

        top_topics = [
            {"topic": t, "avg_views": round(sum(v) / len(v)), "video_count": len(v)}
            for t, v in sorted(topic_views.items(), key=lambda item: sum(item[1])/len(item[1]), reverse=True)[:5]
        ]

        return {
            "has_enough_data": True,
            "sample_size": len(records),
            "message": f"Personalized recommendations based on {len(records)} logged channel uploads. Note: historical correlation does not guarantee future reach.",
            "best_days": sorted_days[:3],
            "best_hours": sorted_hours[:3],
            "top_day_avg_views": round(day_stats[sorted_days[0]]["avg_views"]) if sorted_days else 0,
            "optimal_length_range": best_duration,
            "top_topics": top_topics,
            "day_averages": day_stats,
            "hour_averages": hour_stats,
            "duration_averages": duration_stats
        }
