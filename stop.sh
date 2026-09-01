#!/usr/bin/env bash
# Stop the FS Intelligence Dashboard server
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PID_FILE="${SCRIPT_DIR}/.server.pid"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  kill "$PID" 2>/dev/null && echo "  ✓ Server (PID $PID) stopped." || echo "  ⚠ Server was not running."
  rm -f "$PID_FILE"
else
  # Fallback: kill anything on port 5050
  EXISTING=$(lsof -ti tcp:5050 2>/dev/null || true)
  if [ -n "$EXISTING" ]; then
    kill -9 $EXISTING 2>/dev/null
    echo "  ✓ Stopped process on port 5050."
  else
    echo "  ℹ No server running on port 5050."
  fi
fi
