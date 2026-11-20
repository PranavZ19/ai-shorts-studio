# AI Shorts Studio ⚡

An autonomous, 100% free, local-first AI-powered desktop-web studio that transforms long-form videos into viral, high-retention 9:16 vertical **YouTube Shorts** and **Instagram Reels**.

AI Shorts Studio runs **entirely on your local machine** using open-source AI and hardware acceleration—requiring **zero paid APIs, zero subscriptions, and zero cloud services**.

---

## 🌟 Key Capabilities

- 🎙️ **Local AI Speech-to-Text**: Real speech transcription using **Faster-Whisper** (`base`, `small`, `tiny`) with CUDA acceleration and word-level timestamps.
- 🧠 **Intelligent AI Clip Selection**: Local LLM scoring powered by **Ollama (`qwen2.5:3b`)** evaluating Hook (0–100), Narrative Flow, and Virality Payoff with sentence-boundary snapping.
- 🎯 **Intelligent 9:16 Vertical Reframing**: Face detection and tracking using **OpenCV YuNet DNN** with automatic horizontal panning to keep speakers centered.
- ⚡ **Hardware-Accelerated Rendering**: Fast 1080×1920 MP4 video rendering using **NVIDIA NVENC (`h264_nvenc`)** with automatic CPU fallback.
- 🎨 **Animated Dynamic Captions**: Multi-style animated subtitles (`.ass`) with active-word highlight, karaoke glow, and full Devanagari (Hindi) cross-platform font support.
- 📈 **Creator Strategy & Trend Discovery**: Real-time trending topics from **Google Trends RSS**, **Hacker News API**, and **Reddit** with zero paid APIs; AI strategic blueprints, hook analysis, and personalized content ideas.
- 📅 **Smart Upload Scheduler & Calendar**: Empirical peak upload recommendations tailored for YouTube Shorts vs Instagram Reels with an interactive content calendar.
- 📦 **AI Publishing Kit**: Platform-divergent metadata packages with SEO-optimized titles, line-1 hooks, descriptions, tagged hashtags, and tag lists strictly capped under YouTube's 500-character limit.
- 💾 **Drive D: Media Isolation**: Keeps primary C: drive clean by storing all large files (source videos, rendered clips, model weights, database) in `D:\AI-Shorts-Studio`.
- 🛡️ **Studio Backup & Disaster Recovery**: Instant ZIP backup archives with SQLite WAL checkpointing, manifest validation, and pre-restore safety rollback `.bak` creation.
- 🔒 **Zero Social Media Credentials**: No YouTube OAuth, No Instagram OAuth, No bots, and No automated publishing. You retain 100% manual control over your channels.

---

## 🛠️ System Architecture

| Component | Technology | Configuration / Storage |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons | Responsive Dark SaaS UI, Native 9:16 Video Player |
| **Backend** | Python 3.11, FastAPI, SQLAlchemy, Pydantic | RESTful API, Byte-Range Video Streaming, SSE Progress |
| **Speech-to-Text** | Faster-Whisper (CUDA / CPU) | Model weights stored in `D:\AI-Shorts-Studio\storage\models` |
| **Local LLM Engine** | Ollama (`qwen2.5:3b` Quantized) | Model weights stored in `D:\AI-Shorts-Studio\storage\models\ollama` |
| **Video Processing** | FFmpeg (NVENC + libx264) & OpenCV YuNet | 1080×1920 9:16 MP4 @ 30 FPS, H.264 + AAC |
| **Database** | SQLite 3 (WAL mode) | `D:\AI-Shorts-Studio\storage\studio.db` |
| **Storage Root** | Drive D: Isolated Directory | `D:\AI-Shorts-Studio\` |

---

## 🚀 Quick Start

### Windows (Primary)

1. **Verify System Health**:
   ```cmd
   health-check.bat
   ```
2. **Start AI Shorts Studio**:
   ```cmd
   start.bat
   ```
   *The launcher starts the backend, starts the frontend, launches Ollama on Drive D:, and opens `http://localhost:5173` in your default browser.*
3. **Stop Studio Services**:
   ```cmd
   stop.bat
   ```

### macOS / Linux

```bash
chmod +x setup.sh start.sh stop.sh health-check.sh
./setup.sh
./health-check.sh
./start.sh
```

---

## 📚 Documentation Index

- [Creator User Guide](docs/USER_GUIDE.md): Complete end-to-end tutorial from ingestion to social publishing.
- [Windows Installation Guide](docs/INSTALLATION_WINDOWS.md): Detailed Windows setup instructions.
- [macOS Setup Guide](docs/MACOS_SETUP.md): Homebrew, Apple Silicon, and CPU configuration.
- [Troubleshooting & FAQ](docs/TROUBLESHOOTING.md): Solutions for VRAM management, FFmpeg paths, and recovery.
- [System Architecture](docs/ARCHITECTURE.md): Deep dive into data flow and storage hierarchy.
- [Phase 10 Final Audit & Report](docs/PHASE_10_FINAL_REPORT.md): Comprehensive validation report across all test suites.

---

## 🧪 Automated Test Coverage

AI Shorts Studio includes comprehensive automated integration test suites:

| Test Suite | Purpose | Tests | Status |
|---|---|:---:|:---:|
| `test_phase7_e2e.py` | Complete end-to-end ingestion, transcription, rendering & downloads | 20 / 20 | **100% PASS** |
| `test_phase8_strategy.py` | Creator Strategy, Trend Discovery, Blueprints & Content Calendar | 21 / 21 | **100% PASS** |
| `test_phase9_publishing.py` | AI Publishing Kit, Platform Divergence & Multi-Format Exports | 25 / 25 | **100% PASS** |
| `test_phase10_polish.py` | Storage Stats, Temp Cleanup, Backup/Restore & System Health | 43 / 43 | **100% PASS** |
| **Total Automated Tests** | | **109 / 109** | **100% PASS** |

To run the full Phase 10 test suite:
```cmd
backend\.venv\Scripts\python.exe backend/tests/test_phase10_polish.py
```

---

## 📄 License

MIT License. 100% Free and Open Source.
