// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import WidgetRuntimeFrame from "./WidgetRuntimeFrame.vue";

const mainCssSource = readFileSync("src/assets/main.css", "utf8");

vi.mock("./widgetRuntimeRegistry", () => ({
  getWidgetRuntimeDefinition: () => ({
    runtime: "test-runtime",
    title: "测试组件",
    component: defineComponent({
      template: "<div data-testid='runtime-body'>Runtime Body</div>",
    }),
    defaultSizeKey: "2x2",
  }),
  resolveWidgetRuntimeSizeKey: () => "2x2",
}));

const mountFrame = (props: { editing?: boolean; isDragging?: boolean } = {}) =>
  mount(WidgetRuntimeFrame, {
    props: {
      widget: {
        id: "weather",
        type: "itab-weather-00",
        enable: true,
        isPublic: true,
      },
      ...props,
    },
    global: {
      stubs: {
        MainWidgetShell: {
          props: ["widgetType", "widgetSize", "title"],
          template:
            "<div data-testid='main-widget-shell' :data-title='title'><slot /></div>",
        },
      },
    },
  });

describe("WidgetRuntimeFrame", () => {
  it("opens runtime widgets from normal clicks", async () => {
    const wrapper = mountFrame();

    await wrapper.find("[data-runtime-widget]").trigger("click");

    expect(wrapper.emitted("open")).toHaveLength(1);
  });

  it("does not open runtime widgets while the home grid is dragging", async () => {
    const wrapper = mountFrame({ isDragging: true });

    await wrapper.find("[data-runtime-widget]").trigger("click");
    await wrapper.find("[data-runtime-widget]").trigger("keydown", {
      key: "Enter",
    });

    expect(wrapper.emitted("open")).toBeUndefined();
  });

  it("keeps runtime widgets out of legacy home appearance clamps", () => {
    expect(mainCssSource).not.toContain(
      ".sd-home-widget-frame[data-widget-type]",
    );
    expect(mainCssSource).not.toContain(
      '> :not([data-main-shell-managed="true"])',
    );
    expect(mainCssSource).not.toContain("--sd-runtime-widget-bg");
  });

  it("passes the runtime definition title into the shared shell", () => {
    const wrapper = mountFrame();

    expect(
      wrapper.find("[data-testid='main-widget-shell']").attributes(),
    ).toMatchObject({
      "data-title": "测试组件",
    });
  });
});
