// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import SystemStatusWidget from "./SystemStatusWidget.vue";

describe("SystemStatusWidget", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders catalog previews from sample stats without polling the live API", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const wrapper = mount(SystemStatusWidget, {
      props: {
        widget: {
          id: "preview-system-status",
          type: "system-status",
          enable: true,
          isPublic: true,
          colSpan: 2,
          rowSpan: 2,
          w: 2,
          h: 2,
          data: { catalogPreview: true, sizeKey: "2x2" },
        },
      },
      global: {
        plugins: [
          createTestingPinia({
            createSpy: () => vi.fn(),
            initialState: {
              widgets: { widgets: [] },
            },
          }),
        ],
      },
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(wrapper.find(".system-status-loading").exists()).toBe(false);
    expect(wrapper.find(".system-status-widget").classes()).toContain(
      "has-stats",
    );
    expect(wrapper.text()).toContain("CPU");
    expect(wrapper.text()).toContain("28%");
    expect(wrapper.text()).toContain("内存");
    expect(wrapper.text()).toContain("59%");
  });

  it("does not poll protected system stats while the viewer is a guest", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    mount(SystemStatusWidget, {
      props: {
        widget: {
          id: "guest-system-status",
          type: "system-status",
          enable: true,
          colSpan: 2,
          rowSpan: 2,
          w: 2,
          h: 2,
          data: { sizeKey: "2x2" },
        },
      },
      global: {
        plugins: [
          createTestingPinia({
            createSpy: () => vi.fn(),
            initialState: {
              auth: {
                sessionReady: true,
                username: "",
                sessionGeneration: "",
              },
              widgets: { widgets: [] },
            },
          }),
        ],
      },
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
