#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  FS Intelligence Dashboard — macOS Launcher
#  Run: ./launch.sh
# ═══════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VENV_DIR="${SCRIPT_DIR}/.venv"
APP="$SCRIPT_DIR/app.py"
PORT=5050
URL="http://127.0.0.1:${PORT}"

echo ""
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║   Financial Services Intelligence Dashboard   ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo ""

# ── 1. Python check ──────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
  echo "  ✗ Python 3 is required. Install from https://python.org"
  exit 1
fi
PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "  ✓ Python $PYTHON_VERSION found"

# ── 2. Create virtualenv if missing ─────────────────────────
if [ ! -d "$VENV_DIR" ]; then
  echo "  → Creating virtual environment…"
  python3 -m venv "$VENV_DIR"
fi

# Activate
source "${VENV_DIR}/bin/activate"

# ── 3. Install dependencies ──────────────────────────────────
echo "  → Installing / verifying dependencies…"
pip install --quiet --upgrade pip
pip install --quiet -r "${SCRIPT_DIR}/requirements.txt"
echo "  ✓ Dependencies ready"

# ── 4. Kill any existing instance on the port ────────────────
EXISTING=$(lsof -ti tcp:${PORT} 2>/dev/null || true)
if [ -n "$EXISTING" ]; then
  echo "  → Stopping existing process on port ${PORT}…"
  kill -9 $EXISTING 2>/dev/null || true
  sleep 1
fi

# ── 5. Start Flask server in background ─────────────────────
echo "  → Starting server on ${URL}…"
cd "$SCRIPT_DIR"
PYTHONPATH="$SCRIPT_DIR" python3 "$APP" &
SERVER_PID=$!
echo "  ✓ Server PID: $SERVER_PID"

# Save PID for stop script
echo $SERVER_PID > "${SCRIPT_DIR}/.server.pid"

# ── 6. Wait for server to be ready ──────────────────────────
echo "  → Waiting for server to become ready…"
for i in $(seq 1 20); do
  if curl -s --max-time 2 "${URL}/api/status" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

# ── 7. Open in browser ───────────────────────────────────────
echo "  → Opening dashboard in your browser…"
echo ""
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │  Dashboard: ${URL}                    │"
echo "  │  Press Ctrl+C to stop the server                    │"
echo "  └─────────────────────────────────────────────────────┘"
echo ""

sleep 0.5
open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null || true

# ── 8. Wait for Ctrl+C ──────────────────────────────────────
trap "echo ''; echo '  → Shutting down…'; kill $SERVER_PID 2>/dev/null; rm -f '${SCRIPT_DIR}/.server.pid'; deactivate 2>/dev/null; exit 0" INT TERM

wait $SERVER_PID
