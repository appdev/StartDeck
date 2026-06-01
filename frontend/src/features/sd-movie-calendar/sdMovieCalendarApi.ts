import type { SdMovieCalendarEntry } from "./sdMovieCalendarTypes";

type ApiEnvelope<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
    };

export const SD_MOVIE_CALENDAR_PROXY_PATH = "/api/movie-calendar";

export const fetchSdMovieCalendar = async (
  refresh = false,
  signal?: AbortSignal,
) => {
  const url = new URL(SD_MOVIE_CALENDAR_PROXY_PATH, window.location.origin);
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
    .catch(() => null)) as ApiEnvelope<SdMovieCalendarEntry> | null;
  if (!response.ok || !payload || payload.success === false) {
    throw new Error(
      payload && payload.success === false
        ? payload.error
        : `Movie calendar request failed: ${response.status}`,
    );
  }
  return payload.data;
};
