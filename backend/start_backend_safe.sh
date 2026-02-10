#!/usr/bin/env bash
set -euo pipefail

# start_backend_safe.sh
# - Creates a fresh venv at .venv (backs up existing .venv)
# - Installs/updates pip, setuptools, wheel
# - Installs requirements from requirements.txt
# - Optionally starts the dev server when run with --start
# - Optionally runs DB migrations when run with --migrate
# - If run with no args, performs migrate + reindex + start (convenience for dev)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Repository root (one level above backend)
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# If a repo-level .env exists, load it so alembic and the server see the same DATABASE_URL
if [ -f "$REPO_ROOT/.env" ]; then
  echo "[start_backend_safe] Loading environment from $REPO_ROOT/.env"
  # export variables defined in .env for subprocesses
  set -a
  # shellcheck disable=SC1090
  . "$REPO_ROOT/.env"
  set +a
fi

# If .env points DATABASE_URL at docker service 'db' (common in docker-compose),
# but we're running locally (no docker network), override to use local sqlite for dev convenience.
if [ -n "${DATABASE_URL:-}" ]; then
  if echo "$DATABASE_URL" | grep -qE "(@db:|://db:|@db/|://db/)"; then
    echo "[start_backend_safe] Detected DATABASE_URL pointing to docker host 'db'. Overriding to local sqlite for dev."
    export DATABASE_URL="sqlite:///$REPO_ROOT/data/examgen.db"
    echo "[start_backend_safe] DATABASE_URL set to $DATABASE_URL"
  fi
fi

TIMESTAMP=$(date +%s)

echo "[start_backend_safe] Running in $SCRIPT_DIR"

if [ -d .venv ]; then
  echo "[start_backend_safe] Existing .venv found. Moving to .venv.backup.$TIMESTAMP"
  mv .venv .venv.backup.$TIMESTAMP
fi

# Prefer explicit python3
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 not found in PATH. Install Python 3 and re-run." >&2
  exit 2
fi

# Create venv
python3 -m venv .venv

# Use venv's python for subsequent operations to avoid ambiguity
# Use absolute paths so subshells (cd to repo root) can still find the venv python
VENV_PY="$SCRIPT_DIR/.venv/bin/python"
VENV_PIP="$SCRIPT_DIR/.venv/bin/pip"

echo "[start_backend_safe] Upgrading pip, setuptools, wheel inside venv"
"$VENV_PY" -m pip install --upgrade pip setuptools wheel

REQ_FILE=requirements.txt
if [ ! -f "$REQ_FILE" ]; then
  echo "ERROR: requirements.txt not found in $SCRIPT_DIR" >&2
  exit 3
fi

echo "[start_backend_safe] Installing requirements from $REQ_FILE"
"$VENV_PY" -m pip install -r "$REQ_FILE"

# Parse flags
# action_migrate: run alembic upgrade head
# action_start: start uvicorn
# action_reindex: after server start, call /api/reindex_recent to seed RAG index (dev convenience)

# Defaults: if no args provided, perform migrate + reindex + start for convenience
if [ "$#" -eq 0 ]; then
  action_migrate=true
  action_start=true
  action_reindex=true
else
  action_migrate=false
  action_start=false
  action_reindex=false
  for a in "$@"; do
    case "$a" in
      --migrate) action_migrate=true ;;
      --start) action_start=true ;;
      --reindex) action_reindex=true ;;
      --no-recreate) NO_RECREATE=true ;;
      *) echo "[start_backend_safe] Unknown flag: $a" ;;
    esac
  done
fi

# Run migrations if requested
if [ "${action_migrate:-false}" = true ]; then
  echo "[start_backend_safe] --migrate detected: preparing to run DB migrations"

  echo "[start_backend_safe] Ensuring alembic is installed in venv"
  "$VENV_PY" -m pip install alembic

  # Ensure repo-level data directory exists (SQLite default path)
  REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
  mkdir -p "$REPO_ROOT/data"

  ALEMBIC_INI="$REPO_ROOT/alembic.ini"
  if [ ! -f "$ALEMBIC_INI" ]; then
    echo "[start_backend_safe] WARNING: alembic.ini not found at $ALEMBIC_INI. Skipping migration." >&2
  else
  echo "[start_backend_safe] Running migrations: alembic -c $ALEMBIC_INI upgrade head (cwd=$REPO_ROOT)"
  # Run alembic from the repository root so relative script_location paths resolve correctly
  (cd "$REPO_ROOT" && "$VENV_PY" -m alembic -c "$ALEMBIC_INI" upgrade head)
    echo "[start_backend_safe] Migrations complete"
  fi
fi

# Activation hint
echo "[start_backend_safe] Setup complete. To activate: source .venv/bin/activate"

# Start server (with optional reindex)
if [ "${action_start:-false}" = true ]; then
  # If reindexing requested, start server in background, wait for readiness, call reindex endpoint, then tail logs.
  if [ "${action_reindex:-false}" = true ]; then
    SERVER_LOG="$SCRIPT_DIR/.uvicorn.log"
  echo "[start_backend_safe] Starting uvicorn in background (logs -> $SERVER_LOG)"
  # Start uvicorn in background from repository root so the app and alembic use the same ./data path.
  # Use module path backend.main:app because we're starting from REPO_ROOT
  (cd "$REPO_ROOT" && "$VENV_PY" -m uvicorn backend.main:app --reload --port 8000 >"$SERVER_LOG" 2>&1 &)
  # Capture PID of the uvicorn process we just started
  UVICORN_PID=$(pgrep -f "uvicorn.*backend.main:app" | head -n1 || true)

    # Wait for server to be ready by probing openapi.json
    echo "[start_backend_safe] Waiting for server readiness on http://127.0.0.1:8000/openapi.json"
    for i in {1..30}; do
      if curl -sSf http://127.0.0.1:8000/openapi.json > /dev/null 2>&1; then
        echo "[start_backend_safe] Server is up"
        break
      fi
      sleep 1
    done

    if ! curl -sSf http://127.0.0.1:8000/openapi.json > /dev/null 2>&1; then
      echo "[start_backend_safe] WARNING: server did not become ready in time. Check $SERVER_LOG" >&2
    else
      # Call reindex endpoint to seed a recent-sample index for RAG (best effort)
      echo "[start_backend_safe] Calling /api/reindex_recent to create a sample doc for RAG (best-effort)"
      REINDEX_RESP="$(curl -s -X POST http://127.0.0.1:8000/api/reindex_recent || true)"
      echo "[start_backend_safe] /api/reindex_recent response: $REINDEX_RESP"
    fi

    echo "[start_backend_safe] Tailing server log (press Ctrl-C to stop)"
    tail -n +1 -f "$SERVER_LOG"
    # When tail ends (Ctrl-C), ensure uvicorn is terminated
    echo "[start_backend_safe] Stopping uvicorn (pid=$UVICORN_PID)"
    if [ -n "${UVICORN_PID:-}" ]; then
      kill "$UVICORN_PID" 2>/dev/null || true
    fi
  else
  echo "[start_backend_safe] Starting uvicorn (foreground) from repo root. Use Ctrl-C to stop."
  # Run from repo root so the server uses the same ./data path as migrations
  (cd "$REPO_ROOT" && "$VENV_PY" -m uvicorn backend.main:app --reload --port 8000)
  fi
else
  echo "[start_backend_safe] Done. To start server now run:"
  echo "  source .venv/bin/activate && python -m uvicorn main:app --reload --port 8000"
fi
