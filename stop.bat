@echo off
title Stop AI Shorts Studio

echo Stopping AI Shorts Studio services...

:: Kill processes on port 8000 (Backend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    echo Terminating Backend PID %%a...
    taskkill /f /pid %%a >nul 2>&1
)

:: Kill processes on port 5173 (Frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    echo Terminating Frontend PID %%a...
    taskkill /f /pid %%a >nul 2>&1
)

echo AI Shorts Studio services stopped cleanly.
timeout /t 2 /nobreak >nul
