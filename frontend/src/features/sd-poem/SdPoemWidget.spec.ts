// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { createTestingPinia } from "@pinia/testing";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SdPoemWidget from "./SdPoemWidget.vue";
import { createDefaultSdPoemWidget } from "./sdPoemModel";

vi.mock("./sdPoemApi", () => ({
  fetchSdPoem: vi.fn(async () => ({
    sentence: "斜月沉沉藏海雾，碣石潇湘无限路。",
    poemTitle: "春江花月夜",
    author: "张若虚",
    dynasty: "唐代",
    fullText: ["春江潮水连海平，海上明月共潮生。"],
    translation: ["春天的江潮水势浩荡，与大海连成一片。"],
    annotations: [],
    preface: [],
    sourceStatus: "ok",
  })),
}));

describe("poem widget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mountWidget = (options: {
    widget?: ReturnType<typeof createDefaultSdPoemWidget>;
    sizeKey?: "1x1" | "1x2" | "2x1" | "2x2" | "2x4";
    loggedIn?: boolean;
  } = {}) =>
    mount(SdPoemWidget, {
      props: {
        widget: options.widget ?? createDefaultSdPoemWidget(),
        sizeKey: options.sizeKey ?? "2x2",
      },
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              auth: {
                sessionReady: true,
                username: options.loggedIn === false ? "" : "admin",
                sessionGeneration:
                  options.loggedIn === false ? "" : "test-session",
              },
            },
          }),
        ],
      },
    });

  it("renders source-sized poem text for non-icon sizes", async () => {
    const wrapper = mountWidget();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.attributes("data-sd-poem-size")).toBe("2x2");
    expect(wrapper.find(".is-poem-size-2-2").exists()).toBe(true);
    expect(wrapper.text()).toContain("斜月沉沉藏海雾");
    expect(wrapper.text()).toContain("春江花月夜 · 张若虚");
  });

  it("renders the source icon for the 1x1 size", () => {
    const iconSource = readFileSync(
      "public/sd-live-assets/today-shici.svg",
      "utf8",
    );
    const wrapper = mountWidget({ sizeKey: "1x1" });

    expect(iconSource).toContain("<svg");
    expect(wrapper.find("img").attributes("src")).toBe(
      "/sd-live-assets/today-shici.svg",
    );
  });

  it("renders the current poem synchronized from widget data", () => {
    const widget = createDefaultSdPoemWidget();
    widget.data = {
      ...widget.data,
      currentPoem: {
        sentence: "江畔何人初见月，江月何年初照人？",
        poemTitle: "春江花月夜",
        author: "张若虚",
        dynasty: "唐代",
        fullText: ["江畔何人初见月，江月何年初照人？"],
        translation: [],
        annotations: [],
        preface: [],
        sourceStatus: "ok",
      },
      paletteIndex: 2,
      paletteDate: "2026-05-23",
    };
    const wrapper = mountWidget({ widget });

    expect(wrapper.text()).toContain("江畔何人初见月");
    expect(wrapper.text()).toContain("春江花月夜 · 张若虚");
  });

  it("loads remote poem for guests without emitting a persistent update", async () => {
    const wrapper = mountWidget({ loggedIn: false });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.text()).toContain("斜月沉沉藏海雾");
    expect(wrapper.emitted("updateData")).toBeUndefined();
  });

  it("keeps source-specific outer size CSS anchors", () => {
    const source = readFileSync(
      "src/features/sd-poem/SdPoemWidget.vue",
      "utf8",
    );

    expect(source).toContain(
      "background: var(\n    --sd-poem-card-bg,\n    var(--poem-bg, var(--sd-theme-poem-poem-widget-surface-01))",
    );
    expect(source).toContain(".poem-icon-content.is-poem-size-1-1");
    expect(source).toContain(
      "--sd-poem-card-bg: var(--sd-theme-poem-poem-widget-accent-01)",
    );
    expect(source).toContain(
      "var(--sd-theme-poem-poem-widget-accent-surface-01)",
    );
    expect(source).toContain(
      "color: var(--sd-theme-poem-poem-widget-text-01)",
    );
    expect(source).toContain(
      "color: var(--sd-theme-poem-poem-widget-text-02)",
    );
    expect(source).toContain(".is-poem-size-2-1 .poem-body p");
    expect(source).toContain("writing-mode: vertical-lr");
    expect(source).toContain('fill-opacity="0.6"');
  });

  it("overrides runtime light palette variables in dark theme", () => {
    const source = readFileSync(
      "src/features/sd-poem/SdPoemWidget.vue",
      "utf8",
    );

    expect(source).not.toContain("oklch(");
    expect(source).toContain(
      ':global([data-sd-theme="dark"] .sd-poem-widget)',
    );
    expect(source).toContain(
      "--poem-bg: var(--sd-theme-poem-poem-widget-surface-01) !important;",
    );
    expect(source).toContain("--poem-wave-base: color-mix(");
  });
});
