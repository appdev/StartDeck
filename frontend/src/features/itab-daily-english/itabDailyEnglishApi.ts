import type { ItabDailyEnglishEntry } from "./itabDailyEnglishTypes";

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

export const fetchItabDailyEnglish = async (
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
  const payload = (await response.json()) as ApiEnvelope<ItabDailyEnglishEntry>;
  if (!response.ok || payload.success === false) {
    throw new Error(
      payload.success === false
        ? payload.error
        : `iTab daily English request failed: ${response.status}`,
    );
  }
  return payload.data;
};
