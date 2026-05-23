// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import MainWidgetShell from "./MainWidgetShell.vue";
import { STARTDECK_WIDGET_SHELL_CONTRACT_VERSION } from "@/features/widget-shell/WidgetShellContract";

describe("MainWidgetShell", () => {
  it("renders a non-interactive StartDeck shell root with canonical size metadata", () => {
    const wrapper = mount(MainWidgetShell, {
      props: {
        widgetType: "weather",
        widgetSize: "2x2",
        validateContract: false,
      },
      slots: {
        default: '<div data-test-content data-weather-size="2x2">weather</div>',
      },
    });

    const root = wrapper.element as HTMLElement;
    expect(root.tagName).toBe("DIV");
    expect(root.getAttribute("role")).toBeNull();
    expect(root.getAttribute("tabindex")).toBeNull();
    expect(root.dataset.mainShellManaged).toBe("true");
    expect(root.dataset.widgetShellContract).toBe(
      STARTDECK_WIDGET_SHELL_CONTRACT_VERSION,
    );
    expect(root.dataset.widgetType).toBe("weather");
    expect(root.dataset.widgetSize).toBe("2x2");
    expect(wrapper.find("[data-main-widget-shell-card]").exists()).toBe(true);
    expect(wrapper.find("[data-main-widget-shell-content]").exists()).toBe(
      true,
    );
  });

  it("keeps exactly one canonical data-widget-size inside a migrated widget shell", () => {
    const wrapper = mount(MainWidgetShell, {
      props: {
        widgetType: "itab-weather-00",
        widgetSize: "2x4",
        validateContract: false,
      },
      slots: {
        default: '<div data-weather-size="2x4">weather</div>',
      },
    });

    expect(wrapper.findAll("[data-widget-size]")).toHaveLength(1);
    expect(
      wrapper.find("[data-widget-size]").attributes("data-widget-size"),
    ).toBe("2x4");
  });

  it("renders the source-style shell title outside the clipped card", () => {
    const wrapper = mount(MainWidgetShell, {
      props: {
        widgetType: "itab-todo-17",
        widgetSize: "1x1",
        title: "待办事项",
        validateContract: false,
      },
      slots: {
        default: "<div data-test-content>todo</div>",
      },
    });

    const root = wrapper.element as HTMLElement;
    const title = wrapper.find("[data-main-widget-shell-title]");
    const card = wrapper.find("[data-main-widget-shell-card]");

    expect(title.text()).toBe("待办事项");
    expect(title.element.parentElement).toBe(root);
    expect(card.element.contains(title.element)).toBe(false);
  });
});
