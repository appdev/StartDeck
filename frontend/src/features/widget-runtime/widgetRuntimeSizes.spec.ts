import { describe, expect, it } from "vitest";
import {
  RUNTIME_WIDGET_LARGE_BOARD_TYPES,
  resolveRuntimeWidgetSizeCapability,
  resolveRuntimeWidgetSizeFamily,
  resolveRuntimeWidgetSizeKey,
  supportsRuntimeWidgetSize,
} from "./widgetRuntimeSizes";

describe("widgetRuntimeSizes", () => {
  const baseItabSizes = [
    ["1x1", 1, 1],
    ["1x2", 2, 1],
    ["2x1", 1, 2],
    ["2x2", 2, 2],
    ["2x4", 4, 2],
  ];

  it.each([
    ["docker", "2x2"],
    ["system-status", "1x1"],
    ["custom-css", "1x1"],
    ["itab-weather-00", "1x2"],
    ["itab-clock-12", "2x2"],
    ["itab-daily-english-14", "2x2"],
    ["itab-poem-10", "2x2"],
    ["itab-pomodoro-29", "2x2"],
    ["itab-anniversary-03", "2x2"],
    ["itab-wallpaper-16", "2x2"],
    ["itab-movie-calendar-05", "2x2"],
    ["itab-ip-30", "2x2"],
    ["itab-calendar-01", "2x2"],
    ["itab-number-uppercase-35", "2x2"],
    ["itab-food-picker-15", "2x2"],
    ["ai-usage", "2x2"],
    ["tapd-defects", "2x2"],
  ])(
    "uses iTab %s size semantics without StartDeck 1x2/2x1 inversion",
    (type, defaultSizeKey) => {
      const family = resolveRuntimeWidgetSizeFamily(type);

      expect(family?.defaultSizeKey).toBe(defaultSizeKey);
      expect(
        family?.supported.map((size) => [size.key, size.colSpan, size.rowSpan]),
      ).toEqual(baseItabSizes);
      expect(
        resolveRuntimeWidgetSizeKey(type, {
          colSpan: 2,
          rowSpan: 1,
        }),
      ).toBe("1x2");
      expect(
        resolveRuntimeWidgetSizeKey(type, {
          colSpan: 1,
          rowSpan: 2,
        }),
      ).toBe("2x1");
      expect(
        resolveRuntimeWidgetSizeKey(type, {
          colSpan: 4,
          rowSpan: 4,
        }),
      ).toBeUndefined();
      expect(resolveRuntimeWidgetSizeCapability(type)).toBe("itab-default");
      expect(supportsRuntimeWidgetSize(type, "4x4")).toBe(false);
    },
  );

  it("keeps the 4x4 capability allow-list explicit", () => {
    expect([...RUNTIME_WIDGET_LARGE_BOARD_TYPES].sort()).toEqual([
      "itab-memo-04",
      "itab-todo-17",
    ]);
  });

  it.each([
    ["Todo", "itab-todo-17"],
    ["Memo", "itab-memo-04"],
  ])("exposes 4x4 for %s runtime widgets", (_label, type) => {
    const family = resolveRuntimeWidgetSizeFamily(type);

    expect(family?.defaultSizeKey).toBe("2x2");
    expect(
      family?.supported.map((size) => [size.key, size.colSpan, size.rowSpan]),
    ).toEqual([...baseItabSizes, ["4x4", 4, 4]]);
    expect(family?.maxSize).toEqual({ colSpan: 4, rowSpan: 4 });
    expect(family?.capability).toBe("large-board");
    expect(resolveRuntimeWidgetSizeCapability(type)).toBe("large-board");
    expect(supportsRuntimeWidgetSize(type, "4x4")).toBe(true);
    expect(
      resolveRuntimeWidgetSizeKey(type, {
        colSpan: 4,
        rowSpan: 4,
      }),
    ).toBe("4x4");
    expect(
      resolveRuntimeWidgetSizeKey(type, {
        sizeKey: "4x4",
      }),
    ).toBe("4x4");
  });
});
