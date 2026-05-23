import { describe, expect, it } from "vitest";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  applyItabDailyEnglishSizeToWidget,
  createDefaultItabDailyEnglishWidget,
  normalizeItabDailyEnglishWidgetData,
} from "./itabDailyEnglishModel";
import {
  ITAB_DAILY_ENGLISH_RUNTIME,
  ITAB_DAILY_ENGLISH_WIDGET_TYPE,
} from "./itabDailyEnglishTypes";

describe("itabDailyEnglishModel", () => {
  it("creates the canonical iTab daily English widget with source default size", () => {
    expect(createDefaultItabDailyEnglishWidget()).toMatchObject({
      id: "daily-english",
      type: ITAB_DAILY_ENGLISH_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: ITAB_DAILY_ENGLISH_RUNTIME,
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
      },
    });
  });

  it("normalizes persisted data without keeping transient source payload", () => {
    expect(
      normalizeItabDailyEnglishWidgetData({
        sizeKey: "bad",
        sentence: "do not persist",
        sourceStatus: "ok",
      }),
    ).toEqual({
      runtime: ITAB_DAILY_ENGLISH_RUNTIME,
      layoutSystem: ITAB_GRID_SCHEMA_VERSION,
      version: 1,
      sizeKey: "2x2",
    });
  });

  it("applies iTab size keys without StartDeck size inversion", () => {
    const widget = createDefaultItabDailyEnglishWidget();

    applyItabDailyEnglishSizeToWidget(widget, "1x2");

    expect(widget).toMatchObject({
      id: "daily-english",
      type: ITAB_DAILY_ENGLISH_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 1,
      w: 2,
      h: 1,
      data: expect.objectContaining({ sizeKey: "1x2" }),
    });
  });
});
