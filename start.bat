@echo off
setlocal enabledelayedexpansion
title AI Shorts Studio Launcher

echo ===================================================
echo           Starting AI Shorts Studio...
echo ===================================================

cd /d "%~dp0"

:: Check if virtual environment exists
if not exist "backend\.venv\Scripts\python.exe" (
    echo [ERROR] Python virtual environment not found!
    echo Please run setup.bat first.
    pause
    exit /b 1
)

:: Ensure isolated storage directories exist on D: drive
if not exist "D:\AI-Shorts-Studio\storage" mkdir "D:\AI-Shorts-Studio\storage"
if not exist "D:\AI-Shorts-Studio\storage\source_videos" mkdir "D:\AI-Shorts-Studio\storage\source_videos"
if not exist "D:\AI-Shorts-Studio\storage\clips" mkdir "D:\AI-Shorts-Studio\storage\clips"
if not exist "D:\AI-Shorts-Studio\storage\models" mkdir "D:\AI-Shorts-Studio\storage\models"
if not exist "D:\AI-Shorts-Studio\storage\models\ollama" mkdir "D:\AI-Shorts-Studio\storage\models\ollama"
if not exist "D:\AI-Shorts-Studio\storage\temp" mkdir "D:\AI-Shorts-Studio\storage\temp"
if not exist "D:\AI-Shorts-Studio\storage\thumbnails" mkdir "D:\AI-Shorts-Studio\storage\thumbnails"
if not exist "D:\AI-Shorts-Studio\storage\exports\backups" mkdir "D:\AI-Shorts-Studio\storage\exports\backups"

:: Set Ollama models storage strictly on D: drive
set "OLLAMA_MODELS=D:\AI-Shorts-Studio\storage\models\ollama"

:: Check and start Ollama daemon if installed
set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
if exist "%OLLAMA_EXE%" (
    echo [0/3] Ensuring local Ollama server is running with models on D:...
    start "AI Shorts Studio - Ollama" /min cmd /c "set OLLAMA_MODELS=D:\AI-Shorts-Studio\storage\models\ollama && "%OLLAMA_EXE%" serve"
)

:: Kill any old running instances on ports 8000 and 5173
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [1/2] Starting Backend Service on port 8000...
start "AI Shorts Studio - Backend" /min cmd /c "cd /d "%~dp0backend" && .venv\Scripts\python.exe run.py"

echo [2/2] Starting Frontend Service on port 5173...
start "AI Shorts Studio - Frontend" /min cmd /c "cd /d "%~dp0frontend" && npm run dev"

:: Wait 3 seconds for servers to initialize
timeout /t 3 /nobreak >nul

echo [INFO] Opening AI Shorts Studio in your default browser...
start http://localhost:5173

echo ===================================================
echo   AI Shorts Studio is running!
echo   Frontend: http://localhost:5173
echo   Backend:  http://127.0.0.1:8000
echo   To stop the studio, run stop.bat
echo ===================================================
