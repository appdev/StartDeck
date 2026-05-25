import type { ItabMovieCalendarEntry } from "./itabMovieCalendarTypes";

type ApiEnvelope<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
    };

export const ITAB_MOVIE_CALENDAR_PROXY_PATH = "/api/itab/movie-calendar";

export const fetchItabMovieCalendar = async (
  refresh = false,
  signal?: AbortSignal,
) => {
  const url = new URL(ITAB_MOVIE_CALENDAR_PROXY_PATH, window.location.origin);
  if (refresh) {
    url.searchParams.set("refresh", "true");
  }

  const response = await fetch(url.toString(), {
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: "application/json" },
    signal,
  });
  const payload = (await response
    .json()
    .catch(() => null)) as ApiEnvelope<ItabMovieCalendarEntry> | null;
  if (!response.ok || !payload || payload.success === false) {
    throw new Error(
      payload && payload.success === false
        ? payload.error
        : `iTab movie calendar request failed: ${response.status}`,
    );
  }
  return payload.data;
};
