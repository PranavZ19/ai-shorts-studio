@echo off
setlocal enabledelayedexpansion
title AI Shorts Studio Setup (Windows)

echo ===================================================
echo           AI Shorts Studio - Setup
echo ===================================================

cd /d "%~dp0"

:: 1. Check Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python 3.11 is required but not found in PATH.
    echo Please install Python 3.11 from python.org or run the installer in tools.
    pause
    exit /b 1
)

:: 2. Create Storage Folder Structure
echo [1/4] Ensuring storage directories on D:\AI-Shorts-Studio...
if not exist "D:\AI-Shorts-Studio\storage" (
    mkdir "D:\AI-Shorts-Studio\storage\source_videos" 2>nul
    mkdir "D:\AI-Shorts-Studio\storage\clips" 2>nul
    mkdir "D:\AI-Shorts-Studio\storage\temp" 2>nul
    mkdir "D:\AI-Shorts-Studio\storage\models" 2>nul
    mkdir "D:\AI-Shorts-Studio\storage\exports" 2>nul
    mkdir "D:\AI-Shorts-Studio\storage\thumbnails" 2>nul
)

:: 3. Setup Virtual Environment
echo [2/4] Setting up Python virtual environment...
if not exist "backend\.venv" (
    python -m venv backend\.venv
)

:: 4. Install backend dependencies
echo [3/4] Installing backend dependencies into virtual environment...
backend\.venv\Scripts\python.exe -m pip install --upgrade pip
backend\.venv\Scripts\pip.exe install -r backend\requirements.txt

:: 5. Install frontend dependencies
echo [4/4] Installing frontend dependencies...
cd frontend
call npm install
cd ..

echo ===================================================
echo   Setup Complete! Run start.bat to launch studio.
echo ===================================================
pause
