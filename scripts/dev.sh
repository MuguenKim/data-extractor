#!/usr/bin/env bash
# Enable strict mode, but make pipefail optional for shells/environments that don't support it
set -e
set -u
# Try enabling pipefail if available (ignore errors in non-bash shells)
( set -o pipefail ) 2>/dev/null || true

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
PIDS_DIR="$ROOT_DIR/.dev"
mkdir -p "$PIDS_DIR"

# Load .env if present
if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT_DIR/.env"
  set +a
fi

# Normalize OCR_LANG_PATH to an absolute path if provided, and only keep it if directory exists.
if [[ -n "${OCR_LANG_PATH:-}" ]]; then
  if [[ "${OCR_LANG_PATH:0:1}" != "/" ]]; then
    # Make relative to monorepo root
    OCR_LANG_PATH_ABS="$ROOT_DIR/${OCR_LANG_PATH#./}"
  else
    OCR_LANG_PATH_ABS="$OCR_LANG_PATH"
  fi
  if [[ -d "$OCR_LANG_PATH_ABS" ]]; then
    export OCR_LANG_PATH="$OCR_LANG_PATH_ABS"
    echo "[dev] OCR_LANG_PATH set to $OCR_LANG_PATH"
  else
    echo "[dev] Warning: OCR_LANG_PATH '$OCR_LANG_PATH_ABS' not found; unsetting to allow CDN fallback"
    unset OCR_LANG_PATH
  fi
fi

API_PORT="${API_PORT:-3001}"
WORKER_HTTP_PORT="${WORKER_HTTP_PORT:-3002}"
WEB_PORT="${WEB_PORT:-3000}"

start_one() {
  local name="$1"; shift
  local dir="$1"; shift
  local script="$1"; shift

  echo "[dev] starting $name in $dir ..."
  (
    cd "$ROOT_DIR/$dir" && pnpm "$script"
  ) &
  local pid=$!
  echo "$pid" > "$PIDS_DIR/$name.pid"
  echo "[dev] $name pid=$pid"
}

stop_one() {
  local name="$1"; shift
  local port="$1"; shift
  local pid_file="$PIDS_DIR/$name.pid"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "[dev] stopping $name pid=$pid ..."
      kill "$pid" 2>/dev/null || true
      sleep 0.5
      if kill -0 "$pid" 2>/dev/null; then
        echo "[dev] force killing $name pid=$pid"
        kill -9 "$pid" 2>/dev/null || true
      fi
    fi
    rm -f "$pid_file"
  fi
  # Fallback: kill service by port if still bound
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti tcp:"$port" || true)"
    if [[ -n "$pids" ]]; then
      echo "[dev] freeing port $port for $name (pids: $pids)"
      kill $pids 2>/dev/null || true
    fi
  fi
}

status_one() {
  local name="$1"; shift
  local url="$1"; shift
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || true)
  if [[ "$code" == "200" ]]; then
    echo "[dev] $name: OK ($url)"
  else
    echo "[dev] $name: DOWN ($url) code=$code"
  fi
}

up() {
  start_one api apps/api dev
  start_one worker apps/worker dev
  start_one web apps/web dev

  echo "[dev] waiting for health checks..."
  sleep 2
  status
}

down() {
  stop_one web "$WEB_PORT"
  stop_one worker "$WORKER_HTTP_PORT"
  stop_one api "$API_PORT"
}

restart() {
  down
  sleep 0.5
  up
}

status() {
  status_one api "http://localhost:$API_PORT/health"
  status_one worker "http://localhost:$WORKER_HTTP_PORT/health"
  status_one web "http://localhost:$WEB_PORT/api/health"
}

cmd="${1:-}"
case "$cmd" in
  up) up ;;
  down|stop) down ;;
  restart) restart ;;
  status) status ;;
  *)
    echo "Usage: bash scripts/dev.sh [up|down|restart|status]"
    exit 1
    ;;
esac
