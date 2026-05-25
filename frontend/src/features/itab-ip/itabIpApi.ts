import { ITAB_IP_PROXY_PATH, type ItabIpLookupResult } from "./itabIpTypes";
import { normalizeItabIpLookupResponse } from "./itabIpModel";

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
