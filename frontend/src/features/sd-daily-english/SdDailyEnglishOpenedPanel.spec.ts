// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SdDailyEnglishOpenedPanel from "./SdDailyEnglishOpenedPanel.vue";
import { createDefaultSdDailyEnglishWidget } from "./sdDailyEnglishModel";

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

describe("daily English opened panel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(
      () => undefined,
    );
  });

  it("renders the opened panel and toggles follow-reading audio", async () => {
    const wrapper = mount(SdDailyEnglishOpenedPanel, {
      props: { widget: createDefaultSdDailyEnglishWidget() },
    });

    await nextTickCycle();

    expect(wrapper.text()).toContain(
      "Light stretches longer, painting walls gold.",
    );
    expect(wrapper.text()).toContain("日光拉得更长，把墙壁染成金色。");
    expect(wrapper.attributes("data-daily-english-state")).toBe("paused");

    const playButton = wrapper.find(".opened-english-play");
    await playButton.trigger("click");
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(wrapper.attributes("data-daily-english-state")).toBe("playing");

    await playButton.trigger("click");
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    expect(wrapper.attributes("data-daily-english-state")).toBe("paused");
  });
});
