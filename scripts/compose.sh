#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
DC_FILE="$ROOT_DIR/infrastructure/docker-compose.yml"

cmd="${1:-up}"
case "$cmd" in
  up)
    docker compose -f "$DC_FILE" up --build ;;
  down)
    docker compose -f "$DC_FILE" down -v ;;
  restart)
    docker compose -f "$DC_FILE" down -v && docker compose -f "$DC_FILE" up --build ;;
  *)
    echo "Usage: bash scripts/compose.sh [up|down|restart]"
    exit 1
    ;;
esac

