import { describe, expect, it } from "vitest";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  applySdClockSizeToWidget,
  createDefaultSdClockWidget,
  normalizeSdClockWidgetData,
} from "./sdClockModel";
import { SD_CLOCK_WIDGET_TYPE } from "./sdClockTypes";

describe("clock model", () => {
  it("creates the canonical clock widget with source default size", () => {
    expect(createDefaultSdClockWidget()).toMatchObject({
      id: "clock",
      type: SD_CLOCK_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "sd-clock",
        layoutSystem: SD_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
        showSeconds: true,
      },
    });
  });

  it("normalizes bad data without keeping transient state", () => {
    expect(
      normalizeSdClockWidgetData({
        sizeKey: "bad",
        showSeconds: false,
        loading: true,
      }),
    ).toEqual({
      runtime: "sd-clock",
      layoutSystem: SD_GRID_SCHEMA_VERSION,
      version: 1,
      sizeKey: "2x2",
      showSeconds: false,
    });
  });

  it("applies scoped size keys without StartDeck size inversion", () => {
    const widget = createDefaultSdClockWidget();

    applySdClockSizeToWidget(widget, "1x2");

    expect(widget).toMatchObject({
      id: "clock",
      type: SD_CLOCK_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 1,
      w: 2,
      h: 1,
      data: expect.objectContaining({ sizeKey: "1x2" }),
    });
  });
});
