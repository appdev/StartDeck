// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";

import type { WidgetConfig } from "@/types";
import WidgetOpenedPanelHost from "./WidgetOpenedPanelHost.vue";

vi.mock("./widgetRuntimeRegistry", () => ({
  getWidgetRuntimeDefinition: vi.fn(() => ({
    type: "docker",
    runtime: "docker",
    title: "Docker",
    component: { template: "<div />" },
    openedPanel: {
      name: "DummyOpenedPanel",
      template: '<div class="dummy-opened-panel">opened</div>',
    },
    defaultSizeKey: "2x2",
    supportedSizes: [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 42,
      maxHeightInset: 18,
      trafficVisible: true,
    },
  })),
}));

let wrapper: VueWrapper | null = null;

const source = readFileSync(
  "src/features/widget-runtime/WidgetOpenedPanelHost.vue",
  "utf8",
);

const widget: WidgetConfig = {
  id: "docker-1",
  type: "docker",
  enable: true,
  isPublic: false,
};

const mountHost = () => {
  wrapper = mount(WidgetOpenedPanelHost, {
    props: { widget },
    global: {
      stubs: {
        OverlayMotion: {
          props: ["show", "panelStyle"],
          template:
            '<div v-if="show" class="overlay-motion-stub"><slot /></div>',
        },
      },
    },
  });
  return wrapper;
};

describe("WidgetOpenedPanelHost", () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = "";
  });

  it("routes the macOS close traffic control through the host close event", async () => {
    const host = mountHost();
    const closeButton = host.find(".sd-widget-opened-traffic .is-red");

    expect(closeButton.attributes("aria-label")).toBe("关闭弹窗");
    expect(closeButton.attributes("title")).toBe("关闭弹窗");

    await closeButton.trigger("click");

    expect(host.emitted("close")).toEqual([[]]);
  });

  it("keeps only the red window control interactive", () => {
    const host = mountHost();

    expect(
      host.find(".sd-widget-opened-traffic .is-green").element.tagName,
    ).toBe("SPAN");
    expect(host.find(".sd-widget-opened-traffic .is-red").element.tagName).toBe(
      "BUTTON",
    );
  });

  it("uses the shared app window control component", () => {
    expect(source).toContain("AppWindowControls");
    expect(source).toContain('class="sd-widget-opened-traffic"');
    expect(source).toContain('close-label="关闭弹窗"');
  });

  it("passes runtime-specific overlay and panel classes for migrated widgets", () => {
    expect(source).toContain("sd-widget-opened-overlay--${runtime}");
    expect(source).toContain("sd-widget-opened-panel--${runtime}");
  });

  it("inherits opened shell colors from semantic theme tokens", () => {
    expect(source).toContain("var(--sd-shell-overlay)");
    expect(source).toContain("var(--sd-shell-surface)");
    expect(source).toContain("var(--sd-component-surface)");
    expect(source).not.toContain(
      "background: linear-gradient(45deg, rgb(33, 30, 34)",
    );
  });

  it("syncs the main-project weather opened shell with the source frame", () => {
    expect(source).toContain(
      ".sd-widget-opened-overlay.sd-widget-opened-overlay--sd-weather",
    );
    expect(source).toContain(
      "background: var(--sd-theme-runtime-widget-opened-panel-host-surface-03)",
    );
    expect(source).toContain("backdrop-filter: none");
    expect(source).toContain(".sd-widget-opened-window.opened-sd-weather");
    expect(source).toContain(
      "border: 1px solid var(--sd-theme-runtime-widget-opened-panel-host-border-03)",
    );
    expect(source).toContain("background: transparent");
    expect(source).toContain(
      "box-shadow: var(--sd-theme-runtime-widget-opened-panel-host-shadow-01) 0 12px",
    );
  });
});
