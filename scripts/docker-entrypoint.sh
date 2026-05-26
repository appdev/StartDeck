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
