// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ItabWeatherOpenedPanel", () => {
  it("draws its own source weather surface instead of relying on shell color", () => {
    const source = readFileSync(
      "src/features/itab-weather/ItabWeatherOpenedPanel.vue",
      "utf8",
    );

    expect(source).toContain("data-itab-weather-opened-panel");
    expect(source).toContain("runtime.ensureLoaded({ refreshIfStale: true })");
    expect(source).toContain("background-color: #184482;");
    expect(source).toContain(
      "linear-gradient(35deg, #154280 30%, #335693, #a8b3d2)",
    );
    expect(source).toContain("linear-gradient(35deg, #054989 30%, #72ade0)");
    expect(source).toContain(".opened-weather-panel.weather-yin_d");
    expect(source).toContain(
      "linear-gradient(35deg, #354564 30%, #4c5f7f, #8b9bb8)",
    );
    expect(source).toContain(".opened-weather-panel.weather-rain_d");
    expect(source).toContain('url("/itab/weather/background/rain_d.webp")');
    expect(source).toContain(
      "color: var(--sd-theme-itab-weather-weather-opened-panel-text-01)",
    );
    expect(source).not.toContain("color: rgba(255, 255, 255, 0.82)");
  });

  it("uses source translucent surfaces inside the opened panel", () => {
    const openedSource = readFileSync(
      "src/features/itab-weather/ItabWeatherOpenedPanel.vue",
      "utf8",
    );

    expect(openedSource).toContain("background: #ffffff08;");
    expect(openedSource).toContain(".weather-hour-track span:hover");
    expect(openedSource).toContain("background: #ffffff14;");
    expect(openedSource).toContain(".weather-day-grid article:hover");
    expect(openedSource).toContain("background: #ffffff0f;");
  });

  it("binds the weather skin to the current city card", () => {
    const source = readFileSync(
      "src/features/itab-weather/ItabWeatherOpenedPanel.vue",
      "utf8",
    );

    expect(source).toContain('class="weather-location-card"');
    expect(source).toContain(':class="runtime.weatherOuterClass.value"');
    expect(source).toContain(
      ".weather-location-list > .weather-location-card",
    );
    expect(source).toContain("background-color: #154280;");
    expect(source).toContain("border-radius: 12px;");
    expect(source).toContain("color: #d5d5d5;");
  });
});
