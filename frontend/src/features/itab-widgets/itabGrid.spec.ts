import { describe, expect, it } from "vitest";
import type { WidgetConfig } from "@/types";
import {
  ITAB_GRID_CELL,
  ITAB_GRID_GAP,
  ITAB_GRID_SCHEMA_VERSION,
  resolveItabGridColumns,
  resolveItabGridContainerWidth,
  resolveItabGridLayout,
  resolveItabGridRect,
  resolveItabGridTrackColumns,
  withItabGridData,
} from "./itabGrid";

describe("itabGrid", () => {
  it("resolves exact iTab DOM rectangles from size keys", () => {
    expect(resolveItabGridRect("1x1")).toMatchObject({
      cols: 1,
      rows: 1,
      width: 60,
      height: 60,
    });
    expect(resolveItabGridRect("1x2")).toMatchObject({
      cols: 2,
      rows: 1,
      width: 150,
      height: 60,
    });
    expect(resolveItabGridRect("2x1")).toMatchObject({
      cols: 1,
      rows: 2,
      width: 60,
      height: 150,
    });
    expect(resolveItabGridRect("2x2")).toMatchObject({
      cols: 2,
      rows: 2,
      width: 150,
      height: 150,
    });
    expect(resolveItabGridRect("2x4")).toMatchObject({
      cols: 4,
      rows: 2,
      width: 330,
      height: 150,
    });
  });

  it("derives fixed grid columns and container width from the iTab pitch", () => {
    expect(ITAB_GRID_CELL).toBe(60);
    expect(ITAB_GRID_GAP).toBe(30);
    expect(resolveItabGridColumns(389)).toBe(3);
    expect(resolveItabGridColumns(390)).toBe(4);
    expect(resolveItabGridContainerWidth(4)).toBe(390);
  });

  it("counts centered home-grid tracks without reserving an outer gap", () => {
    expect(resolveItabGridTrackColumns(1259)).toBe(13);
    expect(resolveItabGridTrackColumns(1260)).toBe(14);
    expect(resolveItabGridTrackColumns(1280)).toBe(14);
  });

  it("normalizes widget layout data to iTab schema and size keys", () => {
    const widget = withItabGridData({
      id: "weather",
      type: "itab-weather-00",
      x: 3.8,
      y: 2.2,
      w: 4,
      h: 4,
      layouts: {
        desktop: { x: 9, y: 9, w: 4, h: 4 },
      },
      enable: true,
      isPublic: true,
      data: { sizeKey: "2x2" },
    } as WidgetConfig);

    expect(widget).toMatchObject({
      w: 2,
      h: 2,
      colSpan: 2,
      rowSpan: 2,
      data: {
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        sizeKey: "2x2",
      },
    });
    expect(widget.layouts).toBeUndefined();
    expect(resolveItabGridLayout(widget)).toEqual({
      x: 3,
      y: 2,
      w: 2,
      h: 2,
      sizeKey: "2x2",
    });
  });
});
