#!/bin/sh
set -eu

ICON_SERVICE_DIR="${ICON_SERVICE_DIR:-/app/icon-service}"
ICON_SERVICE_DEFAULTS_DIR="${ICON_SERVICE_DEFAULTS_DIR:-/app/icon-service-defaults}"
STARTDECK_SERVER_RESOURCE_DIR="${STARTDECK_SERVER_RESOURCE_DIR:-/app/startdeck-server-defaults}"
ICON_SERVICE_DATA_DIR="${ICON_SERVICE_DATA_DIR:-${ICON_SERVICE_DIR}/data}"
ICON_SERVICE_RESOURCE_DIR="${ICON_SERVICE_RESOURCE_DIR:-${ICON_SERVICE_DEFAULTS_DIR}/data}"

export PORT="${PORT:-9001}"
export ICON_SERVICE_PORT="${ICON_SERVICE_PORT:-9002}"
export ICON_SERVER_BASE_URL="${ICON_SERVER_BASE_URL:-http://127.0.0.1:${ICON_SERVICE_PORT}}"
export STARTDECK_SERVER_RESOURCE_DIR
export ICON_SERVICE_DATA_DIR
export ICON_SERVICE_RESOURCE_DIR

mkdir -p "${ICON_SERVICE_DATA_DIR}/cache"

"${ICON_SERVICE_DIR}/startdeck-iconserver" &
icon_pid="$!"

wait_for_icon_service() {
  attempts="${ICON_SERVICE_STARTUP_ATTEMPTS:-30}"
  while [ "${attempts}" -gt 0 ]; do
    if ! kill -0 "${icon_pid}" 2>/dev/null; then
      wait "${icon_pid}" 2>/dev/null || true
      echo "startdeck icon service exited before becoming ready" >&2
      return 1
    fi
    if wget -q -O /dev/null "http://127.0.0.1:${ICON_SERVICE_PORT}/healthz" 2>/dev/null; then
      return 0
    fi
    attempts=$((attempts - 1))
    sleep 1
  done
  echo "startdeck icon service did not become ready on port ${ICON_SERVICE_PORT}" >&2
  return 1
}

if ! wait_for_icon_service; then
  kill "${icon_pid}" 2>/dev/null || true
  wait "${icon_pid}" 2>/dev/null || true
  exit 1
fi

./startdeck-server &
backend_pid="$!"

shutdown() {
  kill "${backend_pid}" "${icon_pid}" 2>/dev/null || true
  wait "${backend_pid}" 2>/dev/null || true
  wait "${icon_pid}" 2>/dev/null || true
}

trap shutdown INT TERM

while :; do
  if ! kill -0 "${backend_pid}" 2>/dev/null; then
    set +e
    wait "${backend_pid}"
    status="$?"
    set -e
    shutdown
    exit "${status}"
  fi
  if ! kill -0 "${icon_pid}" 2>/dev/null; then
    set +e
    wait "${icon_pid}"
    status="$?"
    set -e
    echo "startdeck icon service exited; shutting down backend" >&2
    shutdown
    exit "${status}"
  fi
  sleep 1
done
