import { describe, expect, it } from "vitest";
import { migrateLegacyWidgetConfig } from "./legacyWidgetMigration";

describe("legacy widget migration", () => {
  it("maps old widget identifiers and local resource paths to sd identifiers", () => {
    const migrated = migrateLegacyWidgetConfig({
      id: "itab-weather-00-custom",
      type: "itab-weather-00",
      enable: true,
      data: {
        runtime: "itab-weather",
        layoutSystem: "itab-grid/2026-05-22",
        itab: {
          namespace: "itab",
          catalogId: "itab-weather-00",
          localStateKey: "itab.weather.00",
        },
        iconUrl: "/itab/weather/icon/104-fill.svg",
        backgroundImage: "/itab-live-assets/anniversary/yiyan-2.webp",
      },
    });

    expect(migrated).toMatchObject({
      id: "sd-weather-00-custom",
      type: "sd-weather-00",
      data: {
        runtime: "sd-weather",
        layoutSystem: "sd-grid/2026-05-22",
        sd: {
          namespace: "sd",
          catalogId: "sd-weather-00",
          localStateKey: "sd.weather.00",
        },
        iconUrl: "/sd/weather/icon/104-fill.svg",
        backgroundImage: "/sd-live-assets/anniversary/yiyan-2.webp",
      },
    });
  });

  it("does not rewrite arbitrary upstream URLs inside widget data", () => {
    const migrated = migrateLegacyWidgetConfig({
      id: "itab-movie-calendar-05",
      type: "itab-movie-calendar-05",
      enable: true,
      data: {
        sourceUrl: "https://api.codelife.cc/itab/todayMovie?version=v2",
      },
    });

    expect(migrated.data.sourceUrl).toBe(
      "https://api.codelife.cc/itab/todayMovie?version=v2",
    );
  });
});
