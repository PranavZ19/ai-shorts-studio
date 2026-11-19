#!/usr/bin/env bash
# AI Shorts Studio Launcher (macOS / Linux)

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "==================================================="
echo "          Starting AI Shorts Studio (macOS)..."
echo "==================================================="

if [ ! -f "backend/.venv/bin/python" ]; then
    echo "[ERROR] Python virtual environment not found in backend/.venv!"
    echo "Please run ./setup.sh first."
    exit 1
fi

# Stop existing processes
lsof -ti :8000 | xargs kill -9 2>/dev/null
lsof -ti :5173 | xargs kill -9 2>/dev/null

echo "[1/2] Starting Backend Service on port 8000..."
cd "$SCRIPT_DIR/backend"
./.venv/bin/python run.py &
BACKEND_PID=$!

echo "[2/2] Starting Frontend Service on port 5173..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

sleep 2

# Open in default browser
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:5173"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "http://localhost:5173" 2>/dev/null || true
fi

echo "AI Shorts Studio is running at http://localhost:5173"
echo "To stop, run ./stop.sh"
wait
