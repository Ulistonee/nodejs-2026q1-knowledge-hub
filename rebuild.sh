#!/usr/bin/env bash
set -euo pipefail

PORT=4000

echo "=== Step 1: Kill processes on port ${PORT} ==="
PIDS="$(lsof -ti "tcp:${PORT}" || true)"
if [[ -n "${PIDS}" ]]; then
  echo "Killing PIDs: ${PIDS}"
  kill -9 ${PIDS}
  echo "Port ${PORT} freed."
else
  echo "Port ${PORT} already free."
fi

echo ""
echo "=== Step 2: docker compose down ==="
docker compose down --remove-orphans

echo ""
echo "=== Step 3: Build without cache ==="
docker compose build --no-cache

echo ""
echo "=== Step 4: Start containers ==="
docker compose up -d

echo ""
echo "=== Waiting for containers to become healthy ==="
for i in $(seq 1 60); do
  APP_HEALTH=$(docker compose ps --format json | grep -o '"Health":"[^"]*"' | head -1 || true)
  if echo "${APP_HEALTH}" | grep -q "healthy"; then
    echo "App is healthy!"
    break
  fi
  if [[ $i -eq 60 ]]; then
    echo "Timeout waiting for app to become healthy."
    docker compose logs app --tail 30
    exit 1
  fi
  sleep 2
done

echo ""
echo "=== Final status ==="
docker compose ps
echo ""
echo "Done! App should be available at http://localhost:${PORT}"
