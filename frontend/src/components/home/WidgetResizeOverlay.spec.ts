// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import WidgetResizeOverlay from "./WidgetResizeOverlay.vue";

describe("WidgetResizeOverlay", () => {
  it("draws shrink ghost and badge from target size instead of current size", () => {
    const wrapper = mount(WidgetResizeOverlay, {
      props: {
        currentSize: { colSpan: 2, rowSpan: 2 },
        targetSize: { colSpan: 1, rowSpan: 1 },
        maxSize: { colSpan: 4, rowSpan: 4 },
      },
    });

    const ghost = wrapper.find(".sd-home-resize-ghost");
    const badge = wrapper.find(".sd-home-resize-badge");

    expect(ghost.attributes("style")).toContain("width: 50%");
    expect(ghost.attributes("style")).toContain("height: 50%");
    expect(badge.text()).toBe("2 x 2 -> 1 x 1");
    expect(badge.attributes("style")).toContain("left: 50%");
    expect(badge.attributes("style")).toContain("top: 50%");
  });
});
