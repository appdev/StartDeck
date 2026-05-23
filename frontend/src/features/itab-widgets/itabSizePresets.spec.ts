import { describe, expect, it } from "vitest";
import {
  ITAB_WIDGET_SIZE_CANDIDATES,
  resolveItabWidgetSize,
  toItabWidgetSizeKey,
} from "./itabSizePresets";

describe("itabSizePresets", () => {
  it("maps captured iTab labels to grid spans and DOM rectangles without inversion", () => {
    expect(ITAB_WIDGET_SIZE_CANDIDATES.map((size) => size.key)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
    expect(resolveItabWidgetSize("1x1")).toMatchObject({
      colSpan: 1,
      rowSpan: 1,
      width: 60,
      height: 60,
    });
    expect(resolveItabWidgetSize("1x2")).toMatchObject({
      colSpan: 2,
      rowSpan: 1,
      width: 150,
      height: 60,
      default: true,
    });
    expect(resolveItabWidgetSize("2x1")).toMatchObject({
      colSpan: 1,
      rowSpan: 2,
      width: 60,
      height: 150,
    });
    expect(resolveItabWidgetSize("2x2")).toMatchObject({
      colSpan: 2,
      rowSpan: 2,
      width: 150,
      height: 150,
    });
    expect(resolveItabWidgetSize("2x4")).toMatchObject({
      colSpan: 4,
      rowSpan: 2,
      width: 330,
      height: 150,
    });
  });

  it("round-trips scoped dimensions to iTab keys", () => {
    expect(toItabWidgetSizeKey({ colSpan: 1, rowSpan: 2 })).toBe("2x1");
    expect(toItabWidgetSizeKey({ colSpan: 2, rowSpan: 1 })).toBe("1x2");
  });
});
