import { describe, expect, it } from "vitest";
import { SD_WIDGET_REGISTRY } from "./sdWidgetRegistry";

describe("widget registry", () => {
  it("contains exactly the supported capture entries", () => {
    const expectedIds = [
      "sd-weather-00",
      "sd-calendar-01",
      "sd-memo-04",
      "sd-movie-calendar-05",
      "sd-poem-10",
      "sd-clock-12",
      "sd-daily-english-14",
      "sd-food-picker-15",
      "sd-wallpaper-16",
      "sd-todo-17",
      "sd-pomodoro-29",
      "sd-number-uppercase-35",
    ];

    expect(SD_WIDGET_REGISTRY.map((entry) => entry.id)).toEqual(expectedIds);
    expect(SD_WIDGET_REGISTRY.map((entry) => entry.captureIndex)).toEqual([
      0, 1, 4, 5, 10, 12, 14, 15, 16, 17, 29, 35,
    ]);
    expect(new Set(SD_WIDGET_REGISTRY.map((entry) => entry.id)).size).toBe(
      expectedIds.length,
    );
    expect(new Set(SD_WIDGET_REGISTRY.map((entry) => entry.type)).size).toBe(
      expectedIds.length,
    );
  });

  it("uses multi mode and identical five-size support for every entry", () => {
    for (const entry of SD_WIDGET_REGISTRY) {
      expect(entry.mode).toBe("multi");
      expect(entry.source).toBe("sd-capture");
      expect(entry.supportedSizes).toEqual(["1x1", "1x2", "2x1", "2x2", "2x4"]);
      expect(entry.persistedData).toMatchObject({
        namespace: "sd",
        captureIndex: entry.captureIndex,
        catalogId: entry.id,
      });
    }
  });
});
