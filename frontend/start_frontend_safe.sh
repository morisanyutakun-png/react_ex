#!/usr/bin/env bash
set -euo pipefail

# Safe frontend start script for macOS (zsh/bash) - frontend/start_frontend_safe.sh
# - Cleans node_modules and package-lock.json
# - Clears npm cache
# - Installs dependencies skipping optional native deps
# - Installs platform-specific @rollup optional package for darwin-arm64 when needed
# - Starts Vite dev server

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
Usage: start_frontend_safe.sh [--start] [--install] [--recovery] [--help]

Options:
  --start     Run safe install then start dev server (default if omitted)
  --install   Only perform safe install (no dev server)
  --recovery  Force recovery install (remove node_modules & package-lock.json, then install)
  --help      Show this message

This script performs a conservative npm install that skips optional native
dependencies and then installs the darwin-arm64 rollup package explicitly
if running on Apple Silicon, which works around an npm optional-deps bug.
USAGE
}

install_rollup_optional_if_needed() {
  local os arch pkg
  os="$(uname -s)"
  arch="$(uname -m)"

  # Only handle Darwin/arm64 explicitly (common issue on Apple Silicon)
  if [[ "$os" == "Darwin" && "$arch" == "arm64" ]]; then
    pkg="@rollup/rollup-darwin-arm64"
    echo "[info] Installing optional package $pkg (darwin arm64 workaround)"
    # Install as optional; don't fail the script if npm has other problems
    npm install "$pkg" --save-optional || true
  fi
}

safe_install() {
  echo "[info] Running safe install (skip optional native deps)"
  npm install --omit=optional
  install_rollup_optional_if_needed
}

recovery_install() {
  echo "[info] Recovery: removing node_modules and package-lock.json"
  rm -rf node_modules package-lock.json
  echo "[info] Clearing npm cache (may require sudo depending on your setup)"
  npm cache clean --force
  safe_install
}

# Default action: start (install then run dev)
MODE="start"

if [[ ${#@} -gt 0 ]]; then
  case "$1" in
    --start) MODE="start" ;;
    --install) MODE="install" ;;
    --recovery) MODE="recovery" ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 2 ;;
  esac
fi

if [[ ! -f package.json ]]; then
  echo "[error] package.json not found in $ROOT_DIR. Are you in the frontend folder?"
  exit 1
fi

case "$MODE" in
  start)
    # If no node_modules or package-lock.json, do a safe install. Otherwise try lightweight install first.
    if [[ ! -d node_modules || ! -f package-lock.json ]]; then
      safe_install
    else
      echo "[info] node_modules and package-lock.json detected — running lightweight 'npm install --omit=optional'"
      safe_install
    fi

    echo "[info] Starting Vite dev server (npm run dev)"
    # exec so that Ctrl-C is forwarded to the process
    exec npm run dev
    ;;
  install)
    safe_install
    ;;
  recovery)
    recovery_install
    ;;
  *)
    echo "Invalid mode"; exit 3
    ;;
esac
#!/usr/bin/env bash
set -euo pipefail

# start_frontend_safe.sh
# Enhanced frontend starter for the project
# Features:
#  - detect package manager (pnpm/yarn/npm)
#  - optional clean reinstall (--reinstall)
#  - optional native rebuild (--rebuild-native)
#  - optional trust native binaries (--trust-native)  <-- DANGEROUS: removes quarantine and can codesign ad-hoc
#  - port check / conflict handling (default port: 5173)
#  - start dev server (--start)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

REINSTALL=false
START_NOW=false
REBUILD_NATIVE=false
TRUST_NATIVE=false
PORT=5173

print_usage(){
  cat <<EOF
Usage: $0 [--reinstall] [--rebuild-native] [--trust-native] [--start] [--port PORT]

Options:
  --reinstall       remove node_modules and lockfiles, reinstall deps
  --rebuild-native  run 'npm rebuild --build-from-source' after install
  --trust-native    (DANGEROUS) remove com.apple.quarantine and chmod+ on native .node files
  --start           start Vite dev server after install
  --port PORT       port to start dev server on (default: 5173)
  -h, --help        show this help
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --reinstall) REINSTALL=true; shift ;;
    --rebuild-native) REBUILD_NATIVE=true; shift ;;
    --trust-native) TRUST_NATIVE=true; shift ;;
    --start) START_NOW=true; shift ;;
    --port) PORT="$2"; shift 2 ;;
    -h|--help) print_usage; exit 0 ;;
    *) echo "Unknown arg: $1"; print_usage; exit 2 ;;
  esac
done

# Node check
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found. Please install Node.js (>=18, recommend 20.x)." >&2
  echo "Visit https://nodejs.org/ or use Homebrew: brew install node@20" >&2
  exit 2
fi

NODE_VER=$(node -v)
echo "[start_frontend_safe] Found node $NODE_VER"

# prefer pnpm if available, else yarn, else npm
PKG_MANAGER="npm"
if command -v pnpm >/dev/null 2>&1; then
  PKG_MANAGER="pnpm"
elif command -v yarn >/dev/null 2>&1; then
  PKG_MANAGER="yarn"
fi

echo "[start_frontend_safe] Using package manager: $PKG_MANAGER"

if [ "$REINSTALL" = true ]; then
  echo "[start_frontend_safe] Cleaning node_modules and lockfile (if present)..."
  mv node_modules node_modules.backup.$(date +%s) 2>/dev/null || rm -rf node_modules || true
  [ -f package-lock.json ] && mv package-lock.json package-lock.json.backup.$(date +%s) || true
  [ -f pnpm-lock.yaml ] && mv pnpm-lock.yaml pnpm-lock.yaml.backup.$(date +%s) || true
  [ -f yarn.lock ] && mv yarn.lock yarn.lock.backup.$(date +%s) || true
  if [ "$PKG_MANAGER" = "npm" ]; then
    npm cache clean --force || true
  fi
fi

echo "[start_frontend_safe] Installing dependencies..."
if [ "$PKG_MANAGER" = "pnpm" ]; then
  pnpm install
elif [ "$PKG_MANAGER" = "yarn" ]; then
  yarn install
else
  npm install
fi

if [ "$REBUILD_NATIVE" = true ]; then
  echo "[start_frontend_safe] Rebuilding native modules from source..."
  # rebuild package named rollup and native deps; run generic rebuild to cover others
  npm rebuild --build-from-source || true
fi

if [ "$TRUST_NATIVE" = true ]; then
  echo "[start_frontend_safe] Trusting native .node files (will remove quarantine and chmod)."
  # find common native node modules (rollup, etc.) and remove quarantine
  while IFS= read -r f; do
    echo "  -> trust: $f"
    cp "$f" "$f".bak 2>/dev/null || true
    xattr -d com.apple.quarantine "$f" 2>/dev/null || true
    chmod +x "$f" 2>/dev/null || true
  done < <(find node_modules -type f -name "*.node" -print 2>/dev/null)
fi

echo "[start_frontend_safe] Install complete."

# Port conflict check
if [ "$START_NOW" = true ]; then
  if command -v lsof >/dev/null 2>&1; then
    OCCUPIER=$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -Fp | tr -d 'p') || true
  else
    OCCUPIER=""
  fi

  if [ -n "$OCCUPIER" ]; then
    echo "[start_frontend_safe] Port $PORT appears in use. Processes:"
    lsof -nP -iTCP:$PORT -sTCP:LISTEN || true
    echo -n "Do you want to kill the processes listening on port $PORT? [y/N]: "
    read -r REPLY
    if [ "${REPLY,,}" = "y" ] || [ "${REPLY,,}" = "yes" ]; then
      lsof -t -iTCP:$PORT -sTCP:LISTEN | xargs -r kill
      sleep 0.5
    else
      echo "[start_frontend_safe] Starting on alternative port 5174"
      PORT=5174
    fi
  fi

  echo "[start_frontend_safe] Starting Vite dev server on port $PORT (foreground). Ctrl-C to stop."
  # pass port through to npm script
  if [ "$PKG_MANAGER" = "pnpm" ]; then
    pnpm --silent run dev -- --port $PORT
  elif [ "$PKG_MANAGER" = "yarn" ]; then
    yarn dev --port $PORT
  else
    npm run dev -- --port $PORT
  fi
else
  echo "[start_frontend_safe] Done. To start dev server now run:"
  echo "  ./start_frontend_safe.sh --start"
fi
