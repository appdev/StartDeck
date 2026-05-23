import { describe, expect, it } from "vitest";
import { ITAB_WIDGET_REGISTRY } from "./itabWidgetRegistry";

describe("itabWidgetRegistry", () => {
  it("contains exactly the 36 approved capture entries", () => {
    expect(ITAB_WIDGET_REGISTRY).toHaveLength(36);
    expect(ITAB_WIDGET_REGISTRY.map((entry) => entry.captureIndex)).toEqual(
      Array.from({ length: 36 }, (_, index) => index),
    );
    expect(new Set(ITAB_WIDGET_REGISTRY.map((entry) => entry.id)).size).toBe(
      36,
    );
    expect(new Set(ITAB_WIDGET_REGISTRY.map((entry) => entry.type)).size).toBe(
      36,
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
