import { describe, expect, it } from "vitest";
import { ITAB_WIDGET_REGISTRY } from "./itabWidgetRegistry";

describe("itabWidgetRegistry", () => {
  it("contains exactly the supported capture entries", () => {
    const expectedIds = [
      "itab-weather-00",
      "itab-calendar-01",
      "itab-memo-04",
      "itab-movie-calendar-05",
      "itab-poem-10",
      "itab-clock-12",
      "itab-daily-english-14",
      "itab-food-picker-15",
      "itab-wallpaper-16",
      "itab-todo-17",
      "itab-pomodoro-29",
      "itab-number-uppercase-35",
    ];

    expect(ITAB_WIDGET_REGISTRY.map((entry) => entry.id)).toEqual(expectedIds);
    expect(ITAB_WIDGET_REGISTRY.map((entry) => entry.captureIndex)).toEqual([
      0, 1, 4, 5, 10, 12, 14, 15, 16, 17, 29, 35,
    ]);
    expect(new Set(ITAB_WIDGET_REGISTRY.map((entry) => entry.id)).size).toBe(
      expectedIds.length,
    );
    expect(new Set(ITAB_WIDGET_REGISTRY.map((entry) => entry.type)).size).toBe(
      expectedIds.length,
    );
  });

  it("uses multi mode and identical five-size support for every entry", () => {
    for (const entry of ITAB_WIDGET_REGISTRY) {
      expect(entry.mode).toBe("multi");
      expect(entry.source).toBe("itab-capture");
      expect(entry.supportedSizes).toEqual(["1x1", "1x2", "2x1", "2x2", "2x4"]);
      expect(entry.persistedData).toMatchObject({
        namespace: "itab",
        captureIndex: entry.captureIndex,
        catalogId: entry.id,
      });
    }
  });
});
