#!/usr/bin/env bash
# Deploys a git tag or branch to staging or production (docs/11-deployment.md section 4).
set -euo pipefail

if [ "$#" -ne 2 ] || { [ "$1" != "staging" ] && [ "$1" != "production" ]; }; then
  echo "Usage: ./deploy/deploy.sh <staging|production> <git tag or branch>"
  exit 2
fi

environment="$1"
ref="$2"
service="app-${environment}"
compose=(docker compose -f deploy/docker-compose.yml)
health_check="fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

cd "$(dirname "$0")/.."

git fetch --tags origin
if git rev-parse --verify --quiet "refs/remotes/origin/${ref}" > /dev/null; then
  git checkout --detach "origin/${ref}"
else
  git checkout --detach "${ref}"
fi

"${compose[@]}" build "${service}"
"${compose[@]}" up -d --no-deps "${service}"
if [ -z "$("${compose[@]}" ps --status running --quiet caddy)" ]; then
  "${compose[@]}" up -d caddy
fi

for _ in $(seq 30); do
  if "${compose[@]}" exec -T "${service}" node -e "${health_check}" > /dev/null 2>&1; then
    echo "Deployed ${ref} to ${environment}"
    exit 0
  fi
  sleep 2
done

echo "Health check failed"
exit 1
