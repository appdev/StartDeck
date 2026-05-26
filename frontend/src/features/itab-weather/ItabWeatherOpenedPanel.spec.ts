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
    expect(source).toContain(
      "background: var(--sd-theme-itab-weather-weather-opened-panel-surface-00)",
    );
    expect(source).toContain(
      "color: var(--sd-theme-itab-weather-weather-opened-panel-text-01)",
    );
  });
});
