#!/usr/bin/env bash
# AI Shorts Studio - System Health Check (macOS / Linux)

set -e
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "==============================================================================="
echo "               AI SHORTS STUDIO -- SYSTEM HEALTH CHECK (UNIX/macOS)"
echo "==============================================================================="
echo ""

OVERALL_STATUS="PASSED"

# 1. Python virtual environment
echo "[1/7] Checking Python Virtual Environment..."
if [ -f "backend/.venv/bin/python" ]; then
    PY_VER=$(backend/.venv/bin/python -V 2>&1)
    echo "  [OK] Python found: $PY_VER"
else
    echo "  [FAIL] backend/.venv/bin/python not found!"
    OVERALL_STATUS="FAILED"
fi

# 2. Node.js & npm
echo ""
echo "[2/7] Checking Node.js and NPM..."
if command -v node >/dev/null 2>&1; then
    NODE_VER=$(node -v)
    echo "  [OK] Node.js found: $NODE_VER"
else
    echo "  [FAIL] Node.js not found in PATH!"
    OVERALL_STATUS="FAILED"
fi

# 3. FFmpeg and FFprobe
echo ""
echo "[3/7] Checking FFmpeg and FFprobe..."
if command -v ffmpeg >/dev/null 2>&1; then
    FF_VER=$(ffmpeg -version | head -n 1)
    echo "  [OK] FFmpeg found: $FF_VER"
else
    echo "  [FAIL] FFmpeg not found in PATH! Install via: brew install ffmpeg"
    OVERALL_STATUS="FAILED"
fi

# 4. Ollama
echo ""
echo "[4/7] Checking Local Ollama AI Engine..."
if curl -s http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
    echo "  [OK] Ollama server is responding at http://127.0.0.1:11434"
else
    echo "  [WARN] Ollama is not responding at port 11434. Start via: ollama serve"
fi

# 5. Storage Directory
echo ""
echo "[5/7] Checking Storage Root..."
STORAGE_DIR="storage"
mkdir -p "$STORAGE_DIR/source_videos" "$STORAGE_DIR/clips" "$STORAGE_DIR/models" "$STORAGE_DIR/temp" "$STORAGE_DIR/thumbnails" "$STORAGE_DIR/exports"
echo "  [OK] Storage subdirectories verified in ./$STORAGE_DIR"

# 6. Database Check
echo ""
echo "[6/7] Checking SQLite Database..."
if [ -f "$STORAGE_DIR/studio.db" ] && [ -f "backend/.venv/bin/python" ]; then
    backend/.venv/bin/python -c "import sqlite3; conn = sqlite3.connect('$STORAGE_DIR/studio.db'); cur = conn.cursor(); cur.execute('PRAGMA integrity_check;'); print('  [OK] PRAGMA integrity_check:', cur.fetchone()[0]); conn.close()" 2>/dev/null || true
else
    echo "  [INFO] Database will be initialized on first run."
fi

# 7. Hardware Detection
echo ""
echo "[7/7] Checking Hardware Capabilities..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    ARCH=$(uname -m)
    echo "  [OK] macOS detected on architecture: $ARCH (Apple Silicon / Intel)"
elif command -v nvidia-smi >/dev/null 2>&1; then
    echo "  [OK] NVIDIA GPU detected with CUDA support."
else
    echo "  [INFO] Running in CPU mode."
fi

echo ""
echo "==============================================================================="
if [ "$OVERALL_STATUS" = "PASSED" ]; then
    echo "               HEALTH CHECK RESULT: [OK] SYSTEM IS HEALTHY"
    echo "       AI Shorts Studio is ready to run with ./start.sh"
else
    echo "               HEALTH CHECK RESULT: [FAIL] ISSUES DETECTED"
    echo "       Please resolve the failed items above before launching."
fi
echo "==============================================================================="
echo ""
