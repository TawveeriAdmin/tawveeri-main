#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTHON="$SCRIPT_DIR/.venv/bin/python"

if [ ! -x "$VENV_PYTHON" ]; then
  "$SCRIPT_DIR/install-flask.sh"
fi

cd "$SCRIPT_DIR"
exec "$VENV_PYTHON" app.py
