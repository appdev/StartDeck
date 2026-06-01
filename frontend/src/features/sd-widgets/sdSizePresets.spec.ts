import { describe, expect, it } from "vitest";
import {
  SD_WIDGET_SIZE_CANDIDATES,
  resolveSdWidgetSize,
  toSdWidgetSizeKey,
} from "./sdSizePresets";

describe("size presets", () => {
  it("maps captured source labels to grid spans and DOM rectangles without inversion", () => {
    expect(SD_WIDGET_SIZE_CANDIDATES.map((size) => size.key)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
    expect(resolveSdWidgetSize("1x1")).toMatchObject({
      colSpan: 1,
      rowSpan: 1,
      width: 60,
      height: 60,
    });
    expect(resolveSdWidgetSize("1x2")).toMatchObject({
      colSpan: 2,
      rowSpan: 1,
      width: 150,
      height: 60,
      default: true,
    });
    expect(resolveSdWidgetSize("2x1")).toMatchObject({
      colSpan: 1,
      rowSpan: 2,
      width: 60,
      height: 150,
    });
    expect(resolveSdWidgetSize("2x2")).toMatchObject({
      colSpan: 2,
      rowSpan: 2,
      width: 150,
      height: 150,
    });
    expect(resolveSdWidgetSize("2x4")).toMatchObject({
      colSpan: 4,
      rowSpan: 2,
      width: 330,
      height: 150,
    });
  });

  it("round-trips scoped dimensions to scoped keys", () => {
    expect(toSdWidgetSizeKey({ colSpan: 1, rowSpan: 2 })).toBe("2x1");
    expect(toSdWidgetSizeKey({ colSpan: 2, rowSpan: 1 })).toBe("1x2");
  });
});
