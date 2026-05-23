// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ItabPoemWidget from "./ItabPoemWidget.vue";
import { createDefaultItabPoemWidget } from "./itabPoemModel";

vi.mock("./itabPoemApi", () => ({
  fetchItabPoem: vi.fn(async () => ({
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

describe("ItabPoemWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders source-sized poem text for non-icon sizes", async () => {
    const wrapper = mount(ItabPoemWidget, {
      props: {
        widget: createDefaultItabPoemWidget(),
        sizeKey: "2x2",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.attributes("data-itab-poem-size")).toBe("2x2");
    expect(wrapper.find(".is-poem-size-2-2").exists()).toBe(true);
    expect(wrapper.text()).toContain("斜月沉沉藏海雾");
    expect(wrapper.text()).toContain("春江花月夜 · 张若虚");
  });

  it("renders the source icon for the 1x1 size", () => {
    const iconSource = readFileSync(
      "public/itab-live-assets/today-shici.svg",
      "utf8",
    );
    const wrapper = mount(ItabPoemWidget, {
      props: {
        widget: createDefaultItabPoemWidget(),
        sizeKey: "1x1",
      },
    });

    expect(iconSource).toContain("<svg");
    expect(wrapper.find("img").attributes("src")).toBe(
      "/itab-live-assets/today-shici.svg",
    );
  });

  it("renders the current poem synchronized from widget data", () => {
    const widget = createDefaultItabPoemWidget();
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
    const wrapper = mount(ItabPoemWidget, {
      props: {
        widget,
        sizeKey: "2x2",
      },
    });

    expect(wrapper.text()).toContain("江畔何人初见月");
    expect(wrapper.text()).toContain("春江花月夜 · 张若虚");
  });

  it("keeps source-specific outer size CSS anchors", () => {
    const source = readFileSync(
      "src/features/itab-poem/ItabPoemWidget.vue",
      "utf8",
    );

    expect(source).toContain(
      "background: var(--itab-poem-card-bg, var(--poem-bg, #eee))",
    );
    expect(source).toContain(".poem-icon-content.is-poem-size-1-1");
    expect(source).toContain("--itab-poem-card-bg: rgb(9, 55, 68)");
    expect(source).toContain(
      "background: var(--itab-poem-card-bg, rgb(9, 55, 68))",
    );
    expect(source).toContain("color: #333");
    expect(source).toContain(".is-poem-size-2-1 .poem-body p");
    expect(source).toContain("writing-mode: vertical-lr");
    expect(source).toContain('fill-opacity="0.6"');
  });
});
