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
