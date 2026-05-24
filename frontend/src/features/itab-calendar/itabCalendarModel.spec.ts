import { describe, expect, it } from "vitest";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  applyItabCalendarSizeToWidget,
  createDefaultItabCalendarWidget,
  normalizeItabCalendarWidgetData,
} from "./itabCalendarModel";
import {
  ITAB_CALENDAR_CATALOG_ID,
  ITAB_CALENDAR_RUNTIME,
  ITAB_CALENDAR_WIDGET_TYPE,
} from "./itabCalendarTypes";

describe("itabCalendarModel", () => {
  it("creates the canonical main-project calendar widget", () => {
    expect(createDefaultItabCalendarWidget()).toMatchObject({
      id: ITAB_CALENDAR_CATALOG_ID,
      type: ITAB_CALENDAR_WIDGET_TYPE,
      enable: true,
      isPublic: true,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: ITAB_CALENDAR_RUNTIME,
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
      },
    });
  });

  it("normalizes persisted data without resurrecting legacy calendar fields", () => {
    expect(
      normalizeItabCalendarWidgetData({
        sizeKey: "bad",
        selectedDate: "2026-05-20",
      }),
    ).toEqual({
      runtime: ITAB_CALENDAR_RUNTIME,
      layoutSystem: ITAB_GRID_SCHEMA_VERSION,
      version: 1,
      sizeKey: "2x2",
    });
  });

  it("applies iTab size keys to grid spans", () => {
    const widget = createDefaultItabCalendarWidget();

    applyItabCalendarSizeToWidget(widget, "2x4");

    expect(widget).toMatchObject({
      id: ITAB_CALENDAR_CATALOG_ID,
      type: ITAB_CALENDAR_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({
        runtime: ITAB_CALENDAR_RUNTIME,
        sizeKey: "2x4",
      }),
    });
  });
});
