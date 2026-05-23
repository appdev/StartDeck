import { describe, expect, it } from "vitest";
import {
  getItabRuntimeResources,
  resolveItabResourceUrl,
  validateItabDynamicBindings,
} from "./itabDynamicBindings";
import { ITAB_WIDGET_REGISTRY } from "./itabWidgetRegistry";

describe("itabDynamicBindings", () => {
  it("keeps live resource rendering bound to generated resource ids", () => {
    const entry = ITAB_WIDGET_REGISTRY.find(
      (item) => item.type === "itab-weather-00",
    )!;
    const resources = getItabRuntimeResources(entry.type, "live", {
      state: "body",
      sizeKey: "2x4",
    });

    expect(resources.length).toBeGreaterThan(0);
    for (const resource of resources) {
      expect(resource.visualResourceId).toMatch(/^itab-/);
      expect(resource).not.toHaveProperty("url");
      expect(resource).not.toHaveProperty("originalUrl");
      expect(resource).not.toHaveProperty("normalizedUrl");
      if (resource.renderMode === "proxy-by-resource-id") {
        expect(resolveItabResourceUrl(resource, "live")).toMatch(
          /^\/api\/itab-resources\/itab-/,
        );
      }
    }
  });

  it("does not expose fixture-only resources in live validation", () => {
    const status = validateItabDynamicBindings("live");
    expect(status.ok).toBe(true);
    expect(status.issues).toEqual([]);
  });
});
