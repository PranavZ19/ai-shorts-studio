import json
import logging
import re
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.source_video import SourceVideo
from app.models.transcript import Transcript, TranscriptSegment
from app.models.clip import Clip
from app.models.strategy import ContentIdea, TrendTopic

logger = logging.getLogger(__name__)

class StrategyAIService:
    """Uses local Ollama (Qwen2.5 3B) with heuristic fallback for AI trend analysis and personalized content ideas."""

    def __init__(self, ollama_url: str = "http://127.0.0.1:11434"):
        self.ollama_url = ollama_url

    def is_ollama_available(self) -> bool:
        try:
            req = urllib.request.Request(f"{self.ollama_url}/api/tags", headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                return resp.status == 200
        except Exception:
            return False

    def analyze_trend_topic(
        self,
        topic_name: str,
        niche: str,
        source_indicator: str = "",
        model_name: str = "qwen2.5:3b"
    ) -> Dict[str, Any]:
        """Runs deep AI analysis on a trending topic to derive titles, hooks, angles, and opportunity scores."""
        if self.is_ollama_available():
            try:
                ai_result = self._call_ollama_trend_analysis(topic_name, niche, source_indicator, model_name)
                if ai_result:
                    return ai_result
            except Exception as e:
                logger.warning(f"Ollama trend analysis failed, using heuristic: {e}")

        return self._heuristic_trend_analysis(topic_name, niche, source_indicator)

    def generate_content_ideas(
        self,
        db: Session,
        niche: str,
        trending_topics: List[str],
        project_id: Optional[str] = None,
        count: int = 4,
        model_name: str = "qwen2.5:3b"
    ) -> List[Dict[str, Any]]:
        """
        Synthesizes trending topics with existing video transcripts and clips to create personalized content ideas.
        """
        # Gather existing transcripts and topics to avoid repetition and find associations
        transcripts_query = db.query(Transcript)
        if project_id:
            transcripts_query = transcripts_query.join(SourceVideo).filter(SourceVideo.project_id == project_id)
        transcripts = transcripts_query.limit(5).all()

        existing_topics = [t.topic for t in db.query(ContentIdea).filter(ContentIdea.niche == niche).all()]

        transcript_snippets = []
        source_video_map = {}
        for tr in transcripts:
            if tr.full_text:
                transcript_snippets.append(tr.full_text[:300])
                source_video_map[tr.full_text[:60]] = tr.video_id

        # Check existing clips
        clips_query = db.query(Clip)
        if project_id:
            clips_query = clips_query.filter(Clip.project_id == project_id)
        recent_clips = clips_query.order_by(Clip.created_at.desc()).limit(6).all()
        clip_titles = [c.title for c in recent_clips if c.title]

        # Call Ollama if available
        ideas: List[Dict[str, Any]] = []
        if self.is_ollama_available() and trending_topics:
            try:
                ideas = self._call_ollama_content_ideas(
                    niche=niche,
                    trending_topics=trending_topics[:5],
                    transcript_snippets=transcript_snippets,
                    clip_titles=clip_titles,
                    count=count,
                    model_name=model_name
                )
            except Exception as e:
                logger.warning(f"Ollama idea generation failed: {e}")

        # Fallback if Ollama returned empty or was unavailable
        if not ideas:
            ideas = self._heuristic_content_ideas(
                niche=niche,
                trending_topics=trending_topics,
                existing_topics=existing_topics,
                recent_clips=recent_clips,
                count=count
            )

        # Check for matching source videos and clips
        for idea in ideas:
            for c in recent_clips:
                if any(w.lower() in (c.title or "").lower() for w in idea["topic"].split() if len(w) > 4):
                    idea["associated_clip_id"] = c.id
                    idea["associated_source_video_id"] = c.video_id
                    break

        return ideas

    def _call_ollama_trend_analysis(self, topic: str, niche: str, indicator: str, model: str) -> Optional[Dict[str, Any]]:
        # Sanitize untrusted external inputs
        safe_topic = re.sub(r'["\\]', '', topic)[:120]
        safe_indicator = re.sub(r'["\\]', '', indicator)[:80]
        safe_niche = re.sub(r'["\\]', '', niche)[:40]

        prompt = f"""You are a senior YouTube Shorts and Instagram Reels strategist.
Analyze this trending topic for a creator in the '{safe_niche}' niche:
Topic: "{safe_topic}"
Signal: "{safe_indicator}"

Respond ONLY with a valid JSON object matching this schema:
{{
  "why_attention": "Concise 1-sentence explanation of why viewers care right now",
  "target_audience": "Specific audience description (e.g. 'Junior developers and AI enthusiasts')",
  "opportunity_score": 88.5,
  "competition_level": "medium",
  "related_keywords": ["keyword1", "keyword2", "keyword3"],
  "suggested_hashtags": ["#tag1", "#tag2", "#tag3"],
  "content_angles": ["Angle 1", "Angle 2"],
  "suggested_titles": ["Shorts Title 1", "Shorts Title 2"],
  "suggested_hooks": ["Opening hook 1 (first 3 seconds)", "Opening hook 2"],
  "video_formats": ["Fast Explainer", "Myth Buster"]
}}
Do NOT output any markdown backticks, explanations, or prose. Just raw JSON."""

        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.4}
        }
        req = urllib.request.Request(
            f"{self.ollama_url}/api/generate",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=12.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            raw = data.get("response", "").strip()
            # Clean possible markdown wrapping
            if raw.startswith("```"):
                raw = re.sub(r"^```(?:json)?\n", "", raw)
                raw = re.sub(r"\n```$", "", raw)
            parsed = json.loads(raw)
            parsed["topic_name"] = topic
            parsed["niche"] = niche
            return parsed

    def _call_ollama_content_ideas(
        self,
        niche: str,
        trending_topics: List[str],
        transcript_snippets: List[str],
        clip_titles: List[str],
        count: int,
        model: str
    ) -> List[Dict[str, Any]]:
        safe_niche = re.sub(r'["\\]', '', niche)[:40]
        safe_topics = [re.sub(r'["\\]', '', str(t))[:120] for t in trending_topics[:5]]
        safe_clip_themes = [re.sub(r'["\\]', '', str(c))[:80] for c in clip_titles[:4]]

        prompt = f"""You are an elite short-form video strategist.
Generate {count} unique, high-retention Short/Reel concepts for the '{safe_niche}' niche.
Trending topics: {json.dumps(safe_topics)}
Previous content themes: {json.dumps(safe_clip_themes)}

Respond ONLY with a valid JSON array of {count} items matching this schema:
[
  {{
    "topic": "Topic Name",
    "concept": "1-2 sentence core video premise",
    "suggested_title": "Hooky YouTube Shorts Title",
    "opening_hook": "First 3-5 seconds spoken hook that stops scrolling",
    "short_description": "Brief description with video flow",
    "target_audience": "Target demographic",
    "keywords": ["tag1", "tag2"],
    "hashtags": ["#Shorts", "#Niche"],
    "recommended_duration_seconds": 35.0,
    "why_create": "Why this video will hold attention right now"
  }}
]
Do NOT output any markdown codeblocks or extra text. Only raw JSON array."""

        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.5}
        }
        req = urllib.request.Request(
            f"{self.ollama_url}/api/generate",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=15.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            raw = data.get("response", "").strip()
            if raw.startswith("```"):
                raw = re.sub(r"^```(?:json)?\n", "", raw)
                raw = re.sub(r"\n```$", "", raw)
            return json.loads(raw)

    def _heuristic_trend_analysis(self, topic: str, niche: str, indicator: str) -> Dict[str, Any]:
        """Reliable rule-based analysis when Ollama is offline or busy."""
        words = [w for w in re.findall(r"\b[A-Za-z0-9]+\b", topic) if len(w) > 3]
        clean_keywords = [w.lower() for w in words[:4]]
        hashtags = [f"#{w.capitalize()}" for w in words[:3]] + [f"#{niche.capitalize()}", "#Shorts"]

        return {
            "topic_name": topic,
            "niche": niche,
            "why_attention": f"High momentum across online discussions driven by recent developments and community interest.",
            "target_audience": f"Creators, practitioners, and curious learners in {niche}",
            "opportunity_score": 84.0,
            "competition_level": "medium",
            "related_keywords": clean_keywords + [f"{niche.lower()} tips", f"best {niche.lower()}"],
            "suggested_hashtags": hashtags,
            "content_angles": [
                f"The 1 Big Mistake Everyone Makes With {topic}",
                f"Why {topic} Is Changing Everything in 2026",
                f"Beginner vs Expert Approach to {topic}"
            ],
            "suggested_titles": [
                f"Why Everyone is Wrong About {topic[:40]}",
                f"The Untold Truth Behind {topic[:40]}",
                f"Stop Doing This If You Want to Master {topic[:35]}"
            ],
            "suggested_hooks": [
                f"If you're still doing this with {topic[:30]}, you're leaving results on the table.",
                f"Nobody is talking about the real reason behind {topic[:30]}, but here is the truth.",
                f"This single change regarding {topic[:30]} will save you months of wasted time."
            ],
            "video_formats": ["Myth Buster", "Fast-Paced Explainer", "Step-by-Step Breakdown"]
        }

    def _heuristic_content_ideas(
        self,
        niche: str,
        trending_topics: List[str],
        existing_topics: List[str],
        recent_clips: List[Clip],
        count: int = 4
    ) -> List[Dict[str, Any]]:
        """Generates diverse, non-repeating ideas based on trends and existing clips."""
        pool = list(trending_topics)
        if not pool:
            pool = [
                f"Top 3 Tools for {niche.title()} in 2026",
                f"The Biggest Mistake in {niche.title()} Revealed",
                f"How Beginners Can Master {niche.title()} Faster",
                f"The Secret Technique Nobody Tells You About {niche.title()}"
            ]

        ideas = []
        for i, item in enumerate(pool[:count]):
            # Avoid duplicate topic
            if item in existing_topics and len(pool) > count:
                continue

            ideas.append({
                "topic": item,
                "concept": f"A dynamic 35-second breakdown focusing on the single most surprising aspect of {item}.",
                "suggested_title": f"The Secret Behind {item[:45]} That Works in 2026",
                "opening_hook": f"Here is why 99% of people get {item[:30]} completely backwards...",
                "short_description": f"Hook viewers with a common misconception about {item}, followed by a rapid 3-point reveal and punchy conclusion.",
                "target_audience": f"{niche.title()} creators, students, and everyday mobile viewers",
                "keywords": [niche.lower(), "shorts", "reels", "tips", "hacks"],
                "hashtags": [f"#{niche.capitalize()}", "#Shorts", "#CreatorTips", "#ViralHacks"],
                "recommended_duration_seconds": 32.0 + (i * 4.0),
                "why_create": f"Combines high topical search momentum with curiosity-driven retention structuring."
            })

        return ideas
