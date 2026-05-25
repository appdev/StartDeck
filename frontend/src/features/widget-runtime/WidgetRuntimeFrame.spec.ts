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
      template: `
        <div data-testid="runtime-body">
          <span data-testid="runtime-background">Runtime Body</span>
          <button type="button" data-testid="native-button">Button</button>
          <a href="#runtime-link" data-testid="native-link">Link</a>
          <input data-testid="native-input" />
          <textarea data-testid="native-textarea"></textarea>
          <select data-testid="native-select"><option>One</option></select>
          <label data-testid="native-label"><input type="checkbox" /> Label</label>
          <span role="button" data-testid="role-button">Role button</span>
          <span role="switch" data-testid="role-switch">Role switch</span>
          <span contenteditable data-testid="contenteditable-any">Edit</span>
          <span contenteditable="true" data-testid="contenteditable-true">Edit</span>
          <span data-runtime-open-ignore data-testid="runtime-ignore">Ignore</span>
          <span data-runtime-action data-testid="runtime-action">Action</span>
          <span data-docker-action data-testid="docker-action">Docker</span>
          <span data-system-status-action data-testid="system-action">System</span>
          <span data-itab-inner-control data-testid="itab-control">iTab</span>
        </div>
      `,
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
    await wrapper.find("[data-testid='runtime-background']").trigger("click");

    expect(wrapper.emitted("open")).toHaveLength(2);
  });

  it("opens once for Enter and Space on the runtime frame", () => {
    const wrapper = mountFrame();
    const frame = wrapper.find("[data-runtime-widget]").element;

    const enter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    const space = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });

    frame.dispatchEvent(enter);
    frame.dispatchEvent(space);

    expect(enter.defaultPrevented).toBe(true);
    expect(space.defaultPrevented).toBe(true);
    expect(wrapper.emitted("open")).toHaveLength(2);
  });

  it("ignores internal controls for click and keydown without preventing ignored keys", async () => {
    const wrapper = mountFrame();
    const ignoredTargets = [
      "native-button",
      "native-link",
      "native-input",
      "native-textarea",
      "native-select",
      "native-label",
      "role-button",
      "role-switch",
      "contenteditable-any",
      "contenteditable-true",
      "runtime-ignore",
      "runtime-action",
      "docker-action",
      "system-action",
      "itab-control",
    ];

    for (const target of ignoredTargets) {
      await wrapper.find(`[data-testid='${target}']`).trigger("click");
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      });
      wrapper.find(`[data-testid='${target}']`).element.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }

    expect(wrapper.emitted("open")).toBeUndefined();
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
