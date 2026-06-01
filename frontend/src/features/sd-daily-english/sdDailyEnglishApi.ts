import type { SdDailyEnglishEntry } from "./sdDailyEnglishTypes";

type ApiEnvelope<T> =
  | {
      success: true;
      data: T;
      sourceStatus?: string;
    }
  | {
      success: false;
      error: string;
    };

export const fetchSdDailyEnglish = async (
  refresh = false,
  signal?: AbortSignal,
) => {
  const url = new URL("/api/today-english", window.location.origin);
  if (refresh) {
    url.searchParams.set("refresh", "true");
  }
  const response = await fetch(url.toString(), {
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: "application/json" },
    signal,
  });
  const payload = (await response.json()) as ApiEnvelope<SdDailyEnglishEntry>;
  if (!response.ok || payload.success === false) {
    throw new Error(
      payload.success === false
        ? payload.error
        : `Daily English request failed: ${response.status}`,
    );
  }
  return payload.data;
};
