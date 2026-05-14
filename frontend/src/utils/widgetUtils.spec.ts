import { describe, expect, it } from "vitest";
import type { WidgetConfig } from "@/types";
import { normalizeIncomingWidgets } from "./widgetUtils";

const publicClock: WidgetConfig = {
  id: "clock-public",
  type: "clock",
  enable: true,
  isPublic: true,
};

describe("normalizeIncomingWidgets", () => {
  it("does not restore filtered private default widgets for guests", () => {
    const widgets = normalizeIncomingWidgets([publicClock], false);

    expect(widgets.some((widget) => widget.type === "clock")).toBe(true);
    expect(widgets.some((widget) => widget.type === "memo")).toBe(false);
    expect(widgets.some((widget) => widget.type === "todo")).toBe(false);
  });

  it("keeps an empty server-filtered guest widget list empty", () => {
    expect(normalizeIncomingWidgets([], false)).toEqual([]);
  });

  it("still restores missing default widgets for authenticated users", () => {
    const widgets = normalizeIncomingWidgets([publicClock], true);

    expect(widgets.some((widget) => widget.type === "memo")).toBe(true);
    expect(widgets.some((widget) => widget.type === "todo")).toBe(true);
  });
});
