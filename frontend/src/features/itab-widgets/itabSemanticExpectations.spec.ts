import { describe, expect, it } from "vitest";
import { ITAB_CLONE_SKINS } from "./generated/itabCloneSkins.generated";
import { ITAB_SEMANTIC_EXPECTATIONS } from "./generated/itabSemanticExpectations.generated";
import { ITAB_WIDGET_REGISTRY } from "./itabWidgetRegistry";

describe("itab v6 clone skin and semantic manifests", () => {
  it("covers every approved body and opened state with approved skin slots", () => {
    expect(ITAB_CLONE_SKINS).toHaveLength(216);
    expect(
      ITAB_CLONE_SKINS.filter((skin) => skin.state === "body"),
    ).toHaveLength(180);
    expect(
      ITAB_CLONE_SKINS.filter((skin) => skin.state === "opened"),
    ).toHaveLength(36);
    expect(ITAB_CLONE_SKINS.every((skin) => skin.cloneSkinModeApproved)).toBe(
      true,
    );
    expect(
      ITAB_CLONE_SKINS.every((skin) =>
        skin.assetUrl.startsWith("/__itab-qa-skins/"),
      ),
    ).toBe(true);
    expect(new Set(ITAB_CLONE_SKINS.map((skin) => skin.skinId)).size).toBe(216);
  });

  it("uses corrected v6 outer dimensions for body skins and opened skins", () => {
    const dimensions = new Map([
      ["1x1", "76x76"],
      ["1x2", "166x76"],
      ["2x1", "76x166"],
      ["2x2", "166x166"],
      ["2x4", "346x166"],
    ]);
    for (const skin of ITAB_CLONE_SKINS) {
      if (skin.state === "opened") {
        expect(`${skin.outerRect.width}x${skin.outerRect.height}`).toBe(
          "1733x842",
        );
      } else {
        expect(`${skin.outerRect.width}x${skin.outerRect.height}`).toBe(
          dimensions.get(skin.sizeKey),
        );
      }
    }
  });

  it("generates countable semantic and hotspot expectations for all states", () => {
    expect(ITAB_SEMANTIC_EXPECTATIONS).toHaveLength(216);
    const expectedComponentIds = new Set(
      ITAB_WIDGET_REGISTRY.map((entry) => entry.type),
    );
    for (const expectation of ITAB_SEMANTIC_EXPECTATIONS) {
      expect(expectedComponentIds.has(expectation.componentId)).toBe(true);
      expect(expectation.requiredSlots.length).toBeGreaterThanOrEqual(
        expectation.minCounts.semanticSlots,
      );
      expect(expectation.requiredHotspots.length).toBeGreaterThanOrEqual(
        expectation.minCounts.hotspots,
      );
      expect(expectation.requiredKeyboard.length).toBeGreaterThanOrEqual(1);
    }
  });
});
