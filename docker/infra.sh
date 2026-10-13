#!/bin/sh
# Infrastruktur lokal: `pnpm infra:up` / `pnpm infra:down` (env dari `.env` root lewat dotenv-cli).
set -eu
compose() { docker compose -f "$(dirname "$0")/docker-compose.yml" "$@"; }

case "${1:-}" in
  up)
    compose up -d --wait
    compose run --rm minio-init
    ;;
  down)
    compose --profile init down
    ;;
  *)
    echo "pemakaian: infra.sh up|down" >&2
    exit 1
    ;;
esac
