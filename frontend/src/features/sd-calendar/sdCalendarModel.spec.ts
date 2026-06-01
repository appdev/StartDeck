import { describe, expect, it } from "vitest";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  applySdCalendarSizeToWidget,
  createDefaultSdCalendarWidget,
  normalizeSdCalendarWidgetData,
} from "./sdCalendarModel";
import {
  SD_CALENDAR_CATALOG_ID,
  SD_CALENDAR_RUNTIME,
  SD_CALENDAR_WIDGET_TYPE,
} from "./sdCalendarTypes";

describe("calendar model", () => {
  it("creates the canonical main-project calendar widget", () => {
    const widget = createDefaultSdCalendarWidget();
    expect(widget).toMatchObject({
      id: SD_CALENDAR_CATALOG_ID,
      type: SD_CALENDAR_WIDGET_TYPE,
      enable: true,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: SD_CALENDAR_RUNTIME,
        layoutSystem: SD_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
      },
    });
    expect(widget).not.toHaveProperty("isPublic");
  });

  it("normalizes persisted data without resurrecting legacy calendar fields", () => {
    expect(
      normalizeSdCalendarWidgetData({
        sizeKey: "bad",
        selectedDate: "2026-05-20",
      }),
    ).toEqual({
      runtime: SD_CALENDAR_RUNTIME,
      layoutSystem: SD_GRID_SCHEMA_VERSION,
      version: 1,
      sizeKey: "2x2",
    });
  });

  it("applies scoped size keys to grid spans", () => {
    const widget = createDefaultSdCalendarWidget();

    applySdCalendarSizeToWidget(widget, "2x4");

    expect(widget).toMatchObject({
      id: SD_CALENDAR_CATALOG_ID,
      type: SD_CALENDAR_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({
        runtime: SD_CALENDAR_RUNTIME,
        sizeKey: "2x4",
      }),
    });
  });
});
