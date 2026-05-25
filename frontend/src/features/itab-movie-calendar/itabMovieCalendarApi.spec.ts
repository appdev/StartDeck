// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ITAB_MOVIE_CALENDAR_PROXY_PATH,
  fetchItabMovieCalendar,
} from "./itabMovieCalendarApi";

describe("itabMovieCalendarApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requests the StartDeck backend proxy and forwards refresh intent", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        success: true,
        data: {
          date: "2026-05-23",
          movieTitle: "雌雄莫辨",
          rating: "7.4",
          sourceStatus: "ok",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const data = await fetchItabMovieCalendar(true);

    expect(data.movieTitle).toBe("雌雄莫辨");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`${ITAB_MOVIE_CALENDAR_PROXY_PATH}?refresh=true`),
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      }),
    );
  });
});
