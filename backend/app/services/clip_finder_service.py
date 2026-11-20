import json
import re
import math
import logging
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Weight configuration matching viral algorithm scoring rubric
SCORE_WEIGHTS = {
    "hook": 0.20,
    "emotional": 0.15,
    "curiosity": 0.15,
    "story": 0.15,
    "information": 0.10,
    "clarity": 0.10,
    "shareability": 0.10,
    "ending": 0.05
}

class ClipFinderService:
    def __init__(self):
        self.ollama_url = settings.OLLAMA_API_URL

    def is_ollama_available(self) -> Tuple[bool, List[str]]:
        """Check if local Ollama daemon is reachable and return list of downloaded models."""
        try:
            with httpx.Client(timeout=0.2) as client:
                resp = client.get(f"{self.ollama_url}/api/tags")
                if resp.status_code == 200:
                    models = [m.get("name") for m in resp.json().get("models", [])]
                    return True, models
        except Exception:
            pass
        return False, []

    def snap_boundaries_to_words(
        self,
        start_time: float,
        end_time: float,
        segments: List[Dict[str, Any]],
        max_duration: float = 90.0,
        min_duration: float = 15.0
    ) -> Tuple[float, float]:
        """
        Snap arbitrary start and end times to the nearest natural word or sentence boundaries.
        Avoids cutting off mid-word or in the middle of a short phrase.
        """
        all_words = []
        for seg in segments:
            for w in seg.get("words", []):
                all_words.append(w)

        if not all_words:
            # Fallback to segment start/end if word timestamps are not present
            return round(start_time, 2), round(end_time, 2)

        # 1. Snap start_time: Find word whose start is closest to start_time
        # Prefer starting at the beginning of a sentence (or capital word / after pause)
        best_start = all_words[0]["start"]
        min_diff = float("inf")
        for i, w in enumerate(all_words):
            diff = abs(w["start"] - start_time)
            # Give slight preference to words that look like sentence starters
            is_sentence_starter = (
                i == 0 or
                all_words[i - 1]["word"].rstrip().endswith((".", "!", "?")) or
                (w["start"] - all_words[i - 1]["end"] >= 0.4)
            )
            adjusted_diff = diff * 0.75 if is_sentence_starter else diff
            if adjusted_diff < min_diff:
                min_diff = adjusted_diff
                best_start = w["start"]

        # 2. Snap end_time: Find word whose end concludes a sentence or thought
        # Look within [start_time + min_duration, start_time + max_duration]
        target_end = end_time
        best_end = all_words[-1]["end"]
        min_diff = float("inf")

        for i, w in enumerate(all_words):
            if w["start"] <= best_start:
                continue
            cur_dur = w["end"] - best_start
            if cur_dur > max_duration + 5:
                break
            
            diff = abs(w["end"] - target_end)
            is_sentence_ender = (
                w["word"].rstrip().endswith((".", "!", "?")) or
                (i + 1 < len(all_words) and all_words[i + 1]["start"] - w["end"] >= 0.5)
            )
            adjusted_diff = diff * 0.6 if is_sentence_ender else diff
            
            if cur_dur >= min_duration and adjusted_diff < min_diff:
                min_diff = adjusted_diff
                best_end = w["end"]

        # Final sanity check on duration
        if best_end <= best_start or (best_end - best_start) < min_duration:
            best_end = min(best_start + max(min_duration, 25.0), all_words[-1]["end"])

        return round(best_start, 2), round(best_end, 2)

    def calculate_overall_score(self, scores: Dict[str, float]) -> float:
        """Compute the composite viral potential score using calibrated weights."""
        total = 0.0
        for k, weight in SCORE_WEIGHTS.items():
            val = float(scores.get(k, 50.0))
            total += max(0.0, min(100.0, val)) * weight
        return round(total, 1)

    def deduplicate_candidates(
        self,
        candidates: List[Dict[str, Any]],
        max_overlap_ratio: float = 0.60
    ) -> List[Dict[str, Any]]:
        """
        Deduplicate candidate clips with high temporal overlap.
        Keeps the higher-scoring candidate when two clips overlap by more than max_overlap_ratio.
        """
        # Sort candidates descending by overall_score
        sorted_clips = sorted(candidates, key=lambda c: c.get("overall_score", 0), reverse=True)
        accepted = []

        for c in sorted_clips:
            c_start = c["start_time"]
            c_end = c["end_time"]
            c_dur = max(0.1, c_end - c_start)

            overlaps = False
            for acc in accepted:
                a_start = acc["start_time"]
                a_end = acc["end_time"]
                a_dur = max(0.1, a_end - a_start)

                # Temporal intersection
                inter = max(0.0, min(c_end, a_end) - max(c_start, a_start))
                overlap_ratio = inter / min(c_dur, a_dur)

                if overlap_ratio >= max_overlap_ratio:
                    overlaps = True
                    break

            if not overlaps:
                accepted.append(c)

        return accepted

    def analyze_with_heuristic(
        self,
        segments: List[Dict[str, Any]],
        target_count: int = 5,
        target_duration: float = 45.0,
        min_duration: float = 20.0,
        max_duration: float = 75.0,
        video_metadata: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Rule-based high-retention NLP clip finder.
        Used as a rock-solid zero-cost fallback when Ollama is offline or under memory pressure.
        Evaluates speech density, hook trigger words, emotional markers, and sentence closure.
        """
        if not segments:
            return []

        # Hook patterns for English, Hindi, and Hinglish
        HOOK_PATTERNS = [
            r"\b(secret|truth|never|nobody|stop|why|how to|what if|imagine|look at|check this|did you know|wait until)\b",
            r"\b(mistake|crazy|insane|shocking|unbelievable|huge|warning|fail|hack|trick|formula|strategy)\b",
            r"\b(kyun|kya|sach|dekho|sunno|samjho|sabse bada|asal mein|agar aap|galati|raaz)\b",
            r"\?{1,}"
        ]
        
        EMOTION_PATTERNS = [
            r"\b(love|hate|angry|amazing|terrifying|beautiful|excited|hilarious|crying|laughing|funniest|awesome)\b",
            r"\b(pyaar|gussa|darr|khushi|zabardast|kamaal|shandar|ajeeb)\b",
            r"!{1,}"
        ]

        CURIOSITY_PATTERNS = [
            r"\b(reason|because|happened|actually|turns out|discover|revealed|hidden|mystery|future|problem)\b",
            r"\b(vajah|kyunki|hua kya|asliyat|bhed|chupa)\b"
        ]

        # Adjust min_duration if entire transcript is shorter than configured min_duration
        total_transcript_dur = max(1.0, segments[-1]["end_time"] - segments[0]["start_time"])
        effective_min_duration = min(min_duration, max(2.0, total_transcript_dur * 0.7))
        effective_target_duration = min(target_duration, total_transcript_dur)

        # Break transcript into rolling candidates of target duration
        candidates = []
        n_segs = len(segments)
        
        # Stride through segments to formulate realistic short-form candidate windows
        for i in range(n_segs):
            start_seg = segments[i]
            cur_start = start_seg["start_time"]

            # Accumulate segments until duration >= target_duration or reaches end
            window_segs = []
            for j in range(i, n_segs):
                window_segs.append(segments[j])
                dur = segments[j]["end_time"] - cur_start
                if dur >= effective_min_duration:
                    if dur >= effective_target_duration or j == n_segs - 1 or (dur + (segments[j+1]["end_time"] - segments[j]["end_time"])) > max_duration:
                        break

            if not window_segs:
                continue

            window_text = " ".join(s.get("text", "").strip() for s in window_segs)
            raw_start = window_segs[0]["start_time"]
            raw_end = window_segs[-1]["end_time"]
            raw_dur = raw_end - raw_start

            if raw_dur < effective_min_duration or raw_dur > max_duration + 10:
                continue

            # Snap cleanly to words
            snapped_start, snapped_end = self.snap_boundaries_to_words(
                raw_start, raw_end, window_segs, max_duration=max_duration, min_duration=min_duration
            )
            final_dur = snapped_end - snapped_start
            if final_dur < min_duration:
                continue

            # Extract first 3-5 seconds text as hook
            hook_text = ""
            for s in window_segs:
                if s["start_time"] <= snapped_start + 6.0:
                    hook_text += " " + s.get("text", "").strip()
            hook_text = hook_text.strip()[:180]

            # 1. Hook Score (0-100)
            hook_score = 50.0
            for pat in HOOK_PATTERNS:
                matches = len(re.findall(pat, hook_text, re.IGNORECASE))
                hook_score += min(30.0, matches * 12.0)
            hook_score = min(98.0, max(45.0, hook_score))

            # 2. Emotional Score (0-100)
            emotional_score = 48.0
            for pat in EMOTION_PATTERNS:
                matches = len(re.findall(pat, window_text, re.IGNORECASE))
                emotional_score += min(35.0, matches * 9.0)
            emotional_score = min(95.0, max(40.0, emotional_score))

            # 3. Curiosity Score (0-100)
            curiosity_score = 50.0
            for pat in CURIOSITY_PATTERNS:
                matches = len(re.findall(pat, window_text, re.IGNORECASE))
                curiosity_score += min(35.0, matches * 10.0)
            curiosity_score = min(96.0, max(45.0, curiosity_score))

            # 4. Story Completeness & Flow (0-100)
            # Checks for logical connector words and balanced word pacing
            story_score = 65.0
            word_count = len(window_text.split())
            words_per_sec = word_count / max(1.0, final_dur)
            # Ideal speech pace for short-form retention is 2.3 to 3.5 words/second
            if 2.2 <= words_per_sec <= 3.8:
                story_score += 15.0
            else:
                story_score -= 10.0
            story_score = min(92.0, max(45.0, story_score))

            # 5. Information Score (0-100)
            info_score = min(90.0, max(50.0, 50.0 + (word_count / 15.0)))

            # 6. Clarity Score (0-100)
            clarity_score = 80.0
            if window_text.count(".") + window_text.count("?") >= 2:
                clarity_score += 10.0
            clarity_score = min(95.0, clarity_score)

            # 7. Shareability Score (0-100)
            shareability_score = round((hook_score * 0.4 + emotional_score * 0.3 + curiosity_score * 0.3), 1)

            # 8. Ending Score (0-100)
            last_word = window_text.strip()[-1] if window_text.strip() else ""
            ending_score = 85.0 if last_word in [".", "!", "?"] else 60.0

            scores_dict = {
                "hook": hook_score,
                "emotional": emotional_score,
                "curiosity": curiosity_score,
                "story": story_score,
                "information": info_score,
                "clarity": clarity_score,
                "shareability": shareability_score,
                "ending": ending_score
            }
            overall_score = self.calculate_overall_score(scores_dict)

            # Formulate title from opening or topic
            clean_first_sentence = window_text.split(".")[0].split("?")[0].strip()
            if len(clean_first_sentence) > 60:
                clean_first_sentence = clean_first_sentence[:57] + "..."
            
            title = clean_first_sentence if len(clean_first_sentence) > 10 else f"High Impact Moment at {int(snapped_start)}s"

            # Formulate 5 titles, 2 descriptions, hashtags
            topic_words = [w.lower() for w in re.findall(r"\b[A-Za-z]{4,}\b", window_text)]
            freq = {}
            for tw in topic_words:
                freq[tw] = freq.get(tw, 0) + 1
            top_topics = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:3]
            main_topic = top_topics[0][0].capitalize() if top_topics else "Insight"

            titles = [
                f"The Secret About {main_topic} You Didn't Know",
                f"Why Everyone Is Talking About {main_topic}",
                f"The Truth Behind {main_topic} Revealed",
                f"What Happens When You Understand {main_topic}",
                f"{main_topic}: The 60-Second Masterclass"
            ]

            descriptions = [
                f"Did you know this about {main_topic}? Watch till the end to see the full breakdown! #Shorts #Reels",
                f"In this clip: Exploring {main_topic} and why it matters right now. Key takeaway: {window_text[:120]}... Let us know your thoughts in the comments!"
            ]

            hashtags = [
                f"#{main_topic.replace(' ', '')}",
                "#Shorts",
                "#Reels",
                "#Viral",
                "#MustWatch",
                "#LifeHack",
                "#LearnOnTikTok",
                "#Trending",
                "#DailyInsight",
                "#CreatorStudio"
            ]

            explanation = (
                f"Selected via NLP heuristic analysis. High initial curiosity ({int(curiosity_score)}/100) "
                f"and hook strength ({int(hook_score)}/100) with a strong conversational cadence ({round(words_per_sec, 1)} words/sec). "
                f"Clean boundary closure at {round(snapped_end, 1)}s."
            )

            candidates.append({
                "title": title,
                "main_topic": main_topic,
                "start_time": snapped_start,
                "end_time": snapped_end,
                "duration": round(final_dur, 2),
                "overall_score": overall_score,
                "hook_score": round(hook_score, 1),
                "emotional_score": round(emotional_score, 1),
                "curiosity_score": round(curiosity_score, 1),
                "story_score": round(story_score, 1),
                "information_score": round(info_score, 1),
                "shareability_score": round(shareability_score, 1),
                "ending_score": round(ending_score, 1),
                "clarity_score": round(clarity_score, 1),
                "hook_summary": hook_text[:150] if hook_text else "Opening statement",
                "target_audience": "General Social Media Viewers / Shorts Audience",
                "score_explanation": explanation,
                "analysis_mode": "heuristic_fallback",
                "ai_metadata": {
                    "titles": titles,
                    "descriptions": descriptions,
                    "hashtags": hashtags,
                    "target_audience": "Engaged short-form viewers interested in " + main_topic,
                    "key_takeaways": [
                        f"Core discussion revolves around {main_topic}",
                        f"Opening statement immediately establishes curiosity",
                        f"Self-contained takeaway suitable for social sharing"
                    ]
                }
            })

        if not candidates and segments:
            # Fallback candidate spanning the available transcript
            snapped_start = segments[0]["start_time"]
            snapped_end = segments[-1]["end_time"]
            final_dur = max(1.0, snapped_end - snapped_start)
            window_text = " ".join(s.get("text", "").strip() for s in segments)
            main_topic = "Video Highlights"
            candidates.append({
                "title": f"Key Takeaway: {window_text[:40]}...",
                "main_topic": main_topic,
                "start_time": snapped_start,
                "end_time": snapped_end,
                "duration": round(final_dur, 2),
                "overall_score": 75.0,
                "hook_score": 75.0,
                "emotional_score": 70.0,
                "curiosity_score": 75.0,
                "story_score": 70.0,
                "information_score": 75.0,
                "shareability_score": 75.0,
                "ending_score": 70.0,
                "clarity_score": 80.0,
                "hook_summary": window_text[:120] if window_text else "Opening statement",
                "target_audience": "General Social Media Viewers",
                "score_explanation": "Self-contained clip candidate spanning full speech audio.",
                "analysis_mode": "heuristic_fallback",
                "ai_metadata": {
                    "titles": [
                        f"{window_text[:45]}...",
                        "Essential Takeaway You Need to Hear",
                        "The Complete Breakdown in Under 60 Seconds"
                    ],
                    "descriptions": [
                        f"Watch the full moment: {window_text[:120]}... #Shorts #Reels",
                        f"Key discussion highlights: {window_text[:120]}... Let us know what you think!"
                    ],
                    "hashtags": ["#Shorts", "#Reels", "#Viral", "#Insight", "#Trending"],
                    "target_audience": "General audience",
                    "key_takeaways": [
                        "Self-contained message from video",
                        "Key discussion point highlighted"
                    ]
                }
            })

        # Deduplicate and sort
        deduped = self.deduplicate_candidates(candidates)
        return deduped[:target_count]

    def analyze_with_ollama(
        self,
        transcript_data: Dict[str, Any],
        model_name: str = "qwen2.5:3b",
        target_count: int = 5,
        target_duration: float = 45.0,
        min_duration: float = 20.0,
        max_duration: float = 75.0,
        video_metadata: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Analyze transcript with local Ollama LLM to find high-retention short clips.
        Prompts Ollama for structured JSON containing timestamp bounds, rubric scores, titles, descriptions, and hashtags.
        """
        segments = transcript_data.get("segments", [])
        if not segments:
            return []

        # Build compact representation of transcript with timestamps
        compact_transcript_lines = []
        for s in segments:
            compact_transcript_lines.append(f"[{round(s['start_time'], 1)}s - {round(s['end_time'], 1)}s]: {s.get('text', '').strip()}")
        compact_text = "\n".join(compact_transcript_lines)

        # Truncate if ultra-long (Ollama 3B context limit protection)
        if len(compact_text) > 18000:
            compact_text = compact_text[:18000] + "\n...[Transcript continues]..."

        system_prompt = (
            "You are an elite short-form video editor for YouTube Shorts and Instagram Reels.\n"
            "Analyze the provided timestamped video transcript and identify the most viral, standalone moments.\n"
            "Rules for clip selection:\n"
            "1. Each clip MUST be self-contained: understandable on its own without prior context.\n"
            "2. Duration MUST be between {min_dur}s and {max_dur}s (target ~{target_dur}s).\n"
            "3. Strong opening hook in the first 3-5 seconds (curiosity, bold statement, or tension).\n"
            "4. Crisp, satisfying conclusion (no dangling incomplete thoughts).\n"
            "5. Preserve the authentic spoken language (English, Hindi, or Hinglish).\n"
            "6. Output ONLY valid JSON matching the exact schema requested. No prose, no markdown fences."
        ).format(min_dur=int(min_duration), max_dur=int(max_duration), target_dur=int(target_duration))

        user_prompt = f"""
Find the top {target_count} viral clip candidates from this transcript.

Respond with a JSON object with a single key "clips", containing an array of objects with this schema:
{{
  "clips": [
    {{
      "start_time": 12.5,
      "end_time": 54.0,
      "title": "Punchy Main Title",
      "main_topic": "Topic Name",
      "hook_summary": "First 3-5 seconds hook summary",
      "target_audience": "Ideal viewer demographic",
      "hook_score": 88,
      "emotional_score": 82,
      "curiosity_score": 90,
      "story_score": 85,
      "information_score": 75,
      "clarity_score": 85,
      "shareability_score": 88,
      "ending_score": 80,
      "score_explanation": "Detailed 2-sentence rationale for why this moment will succeed on Shorts/Reels.",
      "titles": [
        "Title Option 1 (Curiosity)",
        "Title Option 2 (Bold statement)",
        "Title Option 3 (How-to / Reveal)",
        "Title Option 4 (Question format)",
        "Title Option 5 (Viral hook)"
      ],
      "descriptions": [
        "Short 1-sentence SEO description with hashtags #Shorts #Viral",
        "Detailed 3-sentence description covering the core takeaway and call to action."
      ],
      "hashtags": ["#Shorts", "#Reels", "#Viral", "#Education", "#Insight", "#Trending", "#ForYou", "#DailyMotivation", "#CreatorStudio", "#YouTubeShorts"],
      "key_takeaways": [
        "First major point",
        "Second major point",
        "Core actionable insight"
      ]
    }}
  ]
}}

Transcript:
{compact_text}
"""

        try:
            # Free up CUDA memory before Ollama inference
            try:
                import torch
                import gc
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except Exception:
                pass

            with httpx.Client(timeout=httpx.Timeout(120.0, connect=5.0)) as client:
                res = client.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": model_name,
                        "prompt": user_prompt,
                        "system": system_prompt,
                        "format": "json",
                        "stream": False,
                        "options": {
                            "temperature": 0.4,
                            "top_p": 0.9,
                            "num_predict": 2048
                        }
                    }
                )

                if res.status_code != 200:
                    logger.warning(f"Ollama returned HTTP {res.status_code}: {res.text}. Falling back to heuristic.")
                    return self.analyze_with_heuristic(segments, target_count, target_duration, min_duration, max_duration, video_metadata)

                resp_data = res.json()
                raw_response = resp_data.get("response", "").strip()

                # Clean markdown backticks if returned
                if raw_response.startswith("```json"):
                    raw_response = raw_response[7:]
                if raw_response.startswith("```"):
                    raw_response = raw_response[3:]
                if raw_response.endswith("```"):
                    raw_response = raw_response[:-3]

                parsed = json.loads(raw_response.strip())
                raw_clips = parsed.get("clips", [])
                if not isinstance(raw_clips, list) or not raw_clips:
                    logger.warning("Ollama returned empty or malformed 'clips' list. Falling back to heuristic.")
                    return self.analyze_with_heuristic(segments, target_count, target_duration, min_duration, max_duration, video_metadata)

                results = []
                for c in raw_clips:
                    raw_s = float(c.get("start_time", 0.0))
                    raw_e = float(c.get("end_time", raw_s + target_duration))

                    # Snap boundaries to actual speech words/sentences
                    snapped_s, snapped_e = self.snap_boundaries_to_words(
                        raw_s, raw_e, segments, max_duration=max_duration, min_duration=min_duration
                    )
                    dur = round(snapped_e - snapped_s, 2)
                    if dur < min_duration:
                        continue

                    scores_dict = {
                        "hook": float(c.get("hook_score", 70)),
                        "emotional": float(c.get("emotional_score", 70)),
                        "curiosity": float(c.get("curiosity_score", 70)),
                        "story": float(c.get("story_score", 70)),
                        "information": float(c.get("information_score", 70)),
                        "clarity": float(c.get("clarity_score", 70)),
                        "shareability": float(c.get("shareability_score", 70)),
                        "ending": float(c.get("ending_score", 70))
                    }
                    overall = self.calculate_overall_score(scores_dict)

                    titles = c.get("titles") or [c.get("title", f"Clip at {int(snapped_s)}s")]
                    descriptions = c.get("descriptions") or [f"Clip from {int(snapped_s)}s to {int(snapped_e)}s. #Shorts"]
                    hashtags = c.get("hashtags") or ["#Shorts", "#Reels", "#Viral"]
                    takeaways = c.get("key_takeaways") or ["High retention segment"]

                    results.append({
                        "title": c.get("title") or titles[0],
                        "main_topic": c.get("main_topic", "Key Highlight"),
                        "start_time": snapped_s,
                        "end_time": snapped_e,
                        "duration": dur,
                        "overall_score": overall,
                        "hook_score": scores_dict["hook"],
                        "emotional_score": scores_dict["emotional"],
                        "curiosity_score": scores_dict["curiosity"],
                        "story_score": scores_dict["story"],
                        "information_score": scores_dict["information"],
                        "shareability_score": scores_dict["shareability"],
                        "ending_score": scores_dict["ending"],
                        "clarity_score": scores_dict["clarity"],
                        "hook_summary": c.get("hook_summary", "Strong opening hook"),
                        "target_audience": c.get("target_audience", "Social Media Viewers"),
                        "score_explanation": c.get("score_explanation", f"AI rated overall viral score at {overall}/100."),
                        "analysis_mode": f"ollama_{model_name}",
                        "ai_metadata": {
                            "titles": titles,
                            "descriptions": descriptions,
                            "hashtags": hashtags,
                            "target_audience": c.get("target_audience", "Social Media Viewers"),
                            "key_takeaways": takeaways
                        }
                    })

                deduped = self.deduplicate_candidates(results)
                return deduped[:target_count]

        except Exception as e:
            logger.error(f"Ollama inference failed with error: {str(e)}. Falling back to heuristic.")
            return self.analyze_with_heuristic(segments, target_count, target_duration, min_duration, max_duration, video_metadata)

    def find_clips(
        self,
        transcript_data: Dict[str, Any],
        model_name: Optional[str] = None,
        target_count: int = 5,
        target_duration: float = 45.0,
        min_duration: float = 20.0,
        max_duration: float = 75.0,
        force_heuristic: bool = False,
        video_metadata: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Unified clip finding engine.
        Automatically checks Ollama availability; uses local LLM if ready, otherwise gracefully executes heuristic NLP.
        """
        segments = transcript_data.get("segments", [])
        if not segments:
            return []

        if force_heuristic:
            return self.analyze_with_heuristic(
                segments=segments,
                target_count=target_count,
                target_duration=target_duration,
                min_duration=min_duration,
                max_duration=max_duration,
                video_metadata=video_metadata
            )

        ollama_ok, models = self.is_ollama_available()
        selected_model = model_name or ("qwen2.5:3b" if "qwen2.5:3b" in models else (models[0] if models else "qwen2.5:3b"))

        if ollama_ok and (model_name in models or not models or any(m.startswith("qwen") or m.startswith("llama") for m in models)):
            return self.analyze_with_ollama(
                transcript_data=transcript_data,
                model_name=selected_model,
                target_count=target_count,
                target_duration=target_duration,
                min_duration=min_duration,
                max_duration=max_duration,
                video_metadata=video_metadata
            )
        else:
            return self.analyze_with_heuristic(
                segments=segments,
                target_count=target_count,
                target_duration=target_duration,
                min_duration=min_duration,
                max_duration=max_duration,
                video_metadata=video_metadata
            )
