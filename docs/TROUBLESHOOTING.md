# AI Shorts Studio — Troubleshooting & Common Issues Guide

This guide covers common issues, root causes, and verified solutions for **AI Shorts Studio**.

---

## 1. Local AI & VRAM Management

### Symptom: `CUDA out of memory` during transcription or rendering
- **Cause**: On 4 GB VRAM GPUs (such as RTX 3050 Laptop), running Faster-Whisper, Ollama inference, and NVENC hardware encoding simultaneously can exceed GPU memory.
- **Solution**:
  1. The studio automatically runs workloads sequentially. Avoid manually triggering a new transcription while a render is actively encoding.
  2. In **Studio Settings**, select Whisper model `base` or `tiny` instead of `small`.
  3. Set Hardware Acceleration to `Auto-detect` or force `CPU Encoding (libx264)`.

### Symptom: `Ollama connection refused` or `http://127.0.0.1:11434 unreachable`
- **Cause**: Ollama daemon is not running in the background.
- **Solution**:
  1. Launch Ollama manually: `ollama serve`.
  2. Verify by visiting `http://127.0.0.1:11434` in your browser.
  3. Ensure `qwen2.5:3b` is pulled: `ollama pull qwen2.5:3b`.
  4. Note: If Ollama is offline, the studio uses its built-in rule-based heuristic fallback engine, ensuring your workflow is never interrupted.

---

## 2. Storage & Drive D: Issues

### Symptom: `[WinError 3] The system cannot find the path specified: 'D:\\AI-Shorts-Studio'`
- **Cause**: Your system does not have a physical D: drive or the directory was deleted.
- **Solution**:
  1. Run `health-check.bat` or `start.bat` — it will automatically create the required directories.
  2. If your PC does not have a D: drive, create a directory (e.g. `C:\AI-Shorts-Studio`), open `backend/app/config.py`, and set `STORAGE_ROOT = Path("C:/AI-Shorts-Studio")`.

### Symptom: `Low disk space warning!`
- **Cause**: Free space on Drive D: is below 5 GB.
- **Solution**:
  1. Open **Settings > Storage & Disk Management**.
  2. Click **Clean Stale Temp Files** to purge expired upload chunks and intermediate rendering files.
  3. Delete older unneeded source videos or clips using the bulk delete tool.

---

## 3. Video Rendering & FFmpeg Issues

### Symptom: `ffmpeg is not recognized as an internal or external command`
- **Cause**: FFmpeg is not in the Windows system PATH.
- **Solution**:
  1. Download FFmpeg and place `ffmpeg.exe` and `ffprobe.exe` into `D:\AI-Shorts-Studio\tools\ffmpeg\bin\`.
  2. The application checks this specific folder automatically before falling back to system PATH.

### Symptom: `nvenc: Unknown encoder 'h264_nvenc'`
- **Cause**: NVIDIA graphics drivers are outdated or GPU does not support NVENC.
- **Solution**:
  1. Update NVIDIA drivers to the latest Game Ready or Studio Driver.
  2. In **Settings > Rendering Defaults**, change Hardware Acceleration from `cuda` to `auto` or `cpu`.

---

## 4. Subtitle Font & Devanagari (Hindi) Rendering

### Symptom: Hindi or Devanagari text shows squares (tofu) or disconnected characters
- **Cause**: Missing Indic fonts or unsupported subtitle format.
- **Solution**:
  1. AI Shorts Studio includes a robust multi-font stack: `Segoe UI, Nirmala UI, Kohinoor Devanagari, Arial Unicode MS`.
  2. Windows has `Nirmala UI` preinstalled; macOS includes `Kohinoor Devanagari`.
  3. Ensure your system language settings include the Hindi language pack.

---

## 5. Database & Recovery

### Symptom: `sqlite3.OperationalError: database is locked`
- **Cause**: An interrupted process or zombie worker held a lock on `studio.db`.
- **Solution**:
  1. Run `stop.bat` to terminate all background Python processes and free locks.
  2. The studio operates in `WAL` mode (`PRAGMA journal_mode=WAL;`), which allows concurrent reads and safe recovery.

### Symptom: Accidental deletion or corrupt data
- **Solution**:
  1. Go to **Settings > Studio Backup & Disaster Recovery**.
  2. Find your latest backup and click **Restore**.
  3. The system validates the archive, executes `PRAGMA integrity_check`, creates a safety snapshot (`studio.db.pre_restore_*.bak`), and restores your projects cleanly.
