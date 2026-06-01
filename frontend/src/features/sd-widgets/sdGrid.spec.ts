import { describe, expect, it } from "vitest";
import type { WidgetConfig } from "@/types";
import {
  SD_GRID_CELL,
  SD_GRID_GAP,
  SD_GRID_SCHEMA_VERSION,
  resolveSdGridColumns,
  resolveSdGridContainerWidth,
  resolveSdGridLayout,
  resolveSdGridRect,
  resolveSdGridTrackColumns,
  withSdGridData,
} from "./sdGrid";

describe("grid sizing", () => {
  it("resolves exact source DOM rectangles from size keys", () => {
    expect(resolveSdGridRect("1x1")).toMatchObject({
      cols: 1,
      rows: 1,
      width: 60,
      height: 60,
    });
    expect(resolveSdGridRect("1x2")).toMatchObject({
      cols: 2,
      rows: 1,
      width: 150,
      height: 60,
    });
    expect(resolveSdGridRect("2x1")).toMatchObject({
      cols: 1,
      rows: 2,
      width: 60,
      height: 150,
    });
    expect(resolveSdGridRect("2x2")).toMatchObject({
      cols: 2,
      rows: 2,
      width: 150,
      height: 150,
    });
    expect(resolveSdGridRect("2x4")).toMatchObject({
      cols: 4,
      rows: 2,
      width: 330,
      height: 150,
    });
  });

  it("derives fixed grid columns and container width from the fixed grid pitch", () => {
    expect(SD_GRID_CELL).toBe(60);
    expect(SD_GRID_GAP).toBe(30);
    expect(resolveSdGridColumns(389)).toBe(3);
    expect(resolveSdGridColumns(390)).toBe(4);
    expect(resolveSdGridContainerWidth(4)).toBe(390);
  });

  it("counts centered home-grid tracks without reserving an outer gap", () => {
    expect(resolveSdGridTrackColumns(1259)).toBe(13);
    expect(resolveSdGridTrackColumns(1260)).toBe(14);
    expect(resolveSdGridTrackColumns(1280)).toBe(14);
  });

  it("normalizes widget layout data to grid schema and size keys", () => {
    const widget = withSdGridData({
      id: "weather",
      type: "sd-weather-00",
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
        layoutSystem: SD_GRID_SCHEMA_VERSION,
        sizeKey: "2x2",
      },
    });
    expect(widget.layouts).toBeUndefined();
    expect(resolveSdGridLayout(widget)).toEqual({
      x: 3,
      y: 2,
      w: 2,
      h: 2,
      sizeKey: "2x2",
    });
  });
});
