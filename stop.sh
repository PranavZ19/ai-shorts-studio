#!/usr/bin/env bash
# Stop AI Shorts Studio services (macOS / Linux)

echo "Stopping AI Shorts Studio services..."

lsof -ti :8000 | xargs kill -9 2>/dev/null
lsof -ti :5173 | xargs kill -9 2>/dev/null

echo "All AI Shorts Studio processes stopped."
