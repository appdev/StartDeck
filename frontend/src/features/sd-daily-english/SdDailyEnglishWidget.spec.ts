// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SdDailyEnglishWidget from "./SdDailyEnglishWidget.vue";
import { createDefaultSdDailyEnglishWidget } from "./sdDailyEnglishModel";
import { fetchSdDailyEnglish } from "./sdDailyEnglishApi";

vi.mock("./sdDailyEnglishApi", () => ({
  fetchSdDailyEnglish: vi.fn(async () => ({
    mode: "跟读",
    sentence: "Light stretches longer, painting walls gold.",
    translation: "日光拉得更长，把墙壁染成金色。",
    progressLabel: "00:00",
    imageUrl: "/api/today-english/media/image",
    audioUrl: "/api/today-english/media/audio",
    dateline: "2026-05-22",
    sourceStatus: "ok",
  })),
}));

const nextTickCycle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("daily English widget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the source icon-only UI for 1x1, 1x2, and 2x1 sizes", async () => {
    for (const sizeKey of ["1x1", "1x2", "2x1"] as const) {
      const wrapper = mount(SdDailyEnglishWidget, {
        props: {
          widget: createDefaultSdDailyEnglishWidget(),
          sizeKey,
        },
      });

      await nextTickCycle();

      expect(wrapper.attributes("data-sd-daily-english-size")).toBe(sizeKey);
      expect(wrapper.find(".daily-english-icon svg").exists()).toBe(true);
      expect(wrapper.find(".daily-english-copy").exists()).toBe(false);
      expect(wrapper.attributes("data-daily-english-source-status")).toBe("ok");

      wrapper.unmount();
    }
  });

  it("renders copy for larger sizes and refreshes through the runtime contract", async () => {
    const wrapper = mount(SdDailyEnglishWidget, {
      props: {
        widget: createDefaultSdDailyEnglishWidget(),
        sizeKey: "2x2",
        refreshToken: 0,
      },
    });

    await nextTickCycle();

    expect(wrapper.find(".daily-english-follow").text()).toContain("跟读");
    expect(wrapper.find(".daily-english-copy p").text()).toBe(
      "Light stretches longer, painting walls gold.",
    );
    expect(wrapper.find(".daily-english-copy em").text()).toBe(
      "日光拉得更长，把墙壁染成金色。",
    );

    await wrapper.setProps({ refreshToken: 1 });
    await nextTickCycle();

    expect(fetchSdDailyEnglish).toHaveBeenCalledWith(
      true,
      expect.any(AbortSignal),
    );
  });

  it("keeps the content area empty when the backend has no entry", async () => {
    vi.mocked(fetchSdDailyEnglish).mockRejectedValueOnce(
      new Error("cache_miss"),
    );
    const wrapper = mount(SdDailyEnglishWidget, {
      props: {
        widget: createDefaultSdDailyEnglishWidget(),
        sizeKey: "2x2",
      },
    });

    await nextTickCycle();

    expect(wrapper.attributes("data-daily-english-source-status")).toBe(
      "error",
    );
    expect(wrapper.find(".daily-english-copy").exists()).toBe(false);
    expect(wrapper.find(".daily-english-audio").exists()).toBe(false);
  });
});
