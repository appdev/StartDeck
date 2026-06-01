import { describe, expect, it } from "vitest";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  applySdMovieCalendarSizeToWidget,
  createDefaultSdMovieCalendarWidget,
  normalizeSdMovieCalendarWidgetData,
} from "./sdMovieCalendarModel";
import {
  SD_MOVIE_CALENDAR_CATALOG_ID,
  SD_MOVIE_CALENDAR_RUNTIME,
  SD_MOVIE_CALENDAR_WIDGET_TYPE,
} from "./sdMovieCalendarTypes";

describe("movie calendar model", () => {
  it("creates the canonical main-project movie calendar widget", () => {
    const widget = createDefaultSdMovieCalendarWidget();

    expect(widget).toMatchObject({
      id: SD_MOVIE_CALENDAR_CATALOG_ID,
      type: SD_MOVIE_CALENDAR_WIDGET_TYPE,
      enable: true,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: SD_MOVIE_CALENDAR_RUNTIME,
        layoutSystem: SD_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
      },
    });
    expect(widget).not.toHaveProperty("isPublic");
  });

  it("normalizes persisted data and applies scoped size keys to grid spans", () => {
    const widget = createDefaultSdMovieCalendarWidget();
    applySdMovieCalendarSizeToWidget(widget, "2x4");

    expect(widget).toMatchObject({
      id: SD_MOVIE_CALENDAR_CATALOG_ID,
      type: SD_MOVIE_CALENDAR_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({
        runtime: SD_MOVIE_CALENDAR_RUNTIME,
        sizeKey: "2x4",
      }),
    });
    expect(
      normalizeSdMovieCalendarWidgetData({ sizeKey: "unsupported" }),
    ).toMatchObject({
      runtime: SD_MOVIE_CALENDAR_RUNTIME,
      sizeKey: "2x2",
    });
  });
});
