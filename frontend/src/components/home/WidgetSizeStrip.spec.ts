// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import WidgetSizeStrip from "./WidgetSizeStrip.vue";
import { resolveWidgetSizeState } from "@/composables/useWidgetResize";

describe("WidgetSizeStrip", () => {
  it("keeps disabled finite sizes visible and non-committable", async () => {
    const state = resolveWidgetSizeState({
      widgetType: "custom-css",
      deviceKey: "mobile",
      runtimeCols: 1,
      currentSize: { colSpan: 1, rowSpan: 1 },
    });
    const wrapper = mount(WidgetSizeStrip, {
      props: {
        options: state.options,
        currentSize: { colSpan: 1, rowSpan: 1 },
        targetSize: null,
        maxSize: state.maxSize,
        runtimeCols: 1,
      },
    });

    const disabledTwoColumn = wrapper
      .findAll("button")
      .find((button) => button.text().startsWith("1x2"));

    expect(disabledTwoColumn?.exists()).toBe(true);
    expect(disabledTwoColumn?.attributes("disabled")).toBeDefined();
    expect(disabledTwoColumn?.attributes("aria-disabled")).toBe("true");
    expect(disabledTwoColumn?.attributes("aria-label")).toContain("不可用");

    await disabledTwoColumn?.trigger("click");
    expect(wrapper.emitted("select")).toBeUndefined();

    const enabledOneColumn = wrapper
      .findAll("button")
      .find((button) => button.text().startsWith("1x1"));
    await enabledOneColumn?.trigger("click");
    expect(wrapper.emitted("select")?.[0]).toEqual([
      { colSpan: 1, rowSpan: 1 },
    ]);
  });

  it("surfaces iTab runtime limit reasons in disabled size labels", () => {
    const state = resolveWidgetSizeState({
      widgetType: "custom-css",
      deviceKey: "mobile",
      runtimeCols: 1,
      currentSize: { colSpan: 1, rowSpan: 1 },
    });
    const wrapper = mount(WidgetSizeStrip, {
      props: {
        options: state.options,
        currentSize: { colSpan: 1, rowSpan: 1 },
        targetSize: { colSpan: 1, rowSpan: 1 },
        maxSize: state.maxSize,
        runtimeCols: 1,
      },
    });

    const wideDisabled = wrapper
      .findAll("button")
      .find((button) => button.text().startsWith("1x2"));
    expect(wideDisabled?.exists()).toBe(true);
    expect(wideDisabled?.attributes("aria-label")).toContain(
      "当前布局最大 1 x 2",
    );
    expect(wrapper.text()).toContain("目标 1 x 1");
  });
});
