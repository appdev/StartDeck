// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import WidgetRuntimeMenu from "./WidgetRuntimeMenu.vue";

const widget = {
  id: "weather",
  type: "itab-weather-00",
  enable: true,
  isPublic: true,
  colSpan: 2,
  rowSpan: 2,
  w: 2,
  h: 2,
  data: {
    runtime: "itab-weather",
    version: 1,
    sizeKey: "2x2",
  },
};

describe("WidgetRuntimeMenu", () => {
  const mountMenu = (events: string[] = []) =>
    mount(WidgetRuntimeMenu, {
      props: {
        show: true,
        x: 120,
        y: 80,
        widget,
        onClose: () => events.push("close"),
        onRefresh: () => events.push("refresh"),
        onEditIcon: () => events.push("edit-icon"),
        onEditHome: () => events.push("edit-home"),
        onDelete: () => events.push("delete"),
        onSelectSize: (_widget: unknown, sizeKey: string) =>
          events.push(`size:${sizeKey}`),
      },
      global: {
        stubs: {
          ContextMenuSurface: {
            props: ["show"],
            template: '<div v-if="show" data-stub-menu><slot /></div>',
          },
        },
      },
    });

  it("renders all iTab weather sizes without inverting labels", () => {
    const wrapper = mountMenu();

    expect(wrapper.find(".sd-runtime-menu-heading").text()).toBe("布局");
    expect(
      wrapper.findAll('[role="menuitemradio"]').map((item) => item.text()),
    ).toEqual(["1x1", "1x2", "2x1", "2x2", "2x4"]);
    expect(
      wrapper
        .findAll('[role="menuitemradio"]')
        .find((item) => item.text() === "2x2")
        ?.attributes("aria-checked"),
    ).toBe("true");
    expect(wrapper.find('[role="menu"]').text()).toContain("编辑图标");
    expect(wrapper.find('[role="menu"]').text()).toContain("编辑主页");
    expect(wrapper.find('[role="menu"]').text()).toContain("刷新");
    expect(wrapper.find('[role="menu"]').text()).toContain("删除");
  });

  it("closes before refresh edit delete and size side effects", async () => {
    const events: string[] = [];
    const wrapper = mountMenu(events);

    await wrapper
      .findAll('[role="menuitem"]')
      .find((item) => item.text() === "刷新")!
      .trigger("click");
    await wrapper
      .findAll('[role="menuitem"]')
      .find((item) => item.text() === "编辑图标")!
      .trigger("click");
    await wrapper
      .findAll('[role="menuitem"]')
      .find((item) => item.text() === "编辑主页")!
      .trigger("click");
    await wrapper
      .findAll('[role="menuitem"]')
      .find((item) => item.text() === "删除")!
      .trigger("click");
    await wrapper
      .findAll('[role="menuitemradio"]')
      .find((item) => item.text() === "1x2")!
      .trigger("click");

    expect(events).toEqual([
      "close",
      "refresh",
      "close",
      "edit-icon",
      "close",
      "edit-home",
      "close",
      "delete",
      "close",
      "size:1x2",
    ]);
  });
});
