import os
import re
import math
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

class CaptionService:
    PRESETS = {
        "bold_creator": {
            "name": "Bold Creator",
            "font_name": "Segoe UI, Nirmala UI, Kohinoor Devanagari, Arial Unicode MS, Arial Black, Arial",
            "font_size": 28,
            "bold": True,
            "text_color": "#FFFFFF",
            "highlight_color": "#FFCC00",  # Punchy Yellow
            "outline_color": "#000000",
            "outline_width": 4.0,
            "shadow_offset": 2.0,
            "uppercase": True,
            "position_y": 72,  # 72% down screen (comfortable lower-middle)
            "border_style": 1   # Outline with drop shadow
        },
        "karaoke_highlight": {
            "name": "Karaoke Highlight",
            "font_name": "Segoe UI, Nirmala UI, Kohinoor Devanagari, Arial Unicode MS, Arial",
            "font_size": 26,
            "bold": True,
            "text_color": "#E0E0E0",
            "highlight_color": "#00FF88",  # Neon Emerald
            "outline_color": "#111111",
            "outline_width": 3.5,
            "shadow_offset": 1.5,
            "uppercase": False,
            "position_y": 74,
            "border_style": 1
        },
        "clean_minimal": {
            "name": "Clean Minimal",
            "font_name": "Segoe UI, Nirmala UI, Kohinoor Devanagari, Arial Unicode MS, Arial",
            "font_size": 24,
            "bold": False,
            "text_color": "#FFFFFF",
            "highlight_color": "#60A5FA",  # Soft Blue
            "outline_color": "#000000",
            "outline_width": 2.0,
            "shadow_offset": 1.0,
            "uppercase": False,
            "position_y": 78,
            "border_style": 1
        },
        "podcast_style": {
            "name": "Podcast Style",
            "font_name": "Segoe UI, Nirmala UI, Kohinoor Devanagari, Arial Unicode MS, Arial",
            "font_size": 25,
            "bold": True,
            "text_color": "#FFFFFF",
            "highlight_color": "#F59E0B",  # Warm Amber
            "outline_color": "#000000",
            "outline_width": 1.0,
            "shadow_offset": 0.0,
            "uppercase": False,
            "position_y": 80,
            "border_style": 3  # Opaque/semi-transparent background box
        },
        "minimal_subtitle": {
            "name": "Minimal Subtitle",
            "font_name": "Segoe UI, Nirmala UI, Kohinoor Devanagari, Arial Unicode MS, Arial",
            "font_size": 22,
            "bold": False,
            "text_color": "#FFFFFF",
            "highlight_color": "#FFFFFF",
            "outline_color": "#1F2937",
            "outline_width": 2.5,
            "shadow_offset": 1.0,
            "uppercase": False,
            "position_y": 85,
            "border_style": 1
        }
    }

    def __init__(self):
        pass

    @classmethod
    def get_presets(cls) -> Dict[str, Any]:
        """Return copy of available caption styling presets."""
        return cls.PRESETS.copy()

    @staticmethod
    def hex_to_ass_color(hex_str: str, alpha: int = 0) -> str:
        """
        Convert standard hex color '#RRGGBB' to ASS color format '&HAABBGGRR&'.
        ASS uses BGR ordering.
        """
        clean_hex = hex_str.lstrip("#")
        if len(clean_hex) == 3:
            clean_hex = "".join([c * 2 for c in clean_hex])
        if len(clean_hex) != 6:
            clean_hex = "FFFFFF"

        r = clean_hex[0:2]
        g = clean_hex[2:4]
        b = clean_hex[4:6]
        a = f"{alpha:02X}"

        return f"&H{a}{b}{g}{r}&"

    @staticmethod
    def format_ass_time(seconds: float) -> str:
        """Convert float seconds to ASS timestamp format: H:MM:SS.cc"""
        total_centis = int(round(max(0.0, seconds) * 100))
        hours = total_centis // (3600 * 100)
        rem = total_centis % (3600 * 100)
        mins = rem // (60 * 100)
        rem = rem % (60 * 100)
        secs = rem // 100
        centis = rem % 100
        return f"{hours}:{mins:02d}:{secs:02d}.{centis:02d}"

    @staticmethod
    def format_srt_time(seconds: float) -> str:
        """Convert float seconds to SRT timestamp format: HH:MM:SS,mmm"""
        total_millis = int(round(max(0.0, seconds) * 1000))
        hours = total_millis // (3600 * 1000)
        rem = total_millis % (3600 * 1000)
        mins = rem // (60 * 1000)
        rem = rem % (60 * 1000)
        secs = rem // 1000
        millis = rem % 1000
        return f"{hours:02d}:{mins:02d}:{secs:02d},{millis:03d}"

    def extract_clip_words(
        self,
        segments: List[Dict[str, Any]],
        start_time: float,
        end_time: float,
        excluded_phrases: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Extract word timestamps falling within the clip boundary [start_time, end_time].
        Normalizes timestamps relative to clip start (t = 0.0s).
        Filters out any words or phrases specified in excluded_phrases.
        """
        words = []
        for seg in segments:
            # Check segment overlap
            if seg.get("end_time", 0) < start_time or seg.get("start_time", 0) > end_time:
                continue

            seg_words = seg.get("words", [])
            if seg_words:
                for w in seg_words:
                    w_start = float(w.get("start", 0.0))
                    w_end = float(w.get("end", 0.0))
                    # Check word overlap
                    if w_end > start_time and w_start < end_time:
                        words.append({
                            "word": w.get("word", "").strip(),
                            "start": max(0.0, w_start - start_time),
                            "end": max(0.0, min(end_time - start_time, w_end - start_time))
                        })
            else:
                # Fallback if no word timestamps: synthesize from segment text
                seg_text = seg.get("text", "").strip()
                tokens = seg_text.split()
                if tokens:
                    s_rel = max(0.0, seg["start_time"] - start_time)
                    e_rel = max(0.0, min(end_time - start_time, seg["end_time"] - start_time))
                    dur = max(0.1, e_rel - s_rel)
                    w_len = dur / len(tokens)
                    for i, t in enumerate(tokens):
                        words.append({
                            "word": t,
                            "start": s_rel + (i * w_len),
                            "end": s_rel + ((i + 1) * w_len)
                        })

        # Filter out excluded words/phrases if specified
        if excluded_phrases:
            clean_excluded_tokens = set()
            for ep in excluded_phrases:
                for t in ep.lower().split():
                    clean_excluded_tokens.add(t.strip(" ,.-'\"?!"))
            if clean_excluded_tokens:
                words = [
                    w for w in words
                    if w.get("word", "").lower().strip(" ,.-'\"?!") not in clean_excluded_tokens
                ]

        return words

    def generate_ass_subtitle(
        self,
        words: List[Dict[str, Any]],
        output_ass_path: Path,
        preset_name: str = "bold_creator",
        custom_config: Optional[Dict[str, Any]] = None,
        max_words_per_line: int = 4
    ) -> Path:
        """
        Generate Advanced SubStation Alpha (.ass) subtitle file with word-by-word active highlighting.
        Supports Devanagari (Hindi) and English text with proper safe area margins.
        """
        output_ass_path.parent.mkdir(parents=True, exist_ok=True)
        preset = self.PRESETS.get(preset_name, self.PRESETS["bold_creator"]).copy()
        if custom_config:
            preset.update(custom_config)

        # Style parameters
        font_name = preset.get("font_name", "Segoe UI, Nirmala UI, Arial")
        font_size = int(preset.get("font_size", 28))
        is_bold = -1 if preset.get("bold", True) else 0
        text_color_ass = self.hex_to_ass_color(preset.get("text_color", "#FFFFFF"))
        highlight_color_ass = self.hex_to_ass_color(preset.get("highlight_color", "#FFCC00"))
        outline_color_ass = self.hex_to_ass_color(preset.get("outline_color", "#000000"))
        outline_width = float(preset.get("outline_width", 3.5))
        shadow_offset = float(preset.get("shadow_offset", 1.5))
        border_style = int(preset.get("border_style", 1))
        is_uppercase = preset.get("uppercase", False)

        # Vertical positioning on 1080x1920 canvas
        pos_y_pct = float(preset.get("position_y", 74))
        # MarginV in ASS is distance from bottom when Alignment=2 (bottom-center)
        # 1920 canvas height: 75% down means 25% from bottom = 480px margin
        margin_v = int(round(1920.0 * (1.0 - (pos_y_pct / 100.0))))

        # Group words into sentence-aware lines of 3-5 words
        lines = []
        cur_line = []
        for w in words:
            cur_line.append(w)
            w_text = w["word"]
            is_sentence_end = w_text.endswith((".", "!", "?", "।"))  # Hindi purna viram
            if len(cur_line) >= max_words_per_line or is_sentence_end:
                lines.append(cur_line)
                cur_line = []
        if cur_line:
            lines.append(cur_line)

        # Construct ASS header
        ass_content = [
            "[Script Info]",
            "Title: AI Shorts Studio Animated Subtitles",
            "ScriptType: v4.00+",
            "WrapStyle: 0",
            "ScaledBorderAndShadow: yes",
            "YCbCr Matrix: TV.709",
            "PlayResX: 1080",
            "PlayResY: 1920",
            "",
            "[V4+ Styles]",
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
            f"Style: Default,{font_name},{font_size},{text_color_ass},&H000000FF&,{outline_color_ass},&H80000000&,{is_bold},0,0,0,100,100,0.5,0,{border_style},{outline_width},{shadow_offset},2,60,60,{margin_v},1",
            "",
            "[Events]",
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
        ]

        # Generate Dialogue events with active-word highlight
        for line_words in lines:
            if not line_words:
                continue
            line_start = line_words[0]["start"]
            line_end = line_words[-1]["end"]

            # For each word in the current line, emit a dialogue slice where it is highlighted
            for active_idx, active_word in enumerate(line_words):
                w_start_str = self.format_ass_time(active_word["start"])
                w_end_str = self.format_ass_time(active_word["end"])

                # Assemble line text with active word highlighted
                parts = []
                for idx, item in enumerate(line_words):
                    word_display = item["word"].upper() if is_uppercase else item["word"]
                    if idx == active_idx:
                        # Highlight active word
                        parts.append(f"{{\\c{highlight_color_ass}\\b1}}{word_display}{{\\c{text_color_ass}}}")
                    else:
                        parts.append(word_display)

                line_text = " ".join(parts)
                ass_content.append(f"Dialogue: 0,{w_start_str},{w_end_str},Default,,0,0,0,,{line_text}")

        # Write out ASS file with UTF-8 encoding
        with open(output_ass_path, "w", encoding="utf-8") as f:
            f.write("\n".join(ass_content) + "\n")

        return output_ass_path

    def generate_srt_subtitle(
        self,
        words: List[Dict[str, Any]],
        output_srt_path: Path,
        max_words_per_line: int = 5
    ) -> Path:
        """Generate standard clean .srt file for clip download."""
        output_srt_path.parent.mkdir(parents=True, exist_ok=True)
        lines = []
        cur_line = []
        for w in words:
            cur_line.append(w)
            if len(cur_line) >= max_words_per_line or w["word"].endswith((".", "!", "?", "।")):
                lines.append(cur_line)
                cur_line = []
        if cur_line:
            lines.append(cur_line)

        srt_parts = []
        for idx, line_words in enumerate(lines):
            if not line_words:
                continue
            s_time = self.format_srt_time(line_words[0]["start"])
            e_time = self.format_srt_time(line_words[-1]["end"])
            text = " ".join(w["word"] for w in line_words)
            srt_parts.append(f"{idx + 1}\n{s_time} --> {e_time}\n{text}\n")

        with open(output_srt_path, "w", encoding="utf-8") as f:
            f.write("\n".join(srt_parts))

        return output_srt_path

    @staticmethod
    def format_vtt_time(seconds: float) -> str:
        """Format seconds into WebVTT timestamp: HH:MM:SS.mmm"""
        hrs = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int(round((seconds - int(seconds)) * 1000))
        if millis >= 1000:
            millis = 999
        return f"{hrs:02d}:{mins:02d}:{secs:02d}.{millis:03d}"

    def generate_vtt_subtitle(
        self,
        words: List[Dict[str, Any]],
        output_vtt_path: Path,
        max_words_per_line: int = 5
    ) -> Path:
        """Generate standard WebVTT .vtt file for clip download and web player tracks."""
        output_vtt_path.parent.mkdir(parents=True, exist_ok=True)
        lines = []
        cur_line = []
        for w in words:
            cur_line.append(w)
            if len(cur_line) >= max_words_per_line or w["word"].endswith((".", "!", "?", "।")):
                lines.append(cur_line)
                cur_line = []
        if cur_line:
            lines.append(cur_line)

        vtt_parts = ["WEBVTT\n"]
        for idx, line_words in enumerate(lines):
            if not line_words:
                continue
            s_time = self.format_vtt_time(line_words[0]["start"])
            e_time = self.format_vtt_time(line_words[-1]["end"])
            text = " ".join(w["word"] for w in line_words)
            vtt_parts.append(f"{idx + 1}\n{s_time} --> {e_time}\n{text}\n")

        with open(output_vtt_path, "w", encoding="utf-8") as f:
            f.write("\n".join(vtt_parts))

        return output_vtt_path

    @staticmethod
    def srt_to_vtt(srt_path: Path, output_vtt_path: Path) -> Path:
        """Convert an existing SRT subtitle file into standard WebVTT format."""
        if not srt_path.exists():
            return output_vtt_path
        with open(srt_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        
        # Replace commas in timestamps (00:00:01,234 -> 00:00:01.234)
        vtt_content = "WEBVTT\n\n" + re.sub(
            r"(\d{2}:\d{2}:\d{2}),(\d{3}) --> (\d{2}:\d{2}:\d{2}),(\d{3})",
            r"\1.\2 --> \3.\4",
            content
        )
        with open(output_vtt_path, "w", encoding="utf-8") as f:
            f.write(vtt_content)
        return output_vtt_path

caption_service = CaptionService()
