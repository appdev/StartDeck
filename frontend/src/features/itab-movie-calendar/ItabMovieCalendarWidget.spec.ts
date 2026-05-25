// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ItabMovieCalendarWidget from "./ItabMovieCalendarWidget.vue";
import { createDefaultItabMovieCalendarWidget } from "./itabMovieCalendarModel";
import { fetchItabMovieCalendar } from "./itabMovieCalendarApi";
import { resetItabMovieCalendarRuntimeForTests } from "./useItabMovieCalendarRuntime";

vi.mock("./itabMovieCalendarApi", () => ({
  fetchItabMovieCalendar: vi.fn(async () => ({
    date: "2026-05-23",
    day: "23",
    monthLabel: "5月",
    weekday: "周六",
    movieTitle: "雌雄莫辨",
    rating: "7.4",
    quote: "你不需要成为任何人，只需做你自己。",
    posterUrl: "/api/itab/movie-calendar/image/poster",
    coverUrl: "/api/itab/movie-calendar/image/cover",
    sourceUrl: "https://movie.douban.com/subject/4712730/",
    year: "2011",
    area: "英国 美国 爱尔兰",
    director: "罗德里戈·加西亚",
    intro: "电影改编自乔治·摩尔的短篇小说。",
    genres: ["剧情", "同性"],
    bgColor: "3a444c",
    textColor: "f4f7f9",
    sourceStatus: "ok",
  })),
}));

const nextTickCycle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ItabMovieCalendarWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetItabMovieCalendarRuntimeForTests();
  });

  it("renders all iTab outer sizes from the backend proxy data", async () => {
    for (const sizeKey of ["1x1", "1x2", "2x1", "2x2", "2x4"] as const) {
      const wrapper = mount(ItabMovieCalendarWidget, {
        props: {
          widget: createDefaultItabMovieCalendarWidget(),
          sizeKey,
        },
      });

      await nextTickCycle();

      expect(wrapper.attributes("data-itab-movie-calendar-size")).toBe(sizeKey);
      expect(wrapper.attributes("data-itab-movie-calendar-title")).toBe(
        "雌雄莫辨",
      );
      expect(wrapper.attributes("data-itab-movie-calendar-source-status")).toBe(
        "ok",
      );
      expect(wrapper.text()).not.toContain("红气球之旅");
      expect(wrapper.text()).toContain(sizeKey === "1x1" ? "23" : "雌雄莫辨");

      wrapper.unmount();
      resetItabMovieCalendarRuntimeForTests();
    }
  });

  it("refreshes through the runtime token contract", async () => {
    const wrapper = mount(ItabMovieCalendarWidget, {
      props: {
        widget: createDefaultItabMovieCalendarWidget(),
        sizeKey: "2x2",
        refreshToken: 0,
      },
    });

    await nextTickCycle();
    await wrapper.setProps({ refreshToken: 1 });
    await nextTickCycle();

    expect(fetchItabMovieCalendar).toHaveBeenCalledWith(
      true,
      expect.any(AbortSignal),
    );
  });
});
