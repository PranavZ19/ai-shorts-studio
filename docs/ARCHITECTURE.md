# AI Shorts Studio — System Architecture & Data Flow

This document details the architectural design, component interactions, and storage isolation of **AI Shorts Studio**.

---

## 1. High-Level System Architecture

```
+-----------------------------------------------------------------------------------------+
|                                    REACT FRONTEND                                       |
|  (Vite + TypeScript + Tailwind CSS + Lucide Icons + Native 9:16 HTML5 Video Player)     |
+--------------------------------------------+--------------------------------------------+
                                             | HTTP REST API / Streaming
+--------------------------------------------v--------------------------------------------+
|                                    FASTAPI BACKEND                                      |
|  - Video Ingestion API (/api/videos)            - Transcription API (/api/transcripts)  |
|  - Intelligent Clip API (/api/clips)           - Strategy & Trends API (/api/strategy)  |
|  - Publishing Kit API (/api/publishing-kit)     - Settings & Backups (/api/settings)   |
+---------------------+-------------------+-------------------+---------------------------+
                      |                   |                   |
          +-----------v----+      +-------v---------+  +------v--------+
          | Faster-Whisper |      |  Local Ollama   |  | FFmpeg/OpenCV |
          | (Speech-to-Text|      |   (qwen2.5:3b   |  | (Face Track   |
          |  tiny/base/sm) |      | Virality Engine)|  | & 9:16 NVENC) |
          +----------------+      +-----------------+  +---------------+
                                          |
                      +-------------------v-------------------+
                      |      SQLAlchemy ORM + SQLite (WAL)    |
                      |          (D:\AI-Shorts-Studio)        |
                      +---------------------------------------+
```

---

## 2. Component Breakdown

### A. Video Ingestion & Analysis Engine
- **Chunked File Streaming**: Large video uploads (MP4, MOV, MKV, WebM, AVI) stream directly to disk without memory overhead.
- **FFprobe Inspection**: Extracts stream metadata (codecs, framerate, resolution, audio channels) and extracts a high-res poster thumbnail.
- **yt-dlp Integration**: Validates and downloads YouTube video metadata and streams for processing.

### B. Speech Transcription Engine (Faster-Whisper)
- **Local Model Caching**: Whisper model weights are stored strictly on `D:\AI-Shorts-Studio\storage\models`.
- **Hardware Acceleration**: Automatic CUDA acceleration with CPU fallback.
- **Word-Level Precision**: Extracts word-level timestamps and punctuation essential for viral karaoke captions.

### C. AI Virality & Selection Engine (Ollama)
- **Model**: `qwen2.5:3b` (Quantized ~1.93 GB local model).
- **Rubric-Based Evaluation**: Scores candidate moments on Hook (0–100), Flow, and Payoff.
- **Boundary Optimization**: Snaps clip candidates to natural sentence pauses.
- **Heuristic Fallback Engine**: If Ollama is offline or uninstalled, the studio falls back to an offline heuristic NLP algorithm.

### D. Video Editing & Vertical Reframing Engine (FFmpeg + OpenCV)
- **Face Tracking**: OpenCV YuNet DNN model with Haar cascade fallback tracks speaker faces and smoothly pans the 9:16 crop window.
- **Encoding**: Hardware-accelerated NVIDIA NVENC (`h264_nvenc`) with automatic fallback to CPU (`libx264`).
- **Animated Captions**: SubStation Alpha (`.ass`) rendering with word-level highlight color and multi-font cross-platform stack.

### E. Social Publishing Kit Engine
- **Platform-Specific Divergence**: YouTube Shorts kits focus on SEO search intent, search tags (<500 chars), and pinned comments; Instagram Reels kits focus on line-1 scroll-stopping hooks, cover overlays, and grouped hashtags.
- **Multi-Format Export**: Generates `.txt`, `.json`, and `.zip` packages for effortless manual publishing.

### F. Disaster Recovery & Backup Engine
- **WAL Flush**: Forces `PRAGMA wal_checkpoint(TRUNCATE);` before archiving.
- **Validation**: Verifies ZIP integrity and executes `PRAGMA integrity_check` on the database inside the archive before allowing restoration.
- **Safety Rollback**: Automatically generates a `.bak` snapshot before restoring.

---

## 3. Storage Hierarchy & Drive D: Isolation

```
D:\AI-Shorts-Studio\
├── storage\
│   ├── studio.db                  # SQLite database (WAL mode)
│   ├── source_videos\             # Raw uploaded and downloaded videos
│   ├── clips\                     # Rendered 1080x1920 MP4 clips and SRT files
│   ├── thumbnails\                # Extracted JPEG posters
│   ├── models\                    # Faster-Whisper weights & Ollama storage
│   ├── temp\                      # Upload chunks and transient encoding frames
│   └── exports\
│       ├── backups\               # Studio archive ZIP files
│       └── publishing_kits\       # Exported social metadata bundles
└── tools\
    └── ffmpeg\                    # Local standalone FFmpeg binaries (optional)
```

---

## 4. Database Schema Overview

- `projects`: Master organizational container.
- `source_videos`: Video metadata, duration, dimensions, codecs, file paths.
- `transcripts`: Full video transcripts and word-level timing segments.
- `clips`: Approved moments, framing parameters, render status, scores, output paths.
- `render_jobs`: Async queue records for tracking FFmpeg progress and errors.
- `channel_profiles`: Creator brand settings, niches, tone of voice, timezones.
- `scheduled_posts`: Content calendar slots, publication status, tracking URLs.
- `publishing_kits`: YouTube and Instagram ready-to-publish metadata records.
- `trend_cache`: Cached topic trends with TTL to eliminate redundant network calls.
- `settings`: Application configuration and user preferences.
