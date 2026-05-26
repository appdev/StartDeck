// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ItabMovieCalendarOpenedPanel from "./ItabMovieCalendarOpenedPanel.vue";
import { createDefaultItabMovieCalendarWidget } from "./itabMovieCalendarModel";
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

describe("ItabMovieCalendarOpenedPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetItabMovieCalendarRuntimeForTests();
  });

  it("renders the source-style opened panel from dynamic proxy data", async () => {
    const wrapper = mount(ItabMovieCalendarOpenedPanel, {
      props: { widget: createDefaultItabMovieCalendarWidget() },
    });

    await nextTickCycle();

    expect(wrapper.attributes("data-itab-movie-calendar-title")).toBe(
      "雌雄莫辨",
    );
    expect(wrapper.attributes("data-itab-movie-calendar-source-status")).toBe(
      "ok",
    );
    expect(wrapper.find(".movie-calendar-panel-rating-star").exists()).toBe(
      true,
    );
    expect(wrapper.find(".movie-calendar-panel-rating-star").text()).toBe("");
    expect(
      wrapper.find(".movie-calendar-panel-poster img").attributes("src"),
    ).toBe("/api/itab/movie-calendar/image/poster");
    expect(wrapper.text()).toContain("你不需要成为任何人，只需做你自己。");
    expect(wrapper.text()).toContain("剧情/同性 2011 英国 美国 爱尔兰");
    expect(wrapper.text()).not.toContain("红气球之旅");
    expect(
      wrapper.find(".movie-calendar-panel-source").attributes("href"),
    ).toBe("https://movie.douban.com/subject/4712730/");
  });
});
