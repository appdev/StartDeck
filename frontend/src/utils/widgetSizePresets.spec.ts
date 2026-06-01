import { describe, expect, it } from "vitest";
import {
  WIDGET_FUNCTIONAL_FACE_MATRIX,
  WIDGET_SIZE_CANDIDATE_KEYS,
  WIDGET_SIZE_CANDIDATES,
  WIDGET_SIZE_FAMILY_TYPES,
  resolveWidgetDefaultSize,
  resolveWidgetFunctionalFace,
  resolveWidgetSizeFamily,
  toWidgetSizeKey,
  type WidgetSizeKey,
} from "./widgetSizePresets";

const sdSizeKeys = ["1x1", "1x2", "2x1", "2x2", "2x4"] as const;

const expectedDefaults: Record<string, WidgetSizeKey> = {};

describe("widgetSizePresets", () => {
  it("defines the fixed scoped candidate size set", () => {
    expect(WIDGET_SIZE_CANDIDATE_KEYS).toEqual([...sdSizeKeys]);
    expect(WIDGET_SIZE_CANDIDATES.map((size) => size.label)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
    expect(toWidgetSizeKey({ colSpan: 2, rowSpan: 1 })).toBe("1x2");
    expect(toWidgetSizeKey({ colSpan: 1, rowSpan: 2 })).toBe("2x1");
    expect(toWidgetSizeKey({ colSpan: 4, rowSpan: 2 })).toBe("2x4");
  });

  it("gives every main-project widget the same scoped size family", () => {
    expect(WIDGET_SIZE_FAMILY_TYPES).toHaveLength(0);
    expect(Object.keys(expectedDefaults).sort()).toEqual(
      [...WIDGET_SIZE_FAMILY_TYPES].sort(),
    );

    for (const type of WIDGET_SIZE_FAMILY_TYPES) {
      const family = resolveWidgetSizeFamily(type);
      expect(family.scope).toBe("sd");
      expect(family.supported.map((size) => size.key)).toEqual([
        ...sdSizeKeys,
      ]);
      expect(family.supported.every((size) => size.scope === "sd")).toBe(
        true,
      );
      expect(family.disabled).toEqual([]);
      expect(family.maxSize).toEqual({ colSpan: 4, rowSpan: 2 });
      expect(family.supported.find((size) => size.default)?.key).toBe(
        expectedDefaults[type],
      );
      expect(resolveWidgetDefaultSize(type)).toEqual({
        colSpan: family.defaultSize.colSpan,
        rowSpan: family.defaultSize.rowSpan,
      });
    }
  });

  it("uses the scoped fallback family for unknown future widgets", () => {
    const family = resolveWidgetSizeFamily("future-widget");
    expect(family.scope).toBe("sd");
    expect(family.supported.map((size) => size.key)).toEqual([...sdSizeKeys]);
    expect(family.defaultSize).toEqual({ colSpan: 1, rowSpan: 1 });
  });

  it("does not reference removed StartDeck size keys in functional faces", () => {
    const allowed = new Set<string>(sdSizeKeys);
    for (const faces of Object.values(WIDGET_FUNCTIONAL_FACE_MATRIX)) {
      expect(Object.keys(faces).every((key) => allowed.has(key))).toBe(true);
    }
    expect(resolveWidgetFunctionalFace("custom-css", "2x4")).toBe(
      "custom-workbench",
    );
  });
});
