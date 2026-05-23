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

const itabSizeKeys = ["1x1", "1x2", "2x1", "2x2", "2x4"] as const;

const expectedDefaults: Record<string, WidgetSizeKey> = {
  search: "1x2",
  "div-card": "1x1",
  bookmarks: "2x2",
  iframe: "2x2",
  "custom-css": "1x1",
  countdown: "1x1",
  countup: "1x1",
  calculator: "2x2",
  "file-transfer": "2x2",
  hot: "2x2",
  rss: "2x2",
  docker: "2x2",
  "system-status": "1x1",
  ip: "1x2",
  "status-monitor": "2x2",
};

describe("widgetSizePresets", () => {
  it("defines the fixed iTab candidate size set", () => {
    expect(WIDGET_SIZE_CANDIDATE_KEYS).toEqual([...itabSizeKeys]);
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

  it("gives every main-project widget the same iTab size family", () => {
    expect(WIDGET_SIZE_FAMILY_TYPES).toHaveLength(15);
    expect(Object.keys(expectedDefaults).sort()).toEqual(
      [...WIDGET_SIZE_FAMILY_TYPES].sort(),
    );

    for (const type of WIDGET_SIZE_FAMILY_TYPES) {
      const family = resolveWidgetSizeFamily(type);
      expect(family.scope).toBe("itab");
      expect(family.supported.map((size) => size.key)).toEqual([
        ...itabSizeKeys,
      ]);
      expect(family.supported.every((size) => size.scope === "itab")).toBe(
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

  it("uses the iTab fallback family for unknown future widgets", () => {
    const family = resolveWidgetSizeFamily("future-widget");
    expect(family.scope).toBe("itab");
    expect(family.supported.map((size) => size.key)).toEqual([...itabSizeKeys]);
    expect(family.defaultSize).toEqual({ colSpan: 1, rowSpan: 1 });
  });

  it("does not reference removed StartDeck size keys in functional faces", () => {
    const allowed = new Set<string>(itabSizeKeys);
    for (const faces of Object.values(WIDGET_FUNCTIONAL_FACE_MATRIX)) {
      expect(Object.keys(faces).every((key) => allowed.has(key))).toBe(true);
    }
    expect(resolveWidgetFunctionalFace("search", "1x2")).toBe(
      "search-active-input",
    );
    expect(resolveWidgetFunctionalFace("search", "2x4")).toBe(
      "search-engine-menu-preview",
    );
  });
});
