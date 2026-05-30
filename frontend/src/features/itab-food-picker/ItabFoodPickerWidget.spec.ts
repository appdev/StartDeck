// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import ItabFoodPickerWidget from "./ItabFoodPickerWidget.vue";
import { createDefaultItabFoodPickerWidget } from "./itabFoodPickerModel";

const createWidgetWithMenu = () => {
  const widget = createDefaultItabFoodPickerWidget();
  widget.data = {
    ...widget.data,
    menuItems: [
      "牛肉粉",
      "砂锅粥",
      "肠粉",
      "咖喱饭",
      "云吞面",
      "麻辣烫",
      "汉堡",
      "寿司",
    ],
  };
  return widget;
};

describe("ItabFoodPickerWidget", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["1x1", "1x2", "2x1", "2x2", "2x4"] as const)(
    "renders source-sized food picker content for %s",
    (sizeKey) => {
      const wrapper = mount(ItabFoodPickerWidget, {
        props: {
          widget: createDefaultItabFoodPickerWidget(),
          sizeKey,
        },
      });

      expect(wrapper.attributes("data-itab-food-picker-size")).toBe(sizeKey);
      expect(wrapper.text()).toContain("今天吃什么");
      expect(wrapper.find("button").text()).toBe("开始");
      wrapper.unmount();
    },
  );

  it("emits a canonical pick update from the inner start button", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.3);
    vi.spyOn(Date, "now").mockReturnValue(1770000000000);
    const wrapper = mount(ItabFoodPickerWidget, {
      props: {
        widget: createWidgetWithMenu(),
        sizeKey: "2x2",
      },
    });

    await wrapper.find("button").trigger("click");

    expect(wrapper.emitted("updateData")?.[0]?.[0]).toMatchObject({
      runtime: "itab-food-picker",
      version: 1,
      sizeKey: "2x2",
      currentItem: "肠粉",
      pickedAt: 1770000000000,
    });
    wrapper.unmount();
  });

  it("uses the refresh token as the runtime refresh action", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.spyOn(Date, "now").mockReturnValue(1770000000001);
    const wrapper = mount(ItabFoodPickerWidget, {
      props: {
        widget: createWidgetWithMenu(),
        sizeKey: "2x2",
        refreshToken: 0,
      },
    });

    await wrapper.setProps({ refreshToken: 1 });

    expect(wrapper.emitted("updateData")?.[0]?.[0]).toMatchObject({
      currentItem: "云吞面",
      pickedAt: 1770000000001,
    });
    wrapper.unmount();
  });

  it("keeps text colors on food picker theme tokens", () => {
    const source = readFileSync(
      "src/features/itab-food-picker/ItabFoodPickerWidget.vue",
      "utf8",
    );

    expect(source).not.toContain("oklch(");
    expect(source).toContain(
      "color: var(--sd-theme-itab-food-picker-food-picker-widget-accent-text-01)",
    );
    expect(source).toContain(
      "background: var(\n    --sd-theme-itab-food-picker-food-picker-widget-accent-surface-01\n  )",
    );
  });
});
