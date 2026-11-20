# AI Shorts Studio — Creator User Guide

Welcome to **AI Shorts Studio**, a 100% free, local-first desktop-web application that converts long-form videos into viral YouTube Shorts and Instagram Reels with local AI transcription, intelligent clip detection, vertical reframing, animated captions, trend discovery, and ready-to-publish social publishing kits.

---

## Table of Contents
1. [Core Philosophy & Privacy](#core-philosophy--privacy)
2. [Quick Launch](#quick-launch)
3. [End-to-End Workflow Walkthrough](#end-to-end-workflow-walkthrough)
   - [Step 1: Projects & Ingestion](#step-1-projects--ingestion)
   - [Step 2: Local AI Transcription](#step-2-local-ai-transcription)
   - [Step 3: Intelligent AI Clip Selection](#step-3-intelligent-ai-clip-selection)
   - [Step 4: Automatic Editing & Vertical Reframing](#step-4-automatic-editing--vertical-reframing)
   - [Step 5: Clip Management, Downloads & Bulk Export](#step-5-clip-management-downloads--bulk-export)
   - [Step 6: Creator Strategy & Trend Discovery](#step-6-creator-strategy--trend-discovery)
   - [Step 7: AI Publishing Kit & Social Publishing](#step-7-ai-publishing-kit--social-publishing)
4. [Storage Management & Disaster Recovery](#storage-management--disaster-recovery)
5. [Keyboard Shortcuts & Tips](#keyboard-shortcuts--tips)

---

## 1. Core Philosophy & Privacy

- **100% Local Inference**: Speech recognition runs entirely on your GPU/CPU via Faster-Whisper. Clip discovery, content ideas, and publishing copy run locally via Ollama (`qwen2.5:3b`).
- **Zero Paid APIs & Zero Subscriptions**: No OpenAI keys, Anthropic accounts, Cloudflare workers, or cloud billing.
- **Drive D: Media Isolation**: All large files (source videos, rendered clips, model weights, database) reside on `D:\AI-Shorts-Studio` to keep your primary C: drive clean and fast.
- **Manual Publishing Safety**: The studio **never** asks for Google/Meta account passwords, OAuth tokens, or automated API access. You retain 100% manual control over your social media channels.

---

## 2. Quick Launch

### Windows
1. Double-click `start.bat` in the project root.
2. The launcher will automatically start the backend, start the frontend, ensure Ollama is active with models stored on Drive D:, and open `http://localhost:5173` in your default browser.
3. To stop all services cleanly, run `stop.bat`.

### Health Diagnostics
Before starting large batch renders, run `health-check.bat` to verify your Python environment, Node.js, FFmpeg, NVIDIA CUDA acceleration, Ollama availability, and drive free space.

---

## 3. End-to-End Workflow Walkthrough

```
[Upload / Ingest Video] -> [Faster-Whisper Transcription] -> [Ollama AI Clip Finder]
           |
[Publishing Kit Export] <- [Clip Management & Export] <- [FFmpeg 9:16 Vertical Render]
```

### Step 1: Projects & Ingestion
1. Click **Projects** in the navigation bar and select or create a project.
2. Under **Video Ingestion**, drag and drop your long-form video (MP4, MOV, MKV, WebM, AVI) or paste a YouTube URL to download metadata and video.
3. The chunked upload pipeline streams files directly into `D:\AI-Shorts-Studio\storage\source_videos` without consuming system RAM.
4. FFprobe instantly extracts video duration, resolution, frame rate, and generates a poster thumbnail.

### Step 2: Local AI Transcription
1. Click **Transcribe Video**.
2. Select your Faster-Whisper model:
   - **tiny** (~75 MB): Ultra-fast, minimal memory.
   - **base** (~145 MB, Recommended): Best balance of speed and punctuation accuracy.
   - **small** (~480 MB): Maximum accuracy for complex multi-speaker audio.
3. Faster-Whisper runs on your NVIDIA RTX 3050 GPU (with seamless CPU fallback).
4. Review word-level timestamps, confidence scores, and full search-enabled transcript text.

### Step 3: Intelligent AI Clip Selection
1. Click **Find Viral Clips**.
2. AI Shorts Studio sends transcript blocks to your local Ollama `qwen2.5:3b` model.
3. The AI scores candidate segments using a multi-factor rubric:
   - **Hook Strength** (0–100): Opening 3–5 seconds impact.
   - **Narrative Flow & Coherence**: Completeness of thought.
   - **Virality Potential & Emotional Resonance**: Entertainment or educational payoff.
4. Candidate clips display an overall score, suggested title, rationale, and exact start/end timestamps.
5. You can approve, reject, or fine-tune the boundaries before rendering.

### Step 4: Automatic Editing & Vertical Reframing
1. For each approved candidate, select your editing preferences:
   - **Framing Mode**:
     - *Auto Face Tracking*: Uses OpenCV YuNet DNN face detection with automatic horizontal panning to keep the speaker centered in 9:16.
     - *Center Crop*: Fixed center-column crop.
     - *Manual Offset*: Custom horizontal position.
   - **Caption Preset**:
     - *Bold Creator*: Yellow active-word highlight with black border.
     - *Karaoke Highlight*: Neon emerald glowing active word.
     - *Clean Minimal*: Soft blue subtle modern subtitles.
     - *Podcast Style*: Amber text with background backplate.
     - *Minimal Subtitle*: Classic white bottom-third text.
2. Click **Render Short**. FFmpeg renders the vertical 1080×1920 MP4 at 30 FPS using hardware NVENC encoding.

### Step 5: Clip Management, Downloads & Bulk Export
1. Navigate to **Clips** or your project page.
2. Preview rendered shorts in the vertical 9:16 video player with synchronized captions.
3. Click **Download MP4** for immediate local save.
4. Export options:
   - Download `.srt` or `.vtt` subtitles.
   - Download poster JPEG thumbnail.
   - Download complete Clip ZIP package (MP4 + SRT + VTT + Thumbnail + JSON metadata).
   - Use **Bulk Actions** to export or delete multiple clips simultaneously.

### Step 6: Creator Strategy & Trend Discovery
1. Click **Creator Strategy** in the sidebar.
2. Select or create your channel profile and niche (e.g., Tech & AI, Gaming, Finance).
3. **Trend Discovery**: View real trending topics from Google Trends RSS, Hacker News API, and public subreddits with 0 paid APIs.
4. **AI Strategic Blueprints**: Click any trending topic to generate video hooks, pacing angles, and target lengths.
5. **Upload Scheduler**: Get empirical peak upload window recommendations tailored for YouTube Shorts vs Instagram Reels.
6. Commit scheduled slots directly to your interactive **Content Calendar**.

### Step 7: AI Publishing Kit & Social Publishing
1. On any rendered clip, click **Publishing Kit**.
2. Click **Generate Publishing Kit** to have local Ollama create channel-ready copy:
   - **YouTube Shorts Kit**:
     - 5 SEO-optimized title variations (<70 characters).
     - Full description template with hook, summary, hashtags, timestamps, and pinned comment.
     - Clean tag list strictly validated to remain under YouTube's 500-character limit.
   - **Instagram Reels Kit**:
     - 3 caption variations with punchy line-1 hook and call-to-action.
     - Niche, topic, and community hashtag groups.
     - 3 video cover overlay text hooks.
     - Audio selection and trending music direction.
3. Edit or select preferred title/caption indices.
4. Use **One-Click Copy** buttons:
   - "Copy Title", "Copy Description", "Copy Tags", "Copy Full Kit".
5. Export documentation as clean `.txt` or comprehensive `.zip` package.
6. Open your YouTube Studio or Instagram app and manually paste your ready-to-go assets!

---

## 4. Storage Management & Disaster Recovery

Go to **Settings** in the top navigation bar:

### Storage Diagnostics & Cleanup
- View your live Drive D: capacity, total free space, and studio usage breakdown.
- See space occupied by Source Videos, Rendered Clips, Model Weights, Temp Files, Thumbnails, and SQLite DB.
- Click **Clean Stale Temp Files** to safely purge temporary upload chunks and intermediate rendering files without touching your media or database.

### Studio Backup & Disaster Recovery
- Click **Create Studio Backup** to generate a complete `.zip` archive containing:
  - SQLite `studio.db` flushed with `PRAGMA wal_checkpoint(TRUNCATE);`.
  - Backup `manifest.json` detailing project counts, clip counts, and app version.
  - Optional full source media and clip files.
- To restore: Click **Restore** next to any archive. The system runs `PRAGMA integrity_check`, creates an automatic safety rollback snapshot (`studio.db.pre_restore_*.bak`), and safely restores your database state.

---

## 5. Keyboard Shortcuts & Tips

- `Space`: Play / Pause video in player
- `Left Arrow` / `Right Arrow`: Seek backward / forward 5 seconds
- `M`: Mute / Unmute audio
- **VRAM Conservation**: Avoid running Faster-Whisper transcription and Ollama inference at the exact same second on 4GB VRAM laptops. The app handles sequential queuing automatically.
- **Multilingual Support**: Hindi and Devanagari text are fully supported in animated captions using the cross-platform font stack (`Segoe UI, Nirmala UI, Kohinoor Devanagari, Arial Unicode MS`).
