import {
  SD_IP_LATENCY_PATH,
  SD_IP_PROXY_PATH,
  type SdIpHistoryEntry,
  type SdIpLatencyResult,
  type SdIpLookupResult,
} from "./sdIpTypes";
import { normalizeSdIpLookupResponse } from "./sdIpModel";
import { sessionFetch } from "@/utils/sessionFetch";

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
  return { accept: "application/json" };
};

export const fetchSdIpLookup = async (
  refresh = false,
  signal?: AbortSignal,
): Promise<SdIpLookupResult> => {
  const url = new URL(SD_IP_PROXY_PATH, window.location.origin);
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
  const normalized = normalizeSdIpLookupResponse(payload);
  if (!response.ok || !normalized) {
    throw new Error(`IP request failed: ${response.status}`);
  }
  return normalized;
};

export const fetchSdIpHistory = async (
  signal?: AbortSignal,
): Promise<SdIpHistoryEntry[]> => {
  const response = await sessionFetch("/api/ip/history", {
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
    throw new Error(`IP history request failed: ${response.status}`);
  }
  return payload.data
    .map((entry: unknown) => {
      const normalized = normalizeSdIpLookupResponse(entry);
      if (!normalized || typeof entry !== "object" || entry === null) {
        return null;
      }
      const raw = entry as Record<string, unknown>;
      return {
        ...normalized,
        firstSeenAt: Number(raw.firstSeenAt) || 0,
        lastSeenAt: Number(raw.lastSeenAt) || 0,
        seenCount: Number(raw.seenCount) || 0,
      } satisfies SdIpHistoryEntry;
    })
    .filter((entry): entry is SdIpHistoryEntry => entry !== null);
};

export const fetchSdIpLatency = async (
  signal?: AbortSignal,
): Promise<SdIpLatencyResult> => {
  const url = new URL(SD_IP_LATENCY_PATH, window.location.origin);
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
    throw new Error(`IP latency request failed: ${response.status}`);
  }

  return {
    latencyMs: Math.max(0, elapsedMs),
    checkedAt: formatCheckedAt(),
    serverTs: Number(payload?.serverTs) || 0,
  };
};
