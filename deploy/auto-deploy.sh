#!/bin/bash
# Run by nest-demo-deploy.timer: applies any newly published image or compose file.
set -euo pipefail

cd /home/ubuntu
compose_url=https://raw.githubusercontent.com/antoha805/nest-demo/main/docker-compose.prod.yml
# The project name must stay fixed, as the Postgres volume is named after it.
compose=(docker compose -p ubuntu -f docker-compose.prod.yml --env-file prod.env)

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
curl -fsS -m 30 "$compose_url" -o "$tmp"

compose_changed=false
if ! cmp -s "$tmp" docker-compose.prod.yml; then
  docker compose -p ubuntu -f "$tmp" --env-file prod.env --project-directory . config -q
  cp "$tmp" docker-compose.prod.yml
  compose_changed=true
fi

"${compose[@]}" pull -q api

set -a
. ./prod.env
set +a
latest=$(docker image inspect "$API_IMAGE" --format '{{.Id}}')
container=$("${compose[@]}" ps -q api)
running=$(docker inspect "$container" --format '{{.Image}}' 2>/dev/null || true)

if [ "$latest" != "$running" ] || [ "$compose_changed" = true ]; then
  echo "Deploying $latest"
  "${compose[@]}" up -d --no-build --wait api
  docker image prune -f >/dev/null
fi
