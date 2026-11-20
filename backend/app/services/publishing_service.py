import json
import logging
import re
import urllib.request
import urllib.error
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.config import settings
from app.models.clip import Clip
from app.models.source_video import SourceVideo
from app.models.transcript import Transcript, TranscriptSegment
from app.models.strategy import ChannelProfile
from app.models.publishing_kit import PublishingKit

logger = logging.getLogger(__name__)

class PublishingService:
    """Generates and manages platform-specific publishing kits for YouTube Shorts and Instagram Reels."""

    def __init__(self, db: Session, ollama_url: str = "http://127.0.0.1:11434"):
        self.db = db
        self.ollama_url = ollama_url

    def is_ollama_available(self) -> bool:
        try:
            req = urllib.request.Request(f"{self.ollama_url}/api/tags", headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                return resp.status == 200
        except Exception:
            return False

    def parse_json_response(self, raw: str) -> Dict[str, Any]:
        """Safely parses LLM json output, stripping code fences if present."""
        text = raw.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\n", "", text)
            text = re.sub(r"\n```$", "", text)
        return json.loads(text)

    def extract_clip_transcript(self, clip: Clip) -> str:
        """Extracts transcript restricted strictly to the selected clip's start and end timestamps."""
        transcript = self.db.query(Transcript).filter(
            Transcript.video_id == clip.video_id
        ).order_by(Transcript.created_at.desc()).first()

        if not transcript:
            return ""

        segments = self.db.query(TranscriptSegment).filter(
            TranscriptSegment.transcript_id == transcript.id
        ).order_by(TranscriptSegment.start_time.asc()).all()

        start = clip.start_time or 0.0
        end = clip.end_time or (start + (clip.duration or 30.0))

        # Restrict strictly to clip boundaries
        clip_words = []
        for s in segments:
            if s.end_time >= start and s.start_time <= end:
                clip_words.append(s.text.strip())

        extracted = " ".join(clip_words).strip()
        if not extracted and transcript.full_text:
            extracted = transcript.full_text[:400]

        return extracted

    def get_or_create_kit(
        self,
        clip_id: str,
        channel_profile_id: Optional[str] = None,
        model_name: str = "qwen2.5:3b"
    ) -> PublishingKit:
        """Retrieves existing publishing kit or generates a brand-new platform-specific kit."""
        existing = self.db.query(PublishingKit).filter(PublishingKit.clip_id == clip_id).first()
        if existing:
            return existing

        clip = self.db.query(Clip).filter(Clip.id == clip_id).first()
        if not clip:
            raise ValueError(f"Clip '{clip_id}' not found.")

        return self.generate_publishing_kit(clip=clip, channel_profile_id=channel_profile_id, model_name=model_name)

    def generate_publishing_kit(
        self,
        clip: Clip,
        channel_profile_id: Optional[str] = None,
        model_name: str = "qwen2.5:3b",
        regenerate_platform: Optional[str] = None,  # None (both), "youtube", or "instagram"
        field_name: Optional[str] = None
    ) -> PublishingKit:
        """Generates comprehensive publishing kit tailored separately for YouTube Shorts and Instagram Reels."""
        # 1. Resolve Clip Transcript & Context
        clip_dialogue = self.extract_clip_transcript(clip)
        if not clip_dialogue:
            clip_dialogue = clip.description or clip.hook_summary or clip.title or "Key viral takeaway and insights."

        # 2. Resolve Channel Profile & Brand Settings
        profile = None
        if channel_profile_id:
            profile = self.db.query(ChannelProfile).filter(ChannelProfile.id == channel_profile_id).first()
        if not profile:
            profile = self.db.query(ChannelProfile).first()

        brand_voice = profile.brand_voice if profile and profile.brand_voice else "Conversational"
        niche = profile.niche if profile and profile.niche else (clip.main_topic or "General")
        lang = profile.content_language if profile and profile.content_language else "English"
        cta_pref = profile.default_cta if profile and profile.default_cta else "Subscribe for more"
        audience = profile.target_audience_level if profile and profile.target_audience_level else (clip.target_audience or "General audience")

        brand_snapshot = {
            "channel_name": profile.name if profile else "Creator Studio",
            "niche": niche,
            "brand_voice": brand_voice,
            "language": lang,
            "content_language": lang,
            "audience": audience,
            "default_cta": cta_pref
        }

        # 3. Generate YouTube Kit
        yt_kit = None
        if regenerate_platform in [None, "youtube"]:
            yt_kit = self._generate_youtube_kit(
                clip=clip,
                dialogue=clip_dialogue,
                brand=brand_snapshot,
                model_name=model_name
            )

        # 4. Generate Instagram Kit
        ig_kit = None
        if regenerate_platform in [None, "instagram"]:
            ig_kit = self._generate_instagram_kit(
                clip=clip,
                dialogue=clip_dialogue,
                brand=brand_snapshot,
                model_name=model_name
            )

        # 5. Persist or update PublishingKit record
        kit = self.db.query(PublishingKit).filter(PublishingKit.clip_id == clip.id).first()
        if not kit:
            kit = PublishingKit(
                project_id=clip.project_id,
                video_id=clip.video_id,
                clip_id=clip.id,
                channel_profile_id=profile.id if profile else None,
                clip_transcript_used=clip_dialogue[:1500],
                language=lang,
                status="draft",
                brand_settings_applied_json=json.dumps(brand_snapshot)
            )
            self.db.add(kit)
        else:
            if channel_profile_id:
                kit.channel_profile_id = channel_profile_id
            kit.brand_settings_applied_json = json.dumps(brand_snapshot)
            kit.language = lang

        if yt_kit:
            if field_name == "titles":
                kit.yt_titles_json = json.dumps(yt_kit["titles"])
                kit.yt_primary_title_index = 0
            elif field_name == "description":
                kit.yt_description_short = yt_kit["description_short"]
                kit.yt_description_alt = yt_kit["description_alt"]
                kit.yt_description_seo = yt_kit["description_seo"]
            elif field_name == "hashtags":
                kit.yt_hashtags_json = json.dumps(yt_kit["hashtags"])
            elif field_name == "tags":
                kit.yt_tags_csv = yt_kit["tags_csv"]
            else:
                kit.yt_primary_title_index = 0
                kit.yt_titles_json = json.dumps(yt_kit["titles"])
                kit.yt_description_short = yt_kit["description_short"]
                kit.yt_description_alt = yt_kit["description_alt"]
                kit.yt_description_seo = yt_kit["description_seo"]
                kit.yt_selected_description = "short"
                kit.yt_hashtags_json = json.dumps(yt_kit["hashtags"])
                kit.yt_tags_csv = yt_kit["tags_csv"]
                kit.yt_category = yt_kit.get("category", "Entertainment")
                kit.yt_pinned_comment = yt_kit["pinned_comment"]
                kit.yt_thumbnail_texts_json = json.dumps(yt_kit["thumbnail_texts"])
                kit.yt_playlist_topic = yt_kit["playlist_topic"]
                kit.yt_audience_positioning = yt_kit["audience_positioning"]
                kit.yt_content_language = lang
                kit.yt_cta = yt_kit["cta"]

        if ig_kit:
            if field_name == "captions":
                kit.ig_captions_json = json.dumps(ig_kit["captions"])
                kit.ig_selected_caption_index = 0
            elif field_name == "hook":
                kit.ig_first_line_hook = ig_kit["first_line_hook"]
            elif field_name == "hashtags":
                kit.ig_hashtags_json = json.dumps(ig_kit["hashtags"])
            elif field_name == "audio":
                kit.ig_audio_direction = ig_kit["audio_direction"]
            else:
                kit.ig_selected_caption_index = 0
                kit.ig_captions_json = json.dumps(ig_kit["captions"])
                kit.ig_hashtags_json = json.dumps(ig_kit["hashtags"])
                kit.ig_cover_texts_json = json.dumps(ig_kit["cover_texts"])
                kit.ig_first_line_hook = ig_kit["first_line_hook"]
                kit.ig_cta = ig_kit["cta"]
                kit.ig_keywords_csv = ig_kit["keywords_csv"]
                kit.ig_target_audience = ig_kit["target_audience"]
                kit.ig_posting_category = ig_kit["posting_category"]
                kit.ig_audio_direction = ig_kit["audio_direction"]

        kit.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(kit)
        return kit

    def _generate_youtube_kit(self, clip: Clip, dialogue: str, brand: Dict[str, Any], model_name: str) -> Dict[str, Any]:
        """Generates SEO-focused YouTube Shorts metadata."""
        if self.is_ollama_available():
            try:
                ai_yt = self._call_ollama_youtube(clip, dialogue, brand, model_name)
                if ai_yt:
                    return ai_yt
            except Exception as e:
                logger.warning(f"Ollama YouTube kit generation failed, falling back: {e}")

        return self._heuristic_youtube_kit(clip, dialogue, brand)

    def _generate_instagram_kit(self, clip: Clip, dialogue: str, brand: Dict[str, Any], model_name: str) -> Dict[str, Any]:
        """Generates conversational engagement-focused Instagram Reels metadata."""
        if self.is_ollama_available():
            try:
                ai_ig = self._call_ollama_instagram(clip, dialogue, brand, model_name)
                if ai_ig:
                    return ai_ig
            except Exception as e:
                logger.warning(f"Ollama Instagram kit generation failed, falling back: {e}")

        return self._heuristic_instagram_kit(clip, dialogue, brand)

    # ----------------- OLLAMA INFERENCE PATHS -----------------

    def _call_ollama_youtube(self, clip: Clip, dialogue: str, brand: Dict[str, Any], model: str) -> Optional[Dict[str, Any]]:
        safe_dialogue = re.sub(r'["\\]', '', dialogue)[:700]
        safe_title = re.sub(r'["\\]', '', clip.title or "Viral Highlight")[:80]
        niche = brand.get("niche", "General")
        voice = brand.get("brand_voice", "Conversational")

        prompt = f"""You are a YouTube Shorts SEO and metadata specialist.
Context for the short video clip:
Topic: "{niche}"
Current Title: "{safe_title}"
Spoken Dialogue: "{safe_dialogue}"
Brand Voice: "{voice}"

Generate YouTube Shorts publishing metadata strictly following this JSON schema:
{{
  "titles": [
    {{"title": "Title 1 (max 65 chars)", "strategy": "curiosity", "explanation": "Why it sparks clicks", "char_count": 45}},
    {{"title": "Title 2 (max 65 chars)", "strategy": "educational", "explanation": "Clear instructional hook", "char_count": 48}},
    {{"title": "Title 3 (max 65 chars)", "strategy": "emotional", "explanation": "Resonant feeling", "char_count": 42}},
    {{"title": "Title 4 (max 65 chars)", "strategy": "bold", "explanation": "Strong punchy statement", "char_count": 39}},
    {{"title": "Title 5 (max 65 chars)", "strategy": "storytelling", "explanation": "Narrative intrigue", "char_count": 52}}
  ],
  "description_short": "2-sentence punchy summary of what happens in the video with CTA.",
  "description_alt": "Conversational casual breakdown with key takeaway.",
  "description_seo": "Search-optimized comprehensive description embedding keywords naturally.",
  "hashtags": {{
    "broad": ["#Shorts", "#YouTubeShorts"],
    "specific": ["#SpecificKeyword", "#TopicTag"],
    "audience": ["#CreatorTips", "#LearnOnShorts"]
  }},
  "tags_csv": "keyword1, keyword2, related search phrase, niche topic, shorts",
  "category": "Education",
  "pinned_comment": "Engaging pinned question to spark replies in the comment section.",
  "thumbnail_texts": ["3-WORD PUNCHY HOOK", "THE SECRET REVEALED", "NEVER DO THIS"],
  "playlist_topic": "Best {niche} Shorts",
  "audience_positioning": "Beginners and curious learners",
  "cta": "Subscribe for more {niche} tips every week!"
}}
Output ONLY valid JSON. No markdown code blocks, no prose."""

        payload = {"model": model, "prompt": prompt, "stream": False, "options": {"temperature": 0.4}}
        req = urllib.request.Request(f"{self.ollama_url}/api/generate", data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=16.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            raw = data.get("response", "").strip()
            if raw.startswith("```"):
                raw = re.sub(r"^```(?:json)?\n", "", raw)
                raw = re.sub(r"\n```$", "", raw)
            parsed = json.loads(raw)
            # Recompute accurate character counts
            for t in parsed.get("titles", []):
                t["char_count"] = len(t["title"])
            return parsed

    def _call_ollama_instagram(self, clip: Clip, dialogue: str, brand: Dict[str, Any], model: str) -> Optional[Dict[str, Any]]:
        safe_dialogue = re.sub(r'["\\]', '', dialogue)[:700]
        safe_title = re.sub(r'["\\]', '', clip.title or "Viral Reel")[:80]
        niche = brand.get("niche", "General")
        voice = brand.get("brand_voice", "Conversational")

        prompt = f"""You are an Instagram Reels copywriter and social media strategist.
Context for the short Reel:
Niche: "{niche}"
Title: "{safe_title}"
Spoken Dialogue: "{safe_dialogue}"
Brand Voice: "{voice}"

Generate Instagram Reels publishing metadata strictly following this JSON schema:
{{
  "captions": [
    {{"type": "short", "text": "Hook line that stops the scroll.\\n\\nQuick punchy takeaway.\\n\\nDouble tap and follow for daily tips!", "char_count": 120}},
    {{"type": "conversational", "text": "Have you ever wondered why this happens?\\n\\nHere is the real breakdown from today's session... Drop a comment below with your thoughts!", "char_count": 210}},
    {{"type": "detailed", "text": "The full story behind this moment:\\n\\n1. First key lesson\\n2. What most people miss\\n\\nSave this Reel for later!", "char_count": 320}}
  ],
  "hashtags": {{
    "niche": ["#ReelsInstagram", "#InstaReels"],
    "topic": ["#Daily{niche.replace(' ', '')}", "#{niche.replace(' ', '')}Life"],
    "community": ["#CreatorCommunity", "#ReelsViral"]
  }},
  "cover_texts": ["WAIT FOR IT...", "THE BIG REVEAL", "3 KEY LESSONS"],
  "first_line_hook": "Stop scrolling: this completely changed how I think about this.",
  "cta": "Save this Reel and share it with someone who needs to hear it!",
  "keywords_csv": "instagram reels, {niche.lower()}, viral audio, creator tips",
  "target_audience": "Engaged mobile scrollers and community members",
  "posting_category": "Creators & Lifestyle",
  "audio_direction": "Upbeat, energetic trending instrumental beat"
}}
Output ONLY valid JSON. No markdown code blocks, no prose."""

        payload = {"model": model, "prompt": prompt, "stream": False, "options": {"temperature": 0.5}}
        req = urllib.request.Request(f"{self.ollama_url}/api/generate", data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=16.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            raw = data.get("response", "").strip()
            if raw.startswith("```"):
                raw = re.sub(r"^```(?:json)?\n", "", raw)
                raw = re.sub(r"\n```$", "", raw)
            parsed = json.loads(raw)
            for c in parsed.get("captions", []):
                c["char_count"] = len(c["text"])
            return parsed

    # ----------------- HEURISTIC FALLBACK PATHS -----------------

    def _heuristic_youtube_kit(self, clip: Clip, dialogue: str, brand: Dict[str, Any]) -> Dict[str, Any]:
        """Deterministic, rich heuristic fallback for YouTube Shorts."""
        base_title = (clip.title or "Powerful Insight").strip()
        niche = brand.get("niche", "General").title()
        words = [w for w in re.findall(r"\b[A-Za-z0-9]+\b", dialogue) if len(w) > 4]
        keywords = list(dict.fromkeys(words[:6]))

        titles = [
            {
                "title": f"The Secret Truth Behind {base_title[:45]}",
                "strategy": "curiosity",
                "explanation": "Creates an information gap that compels viewer clicks.",
                "char_count": len(f"The Secret Truth Behind {base_title[:45]}")
            },
            {
                "title": f"How to Master {base_title[:45]} in 30 Seconds",
                "strategy": "educational",
                "explanation": "Promises quick, actionable mastery for busy learners.",
                "char_count": len(f"How to Master {base_title[:45]} in 30 Seconds")
            },
            {
                "title": f"Why Everyone Gets {base_title[:40]} Completely Wrong",
                "strategy": "emotional",
                "explanation": "Stirs contrarian curiosity and personal challenge.",
                "char_count": len(f"Why Everyone Gets {base_title[:40]} Completely Wrong")
            },
            {
                "title": f"Stop Doing This If You Care About {niche[:35]}",
                "strategy": "bold",
                "explanation": "Urgent negative warning hook that prevents scrolling past.",
                "char_count": len(f"Stop Doing This If You Care About {niche[:35]}")
            },
            {
                "title": f"What Happened When I Tried {base_title[:40]}",
                "strategy": "storytelling",
                "explanation": "Personal narrative angle that drives retention to the end.",
                "char_count": len(f"What Happened When I Tried {base_title[:40]}")
            }
        ]

        desc_short = f"Here is the essential breakdown on {base_title}. Watch until the end for the key revelation!\n\nSubscribe for more daily {niche.lower()} breakdowns."
        desc_alt = f"Did you know this about {base_title}? In this short clip, we dive into the core details everyone needs to understand.\n\nDrop your thoughts in the comments!"
        desc_seo = f"In this video, we explore {base_title} and reveal actionable strategies for {niche}. Key themes include {', '.join(keywords[:4])}.\n\nIf you enjoyed this short, hit Subscribe and check out our full playlist!"

        broad_tags = ["#Shorts", "#YouTubeShorts"]
        specific_tags = [f"#{niche.replace(' ', '')}", f"#{re.sub(r'[^a-zA-Z0-9]', '', base_title[:20])}"]
        audience_tags = ["#LearnOnShorts", "#CreatorTips"]

        tags_list = [base_title.lower(), niche.lower(), f"{niche.lower()} shorts", "viral shorts", "youtube tips"] + [k.lower() for k in keywords[:4]]
        tags_csv = ", ".join(dict.fromkeys(tags_list))[:490]

        return {
            "titles": titles,
            "description_short": desc_short,
            "description_alt": desc_alt,
            "description_seo": desc_seo,
            "hashtags": {
                "broad": broad_tags,
                "specific": specific_tags,
                "audience": audience_tags
            },
            "tags_csv": tags_csv,
            "category": "Education",
            "pinned_comment": f"What was your biggest takeaway from this clip? Let me know below and I'll reply to the best comments!",
            "thumbnail_texts": [
                "THE UNTOLD TRUTH",
                "WATCH BEFORE YOU TRY",
                "30-SECOND MASTERCLASS"
            ],
            "playlist_topic": f"Essential {niche} Shorts",
            "audience_positioning": f"{niche} enthusiasts and mobile learners",
            "cta": brand.get("default_cta") or f"Subscribe for more daily {niche} Shorts!"
        }

    def _heuristic_instagram_kit(self, clip: Clip, dialogue: str, brand: Dict[str, Any]) -> Dict[str, Any]:
        """Deterministic, rich heuristic fallback for Instagram Reels."""
        base_title = (clip.title or "Viral Highlight").strip()
        niche = brand.get("niche", "General").title()

        cap_short = f"Stop scrolling if you care about {niche.lower()} 👇\n\n{base_title} is something almost everyone overlooks.\n\nDouble tap if you learned something new! ❤️"
        cap_conv = f"Be honest: did you know this already?\n\n{base_title} completely shifts how we look at {niche.lower()}.\n\nTag a friend who needs to see this! 🚀"
        cap_detailed = f"The real story behind {base_title}:\n\nHere is why this matters right now:\n1. Timing and consistency are everything.\n2. Small adjustments yield massive results.\n\nSave this Reel so you can reference it later! 📌"

        captions = [
            {"type": "short", "text": cap_short, "char_count": len(cap_short)},
            {"type": "conversational", "text": cap_conv, "char_count": len(cap_conv)},
            {"type": "detailed", "text": cap_detailed, "char_count": len(cap_detailed)}
        ]

        hashtags = {
            "niche": ["#ReelsInstagram", f"#{niche.replace(' ', '')}Reels", "#ExplorePage"],
            "topic": [f"#{niche.replace(' ', '')}Tips", f"#{re.sub(r'[^a-zA-Z0-9]', '', base_title[:18])}"],
            "community": ["#CreatorCommunity", "#DailyInspiration"]
        }

        return {
            "captions": captions,
            "hashtags": hashtags,
            "cover_texts": [
                "THE SHOCKING REASON...",
                "MUST-WATCH BREAKDOWN",
                "SAVE THIS TIP"
            ],
            "first_line_hook": f"You won't believe what happens when you understand {base_title[:30]}...",
            "cta": brand.get("default_cta") or "Save this Reel and share with your creative circle!",
            "keywords_csv": f"reels, {niche.lower()}, explore page, creator tips, viral hooks",
            "target_audience": "Active Instagram community & visual learners",
            "posting_category": "Creators & Entertainment",
            "audio_direction": "Energetic, driving lo-fi instrumental beat"
        }

    # ----------------- EXPORTING (TXT, JSON, ZIP) -----------------

    def format_youtube_text(self, kit: PublishingKit, clip: Optional[Clip] = None) -> str:
        """Formats clean copy-ready YouTube Shorts publication text."""
        yt_titles = json.loads(kit.yt_titles_json or "[]")
        yt_tags = json.loads(kit.yt_hashtags_json or "{}")
        primary_title = yt_titles[kit.yt_primary_title_index]["title"] if yt_titles and len(yt_titles) > kit.yt_primary_title_index else (clip.title if clip else "Short")
        selected_desc = (
            kit.yt_description_alt if kit.yt_selected_description == "alt"
            else kit.yt_description_seo if kit.yt_selected_description == "seo"
            else kit.yt_description_short
        ) or ""
        all_hashtags = []
        for t in yt_tags.values():
            all_hashtags.extend(t)

        return (
            f"=== YOUTUBE SHORTS PUBLISHING KIT ===\n"
            f"TITLE:\n{primary_title}\n\n"
            f"DESCRIPTION:\n{selected_desc}\n\n"
            f"HASHTAGS:\n{' '.join(all_hashtags)}\n\n"
            f"TAGS:\n{kit.yt_tags_csv or ''}\n\n"
            f"PINNED COMMENT:\n{kit.yt_pinned_comment or ''}"
        )

    def format_instagram_text(self, kit: PublishingKit, clip: Optional[Clip] = None) -> str:
        """Formats clean copy-ready Instagram Reels publication text."""
        ig_captions = json.loads(kit.ig_captions_json or "[]")
        ig_tags = json.loads(kit.ig_hashtags_json or "{}")
        selected_caption = ig_captions[kit.ig_selected_caption_index]["text"] if ig_captions and len(ig_captions) > kit.ig_selected_caption_index else ""
        all_hashtags = []
        for t in ig_tags.values():
            all_hashtags.extend(t)

        return (
            f"=== INSTAGRAM REELS PUBLISHING KIT ===\n"
            f"FIRST-LINE HOOK:\n{kit.ig_first_line_hook or ''}\n\n"
            f"CAPTION:\n{selected_caption}\n\n"
            f"HASHTAGS:\n{' '.join(all_hashtags)}\n\n"
            f"AUDIO MOOD DIRECTION:\n{kit.ig_audio_direction or ''}"
        )

    def generate_txt_export(self, kit: PublishingKit) -> str:
        """Generates a human-readable plain text publishing guide."""
        yt_titles = json.loads(kit.yt_titles_json or "[]")
        yt_tags = json.loads(kit.yt_hashtags_json or "{}")
        ig_captions = json.loads(kit.ig_captions_json or "[]")
        ig_tags = json.loads(kit.ig_hashtags_json or "{}")

        primary_title = yt_titles[kit.yt_primary_title_index]["title"] if yt_titles and len(yt_titles) > kit.yt_primary_title_index else "Untitled Short"
        selected_desc = (
            kit.yt_description_alt if kit.yt_selected_description == "alt"
            else kit.yt_description_seo if kit.yt_selected_description == "seo"
            else kit.yt_description_short
        ) or ""

        selected_caption = ig_captions[kit.ig_selected_caption_index]["text"] if ig_captions and len(ig_captions) > kit.ig_selected_caption_index else ""

        all_yt_hashtags = []
        for tag_list in yt_tags.values():
            all_yt_hashtags.extend(tag_list)

        all_ig_hashtags = []
        for tag_list in ig_tags.values():
            all_ig_hashtags.extend(tag_list)

        lines = [
            "=" * 70,
            "AI SHORTS STUDIO — MANUAL PUBLISHING KIT",
            "=" * 70,
            f"Generated: {kit.created_at.strftime('%Y-%m-%d %H:%M:%S UTC') if kit.created_at else 'Recent'}",
            f"Clip ID: {kit.clip_id}",
            f"Language: {kit.language}",
            "",
            "----------------------------------------------------------------------",
            "1. YOUTUBE SHORTS PUBLISHING KIT",
            "----------------------------------------------------------------------",
            "[PRIMARY TITLE]",
            primary_title,
            f"(Length: {len(primary_title)} / 100 characters)",
            "",
            "[ALTERNATIVE TITLE OPTIONS]",
        ]
        for idx, t in enumerate(yt_titles):
            prefix = "[PRIMARY] " if idx == kit.yt_primary_title_index else f"[{idx + 1}] "
            lines.append(f"{prefix}{t['title']} ({t.get('strategy', 'curiosity').upper()} — {t.get('char_count', len(t['title']))} chars)")

        lines.extend([
            "",
            "[DESCRIPTION]",
            selected_desc,
            "",
            "[HASHTAGS]",
            " ".join(all_yt_hashtags),
            "",
            "[YOUTUBE VIDEO TAGS / KEYWORDS]",
            kit.yt_tags_csv or "",
            f"(Combined Tags Length: {len(kit.yt_tags_csv or '')} / 500 chars)",
            "",
            "[PINNED COMMENT SUGGESTION]",
            kit.yt_pinned_comment or "",
            "",
            "[THUMBNAIL COVER TEXT OPTIONS]",
            ", ".join(json.loads(kit.yt_thumbnail_texts_json or "[]")),
            "",
            "----------------------------------------------------------------------",
            "2. INSTAGRAM REELS PUBLISHING KIT",
            "----------------------------------------------------------------------",
            "[CAPTION]",
            selected_caption,
            "",
            "[FIRST-LINE HOOK]",
            kit.ig_first_line_hook or "",
            "",
            "[INSTAGRAM HASHTAGS]",
            " ".join(all_ig_hashtags),
            "",
            "[CALL TO ACTION (CTA)]",
            kit.ig_cta or "",
            "",
            "[COVER TEXT OPTIONS]",
            ", ".join(json.loads(kit.ig_cover_texts_json or "[]")),
            "",
            "[SUGGESTED AUDIO DIRECTION]",
            kit.ig_audio_direction or "Upbeat instrumental",
            "",
            "=" * 70,
            "MANUAL PUBLISHING INSTRUCTIONS:",
            "1. Download your rendered vertical 9:16 video from AI Shorts Studio.",
            "2. Open YouTube Shorts or Instagram Reels app on desktop or mobile.",
            "3. Copy the respective title, description/caption, and hashtags from this file.",
            "4. Publish manually. Remember to record your publishing link back in the Studio!",
            "=" * 70
        ])
        return "\n".join(lines)

    def generate_json_export(self, kit: PublishingKit) -> Dict[str, Any]:
        """Generates a complete structured JSON publishing package."""
        clip = self.db.query(Clip).filter(Clip.id == kit.clip_id).first()
        yt_titles = json.loads(kit.yt_titles_json or "[]")
        primary_title = yt_titles[kit.yt_primary_title_index]["title"] if yt_titles and len(yt_titles) > kit.yt_primary_title_index else (clip.title if clip else "")

        return {
            "kit_id": kit.id,
            "publishing_kit_id": kit.id,
            "clip_id": kit.clip_id,
            "project_id": kit.project_id,
            "video_id": kit.video_id,
            "status": kit.status,
            "language": kit.language,
            "generated_at": kit.created_at.isoformat() if kit.created_at else None,
            "clip": {
                "id": clip.id if clip else kit.clip_id,
                "title": clip.title if clip else "Short",
                "duration": clip.duration if clip else 30.0,
                "overall_score": clip.overall_score if clip else 70.0
            },
            "youtube": {
                "primary_title_index": kit.yt_primary_title_index,
                "selected_title": primary_title,
                "titles": yt_titles,
                "description_short": kit.yt_description_short,
                "description_alt": kit.yt_description_alt,
                "description_seo": kit.yt_description_seo,
                "selected_description": kit.yt_selected_description,
                "hashtags": json.loads(kit.yt_hashtags_json or "{}"),
                "tags_csv": kit.yt_tags_csv,
                "category": kit.yt_category,
                "pinned_comment": kit.yt_pinned_comment,
                "thumbnail_texts": json.loads(kit.yt_thumbnail_texts_json or "[]"),
                "playlist_topic": kit.yt_playlist_topic,
                "cta": kit.yt_cta
            },
            "instagram": {
                "selected_caption_index": kit.ig_selected_caption_index,
                "captions": json.loads(kit.ig_captions_json or "[]"),
                "hashtags": json.loads(kit.ig_hashtags_json or "{}"),
                "cover_texts": json.loads(kit.ig_cover_texts_json or "[]"),
                "first_line_hook": kit.ig_first_line_hook,
                "cta": kit.ig_cta,
                "keywords_csv": kit.ig_keywords_csv,
                "audio_direction": kit.ig_audio_direction
            },
            "brand_settings_applied": json.loads(kit.brand_settings_applied_json or "{}")
        }

    def generate_zip_export(self, kit: PublishingKit) -> Path:
        """Packages video, TXT, JSON, subtitles, and thumbnails into a clean ZIP archive under D:\AI-Shorts-Studio\storage\exports."""
        settings.EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
        zip_filename = f"publishing_kit_{kit.clip_id[:8]}_{int(datetime.utcnow().timestamp())}.zip"
        zip_path = settings.EXPORTS_DIR / zip_filename

        clip = self.db.query(Clip).filter(Clip.id == kit.clip_id).first()

        txt_content = self.generate_txt_export(kit)
        json_content = json.dumps(self.generate_json_export(kit), indent=2)

        yt_only_txt = f"YOUTUBE SHORTS PUBLISHING KIT\n{'='*30}\n\nTitle:\n{json.loads(kit.yt_titles_json or '[]')[kit.yt_primary_title_index]['title'] if json.loads(kit.yt_titles_json or '[]') else ''}\n\nDescription:\n{kit.yt_description_short}\n\nTags:\n{kit.yt_tags_csv}\n\nPinned Comment:\n{kit.yt_pinned_comment}"
        ig_only_txt = f"INSTAGRAM REELS PUBLISHING KIT\n{'='*30}\n\nCaption:\n{json.loads(kit.ig_captions_json or '[]')[kit.ig_selected_caption_index]['text'] if json.loads(kit.ig_captions_json or '[]') else ''}\n\nHook:\n{kit.ig_first_line_hook}\n\nCTA:\n{kit.ig_cta}"

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            # 1. Text & JSON publishing kits
            zf.writestr("youtube/youtube-publishing-kit.txt", yt_only_txt)
            zf.writestr("youtube/metadata.txt", yt_only_txt)
            zf.writestr("youtube/youtube-publishing-kit.json", json.dumps(json.loads(kit.yt_titles_json or "[]"), indent=2))
            zf.writestr("instagram/instagram-publishing-kit.txt", ig_only_txt)
            zf.writestr("instagram/metadata.txt", ig_only_txt)
            zf.writestr("instagram/instagram-publishing-kit.json", json.dumps(json.loads(kit.ig_captions_json or "[]"), indent=2))
            zf.writestr("complete-publishing-kit.txt", txt_content)
            zf.writestr("publishing-package.json", json_content)

            # 2. Rendered Video MP4 (only if actually exists on disk)
            if clip and clip.output_path and Path(clip.output_path).exists():
                zf.write(clip.output_path, arcname=f"video/{Path(clip.output_path).name}")

            # 3. Subtitles (only if exist)
            if clip and clip.srt_path and Path(clip.srt_path).exists():
                zf.write(clip.srt_path, arcname="subtitles/subtitles.srt")
            if clip and clip.vtt_path and Path(clip.vtt_path).exists():
                zf.write(clip.vtt_path, arcname="subtitles/subtitles.vtt")

            # 4. Thumbnail (only if exists)
            if clip and clip.thumbnail_path and Path(clip.thumbnail_path).exists():
                zf.write(clip.thumbnail_path, arcname="thumbnails/cover.jpg")

            # 5. README
            readme = (
                "AI SHORTS STUDIO — PUBLISHING KIT ARCHIVE\n"
                "=========================================\n"
                "This folder contains all the assets and metadata required to publish your vertical video.\n\n"
                "Folders:\n"
                "- video/: Your final 9:16 vertical MP4 video.\n"
                "- youtube/: Title options, descriptions, tags, and pinned comment for YouTube Shorts.\n"
                "- instagram/: Hook, caption variations, and hashtags for Instagram Reels.\n"
                "- subtitles/: Subtitle tracks (SRT & VTT) for closed-caption uploads.\n"
                "- thumbnails/: High-resolution poster frame thumbnail.\n"
            )
            zf.writestr("README.txt", readme)

        return zip_path
