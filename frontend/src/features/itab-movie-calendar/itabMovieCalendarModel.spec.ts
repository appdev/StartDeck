import { describe, expect, it } from "vitest";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  applyItabMovieCalendarSizeToWidget,
  createDefaultItabMovieCalendarWidget,
  normalizeItabMovieCalendarWidgetData,
} from "./itabMovieCalendarModel";
import {
  ITAB_MOVIE_CALENDAR_CATALOG_ID,
  ITAB_MOVIE_CALENDAR_RUNTIME,
  ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
} from "./itabMovieCalendarTypes";

describe("itabMovieCalendarModel", () => {
  it("creates the canonical main-project movie calendar widget", () => {
    const widget = createDefaultItabMovieCalendarWidget();

    expect(widget).toMatchObject({
      id: ITAB_MOVIE_CALENDAR_CATALOG_ID,
      type: ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
      enable: true,
      isPublic: true,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: ITAB_MOVIE_CALENDAR_RUNTIME,
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
      },
    });
  });

  it("normalizes persisted data and applies iTab size keys to grid spans", () => {
    const widget = createDefaultItabMovieCalendarWidget();
    applyItabMovieCalendarSizeToWidget(widget, "2x4");

    expect(widget).toMatchObject({
      id: ITAB_MOVIE_CALENDAR_CATALOG_ID,
      type: ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({
        runtime: ITAB_MOVIE_CALENDAR_RUNTIME,
        sizeKey: "2x4",
      }),
    });
    expect(
      normalizeItabMovieCalendarWidgetData({ sizeKey: "unsupported" }),
    ).toMatchObject({
      runtime: ITAB_MOVIE_CALENDAR_RUNTIME,
      sizeKey: "2x2",
    });
  });
});
