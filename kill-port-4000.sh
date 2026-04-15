#!/usr/bin/env bash

set -euo pipefail

PORT=4000
PIDS="$(lsof -ti "tcp:${PORT}" || true)"

if [[ -z "${PIDS}" ]]; then
  echo "No processes found on port ${PORT}."
  exit 0
fi

echo "Killing processes on port ${PORT}: ${PIDS}"
kill -9 ${PIDS}
echo "Port ${PORT} is now free."
