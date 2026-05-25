import { describe, expect, it } from "vitest";
import {
  generateLayout,
  resolveResizeLayout,
  type GridLayoutItem,
} from "./gridLayout";
import type { WidgetConfig } from "@/types";

const widget = (input: Partial<WidgetConfig> & Pick<WidgetConfig, "id">) =>
  ({
    type: "test-widget",
    enable: true,
    isPublic: true,
    ...input,
  }) as WidgetConfig;

describe("generateLayout", () => {
  it("treats non-finite coordinates as unpositioned widgets", () => {
    const layout = generateLayout(
      [
        widget({ id: "existing", x: 0, y: 0, w: 2, h: 2 }),
        widget({ id: "new-widget", x: 0, y: Infinity, w: 2, h: 2 }),
      ],
      4,
    );

    const newWidget = layout.find((item) => item.id === "new-widget");
    expect(newWidget).toMatchObject({ x: 2, y: 0, w: 2, h: 2 });
    expect(Number.isFinite(newWidget?.x)).toBe(true);
    expect(Number.isFinite(newWidget?.y)).toBe(true);
  });

  it("clamps invalid spans before placing widgets", () => {
    const layout = generateLayout(
      [widget({ id: "invalid-size", x: 0, y: 0, w: Infinity, h: NaN })],
      4,
    );

    expect(layout[0]).toMatchObject({ x: 0, y: 0, w: 1, h: 1 });
  });
});

describe("resolveResizeLayout", () => {
  const layoutItem = (input: {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }): GridLayoutItem => ({
    ...widget(input),
    i: input.id,
    x: input.x,
    y: input.y,
    w: input.w,
    h: input.h,
    colSpan: input.w,
    rowSpan: input.h,
  });

  it("keeps the resized widget anchored and pushes the colliding neighbor right", () => {
    const layout = [
      layoutItem({ id: "left", x: 0, y: 0, w: 2, h: 2 }),
      layoutItem({ id: "target", x: 2, y: 0, w: 2, h: 2 }),
      layoutItem({ id: "right", x: 4, y: 0, w: 2, h: 2 }),
    ];

    const resized = resolveResizeLayout(
      layout,
      "target",
      { colSpan: 4, rowSpan: 2 },
      8,
    );

    expect(resized.find((item) => item.i === "left")).toMatchObject({
      x: 0,
      y: 0,
      w: 2,
      h: 2,
    });
    expect(resized.find((item) => item.i === "target")).toMatchObject({
      x: 2,
      y: 0,
      w: 4,
      h: 2,
    });
    expect(resized.find((item) => item.i === "right")).toMatchObject({
      x: 6,
      y: 0,
      w: 2,
      h: 2,
    });
  });

  it("wraps a colliding neighbor downward instead of moving it left on the same row", () => {
    const layout = [
      layoutItem({ id: "left", x: 0, y: 0, w: 2, h: 2 }),
      layoutItem({ id: "target", x: 4, y: 0, w: 2, h: 2 }),
      layoutItem({ id: "right", x: 6, y: 0, w: 2, h: 2 }),
    ];

    const resized = resolveResizeLayout(
      layout,
      "target",
      { colSpan: 4, rowSpan: 2 },
      8,
    );

    expect(resized.find((item) => item.i === "target")).toMatchObject({
      x: 4,
      y: 0,
      w: 4,
      h: 2,
    });
    expect(resized.find((item) => item.i === "right")).toMatchObject({
      x: 0,
      y: 2,
      w: 2,
      h: 2,
    });
  });
});
