// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ItabWeatherOpenedPanel", () => {
  it("draws its own readable weather surface instead of relying on shell color", () => {
    const source = readFileSync(
      "src/features/itab-weather/ItabWeatherOpenedPanel.vue",
      "utf8",
    );

    expect(source).toContain("data-itab-weather-opened-panel");
    expect(source).toContain("runtime.ensureLoaded({ refreshIfStale: true })");
    expect(source).toContain(
      "background: var(--sd-theme-itab-weather-weather-opened-panel-surface-00)",
    );
    expect(source).toContain(".opened-weather-panel.weather-yin_d");
    expect(source).toContain(
      "var(--sd-theme-itab-weather-weather-widget-yin-d-gradient-01) 30%",
    );
    expect(source).toContain(".opened-weather-panel.weather-rain_d");
    expect(source).toContain('url("/itab/weather/background/rain_d.webp")');
    expect(source).toContain(
      "color: var(--sd-theme-itab-weather-weather-opened-panel-text-01)",
    );
    expect(source).not.toContain("color: rgba(255, 255, 255, 0.82)");
  });

  it("keeps the yin day skin shared with the source-style outer weather card", () => {
    const openedSource = readFileSync(
      "src/features/itab-weather/ItabWeatherOpenedPanel.vue",
      "utf8",
    );
    const widgetSource = readFileSync(
      "src/features/itab-weather/ItabWeatherWidget.vue",
      "utf8",
    );
    const themeSource = readFileSync("src/assets/main.css", "utf8");

    for (const source of [openedSource, widgetSource]) {
      expect(source).toContain(
        "--sd-theme-itab-weather-weather-widget-yin-d-surface-01",
      );
      expect(source).toContain(
        "--sd-theme-itab-weather-weather-widget-yin-d-gradient-01",
      );
      expect(source).toContain(
        "--sd-theme-itab-weather-weather-widget-yin-d-gradient-03",
      );
    }

    expect(themeSource).toContain(
      "--sd-theme-itab-weather-weather-widget-yin-d-surface-01: rgb(24, 68, 130)",
    );
    expect(themeSource).toContain(
      "--sd-theme-itab-weather-weather-widget-yin-d-gradient-01: rgb(53, 69, 100)",
    );
    expect(themeSource).toContain(
      "--sd-theme-itab-weather-weather-widget-yin-d-gradient-02: rgb(76, 95, 127)",
    );
    expect(themeSource).toContain(
      "--sd-theme-itab-weather-weather-widget-yin-d-gradient-03: rgb(139, 155, 184)",
    );
  });
});
