// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ItabPoemOpenedPanel from "./ItabPoemOpenedPanel.vue";
import { createDefaultItabPoemWidget } from "./itabPoemModel";
import { fetchItabPoem } from "./itabPoemApi";

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

describe("ItabPoemOpenedPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the opened flow with refresh, full text, translation, annotations and preface sections", async () => {
    const wrapper = mount(ItabPoemOpenedPanel, {
      props: { widget: createDefaultItabPoemWidget() },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.text()).toContain("换一句");
    expect(wrapper.text()).toContain("全文");
    expect(wrapper.text()).toContain("译文");
    expect(wrapper.text()).toContain("注释");
    expect(wrapper.text()).toContain("序");

    await wrapper.find("button").trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchItabPoem).toHaveBeenCalledWith(true, expect.any(AbortSignal));
    expect(wrapper.emitted("updateData")?.at(-1)?.[0]).toMatchObject({
      paletteIndex: expect.any(Number),
      currentPoem: {
        sentence: "斜月沉沉藏海雾，碣石潇湘无限路。",
        poemTitle: "春江花月夜",
        author: "张若虚",
        sourceStatus: "ok",
      },
    });
    expect(wrapper.emitted("updateData")?.at(-1)?.[0]).not.toHaveProperty(
      "paletteDate",
    );
  });

  it("keeps source opened light dialog anchors", () => {
    const source = readFileSync(
      "src/features/itab-poem/ItabPoemOpenedPanel.vue",
      "utf8",
    );

    expect(source).toContain(
      "--sd-theme-itab-poem-poem-opened-panel-surface-01",
    );
    expect(source).toContain("allowDailyPaletteRefresh: false");
    expect(source).not.toContain("runtime.randomizePalette();");
    expect(source).toContain(
      "color: var(--sd-theme-itab-poem-poem-opened-panel-text-01)",
    );
    expect(source).toContain("font-size: 36px");
    expect(source).toContain("line-height: 54px");
    expect(source).toContain(
      'fill="var(--poem-wave-back, var(--sd-itab-poem-wave-back))"',
    );
    expect(source).toContain(
      'fill="var(--poem-wave-middle, var(--sd-itab-poem-wave-middle))"',
    );
    expect(source).toContain(
      'fill="var(--poem-wave-front, var(--sd-itab-poem-wave-front))"',
    );
    expect(source).toContain('fill-opacity="0.6"');
    expect(source).toContain("max-width: 700px");
    expect(source).toContain(
      "background: var(--sd-theme-itab-poem-poem-opened-panel-surface-04)",
    );
  });
});
