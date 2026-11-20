@echo off
setlocal enabledelayedexpansion
title AI Shorts Studio - System Health Check

echo ===============================================================================
echo                AI SHORTS STUDIO -- SYSTEM HEALTH CHECK
echo ===============================================================================
echo.

set "OVERALL_STATUS=PASSED"
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

:: 1. Check Python Virtual Environment
echo [1/8] Checking Python Virtual Environment...
if exist "backend\.venv\Scripts\python.exe" (
    for /f "tokens=*" %%v in ('backend\.venv\Scripts\python.exe -V 2^>^&1') do set "PY_VER=%%v"
    echo   [OK] Python found: !PY_VER!
) else (
    echo   [FAIL] backend\.venv\Scripts\python.exe not found!
    echo          Run setup.bat or create the virtual environment.
    set "OVERALL_STATUS=FAILED"
)

:: 2. Check Node.js and NPM
echo.
echo [2/8] Checking Node.js and NPM...
where node >nul 2>&1
if %ERRORLEVEL% equ 0 (
    for /f "tokens=*" %%v in ('node -v') do set "NODE_VER=%%v"
    echo   [OK] Node.js found: !NODE_VER!
) else (
    echo   [FAIL] Node.js is not installed or not in PATH!
    set "OVERALL_STATUS=FAILED"
)

:: 3. Check FFmpeg and FFprobe
echo.
echo [3/8] Checking FFmpeg and FFprobe...
where ffmpeg >nul 2>&1
if %ERRORLEVEL% equ 0 (
    for /f "tokens=*" %%v in ('ffmpeg -version ^| findstr "ffmpeg version"') do set "FFMPEG_VER=%%v"
    echo   [OK] FFmpeg found: !FFMPEG_VER!
) else (
    echo   [FAIL] FFmpeg not found in PATH! Video rendering requires FFmpeg.
    set "OVERALL_STATUS=FAILED"
)
where ffprobe >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo   [OK] FFprobe found.
) else (
    echo   [FAIL] FFprobe not found in PATH!
    set "OVERALL_STATUS=FAILED"
)

:: 4. Check NVIDIA GPU and CUDA
echo.
echo [4/8] Checking NVIDIA GPU and CUDA Acceleration...
where nvidia-smi >nul 2>&1
if %ERRORLEVEL% equ 0 (
    for /f "tokens=*" %%g in ('nvidia-smi --query-gpu^=gpu_name^,driver_version --format^=csv^,noheader 2^>nul') do set "GPU_INFO=%%g"
    echo   [OK] NVIDIA GPU detected: !GPU_INFO!
    echo   [OK] Hardware acceleration (NVENC + PyTorch CUDA) is available.
) else (
    echo   [WARN] NVIDIA GPU not detected (nvidia-smi unavailable).
    echo          Studio will run in CPU fallback mode (libx264 + CPU Whisper).
)

:: 5. Check Local Ollama Engine
echo.
echo [5/8] Checking Local Ollama AI Engine...
curl -s http://127.0.0.1:11434/api/tags > temp_tags.json 2>nul
if %ERRORLEVEL% equ 0 (
    echo   [OK] Ollama server is actively responding at http://127.0.0.1:11434
    findstr /c:"qwen2.5:3b" temp_tags.json >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        echo   [OK] Model 'qwen2.5:3b' is loaded and ready for viral analysis.
    ) else (
        echo   [WARN] 'qwen2.5:3b' not found in Ollama library. Run: ollama pull qwen2.5:3b
    )
    del temp_tags.json 2>nul
) else (
    echo   [WARN] Ollama is not currently responding at port 11434.
    echo          Start it with: start.bat or 'ollama serve'
)

:: 6. Check Storage Root on Drive D:
echo.
echo [6/8] Checking Isolated Storage Root (D:\AI-Shorts-Studio)...
if exist "D:\AI-Shorts-Studio\storage" (
    echo   [OK] Storage directory exists: D:\AI-Shorts-Studio\storage
    if not exist "D:\AI-Shorts-Studio\storage\source_videos" mkdir "D:\AI-Shorts-Studio\storage\source_videos"
    if not exist "D:\AI-Shorts-Studio\storage\clips" mkdir "D:\AI-Shorts-Studio\storage\clips"
    if not exist "D:\AI-Shorts-Studio\storage\models" mkdir "D:\AI-Shorts-Studio\storage\models"
    if not exist "D:\AI-Shorts-Studio\storage\temp" mkdir "D:\AI-Shorts-Studio\storage\temp"
    if not exist "D:\AI-Shorts-Studio\storage\thumbnails" mkdir "D:\AI-Shorts-Studio\storage\thumbnails"
    if not exist "D:\AI-Shorts-Studio\storage\exports" mkdir "D:\AI-Shorts-Studio\storage\exports"
    echo   [OK] Storage subdirectories verified (source_videos, clips, models, temp, thumbnails, exports).
) else (
    echo   [WARN] D:\AI-Shorts-Studio\storage directory does not exist yet.
    echo          Creating D:\AI-Shorts-Studio\storage...
    mkdir "D:\AI-Shorts-Studio\storage" 2>nul
)

:: 7. Check SQLite Database & Run Integrity Check
echo.
echo [7/8] Checking SQLite Studio Database Integrity...
if exist "D:\AI-Shorts-Studio\storage\studio.db" (
    echo   [OK] Studio database exists: D:\AI-Shorts-Studio\storage\studio.db
    backend\.venv\Scripts\python.exe -c "import sqlite3; conn = sqlite3.connect('D:/AI-Shorts-Studio/storage/studio.db'); cur = conn.cursor(); cur.execute('PRAGMA integrity_check;'); res = cur.fetchone(); print('  [OK] PRAGMA integrity_check:', res[0]); conn.close()" 2>nul
) else (
    echo   [WARN] studio.db not found yet. It will be initialized on first run.
)

:: 8. Check Drive D: Available Space
echo.
echo [8/8] Checking Storage Drive Free Space...
backend\.venv\Scripts\python.exe -c "import shutil; total, used, free = shutil.disk_usage('D:/AI-Shorts-Studio' if __import__('os').path.exists('D:/AI-Shorts-Studio') else 'C:/'); print(f'  Disk Total: {total / (1024**3):.1f} GB | Free: {free / (1024**3):.1f} GB'); print('  [OK] Sufficient disk space available.' if free > 5*1024**3 else '  [WARN] Low disk space! Less than 5 GB free.')" 2>nul

echo.
echo ===============================================================================
if "%OVERALL_STATUS%"=="PASSED" (
    echo                HEALTH CHECK RESULT: [OK] SYSTEM IS HEALTHY
    echo        AI Shorts Studio is ready to run with start.bat
) else (
    echo                HEALTH CHECK RESULT: [FAIL] ISSUES DETECTED
    echo        Please resolve the failed items above before launching.
)
echo ===============================================================================
echo.
pause
