import { describe, expect, it } from "vitest";
import { resolveWidgetSizeState, snapWidgetSizeValue } from "./useWidgetResize";

describe("useWidgetResize iTab finite size rules", () => {
  it("snaps sizes to whole iTab grid units", () => {
    expect(snapWidgetSizeValue(1.24)).toBe(1);
    expect(snapWidgetSizeValue(1.51)).toBe(2);
  });

  it("keeps iTab size options visible but disables widths over a one-column runtime", () => {
    const state = resolveWidgetSizeState({
      widgetType: "calculator",
      deviceKey: "mobile",
      runtimeCols: 1,
      currentSize: { colSpan: 2, rowSpan: 1 },
      requestedSize: { colSpan: 2, rowSpan: 1 },
    });

    expect(state.options.map((option) => option.label)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
    expect(state.clampedSize).toEqual({ colSpan: 1, rowSpan: 1 });
    expect(state.limitReason).toBe("device-max");
    expect(state.canCommit).toBe(false);

    expect(
      state.options.find((option) => option.label === "1x2"),
    ).toMatchObject({
      colSpan: 2,
      rowSpan: 1,
      disabled: true,
      reason: "device-max",
    });
  });

  it("applies the iTab family max before commit", () => {
    const state = resolveWidgetSizeState({
      widgetType: "system-status",
      deviceKey: "desktop",
      runtimeCols: 6,
      currentSize: { colSpan: 1, rowSpan: 1 },
      requestedSize: { colSpan: 4, rowSpan: 3 },
    });

    expect(state.clampedSize).toEqual({ colSpan: 4, rowSpan: 2 });
    expect(state.limitReason).toBe("type-max");
    expect(state.limitLabel).toBe("组件最大 4 x 2");
    expect(state.canCommit).toBe(false);
  });

  it("marks non-family sizes as unsupported and resolves to the nearest iTab size", () => {
    const state = resolveWidgetSizeState({
      widgetType: "calculator",
      deviceKey: "desktop",
      runtimeCols: 4,
      currentSize: { colSpan: 1, rowSpan: 1 },
      requestedSize: { colSpan: 3, rowSpan: 1 },
    });

    expect(state.clampedSize).toEqual({ colSpan: 2, rowSpan: 1 });
    expect(state.limitReason).toBe("unsupported");
    expect(state.canCommit).toBe(false);
  });

  it("uses the scoped five iTab size options and preserves captured orientation", () => {
    const state = resolveWidgetSizeState({
      widgetType: "itab-weather-00",
      deviceKey: "desktop",
      runtimeCols: 4,
      currentSize: { colSpan: 2, rowSpan: 1 },
      requestedSize: { colSpan: 1, rowSpan: 2 },
    });

    expect(state.options.map((option) => option.label)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
    expect(state.clampedSize).toEqual({ colSpan: 1, rowSpan: 2 });
    expect(
      state.options.find((option) => option.label === "2x1"),
    ).toMatchObject({
      colSpan: 1,
      rowSpan: 2,
      disabled: false,
      target: true,
    });
    expect(
      state.options.find((option) => option.label === "1x2"),
    ).toMatchObject({
      colSpan: 2,
      rowSpan: 1,
      current: true,
    });
  });

  it("allows Todo to commit 4x4 on a desktop grid", () => {
    const state = resolveWidgetSizeState({
      widgetType: "itab-todo-17",
      deviceKey: "desktop",
      runtimeCols: 4,
      currentSize: { colSpan: 2, rowSpan: 2 },
      requestedSize: { colSpan: 4, rowSpan: 4 },
    });

    expect(state.clampedSize).toEqual({ colSpan: 4, rowSpan: 4 });
    expect(state.limitReason).toBe("none");
    expect(state.canCommit).toBe(true);
    expect(state.options.map((option) => option.label)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
      "4x4",
    ]);
  });

  it("allows Memo to commit 4x4 on a desktop grid", () => {
    const state = resolveWidgetSizeState({
      widgetType: "itab-memo-04",
      deviceKey: "desktop",
      runtimeCols: 4,
      currentSize: { colSpan: 2, rowSpan: 2 },
      requestedSize: { colSpan: 4, rowSpan: 4 },
    });

    expect(state.clampedSize).toEqual({ colSpan: 4, rowSpan: 4 });
    expect(state.limitReason).toBe("none");
    expect(state.canCommit).toBe(true);
    expect(state.options.map((option) => option.label)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
      "4x4",
    ]);
  });

  it("disables Todo 4x4 when the mobile runtime has fewer than four columns", () => {
    const state = resolveWidgetSizeState({
      widgetType: "itab-todo-17",
      deviceKey: "mobile",
      runtimeCols: 2,
      currentSize: { colSpan: 2, rowSpan: 2 },
      requestedSize: { colSpan: 4, rowSpan: 4 },
    });

    expect(state.clampedSize).toEqual({ colSpan: 2, rowSpan: 2 });
    expect(state.limitReason).toBe("device-max");
    expect(state.canCommit).toBe(false);
    expect(
      state.options.find((option) => option.label === "4x4"),
    ).toMatchObject({
      disabled: true,
      reason: "device-max",
    });
  });

  it("marks 4x4 as unsupported for runtime widgets without a board size", () => {
    const state = resolveWidgetSizeState({
      widgetType: "itab-weather-00",
      deviceKey: "desktop",
      runtimeCols: 4,
      currentSize: { colSpan: 2, rowSpan: 2 },
      requestedSize: { colSpan: 4, rowSpan: 4 },
    });

    expect(state.clampedSize).toEqual({ colSpan: 4, rowSpan: 2 });
    expect(state.limitReason).toBe("unsupported");
    expect(state.canCommit).toBe(false);
    expect(state.options.map((option) => option.label)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
  });
});
