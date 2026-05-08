#!/bin/sh
set -eu

ICON_SERVICE_DIR="${ICON_SERVICE_DIR:-/app/icon-service}"
ICON_SERVICE_DEFAULTS_DIR="${ICON_SERVICE_DEFAULTS_DIR:-/app/icon-service-defaults}"
ICON_SERVICE_CONFIG_FILE="${ICON_SERVICE_CONFIG_FILE:-${ICON_SERVICE_DIR}/config.json}"

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

CONFIG_FILE="${ICON_SERVICE_CONFIG_FILE}" "${ICON_SERVICE_DIR}/flatnas-iconserver" &
icon_pid="$!"

./flatnas-backend &
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
