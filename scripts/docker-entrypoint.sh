#!/bin/sh
set -eu

ICON_SERVICE_DIR="${ICON_SERVICE_DIR:-/app/icon-service}"
ICON_SERVICE_DEFAULTS_DIR="${ICON_SERVICE_DEFAULTS_DIR:-/app/icon-service-defaults}"

export PORT="${PORT:-9001}"
export ICON_SERVICE_PORT="${ICON_SERVICE_PORT:-9002}"
export ICON_SERVER_BASE_URL="${ICON_SERVER_BASE_URL:-http://127.0.0.1:${ICON_SERVICE_PORT}}"

mkdir -p "${ICON_SERVICE_DIR}/data/icons" "${ICON_SERVICE_DIR}/data/cache"

if [ ! -f "${ICON_SERVICE_DIR}/data/seed-data.json" ] && [ -f "${ICON_SERVICE_DEFAULTS_DIR}/data/seed-data.json" ]; then
  cp "${ICON_SERVICE_DEFAULTS_DIR}/data/seed-data.json" "${ICON_SERVICE_DIR}/data/seed-data.json"
fi

if [ ! -f "${ICON_SERVICE_DIR}/data/cache.json" ] && [ -f "${ICON_SERVICE_DEFAULTS_DIR}/data/cache.json" ]; then
  cp "${ICON_SERVICE_DEFAULTS_DIR}/data/cache.json" "${ICON_SERVICE_DIR}/data/cache.json"
fi

if [ -d "${ICON_SERVICE_DEFAULTS_DIR}/data/icons" ] && [ -z "$(ls -A "${ICON_SERVICE_DIR}/data/icons" 2>/dev/null)" ]; then
  cp -R "${ICON_SERVICE_DEFAULTS_DIR}/data/icons/." "${ICON_SERVICE_DIR}/data/icons/"
fi

if [ -d "${ICON_SERVICE_DEFAULTS_DIR}/data/cache" ] && [ -z "$(ls -A "${ICON_SERVICE_DIR}/data/cache" 2>/dev/null)" ]; then
  cp -R "${ICON_SERVICE_DEFAULTS_DIR}/data/cache/." "${ICON_SERVICE_DIR}/data/cache/"
fi

"${ICON_SERVICE_DIR}/startdeck-iconserver" &
icon_pid="$!"

./startdeck-server &
backend_pid="$!"

shutdown() {
  kill "${backend_pid}" "${icon_pid}" 2>/dev/null || true
  wait "${backend_pid}" 2>/dev/null || true
  wait "${icon_pid}" 2>/dev/null || true
}

trap shutdown INT TERM

set +e
wait "${backend_pid}"
status="$?"
set -e
shutdown
exit "${status}"
