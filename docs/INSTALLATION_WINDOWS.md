# AI Shorts Studio — Windows Installation & Setup Guide

This guide provides end-to-end instructions for installing and running **AI Shorts Studio** on Windows 10/11.

---

## Hardware & System Requirements

### Recommended Hardware
- **Operating System**: Windows 10 / Windows 11 (64-bit)
- **CPU**: Intel Core i5 / AMD Ryzen 5 or higher
- **RAM**: 16 GB System Memory
- **GPU**: NVIDIA RTX 3050 Laptop GPU (4 GB VRAM) or higher with CUDA support
- **Storage**: Secondary drive `D:` with at least 25 GB free space for model weights, source videos, and renders.

*(Note: CPU-only mode is also fully supported if no NVIDIA GPU is available).*

---

## 1. Prerequisites Installation

### A. Python 3.11
1. Download Python 3.11 from [python.org](https://www.python.org/downloads/).
2. During installation, **check the box "Add python.exe to PATH"**.
3. Verify in Command Prompt:
   ```cmd
   python --version
   ```

### B. Node.js (v18 or v20 LTS)
1. Download Node.js from [nodejs.org](https://nodejs.org/).
2. Verify installation:
   ```cmd
   node -v
   npm -v
   ```

### C. FFmpeg & FFprobe
1. Download a pre-built static release of FFmpeg (e.g. from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/)).
2. Extract and place `ffmpeg.exe` and `ffprobe.exe` into your system PATH (e.g. `C:\ffmpeg\bin`), or place in `D:\AI-Shorts-Studio\tools\ffmpeg\bin\`.
3. Verify in Command Prompt:
   ```cmd
   ffmpeg -version
   ffprobe -version
   ```

### D. Ollama (Local AI Virality & Rubrics)
1. Download and install Ollama for Windows from [ollama.com/download](https://ollama.com/download).
2. Configure Ollama to store models strictly on Drive D: to avoid taking space on C:
   ```cmd
   setx OLLAMA_MODELS "D:\AI-Shorts-Studio\storage\models\ollama"
   ```
3. Pull the recommended lightweight 3B model:
   ```cmd
   ollama pull qwen2.5:3b
   ```
4. Confirm model is downloaded on Drive D:
   ```cmd
   ollama list
   ```

---

## 2. Project Installation & Setup

1. Open PowerShell or Command Prompt in the project repository:
   ```cmd
   cd c:\Users\DELL\Documents\Projects\shorts-ai
   ```

2. Run the automated setup script:
   ```cmd
   setup.bat
   ```
   *What `setup.bat` does:*
   - Creates the Python virtual environment in `backend\.venv`
   - Installs backend requirements (FastAPI, PyTorch with CUDA, Faster-Whisper, OpenCV, SQLAlchemy, yt-dlp)
   - Installs frontend Node dependencies (`frontend\node_modules`)
   - Pre-creates isolated directories in `D:\AI-Shorts-Studio\storage\`

---

## 3. System Health Check

Before starting the studio, run the diagnostic tool:
```cmd
health-check.bat
```
The health check validates:
- Python virtual environment & packages
- Node.js & npm
- FFmpeg & FFprobe
- NVIDIA GPU detection & NVENC support
- Ollama connection & `qwen2.5:3b` model weights
- Drive D: storage directories
- SQLite database integrity (`PRAGMA integrity_check`)
- Available drive free space

---

## 4. Launching the Studio

Double-click `start.bat` or run from terminal:
```cmd
start.bat
```
- Starts Ollama in background (models stored on Drive D:)
- Starts FastAPI backend at `http://127.0.0.1:8000`
- Starts Vite frontend at `http://localhost:5173`
- Opens your default web browser automatically.

To stop the services cleanly:
```cmd
stop.bat
```
