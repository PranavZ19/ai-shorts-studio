#!/usr/bin/env bash
# AI Shorts Studio Setup (macOS / Linux)

set -e
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "==================================================="
echo "       AI Shorts Studio - Setup (macOS / Linux)"
echo "==================================================="

# 1. Check Python
PYTHON_CMD=""
if command -v python3.11 &>/dev/null; then
    PYTHON_CMD="python3.11"
elif command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
else
    echo "[ERROR] Python 3.11 is required. Please install via brew install python@3.11"
    exit 1
fi

echo "[1/3] Setting up Python virtual environment..."
$PYTHON_CMD -m venv backend/.venv
./backend/.venv/bin/pip install --upgrade pip
./backend/.venv/bin/pip install -r backend/requirements.txt

# PyTorch with MPS (Apple Silicon) or CPU
echo "[2/3] Installing PyTorch..."
./backend/.venv/bin/pip install torch torchvision torchaudio

# 2. Frontend
echo "[3/3] Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo "==================================================="
echo "  Setup complete! Run ./start.sh to launch studio."
echo "==================================================="
