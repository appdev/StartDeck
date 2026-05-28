import {
  ITAB_IP_LATENCY_PATH,
  ITAB_IP_PROXY_PATH,
  type ItabIpHistoryEntry,
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

const authHeaders = () => {
  const headers: Record<string, string> = { accept: "application/json" };
  try {
    const token = localStorage.getItem("start-deck-token")?.trim();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Ignore storage access failures; /api/ip remains a public lookup endpoint.
  }
  return headers;
};

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
    headers: authHeaders(),
    signal,
  });
  const payload = await response.json().catch(() => null);
  const normalized = normalizeItabIpLookupResponse(payload);
  if (!response.ok || !normalized) {
    throw new Error(`iTab IP request failed: ${response.status}`);
  }
  return normalized;
};

export const fetchItabIpHistory = async (
  signal?: AbortSignal,
): Promise<ItabIpHistoryEntry[]> => {
  const response = await fetch("/api/ip/history", {
    cache: "no-store",
    credentials: "same-origin",
    headers: authHeaders(),
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (
    !response.ok ||
    payload?.success !== true ||
    !Array.isArray(payload.data)
  ) {
    throw new Error(`iTab IP history request failed: ${response.status}`);
  }
  return payload.data
    .map((entry: unknown) => {
      const normalized = normalizeItabIpLookupResponse(entry);
      if (!normalized || typeof entry !== "object" || entry === null) {
        return null;
      }
      const raw = entry as Record<string, unknown>;
      return {
        ...normalized,
        firstSeenAt: Number(raw.firstSeenAt) || 0,
        lastSeenAt: Number(raw.lastSeenAt) || 0,
        seenCount: Number(raw.seenCount) || 0,
      } satisfies ItabIpHistoryEntry;
    })
    .filter((entry): entry is ItabIpHistoryEntry => entry !== null);
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
