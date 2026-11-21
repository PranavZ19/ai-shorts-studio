import re
import json
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

import urllib.request
import urllib.error

from app.models.clip import Clip
from app.models.transcript import Transcript, TranscriptSegment

logger = logging.getLogger(__name__)

COLOR_MAP = {
    "yellow": "#FFCC00",
    "gold": "#FFCC00",
    "amber": "#F59E0B",
    "green": "#00FF88",
    "neon green": "#00FF88",
    "cyan": "#00E5FF",
    "blue": "#3B82F6",
    "red": "#EF4444",
    "white": "#FFFFFF",
    "purple": "#A855F7",
    "pink": "#EC4899",
    "orange": "#F97316"
}

PRESET_MAP = {
    "bold": "bold_creator",
    "creator": "bold_creator",
    "bold creator": "bold_creator",
    "karaoke": "karaoke_highlight",
    "highlight": "karaoke_highlight",
    "minimal": "clean_minimal",
    "clean": "clean_minimal",
    "podcast": "podcast_style",
    "hindi": "hindi_dynamic",
    "devanagari": "hindi_dynamic"
}

class CopilotService:
    def __init__(self):
        pass

    def _extract_target_text(self, prompt: str) -> Optional[str]:
        """Extract target text/phrase to be removed or replaced from user's natural prompt."""
        # Normalize common English contractions so apostrophes aren't mistaken for quotes
        norm_prompt = re.sub(r"\b(don|can|won|didn|isn|aren|wasn|weren|shouldn|couldn)'t\b", r"\1t", prompt, flags=re.IGNORECASE)
        norm_prompt = re.sub(r"\b(it|that|there|what|who|he|she)'s\b", r"\1s", norm_prompt, flags=re.IGNORECASE)

        # 1. Quoted text: "..." or '...'
        quoted = re.findall(r'"([^"]+)"', norm_prompt)
        if not quoted:
            quoted = re.findall(r"(?:^|\s)'([^']+)'(?:\s|$|[.,!?])", norm_prompt)
        if quoted:
            for q in quoted:
                clean_q = q.strip(" .")
                if len(clean_q) >= 2:
                    return clean_q

        # 2. "which is X", "that is X", "namely X"
        m_which = re.search(r'(?:which is|that is|namely|text is|saying)\s+["\']?([^"\'\n,.;]+)["\']?', norm_prompt, re.IGNORECASE)
        if m_which:
            clean = m_which.group(1).strip(" .")
            # Strip trailing fillers like "etc", "vagera", "then it should"
            clean = re.sub(r'\s+(?:etc|vagera|aur|then it should|nikal do|hata do|please).*$', '', clean, flags=re.IGNORECASE).strip(" .")
            if len(clean) >= 2:
                return clean

        # 3. Direct removal commands: "remove X", "delete X", "hata do X", "nikal do X"
        m_remove = re.search(
            r'(?:remove|delete|omit|hide|dont\s*want|exclude|nikal\s*do|hata\s*do|restore|unhide)\s+(?:the\s+)?(?:text|words?|caption|subtitle|phrase)?\s*(?:which is\s+)?["\']?([^"\'\n,.;]+)["\']?',
            norm_prompt,
            re.IGNORECASE
        )
        if m_remove:
            clean = m_remove.group(1).strip(" .")
            clean = re.sub(r'\s+(?:from the screen|from captions?|from video|etc|vagera|aur|please).*$', '', clean, flags=re.IGNORECASE).strip(" .")
            if len(clean) >= 2:
                return clean

        # 4. Trailing removal: "X nikal do", "X hata do", "X remove"
        m_trail = re.search(r'["\']?([^"\'\n,.;]+)["\']?\s+(?:nikal\s*do|hata\s*do|remove\s*kar\s*do|delete\s*kar\s*do)', norm_prompt, re.IGNORECASE)
        if m_trail:
            clean = m_trail.group(1).strip(" .")
            if len(clean) >= 2:
                return clean

        return None

        return None

    def _query_ollama(self, prompt: str, system_prompt: str = "") -> Optional[str]:
        """Optional query to local Ollama (qwen2.5:3b) with 2.5s timeout."""
        try:
            req_data = {
                "model": "qwen2.5:3b",
                "prompt": prompt,
                "system": system_prompt,
                "stream": False
            }
            req = urllib.request.Request(
                "http://127.0.0.1:11434/api/generate",
                data=json.dumps(req_data).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=2.5) as resp:
                if resp.status == 200:
                    payload = json.loads(resp.read().decode("utf-8"))
                    res = payload.get("response", "").strip()
                    if res:
                        return res
        except Exception:
            return None
        return None

    def process_command(self, clip: Clip, prompt: str, db: Session) -> Dict[str, Any]:
        """
        Processes natural language instructions for the active clip:
        - Removes or modifies specific phrases in the transcript and on-screen captions
        - Adjusts caption styling (font size, colors, presets, position)
        - Adjusts framing (auto-face, center, left, right)
        - Adjusts volume and audio settings
        """
        clean_prompt = prompt.strip()
        edit_config = json.loads(clip.edit_config_json) if clip.edit_config_json else {}
        actions_taken = []
        changes = {}

        # 1. Check for restoring / unhiding excluded phrases
        is_restore = bool(re.search(
            r'\b(?:restore|unhide|bring back|undo remove|clear\s+(?:all\s+)?(?:excluded|exclusions|phrases?)|reset\s+(?:all\s+)?(?:excluded|exclusions|phrases?))\b',
            clean_prompt,
            re.IGNORECASE
        ))
        if is_restore:
            if re.search(r'\b(?:all|everything)\b', clean_prompt, re.IGNORECASE):
                restore_target = None
            else:
                restore_target = self._extract_target_text(clean_prompt)

            excluded = edit_config.get("excluded_phrases", [])
            if restore_target and any(p.lower() == restore_target.lower() for p in excluded):
                excluded = [p for p in excluded if p.lower() != restore_target.lower()]
                edit_config["excluded_phrases"] = excluded
                actions_taken.append(f"Restored phrase '{restore_target}'")
                changes["excluded_phrases"] = excluded
            else:
                edit_config["excluded_phrases"] = []
                actions_taken.append("Cleared all excluded caption phrases")
                changes["excluded_phrases"] = []

        # 2. Check for Text Removal / Exclusion (if not a restore command)
        is_removal = not is_restore and bool(re.search(r'(?:remove|delete|omit|hide|don\'?t want|exclude|nikal|hata)', clean_prompt, re.IGNORECASE))
        target_text = self._extract_target_text(clean_prompt) if is_removal else None

        if is_removal and target_text:
            excluded = edit_config.get("excluded_phrases", [])
            if target_text not in excluded:
                excluded.append(target_text)
            edit_config["excluded_phrases"] = excluded

            # Find matching transcript segments within clip boundaries
            transcript = db.query(Transcript).filter(Transcript.video_id == clip.video_id).order_by(Transcript.created_at.desc()).first()
            removed_from_segments = 0

            if transcript:
                segments = db.query(TranscriptSegment).filter(
                    TranscriptSegment.transcript_id == transcript.id,
                    TranscriptSegment.start_time <= clip.end_time,
                    TranscriptSegment.end_time >= clip.start_time
                ).all()

                pattern = re.compile(re.escape(target_text), re.IGNORECASE)

                for seg in segments:
                    if pattern.search(seg.text):
                        # Update text
                        new_text = pattern.sub("", seg.text)
                        # Clean multiple spaces and punctuation
                        new_text = re.sub(r'\s+', ' ', new_text).strip(" ,.-")
                        seg.text = new_text
                        seg.is_edited = True

                        # Filter words_json
                        if seg.words_json:
                            try:
                                words_list = json.loads(seg.words_json)
                                target_tokens = [t.lower() for t in target_text.split() if t.strip()]
                                filtered_words = [
                                    w for w in words_list
                                    if w.get("word", "").strip().lower() not in target_tokens
                                ]
                                seg.words_json = json.dumps(filtered_words)
                            except Exception:
                                pass

                        removed_from_segments += 1

            # Clean clip title or hook summary if matched
            if clip.hook_summary and re.search(re.escape(target_text), clip.hook_summary, re.IGNORECASE):
                clip.hook_summary = re.sub(re.escape(target_text), "", clip.hook_summary, flags=re.IGNORECASE).strip(" ,.-")
            if clip.title and re.search(re.escape(target_text), clip.title, re.IGNORECASE):
                clip.title = re.sub(re.escape(target_text), "", clip.title, flags=re.IGNORECASE).strip(" ,.-")

            actions_taken.append(f"Removed '{target_text}' from on-screen captions")
            changes["excluded_phrases"] = excluded

        # 2. Check for Caption Toggle (on / off)
        if re.search(r'(?:disable|hide|turn off|remove all|no)\s+captions?', clean_prompt, re.IGNORECASE):
            edit_config["caption_enabled"] = False
            changes["caption_enabled"] = False
            actions_taken.append("Disabled animated captions")
        elif re.search(r'(?:enable|show|turn on|display)\s+captions?', clean_prompt, re.IGNORECASE):
            edit_config["caption_enabled"] = True
            changes["caption_enabled"] = True
            actions_taken.append("Enabled animated captions")

        # 3. Check for Caption Preset
        for p_key, p_val in PRESET_MAP.items():
            if re.search(rf'\b{p_key}\b', clean_prompt, re.IGNORECASE) and not re.search(r'remove|delete', clean_prompt, re.IGNORECASE):
                edit_config["caption_preset"] = p_val
                changes["caption_preset"] = p_val
                actions_taken.append(f"Switched caption preset to '{p_val}'")
                break

        # 4. Check for Font Size
        m_size = re.search(r'font\s*size\s*(?:to|is|:)?\s*(\d+)', clean_prompt, re.IGNORECASE)
        if m_size:
            sz = int(m_size.group(1))
            sz = max(16, min(48, sz))
            edit_config["font_size"] = sz
            changes["font_size"] = sz
            actions_taken.append(f"Set font size to {sz}px")
        elif re.search(r'(?:bigger|larger|increase)\s+(?:font|text|captions?)', clean_prompt, re.IGNORECASE):
            cur = int(edit_config.get("font_size", 28))
            new_sz = min(48, cur + 4)
            edit_config["font_size"] = new_sz
            changes["font_size"] = new_sz
            actions_taken.append(f"Increased font size to {new_sz}px")
        elif re.search(r'(?:smaller|decrease|reduce)\s+(?:font|text|captions?)', clean_prompt, re.IGNORECASE):
            cur = int(edit_config.get("font_size", 28))
            new_sz = max(16, cur - 4)
            edit_config["font_size"] = new_sz
            changes["font_size"] = new_sz
            actions_taken.append(f"Decreased font size to {new_sz}px")

        # 5. Check for Color Changes
        for c_name, c_hex in COLOR_MAP.items():
            if re.search(rf'\b{c_name}\b', clean_prompt, re.IGNORECASE) and not is_removal:
                if re.search(r'text\s*color', clean_prompt, re.IGNORECASE):
                    edit_config["text_color"] = c_hex
                    changes["text_color"] = c_hex
                    actions_taken.append(f"Set text color to {c_name} ({c_hex})")
                else:
                    # Default color mention applies to highlight
                    edit_config["highlight_color"] = c_hex
                    changes["highlight_color"] = c_hex
                    actions_taken.append(f"Set highlight color to {c_name} ({c_hex})")
                break

        # Check for direct hex color e.g. #FFCC00
        m_hex = re.search(r'#(?:[0-9a-fA-F]{3}){1,2}\b', clean_prompt)
        if m_hex:
            hex_val = m_hex.group(0).upper()
            edit_config["highlight_color"] = hex_val
            changes["highlight_color"] = hex_val
            actions_taken.append(f"Set highlight color to {hex_val}")

        # 6. Check for Caption Position Y (Vertical) - only if not removing text
        if not is_removal and re.search(r'\b(?:top|higher|move up|shift up)\b', clean_prompt, re.IGNORECASE) and re.search(r'\b(?:caption|text|position)\b', clean_prompt, re.IGNORECASE):
            edit_config["position_y"] = 25.0
            changes["position_y"] = 25.0
            actions_taken.append("Moved captions to top position (25%)")
        elif not is_removal and re.search(r'\b(?:bottom|lower|move down|shift down)\b', clean_prompt, re.IGNORECASE) and re.search(r'\b(?:caption|text|position)\b', clean_prompt, re.IGNORECASE):
            edit_config["position_y"] = 82.0
            changes["position_y"] = 82.0
            actions_taken.append("Moved captions to bottom position (82%)")
        elif not is_removal and re.search(r'\b(?:middle|center)\b', clean_prompt, re.IGNORECASE) and re.search(r'\b(?:caption|text|position)\b', clean_prompt, re.IGNORECASE):
            edit_config["position_y"] = 50.0
            changes["position_y"] = 50.0
            actions_taken.append("Centered captions vertically (50%)")

        # 7. Check for Framing Mode
        if re.search(r'\b(?:face|auto[- ]?face|tracking)\b', clean_prompt, re.IGNORECASE) and not is_removal:
            edit_config["framing"] = "auto_face"
            changes["framing"] = "auto_face"
            actions_taken.append("Switched framing to AI Face Tracking")
        elif re.search(r'\b(?:center framing|center crop)\b', clean_prompt, re.IGNORECASE):
            edit_config["framing"] = "center"
            changes["framing"] = "center"
            actions_taken.append("Switched framing to Center Crop")
        elif re.search(r'\b(?:left framing|left side)\b', clean_prompt, re.IGNORECASE):
            edit_config["framing"] = "left"
            changes["framing"] = "left"
            actions_taken.append("Switched framing to Left Anchor")
        elif re.search(r'\b(?:right framing|right side)\b', clean_prompt, re.IGNORECASE):
            edit_config["framing"] = "right"
            changes["framing"] = "right"
            actions_taken.append("Switched framing to Right Anchor")

        # 8. Check for Volume
        m_vol = re.search(r'volume\s*(?:to|is)?\s*(\d+)', clean_prompt, re.IGNORECASE)
        if m_vol:
            v_pct = int(m_vol.group(1))
            v_float = round(max(0.0, min(200.0, float(v_pct))) / 100.0, 2)
            edit_config["audio_volume"] = v_float
            changes["audio_volume"] = v_float
            actions_taken.append(f"Set audio volume to {v_pct}%")
        elif re.search(r'\bmute\b', clean_prompt, re.IGNORECASE):
            edit_config["audio_volume"] = 0.0
            changes["audio_volume"] = 0.0
            actions_taken.append("Muted audio volume")

        # Commit changes if any were made
        if actions_taken:
            clip.edit_config_json = json.dumps(edit_config)
            db.commit()
            db.refresh(clip)
            reply = " • ".join(actions_taken) + ". Live canvas preview has been updated."
            return {
                "success": True,
                "reply": f"✅ {reply}",
                "actions": actions_taken,
                "changes": changes,
                "edit_config": edit_config
            }

        # If no deterministic rule matched, try asking Ollama for helpful feedback
        system_prompt = (
            "You are the AI Video Copilot inside AI Shorts Studio. "
            "The user is editing a 9:16 vertical Short. Guide them on removing words, "
            "styling animated captions, choosing highlight colors, or setting face tracking framing. "
            "Be concise (1-2 sentences)."
        )
        ollama_reply = self._query_ollama(clean_prompt, system_prompt=system_prompt)

        if ollama_reply:
            return {
                "success": True,
                "reply": ollama_reply,
                "actions": [],
                "changes": {},
                "edit_config": edit_config
            }

        return {
            "success": True,
            "reply": "I can help you customize this clip! Try saying: 'Remove the text vagera nikalta hai', 'Change highlight color to yellow', 'Make font size 32', or 'Switch framing to face tracking'.",
            "actions": [],
            "changes": {},
            "edit_config": edit_config
        }

copilot_service = CopilotService()
