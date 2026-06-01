import { describe, expect, it } from "vitest";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  applySdDailyEnglishSizeToWidget,
  createDefaultSdDailyEnglishWidget,
  normalizeSdDailyEnglishWidgetData,
} from "./sdDailyEnglishModel";
import {
  SD_DAILY_ENGLISH_RUNTIME,
  SD_DAILY_ENGLISH_WIDGET_TYPE,
} from "./sdDailyEnglishTypes";

describe("daily English model", () => {
  it("creates the canonical daily English widget with source default size", () => {
    expect(createDefaultSdDailyEnglishWidget()).toMatchObject({
      id: "daily-english",
      type: SD_DAILY_ENGLISH_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: SD_DAILY_ENGLISH_RUNTIME,
        layoutSystem: SD_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
      },
    });
  });

  it("normalizes persisted data without keeping transient source payload", () => {
    expect(
      normalizeSdDailyEnglishWidgetData({
        sizeKey: "bad",
        sentence: "do not persist",
        sourceStatus: "ok",
      }),
    ).toEqual({
      runtime: SD_DAILY_ENGLISH_RUNTIME,
      layoutSystem: SD_GRID_SCHEMA_VERSION,
      version: 1,
      sizeKey: "2x2",
    });
  });

  it("applies scoped size keys without StartDeck size inversion", () => {
    const widget = createDefaultSdDailyEnglishWidget();

    applySdDailyEnglishSizeToWidget(widget, "1x2");

    expect(widget).toMatchObject({
      id: "daily-english",
      type: SD_DAILY_ENGLISH_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 1,
      w: 2,
      h: 1,
      data: expect.objectContaining({ sizeKey: "1x2" }),
    });
  });
});
