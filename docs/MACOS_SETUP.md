# AI Shorts Studio — macOS Setup Guide

AI Shorts Studio is cross-platform compatible and runs cleanly on macOS (both Apple Silicon M1/M2/M3/M4 and Intel Macs).

---

## Architecture & Storage on macOS

On macOS systems:
- The storage root automatically defaults to `~/.ai_shorts_studio/storage/` (or external storage volume if symlinked).
- Video encoding utilizes standard CPU `libx264` or Apple VideoToolbox (`h264_videotoolbox`).
- Speech transcription uses Faster-Whisper with CPU / PyTorch Metal backend.
- Local LLM inference utilizes Ollama for macOS with Apple Silicon GPU acceleration.

---

## 1. Prerequisites (via Homebrew)

1. Install [Homebrew](https://brew.sh) if not already installed:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. Install Python 3.11, Node.js, and FFmpeg:
   ```bash
   brew install python@3.11 node ffmpeg
   ```

3. Verify installations:
   ```bash
   python3.11 --version
   node -v
   ffmpeg -version
   ```

4. Install Ollama:
   ```bash
   brew install --cask ollama
   ```
   Start the Ollama application, then pull the required model:
   ```bash
   ollama pull qwen2.5:3b
   ```

---

## 2. Setup & Installation

1. Clone or navigate to the repository:
   ```bash
   cd shorts-ai
   ```

2. Run the setup script:
   ```bash
   chmod +x setup.sh start.sh stop.sh health-check.sh
   ./setup.sh
   ```

---

## 3. System Diagnostics

Run the Unix health check tool:
```bash
./health-check.sh
```
This confirms:
- Python environment in `backend/.venv`
- Node.js and npm packages
- FFmpeg and FFprobe binary availability
- Ollama reachability at `http://127.0.0.1:11434`
- SQLite database integrity

---

## 4. Launching the Studio

Start both backend and frontend services:
```bash
./start.sh
```
The browser will automatically open `http://localhost:5173`.

To stop the background services:
```bash
./stop.sh
```
