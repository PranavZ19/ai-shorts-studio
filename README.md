# AI Shorts Studio ⚡

An autonomous, 100% free, local AI-powered web studio that transforms long-form videos into high-retention 9:16 vertical YouTube Shorts and Instagram Reels.

Inspired by OpusClip, Klap, and Kixy, AI Shorts Studio runs **entirely on your local machine** using open-source AI and hardware acceleration—requiring zero paid APIs, tokens, or subscriptions.

---

## 🚀 Key Features

- **Local Speech-to-Text**: Full video transcription with Faster-Whisper (CUDA float16 / CPU int8 fallback) with word-level timestamps.
- **Intelligent AI Moment Selection**: Heuristic + local LLM (Ollama `llama3.2:3b`) scoring across 8 engagement factors (Hooks, Emotion, Curiosity, Narrative completeness).
- **Intelligent 9:16 Vertical Cropping**: Face tracking and speaker framing using OpenCV and MediaPipe.
- **Animated Dynamic Captions**: Synchronized word-by-word highlighted captions rendered natively using FFmpeg & libass.
- **Dedicated Download Center**: 1-click downloads for individual MP4s, SRT subtitles, thumbnails, and complete project ZIP packages.
- **Zero Cloud Dependencies**: No OpenAI, Gemini, or Claude API keys required.

---

## 🛠️ System Architecture

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons (Dark SaaS aesthetic)
- **Backend**: Python 3.11, FastAPI, SQLAlchemy, SQLite (with WAL mode)
- **Video Engine**: FFmpeg 9.0.2 with NVIDIA NVENC (`h264_nvenc`) hardware acceleration
- **AI Models**: Faster-Whisper (`base` / `small`) + Ollama (`llama3.2:3b`)
- **Storage**: Configurable local directory (Defaults to `D:\AI-Shorts-Studio` on Windows)

---

## 💻 Quick Start

### Windows
1. Double-click `start.bat` (or run `./start.bat` from terminal).
2. The studio automatically opens at `http://localhost:5173`.
3. To stop all services, run `stop.bat`.

### macOS / Linux
```bash
./setup.sh
./start.sh
```

---

## 📊 Database Schema

Stored in `D:\AI-Shorts-Studio\storage\studio.db`:
- `projects`: Project metadata and configuration.
- `source_videos`: Video technical specs (duration, resolution, fps, codecs).
- `transcripts`: Full video transcripts and word-level segments.
- `clips`: AI extracted candidate moments, scores, and rendered video paths.
- `processing_jobs`: Real-time 15-stage pipeline tracker with Server-Sent Events (SSE).
- `studio_settings`: Configurable model choices, paths, and scoring weights.
