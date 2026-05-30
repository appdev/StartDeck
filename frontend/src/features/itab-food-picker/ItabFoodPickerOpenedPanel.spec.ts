// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import ItabFoodPickerOpenedPanel from "./ItabFoodPickerOpenedPanel.vue";
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

describe("ItabFoodPickerOpenedPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the source wheel and menu editor from persisted data", () => {
    const wrapper = mount(ItabFoodPickerOpenedPanel, {
      props: {
        widget: createWidgetWithMenu(),
      },
    });

    expect(wrapper.text()).toContain("今天吃什么");
    expect(
      wrapper.findAll(".food-wheel span").map((item) => item.text()),
    ).toEqual(["牛肉粉", "砂锅粥", "肠粉", "咖喱饭", "云吞面", "麻辣烫"]);
    expect(wrapper.find("textarea").element.value).toContain("牛肉粉");
    wrapper.unmount();
  });

  it("saves edited menu text as canonical picker data", async () => {
    const wrapper = mount(ItabFoodPickerOpenedPanel, {
      props: {
        widget: createWidgetWithMenu(),
      },
    });

    await wrapper.find("textarea").setValue("烧烤\n拉面\n烧烤");
    await wrapper
      .findAll(".food-picker-editor-actions button")[0]
      ?.trigger("click");

    expect(wrapper.emitted("updateData")?.[0]?.[0]).toMatchObject({
      runtime: "itab-food-picker",
      version: 1,
      sizeKey: "2x2",
      menuItems: ["烧烤", "拉面"],
      currentItem: "",
    });
    wrapper.unmount();
  });

  it("picks from the opened panel primary action", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.12);
    vi.spyOn(Date, "now").mockReturnValue(1770000000002);
    const wrapper = mount(ItabFoodPickerOpenedPanel, {
      props: {
        widget: createWidgetWithMenu(),
      },
    });

    await wrapper.find(".food-picker-primary").trigger("click");

    expect(wrapper.emitted("updateData")?.[0]?.[0]).toMatchObject({
      currentItem: "牛肉粉",
      pickedAt: 1770000000002,
    });
    wrapper.unmount();
  });
});
