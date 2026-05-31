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
  const mountMenu = (events: string[] = [], targetWidget = widget) =>
    mount(WidgetRuntimeMenu, {
      props: {
        show: true,
        x: 120,
        y: 80,
        widget: targetWidget,
        onClose: () => events.push("close"),
        onRefresh: () => events.push("refresh"),
        onReload: () => events.push("reload"),
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
    expect(wrapper.find('[role="menu"]').text()).toContain("重新加载");
    expect(wrapper.find('[role="menu"]').text()).toContain("删除");
  });

  it.each([
    ["Todo", "todo", "itab-todo-17", "itab-todo", { tasks: [] }],
    ["Memo", "memo", "itab-memo-04", "itab-memo", { notes: [] }],
  ])(
    "renders 4x4 for %s runtime widgets",
    (_label, id, type, runtime, payload) => {
      const targetWidget = {
        ...widget,
        id,
        type,
        data: {
          runtime,
          version: 1,
          sizeKey: "4x4",
          ...payload,
        },
      };
      const wrapper = mountMenu([], targetWidget);

      expect(
        wrapper.findAll('[role="menuitemradio"]').map((item) => item.text()),
      ).toEqual(["1x1", "1x2", "2x1", "2x2", "2x4", "4x4"]);
      expect(
        wrapper
          .findAll('[role="menuitemradio"]')
          .find((item) => item.text() === "4x4")
          ?.attributes("aria-checked"),
      ).toBe("true");
    },
  );

  it("closes before refresh reload edit delete and size side effects", async () => {
    const events: string[] = [];
    const wrapper = mountMenu(events);

    await wrapper
      .findAll('[role="menuitem"]')
      .find((item) => item.text() === "刷新")!
      .trigger("click");
    await wrapper
      .findAll('[role="menuitem"]')
      .find((item) => item.text() === "重新加载")!
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
      "reload",
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
