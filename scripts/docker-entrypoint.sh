#!/bin/sh
set -eu

META_SERVER_DIR="${META_SERVER_DIR:-/app/meta-service}"
META_SERVER_DEFAULTS_DIR="${META_SERVER_DEFAULTS_DIR:-/app/meta-service-defaults}"
STARTDECK_SERVER_RESOURCE_DIR="${STARTDECK_SERVER_RESOURCE_DIR:-/app/startdeck-server-defaults}"
META_SERVER_DATA_DIR="${META_SERVER_DATA_DIR:-${META_SERVER_DIR}/data}"
META_SERVER_RESOURCE_DIR="${META_SERVER_RESOURCE_DIR:-${META_SERVER_DEFAULTS_DIR}/data}"

export PORT="${PORT:-9001}"
export META_SERVER_PORT="${META_SERVER_PORT:-9002}"
export META_SERVER_BASE_URL="${META_SERVER_BASE_URL:-http://127.0.0.1:${META_SERVER_PORT}}"
export STARTDECK_SERVER_RESOURCE_DIR
export META_SERVER_DATA_DIR
export META_SERVER_RESOURCE_DIR

mkdir -p "${META_SERVER_DATA_DIR}/cache"

"${META_SERVER_DIR}/startdeck-metaserver" &
meta_pid="$!"

wait_for_meta_server() {
  attempts="${META_SERVER_STARTUP_ATTEMPTS:-30}"
  while [ "${attempts}" -gt 0 ]; do
    if ! kill -0 "${meta_pid}" 2>/dev/null; then
      wait "${meta_pid}" 2>/dev/null || true
      echo "startdeck meta server exited before becoming ready" >&2
      return 1
    fi
    if wget -q -O /dev/null "http://127.0.0.1:${META_SERVER_PORT}/healthz" 2>/dev/null; then
      return 0
    fi
    attempts=$((attempts - 1))
    sleep 1
  done
  echo "startdeck meta server did not become ready on port ${META_SERVER_PORT}" >&2
  return 1
}

if ! wait_for_meta_server; then
  kill "${meta_pid}" 2>/dev/null || true
  wait "${meta_pid}" 2>/dev/null || true
  exit 1
fi

./startdeck-server &
backend_pid="$!"

shutdown() {
  kill "${backend_pid}" "${meta_pid}" 2>/dev/null || true
  wait "${backend_pid}" 2>/dev/null || true
  wait "${meta_pid}" 2>/dev/null || true
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
  if ! kill -0 "${meta_pid}" 2>/dev/null; then
    set +e
    wait "${meta_pid}"
    status="$?"
    set -e
    echo "startdeck meta server exited; shutting down backend" >&2
    shutdown
    exit "${status}"
  fi
  sleep 1
done
