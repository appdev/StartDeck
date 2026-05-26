import {
  ITAB_IP_LATENCY_PATH,
  ITAB_IP_PROXY_PATH,
  type ItabIpLatencyResult,
  type ItabIpLookupResult,
} from "./itabIpTypes";
import { normalizeItabIpLookupResponse } from "./itabIpModel";

const now = () => globalThis.performance?.now?.() ?? Date.now();

const formatCheckedAt = () =>
  new Date().toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export const fetchItabIpLookup = async (
  refresh = false,
  signal?: AbortSignal,
): Promise<ItabIpLookupResult> => {
  const url = new URL(ITAB_IP_PROXY_PATH, window.location.origin);
  url.searchParams.set("ts", String(Date.now()));
  if (refresh) {
    url.searchParams.set("refresh", "1");
  }

  const response = await fetch(url.toString(), {
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: "application/json" },
    signal,
  });
  const payload = await response.json().catch(() => null);
  const normalized = normalizeItabIpLookupResponse(payload);
  if (!response.ok || !normalized) {
    throw new Error(`iTab IP request failed: ${response.status}`);
  }
  return normalized;
};

export const fetchItabIpLatency = async (
  signal?: AbortSignal,
): Promise<ItabIpLatencyResult> => {
  const url = new URL(ITAB_IP_LATENCY_PATH, window.location.origin);
  url.searchParams.set("ts", String(Date.now()));

  const startedAt = now();
  const response = await fetch(url.toString(), {
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: "application/json" },
    method: "GET",
    signal,
  });
  const payload = await response.json().catch(() => null);
  const elapsedMs = now() - startedAt;
  if (!response.ok || payload?.success === false) {
    throw new Error(`iTab IP latency request failed: ${response.status}`);
  }

  return {
    latencyMs: Math.max(0, elapsedMs),
    checkedAt: formatCheckedAt(),
    serverTs: Number(payload?.serverTs) || 0,
  };
};
