import { describe, expect, it } from "vitest";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  applyItabClockSizeToWidget,
  createDefaultItabClockWidget,
  normalizeItabClockWidgetData,
} from "./itabClockModel";
import { ITAB_CLOCK_WIDGET_TYPE } from "./itabClockTypes";

describe("itabClockModel", () => {
  it("creates the canonical iTab clock widget with source default size", () => {
    expect(createDefaultItabClockWidget()).toMatchObject({
      id: "clock",
      type: ITAB_CLOCK_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "itab-clock",
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
        showSeconds: true,
      },
    });
  });

  it("normalizes bad data without keeping transient state", () => {
    expect(
      normalizeItabClockWidgetData({
        sizeKey: "bad",
        showSeconds: false,
        loading: true,
      }),
    ).toEqual({
      runtime: "itab-clock",
      layoutSystem: ITAB_GRID_SCHEMA_VERSION,
      version: 1,
      sizeKey: "2x2",
      showSeconds: false,
    });
  });

  it("applies iTab size keys without StartDeck size inversion", () => {
    const widget = createDefaultItabClockWidget();

    applyItabClockSizeToWidget(widget, "1x2");

    expect(widget).toMatchObject({
      id: "clock",
      type: ITAB_CLOCK_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 1,
      w: 2,
      h: 1,
      data: expect.objectContaining({ sizeKey: "1x2" }),
    });
  });
});
