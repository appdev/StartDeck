// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import ItabLiveReplica from "./ItabLiveReplica.vue";

const replicaSource = readFileSync(
  "src/features/itab-live/ItabLiveReplica.vue",
  "utf8",
);
const widgetFrameSource = readFileSync(
  "src/features/itab-live/ItabLiveWidgetFrame.vue",
  "utf8",
);
const openedShellSource = readFileSync(
  "src/features/itab-live/ItabLiveOpenedShell.vue",
  "utf8",
);
const styleSource = `${replicaSource}\n${widgetFrameSource}\n${openedShellSource}`;

class MockAudioElement {
  currentTime = 0;
  loop = false;
  preload = "";
  src = "";
  volume = 1;
  load = vi.fn();
  pause = vi.fn();
  play = vi.fn(async () => undefined);

  constructor(src = "") {
    this.src = src;
  }
}

const audioInstances: MockAudioElement[] = [];

const mockBingWallpaperEntries = Array.from({ length: 36 }, (_, index) => ({
  id: `backend-wallpaper-${index + 1}`,
  title: index === 0 ? "后端壁纸一" : `后端壁纸 ${index + 1}`,
  location: index === 0 ? "后端地点一" : `后端地点 ${index + 1}`,
  credit: index === 0 ? "Backend Credit" : "Bing",
  thumbnailUrl: `https://www.bing.com/th?id=OHR.Backend${index + 1}_ZH-CN_1920x1080.jpg&w=360&h=202`,
  downloadUrl: `https://www.bing.com/th?id=OHR.Backend${index + 1}_ZH-CN_1920x1080.jpg`,
}));

const defaultMockFetch = async (input: RequestInfo | URL) => {
  const url = String(input);

  if (url.includes("/api/itab/bing-wallpapers")) {
    const requestUrl = new URL(url, "http://localhost");
    const page = Number(requestUrl.searchParams.get("page") || "1");
    const pageSize = Number(requestUrl.searchParams.get("pageSize") || "24");
    const start = (page - 1) * pageSize;
    const entries = mockBingWallpaperEntries.slice(start, start + pageSize);
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: {
          entries,
          sourceStatus: "ok",
          updatedAt: "2026-05-26T00:00:00Z",
          count: mockBingWallpaperEntries.length,
          totalPages: Math.ceil(mockBingWallpaperEntries.length / pageSize),
          pageSize,
          currentPage: page,
        },
      }),
    } as Response;
  }

  if (url.includes("/api/ip")) {
    return {
      ok: true,
      json: async () => ({
        success: true,
        ip: "163.125.214.27",
        queryIp: "163.125.214.27",
        clientIp: "127.0.0.1",
        clientIpSource: "test",
        location: "中国 广东 深圳 中国联通",
        country: "中国",
        region: "广东",
        city: "深圳",
        isp: "中国联通",
        longitude: "114.045422",
        latitude: "22.696667",
      }),
    } as Response;
  }

  if (url.includes("/api/itab/movie-calendar")) {
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: {
          date: "2026-05-22",
          day: "22",
          monthLabel: "5月",
          weekday: "周五",
          movieTitle: "波拉特",
          rating: "7.4",
          quote: "美国以其幽默感闻名于世。",
          posterUrl:
            "https://files.codelife.cc/itab/movieCalendar/p-202303231870044.webp",
          coverUrl:
            "https://files.codelife.cc/itab/movieCalendar/c-202303231870044.webp",
          sourceUrl: "https://movie.douban.com/subject/1870044/",
          year: "2006",
          area: "美国 英国",
          director: "拉里·查尔斯",
          intro: "电影用讽刺癫狂的手段展现一场文化之旅。",
          genres: ["喜剧"],
          bgColor: "4c4c3f",
          textColor: "f9f9f4",
          sourceStatus: "ok",
        },
      }),
    } as Response;
  }

  if (url.includes("api.codelife.cc/itab/todayMovie")) {
    return {
      ok: true,
      json: async () => ({
        date: "20260523",
        mov_title: "雌雄莫辨",
        mov_rating: "7.4",
        mov_text: "你不需要成为任何人，只需做你自己。",
        poster_url:
          "https://files.codelife.cc/itab/movieCalendar/p-202303234712730.webp",
        mov_pic:
          "https://files.codelife.cc/itab/movieCalendar/c-202303234712730.webp",
        mov_link: "https://movie.douban.com/subject/4712730/",
        mov_year: "2011",
        mov_area: "英国 美国 爱尔兰",
        mov_director: "罗德里戈·加西亚",
        mov_intro: "Albert Nobbs 在酒店谨慎生活，直到命运改变他的孤独世界。",
        mov_type: ["剧情", "同性"],
        color: "f9d5ad",
      }),
    } as Response;
  }

  if (url.includes("api.timelessq.com/english-sentence")) {
    return {
      ok: true,
      json: async () => ({
        errno: 0,
        errmsg: "",
        data: {
          content: "Light stretches longer, painting walls gold.",
          note: "日光拉得更长，把墙壁染成金色。",
          picture:
            "https://staticedu-wps-cache.iciba.com/image/ignored-picture.png",
          middlePicture:
            "https://staticedu-wps-cache.iciba.com/image/fa0ba1a3b8cc0bc45195b87a9e7dc82f.png",
          tts: "https://staticedu-wps-cache.iciba.com/audio/source-capture.mp3",
          date: "2026-05-20",
        },
      }),
    } as Response;
  }

  if (url.includes("/yiyan/info")) {
    const requestUrl = new URL(url);
    const date = requestUrl.searchParams.get("date") || "20260523";
    const isPreviousDate = date === "20260522";
    return {
      ok: true,
      json: async () => ({
        code: 200,
        data: {
          _id: isPreviousDate ? "daily-quote-previous" : "daily-quote-current",
          date,
          author: isPreviousDate ? "海明威" : "三毛",
          content: isPreviousDate
            ? "生活总是让我们遍体鳞伤，但后来，那些受伤的地方一定会变成我们最强壮的地方。"
            : "真正的快乐，不是狂喜，亦不是苦痛，在我很主观地来说，它是细水长流。",
          from: isPreviousDate ? "小说家" : "作家",
          like: 56,
          share: 27,
          pic_url:
            "https://pics.tide.moreless.io/dailypics/lkgaHBEg12pm2js5igPS57nUzoWq?imageView2/1/w/1366/h/768/format/webp",
          thumb:
            "https://pics.tide.moreless.io/dailypics/lkgaHBEg12pm2js5igPS57nUzoWq?imageView2/1/w/1366/h/768/format/webp?imageView2/1/w/300/h/300/format/webp",
        },
      }),
    } as Response;
  }

  if (url.includes("/yiyan/like")) {
    return {
      ok: true,
      json: async () => ({
        code: 200,
        data: {
          like: 57,
        },
      }),
    } as Response;
  }

  if (url.includes("/yiyan/share")) {
    return {
      ok: true,
      json: async () => ({
        code: 200,
        data: {
          share: 28,
        },
      }),
    } as Response;
  }

  if (url.includes("/api/itab/poem")) {
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: {
          sentence: "此生飘荡何时歇？",
          poemTitle: "醉落魄 · 离京口作",
          author: "苏轼",
          dynasty: "宋",
          fullText: ["此生飘荡何时歇？"],
          translation: [],
          annotations: [],
          preface: [],
          sourceStatus: "ok",
        },
      }),
    } as Response;
  }

  if (url.includes("jinrishici")) {
    return {
      ok: true,
      json: async () => ({
        data: {
          content: "此生飘荡何时歇？",
          origin: {
            title: "醉落魄 · 离京口作",
            author: "苏轼",
            dynasty: "宋",
            content: ["此生飘荡何时歇？"],
            translate: [],
          },
        },
      }),
    } as Response;
  }

  if (url.includes("/api/itab/weather/location")) {
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: {
          name: "龙华",
          id: "101280608",
          adm1: "广东省",
          adm2: "深圳",
          type: "city",
        },
      }),
    } as Response;
  }

  if (url.includes("/api/itab/weather/current")) {
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: {
          sourceStatus: "ok",
          current: {
            status: "ok",
            now: {
              cond_code: "104",
              cond_txt: "阴",
              hum: "80",
              pcpn: "0.0",
              pres: "1005",
              tmp: "27",
              wind_dir: "东南风",
              wind_sc: "3",
            },
            air_now_city: {
              qlty: "优",
              aqi: "29",
            },
            sun: {
              rise: "05:40",
              set: "19:02",
            },
            daily_forecast: [
              {
                date: "2026-05-22",
                cond_txt_d: "阴",
                cond_code_d: "104",
                wind_sc: "3",
                tmp_max: "30",
                tmp_min: "25",
              },
            ],
          },
          hourly: {
            updateTime: "2026-05-21 21:00",
            hourly: [
              {
                fxTime: "2026-05-21T22:00+08:00",
                icon: "104",
                temp: "27",
              },
            ],
          },
        },
      }),
    } as Response;
  }

  if (url.includes("/api/itab/weather/search")) {
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            name: "深圳",
            id: "101280601",
            adm1: "广东省",
            adm2: "深圳",
            type: "city",
          },
        ],
      }),
    } as Response;
  }

  if (url.includes("getLocation")) {
    return {
      ok: true,
      json: async () => ({
        code: 200,
        data: {
          name: "龙华",
          id: "101280601",
          adm1: "广东省",
          adm2: "深圳",
          type: "city",
        },
      }),
    } as Response;
  }

  if (url.includes("getWeather")) {
    return {
      ok: true,
      json: async () => ({
        code: 200,
        data: {
          status: "ok",
          now: {
            cond_code: "104",
            cond_txt: "阴",
            hum: "80",
            pcpn: "0.0",
            pres: "1005",
            tmp: "27",
            wind_dir: "东南风",
            wind_sc: "3",
          },
          air_now_city: {
            qlty: "优",
            aqi: "29",
          },
          sun: {
            rise: "05:40",
            set: "19:02",
          },
          daily_forecast: [],
        },
      }),
    } as Response;
  }

  if (url.includes("weather/24")) {
    return {
      ok: true,
      json: async () => ({
        code: 200,
        data: {
          updateTime: "2026-05-21 21:00",
          hourly: [],
        },
      }),
    } as Response;
  }

  return {
    ok: false,
    status: 404,
    json: async () => ({}),
  } as Response;
};

const mockFetch = vi.fn(defaultMockFetch);

describe("ItabLiveReplica clock replica", () => {
  let wrapper: VueWrapper | null = null;
  let pinia: Pinia;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T21:09:08+08:00"));
    window.localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
    vi.stubGlobal("fetch", mockFetch);
    vi.stubGlobal(
      "Audio",
      vi.fn((src?: string) => {
        const audio = new MockAudioElement(src);
        audioInstances.push(audio);
        return audio;
      }),
    );
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(
      undefined,
    );
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(
      () => undefined,
    );
    audioInstances.length = 0;
    mockFetch.mockClear();
    mockFetch.mockImplementation(defaultMockFetch);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  const mountReplica = async (
    props: InstanceType<typeof ItabLiveReplica>["$props"] = {},
  ) => {
    wrapper = mount(ItabLiveReplica, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
      props,
    });
    await Promise.resolve();
    await Promise.resolve();
    await nextTick();
    return wrapper;
  };

  const flushReplicaAsync = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await nextTick();
  };

  const setWidgetSize = async (selector: string, size: string) => {
    const widget = wrapper!.find(selector);
    await widget.trigger("contextmenu", {
      clientX: 240,
      clientY: 240,
    });
    await nextTick();

    const button = wrapper!
      .findAll(".layout-buttons button")
      .find((candidate) => candidate.text() === size);
    expect(button, `size button ${size}`).toBeTruthy();
    await button!.trigger("click");
    vi.advanceTimersByTime(2000);
    await nextTick();
  };

  const setClockSize = async (size: string) =>
    setWidgetSize(".widget-clock-12", size);

  const setDailyEnglishSize = async (size: string) =>
    setWidgetSize(".widget-english-14", size);

  const setDailyQuoteSize = async (size: string) =>
    setWidgetSize(".widget-daily-quote-09", size);

  const setMovieSize = async (size: string) =>
    setWidgetSize(".widget-movie-05", size);

  const setSpeedtestSize = async (size: string) =>
    setWidgetSize(".widget-speedtest-13", size);

  const setEatTodaySize = async (size: string) =>
    setWidgetSize(".widget-food-15", size);

  const setGradientSize = async (size: string) =>
    setWidgetSize(".widget-gradient-25", size);

  const setConverterSize = async (size: string) =>
    setWidgetSize(".widget-converter-34", size);

  const setIpSize = async (size: string) =>
    setWidgetSize(".widget-ip-30", size);

  const expectCssRule = (
    selector: string,
    expected: Record<string, string>,
  ) => {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(
      `${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`,
      "m",
    ).exec(styleSource);
    expect(match, selector).toBeTruthy();
    const block = match![1].replace(/\s+/g, " ");
    for (const [property, value] of Object.entries(expected)) {
      expect(block, `${selector} ${property}`).toContain(
        `${property}: ${value};`,
      );
    }
  };

  const expectSmallClockSourceFont = () => {
    expect(replicaSource).toContain(
      ".is-clock.size-1-1 .d-watch-resize,\n.is-clock.size-1-2 .d-watch-resize,\n.is-clock.size-2-1 .d-watch-resize {\n  font-size: 8px;\n}",
    );
  };

  const expectFullscreenButtonNotHidden = () => {
    expect(replicaSource).not.toMatch(
      /\.is-clock\.size-[\s\S]{0,240}\.fullsrceen-btn[\s\S]{0,120}display: none/,
    );
  };

  const expectClockGridSpan = (cols: number, rows: number) => {
    const style = wrapper!.find(".widget-clock-12").attributes("style") ?? "";
    expect(style).toMatch(new RegExp(`grid-column: [^;]+ / span ${cols};`));
    expect(style).toMatch(new RegExp(`grid-row: [^;]+ / span ${rows};`));
  };

  const expectClockSelectedStacking = () => {
    const style = wrapper!.find(".widget-clock-12").attributes("style") ?? "";
    expect(style).toContain("z-index: 5;");
  };

  const expectSpeedtestOutsideExpandedClock = () => {
    const style =
      wrapper!.find(".widget-speedtest-13").attributes("style") ?? "";
    const column = Number(/grid-column:\s*(\d+)\s*\//.exec(style)?.[1]);
    const row = Number(/grid-row:\s*(\d+)\s*\//.exec(style)?.[1]);
    expect(column).toBeGreaterThanOrEqual(1);
    expect(column).toBeLessThanOrEqual(13);
    if (row < 7) {
      expect(column).toBeGreaterThanOrEqual(5);
    }
    expect(style).not.toMatch(
      /grid-column:\s*3\s*\/\s*span\s*2;.*grid-row:\s*5\s*\/\s*span\s*2;/,
    );
  };

  it("deduplicates the initial desktop widget set", async () => {
    await mountReplica();

    expect(wrapper!.findAll(".itab-native-widget")).toHaveLength(31);
    for (const removedDuplicate of [
      ".widget-anniversary-day-08",
      ".widget-weather-19",
      ".widget-countdown-small-22",
      ".widget-hotsearch-small-23",
      ".widget-movie-28",
    ]) {
      expect(wrapper!.find(removedDuplicate).exists()).toBe(false);
    }

    const titles = wrapper!
      .findAll(".itab-native-widget .widget-title")
      .map((title) => title.text());
    const duplicateTitles = titles.filter(
      (title, index) => titles.indexOf(title) !== index,
    );
    expect(duplicateTitles).toEqual([]);
  });

  it("renders the offwork countdown with source-like five-size states", async () => {
    vi.setSystemTime(new Date("2026-05-23T13:00:00+08:00"));
    await mountReplica();

    const countdown = () => wrapper!.find(".widget-countdown-06");
    const card = () => countdown().find(".widget-card");

    expect(countdown().text()).toContain("休息时间");
    expect(countdown().text()).toContain("发薪");
    expect(countdown().text()).toContain("18");
    expect(countdown().text()).toContain("周五");
    expect(countdown().text()).toContain("5");
    expect(countdown().text()).toContain("儿童节");
    expect(countdown().text()).toContain("9");
    expect(countdown().text()).toContain("今天赚了");
    expect(countdown().text()).toContain("0.000");
    expect(countdown().text()).not.toContain("05:23:35");
    expect(card().attributes("style")).toContain("offwork.png");
    expect(card().findAll(".icon-2x4-box li")).toHaveLength(4);

    await setWidgetSize(".widget-countdown-06", "1x1");
    expect(card().find(".iconsize-1x1 .countdown-img.w-full").exists()).toBe(
      true,
    );
    expect(card().text()).toBe("");

    await setWidgetSize(".widget-countdown-06", "1x2");
    expect(card().find(".iconsize-1x2 .time").text()).toBe("休息时间");
    expect(card().find(".iconsize-1x2 .countdown-img").exists()).toBe(true);

    await setWidgetSize(".widget-countdown-06", "2x1");
    expect(card().find(".iconsize-2x1 .time").text()).toBe("休息时间");
    expect(card().find(".iconsize-2x1 .countdown-img").exists()).toBe(true);

    await setWidgetSize(".widget-countdown-06", "2x2");
    expect(card().find(".iconsize-2x2 .time").text()).toBe("休息时间");
    expect(card().find(".iconsize-2x2 .countdown-img").exists()).toBe(true);

    await setWidgetSize(".widget-countdown-06", "2x4");
    expect(card().find(".iconsize-2x4 .time").text()).toBe("休息时间");
    expect(card().findAll(".iconsize-2x4 .icon-2x4-box li")).toHaveLength(4);
  });

  it("opens the offwork countdown in the source light settings dialog with live controls", async () => {
    vi.setSystemTime(new Date("2026-05-23T13:00:00+08:00"));
    await mountReplica();

    await wrapper!.find(".widget-countdown-06").trigger("click");
    await nextTick();

    const panel = wrapper!.find(".opened-countdown-panel");
    expect(panel.exists()).toBe(true);
    expect(wrapper!.find(".opened-window.opened-countdown").exists()).toBe(
      true,
    );
    expect(wrapper!.find(".opened-generic-panel").exists()).toBe(false);
    expect(panel.find(".offwork-dialog-aside").exists()).toBe(true);
    expect(panel.find(".offwork-settings-main").exists()).toBe(true);
    expect(panel.find(".offwork-preview-card .iconsize-2x4").exists()).toBe(
      true,
    );
    expect(panel.findAll(".offwork-weekday-controls button")).toHaveLength(8);
    expect(
      panel.findAll(".offwork-settings-list input").length,
    ).toBeGreaterThanOrEqual(5);
    for (const sourceText of [
      "实时预览",
      "组件名称",
      "工作日",
      "工作时间",
      "字体颜色",
      "背景",
      "HarmonyOS",
      "显示更多",
      "发薪日",
      "距离周五",
      "下一个节日",
      "今天收入",
      "每天的收入",
      "完 成",
    ]) {
      expect(panel.text()).toContain(sourceText);
    }

    const activeWeekdays = () =>
      panel
        .findAll(".offwork-weekday-controls button.active")
        .map((button) => button.text());
    expect(activeWeekdays()).toEqual(["工作日"]);

    const saturdayButton = panel
      .findAll(".offwork-weekday-controls button")
      .find((button) => button.text() === "周六");
    expect(saturdayButton).toBeTruthy();
    await saturdayButton!.trigger("click");
    await nextTick();
    expect(activeWeekdays()).toEqual(["周六"]);

    const imageModeButton = panel
      .findAll(".offwork-background-row button")
      .find((button) => button.text() === "图片");
    expect(imageModeButton).toBeTruthy();
    await imageModeButton!.trigger("click");
    await nextTick();
    expect(panel.find(".offwork-mask-row").exists()).toBe(true);
    expect(
      panel
        .findAll(".offwork-background-row button.active")
        .map((button) => button.text()),
    ).toEqual(["图片"]);

    const previewDots = panel.findAll(".offwork-preview-dots button");
    expect(previewDots).toHaveLength(5);
    expect(previewDots.at(-1)!.classes()).toContain("active");
    await previewDots[0].trigger("click");
    await nextTick();
    expect(panel.find(".offwork-preview-icon.preview-size-1-1").exists()).toBe(
      true,
    );
    expect(
      panel
        .findAll(".offwork-preview-dots button.active")[0]
        .attributes("aria-label"),
    ).toBe("预览 1x1");

    const paydayToggle = panel
      .findAll(".offwork-more-row button")
      .find((button) => button.text() === "发薪日");
    expect(paydayToggle).toBeTruthy();
    expect(paydayToggle!.classes()).toContain("active");
    await paydayToggle!.trigger("click");
    await nextTick();
    expect(paydayToggle!.classes()).not.toContain("active");
    expect(panel.find(".offwork-payday-control").exists()).toBe(false);

    await panel.find(".offwork-submit-button").trigger("click");
    await nextTick();
    expect(wrapper!.find(".opened-countdown-panel").exists()).toBe(false);

    expectCssRule(".opened-window.opened-countdown", {
      "border-radius": "20px",
      background: "#fff",
      "box-shadow": "0 12px 32px rgba(0, 0, 0, 0.48)",
    });
    expect(styleSource).toContain(".offwork-settings-main");
    expect(styleSource).toContain("countdown/offwork.png");
  });

  it("renders the source-shaped food picker body states and opened actions", async () => {
    await mountReplica();

    const food = () => wrapper!.find(".widget-food-15");
    const foodCard = () => food().find(".widget-card");

    expect(food().find(".d-watch-resize").exists()).toBe(true);
    expect(food().find(".app-eat.d-flex-center").exists()).toBe(true);
    expect(food().find(".eat-box.ac").exists()).toBe(true);
    expect(food().find(".eat-title").text()).toBe("今天吃什么");
    expect(food().find(".eat-button").text()).toBe("开始");
    expect(foodCard().find("button").exists()).toBe(false);

    for (const size of ["1x1", "1x2", "2x1", "2x2", "2x4"]) {
      await setWidgetSize(".widget-food-15", size);
      expect(food().classes()).toContain(`size-${size.replace("x", "-")}`);
      expect(food().find(".eat-title").exists()).toBe(true);
      expect(food().find(".eat-button").exists()).toBe(true);
    }

    await wrapper!.find(".widget-food-15").trigger("click");
    await nextTick();

    const openedWindow = wrapper!.find(".opened-window.opened-eat-today");
    const openedPanel = wrapper!.find(".opened-food-panel");
    expect(openedWindow.exists()).toBe(true);
    expect(openedPanel.exists()).toBe(true);
    expect(openedPanel.find(".food-wheel").exists()).toBe(false);
    expect(openedPanel.find(".opened-food-core h2").text()).toBe("今天吃什么");
    expect(openedPanel.find(".opened-food-start").text()).toBe("开始");
    expect(
      openedPanel
        .findAll(".opened-food-actions button")
        .map((button) => button.text()),
    ).toEqual(["朋友帮我选", "菜单自己写"]);

    expectCssRule(
      ".itab-native .itab-native-widget.is-eat-today > .widget-card",
      {
        background: "#fff",
        "box-shadow": "rgba(0, 0, 0, 0.3) 0 0 10px 0",
      },
    );
    expect(styleSource).toContain(
      ".itab-native .itab-native-widget.is-eat-today.size-1-1 > .widget-card,\n.itab-native .itab-native-widget.is-eat-today.size-1-2 > .widget-card,\n.itab-native .itab-native-widget.is-eat-today.size-2-1 > .widget-card {\n  box-shadow: rgba(0, 0, 0, 0.1) 0 0 5px 0;\n}",
    );
    expectCssRule(".is-eat-today .eat-title", {
      width: "40px",
      height: "13px",
      "font-size": "8px",
      "line-height": "12px",
    });
    expectCssRule(".is-eat-today .eat-button", {
      width: "38px",
      height: "13px",
      "border-radius": "8px",
      "box-shadow": "rgb(242, 178, 65) 0 2px 6px 0",
    });
    expectCssRule(
      ".is-eat-today.size-2-2 .eat-title,\n.is-eat-today.size-2-4 .eat-title",
      {
        width: "105px",
        height: "34px",
        "font-size": "21px",
        "line-height": "31.5px",
      },
    );
    expectCssRule(
      ".is-eat-today.size-2-2 .eat-button,\n.is-eat-today.size-2-4 .eat-button",
      {
        width: "99px",
        height: "34px",
        "border-radius": "21px",
      },
    );
    expectCssRule(".opened-window.opened-eat-today", {
      width: "min(1000px, calc(100vw - 32px))",
      height: "min(602px, calc(100vh - 32px))",
      "border-radius": "20px",
      background: "rgb(255, 255, 255)",
      "box-shadow": "rgba(0, 0, 0, 0.48) 0 12px 32px 0",
      "backdrop-filter": "none",
    });
    expectCssRule(".opened-window.opened-eat-today .traffic .yellow", {
      display: "none",
    });
    expectCssRule(".opened-food-actions button", {
      width: "122px",
      height: "32px",
      "border-radius": "20px",
      "font-size": "14px",
    });
  });

  it("reacts when the food picker start controls are clicked", async () => {
    const randomSpy = vi
      .spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.16);
    await mountReplica();

    const food = () => wrapper!.find(".widget-food-15");
    const foodStart = () => food().find(".eat-button");

    await foodStart().trigger("click");
    await nextTick();

    expect(wrapper!.find(".opened-window.opened-eat-today").exists()).toBe(
      false,
    );
    expect(foodStart().text()).toBe("牛肉粉");

    vi.advanceTimersByTime(70);
    await nextTick();
    expect(foodStart().text()).toBe("砂锅粥");

    vi.advanceTimersByTime(70);
    await nextTick();
    expect(foodStart().text()).toBe("肠粉");

    vi.advanceTimersByTime(640);
    await nextTick();

    expect(foodStart().text()).toBe("砂锅粥");
    expect(foodStart().attributes("data-eat-today-current")).toBe("砂锅粥");

    await food().trigger("click");
    await nextTick();

    const openedPanel = wrapper!.find(".opened-food-panel");
    expect(openedPanel.exists()).toBe(true);
    expect(openedPanel.find(".opened-food-core h2").text()).toBe("砂锅粥");
    expect(openedPanel.find(".opened-food-start").text()).toBe("换一个");

    randomSpy.mockReturnValueOnce(0.25).mockReturnValueOnce(0.5);
    await openedPanel.find(".opened-food-start").trigger("click");
    await nextTick();

    expect(openedPanel.find(".opened-food-core h2").text()).toBe("肠粉");
    expect(openedPanel.find(".opened-food-start").text()).toBe("选择中");

    vi.advanceTimersByTime(70);
    await nextTick();
    expect(openedPanel.find(".opened-food-core h2").text()).toBe("咖喱饭");

    vi.advanceTimersByTime(710);
    await nextTick();

    expect(openedPanel.find(".opened-food-core h2").text()).toBe("云吞面");
    expect(openedPanel.find(".opened-food-start").text()).toBe("换一个");
    expect(foodStart().text()).toBe("云吞面");
  });

  it("keeps shared widget chrome in the centralized frame shell", () => {
    expectCssRule(".itab-native .itab-native-widget > .widget-card", {
      position: "absolute",
      "border-radius": "18px",
      "box-shadow": "0 12px 26px rgba(0, 0, 0, 0.21)",
    });
    expectCssRule(".itab-native .itab-native-widget > .widget-title", {
      position: "absolute",
      "text-shadow": "0 1px 7px rgba(0, 0, 0, 0.72)",
    });
    expect(replicaSource).not.toMatch(
      /\.widget-card\s*\{\s*position:\s*absolute/,
    );
  });

  it("reuses the migrated iTab weather runtime for outer and opened states", async () => {
    await mountReplica();

    expect(replicaSource).toContain("ItabWeatherWidget");
    expect(replicaSource).toContain("ItabWeatherOpenedPanel");
    expect(replicaSource).not.toContain("const itabWeatherApiBase");

    const weatherWidget = wrapper!.find(".widget-weather-00");
    expect(weatherWidget.find("[data-itab-weather-widget]").exists()).toBe(
      true,
    );
    expect(weatherWidget.find("[data-itab-weather-size]").attributes()).toEqual(
      expect.objectContaining({
        "data-itab-weather-size": "2x2",
      }),
    );
    expect(
      weatherWidget
        .find(".weather-icon-content")
        .classes()
        .some((className) => /^weather-yin_[dn]$/.test(className)),
    ).toBe(true);

    await setWidgetSize(".widget-weather-00", "2x4");
    expect(
      wrapper!
        .find(".widget-weather-00 [data-itab-weather-size]")
        .attributes("data-itab-weather-size"),
    ).toBe("2x4");

    await wrapper!.find(".widget-weather-00").trigger("click");
    await nextTick();

    expect(wrapper!.find(".opened-weather-panel").exists()).toBe(true);
    expect(wrapper!.find(".opened-weather-panel").text()).toContain("龙华");
  });

  it("reuses the migrated iTab poem runtime for outer and opened states", async () => {
    await mountReplica();

    expect(replicaSource).toContain("ItabPoemWidget");
    expect(replicaSource).toContain("ItabPoemOpenedPanel");
    expect(replicaSource).not.toContain("const poemApiUrl");

    const poemWidget = wrapper!.find(".widget-poem-10");
    expect(poemWidget.find("[data-itab-poem-widget]").exists()).toBe(true);
    expect(poemWidget.find("[data-itab-poem-size]").attributes()).toEqual(
      expect.objectContaining({
        "data-itab-poem-size": "2x2",
      }),
    );

    await setWidgetSize(".widget-poem-10", "2x4");
    expect(
      wrapper!
        .find(".widget-poem-10 [data-itab-poem-size]")
        .attributes("data-itab-poem-size"),
    ).toBe("2x4");
    expectCssRule(".itab-native .itab-native-widget.is-poem > .widget-card", {
      "--itab-poem-card-bg": "#eee",
      background: "var(--itab-poem-card-bg)",
      color: "#333",
    });
    expectCssRule(
      ".itab-native .itab-native-widget.is-poem.size-1-1 > .widget-card",
      {
        "--itab-poem-card-bg": "rgb(9, 55, 68)",
      },
    );

    await wrapper!.find(".widget-poem-10").trigger("click");
    await nextTick();

    expect(wrapper!.find("[data-itab-poem-opened-panel]").exists()).toBe(true);
    expect(wrapper!.find("[data-itab-poem-opened-panel]").text()).toContain(
      "全文",
    );
    expectCssRule(".opened-window.opened-poem", {
      width: "min(860px, calc(100vw - 42px))",
      height: "min(552px, calc(100vh - 64px))",
      background: "#eee",
      color: "#333",
      overflow: "auto",
    });
  });

  it("renders source full-bleed SVG art for speed test and gradient widgets", async () => {
    await mountReplica();

    expect(wrapper!.find(".widget-speedtest-13 img").attributes("src")).toBe(
      "/itab-live-assets/speedtest.svg",
    );
    expect(wrapper!.find(".widget-gradient-25 img").attributes("src")).toBe(
      "/itab-live-assets/web-gradients.svg",
    );

    for (const size of ["1x1", "1x2", "2x1", "2x2", "2x4"]) {
      await setSpeedtestSize(size);
      expect(wrapper!.find(".widget-speedtest-13").classes()).toContain(
        `size-${size.replace("x", "-")}`,
      );
      expect(wrapper!.find(".widget-speedtest-13 img").exists()).toBe(true);

      await setGradientSize(size);
      expect(wrapper!.find(".widget-gradient-25").classes()).toContain(
        `size-${size.replace("x", "-")}`,
      );
      expect(wrapper!.find(".widget-gradient-25 img").exists()).toBe(true);
    }

    expect(wrapper!.find(".widget-gradient-25").attributes("style")).toMatch(
      /grid-column:\s*11\s*\/\s*span 4;/,
    );

    expectCssRule(
      ".itab-native .itab-native-widget.is-speed-test > .widget-card",
      {
        display: "block",
        background: "rgb(28, 33, 50)",
      },
    );
    expectCssRule(
      ".itab-native .itab-native-widget.is-speed-test > .widget-card img,\n.itab-native .itab-native-widget.is-gradient > .widget-card img",
      {
        width: "100%",
        height: "100%",
        "object-fit": "contain",
      },
    );
    expectCssRule(
      ".itab-native .itab-native-widget.is-speed-test > .widget-card img",
      {
        "background-color": "rgb(28, 33, 50)",
      },
    );
    expectCssRule(
      ".itab-native .itab-native-widget.is-gradient > .widget-card",
      {
        background: "#fff",
      },
    );
    expect(widgetFrameSource).toContain(
      ".itab-native .itab-native-widget.is-gradient > .widget-card img {\n  background-color: #fff;\n}",
    );
    expectCssRule(
      ".itab-native .itab-native-widget.is-speed-test.size-2-2 > .widget-card,\n.itab-native .itab-native-widget.is-speed-test.size-2-4 > .widget-card",
      {
        "box-shadow": "rgba(0, 0, 0, 0.3) 0 0 10px 0",
      },
    );
    expectCssRule(
      ".itab-native .itab-native-widget.is-gradient.size-1-1 > .widget-card,\n.itab-native .itab-native-widget.is-gradient.size-1-2 > .widget-card,\n.itab-native .itab-native-widget.is-gradient.size-2-1 > .widget-card,\n.itab-native .itab-native-widget.is-gradient.size-2-4 > .widget-card",
      {
        "box-shadow": "rgba(0, 0, 0, 0.1) 0 0 5px 0",
      },
    );
  });

  it("renders eat-today source outer sizes and opened source panel", async () => {
    await mountReplica();

    const foodWidget = () => wrapper!.find(".widget-food-15");

    expect(foodWidget().text()).toContain("今天吃什么");
    expect(foodWidget().text()).toContain("开始");
    expect(foodWidget().find(".eat-title").exists()).toBe(true);
    expect(foodWidget().find(".eat-button").exists()).toBe(true);

    for (const size of ["1x1", "1x2", "2x1", "2x2", "2x4"]) {
      await setEatTodaySize(size);
      expect(foodWidget().classes()).toContain(
        `size-${size.replace("x", "-")}`,
      );
      expect(foodWidget().find(".eat-title").text()).toBe("今天吃什么");
      expect(foodWidget().find(".eat-button").text()).toBe("开始");
    }

    expectCssRule(
      ".itab-native .itab-native-widget.is-eat-today > .widget-card",
      {
        display: "block",
        background: "#fff",
        "box-shadow": "rgba(0, 0, 0, 0.3) 0 0 10px 0",
      },
    );
    expectCssRule(
      ".itab-native .itab-native-widget.is-eat-today.size-1-1 > .widget-card,\n.itab-native .itab-native-widget.is-eat-today.size-1-2 > .widget-card,\n.itab-native .itab-native-widget.is-eat-today.size-2-1 > .widget-card",
      {
        "box-shadow": "rgba(0, 0, 0, 0.1) 0 0 5px 0",
      },
    );
    expectCssRule(".is-eat-today .eat-title", {
      width: "40px",
      height: "13px",
      "font-size": "8px",
      "font-weight": "700",
      "line-height": "12px",
    });
    expectCssRule(".is-eat-today .eat-button", {
      width: "38px",
      height: "13px",
      margin: "8px 0 0",
      "border-radius": "8px",
      "box-shadow": "rgb(242, 178, 65) 0 2px 6px 0",
    });
    expectCssRule(
      ".is-eat-today.size-2-2 .eat-title,\n.is-eat-today.size-2-4 .eat-title",
      {
        width: "105px",
        height: "34px",
        "font-size": "21px",
        "line-height": "31.5px",
      },
    );
    expectCssRule(
      ".is-eat-today.size-2-2 .eat-button,\n.is-eat-today.size-2-4 .eat-button",
      {
        width: "99px",
        height: "34px",
        "margin-top": "21px",
        "border-radius": "21px",
      },
    );

    await foodWidget().trigger("click");
    await nextTick();

    const openedWindow = wrapper!.find(".opened-window.opened-eat-today");
    expect(openedWindow.exists()).toBe(true);
    expect(openedWindow.attributes("style")).toContain(
      "width: min(1000px, calc(100vw - 32px));",
    );
    expect(openedWindow.attributes("style")).toContain(
      "height: min(602px, calc(100vh - 32px));",
    );
    expect(wrapper!.find(".opened-food-panel").exists()).toBe(true);
    expect(wrapper!.find(".food-wheel").exists()).toBe(false);
    expect(wrapper!.find(".opened-generic-panel").exists()).toBe(false);
    expect(wrapper!.find(".opened-food-panel").text()).toContain("今天吃什么");
    expect(wrapper!.find(".opened-food-panel").text()).toContain("开始");
    expect(wrapper!.find(".opened-food-panel").text()).toContain("朋友帮我选");
    expect(wrapper!.find(".opened-food-panel").text()).toContain("菜单自己写");

    expectCssRule(".opened-window.opened-eat-today", {
      border: "0",
      "border-radius": "20px",
      background: "rgb(255, 255, 255)",
      "box-shadow": "rgba(0, 0, 0, 0.48) 0 12px 32px 0",
      "backdrop-filter": "none",
    });
    expectCssRule(".opened-window.opened-eat-today .traffic .yellow", {
      display: "none",
    });
    expectCssRule(".opened-food-panel", {
      position: "relative",
      width: "calc(100% - 2px)",
      height: "calc(100% - 2px)",
      margin: "1px",
      background: "rgb(255, 255, 255)",
    });
    expectCssRule(".opened-food-start", {
      width: "122px",
      height: "42px",
      "border-radius": "21px",
      "box-shadow": "rgb(242, 178, 65) 0 2px 6px 0",
    });
    expectCssRule(".opened-food-actions", {
      right: "100px",
      bottom: "49px",
      left: "100px",
      "justify-content": "space-between",
    });
  });

  it("renders converter source-sized outer states", async () => {
    await mountReplica();

    const converter = () => wrapper!.find(".widget-converter-34");

    expect(converter().find(".converter-card-size-2-2").exists()).toBe(true);
    expect(converter().findAll(".converter-tool-tile")).toHaveLength(4);
    expect(converter().findAll(".converter-card-content svg")).toHaveLength(6);
    expect(converter().text()).toContain("个人所得税");
    expect(converter().text()).toContain("长度单位");

    await setConverterSize("1x1");
    expect(converter().classes()).toContain("size-1-1");
    expect(converter().find(".converter-card-size-1-1").exists()).toBe(true);
    expect(converter().find(".converter-icon-img").attributes("src")).toBe(
      "https://go.itab.link/assets/x-icon-qPAB74ev.png",
    );
    expect(converter().findAll(".converter-tool-tile")).toHaveLength(0);

    await setConverterSize("1x2");
    expect(converter().classes()).toContain("size-1-2");
    expect(converter().find(".converter-compact-title").text()).toBe("换算器");
    expect(converter().find(".converter-compact-sub").text()).toBe("快捷转换");
    expect(converter().find(".converter-icon-img").exists()).toBe(true);

    await setConverterSize("2x1");
    expect(converter().classes()).toContain("size-2-1");
    expect(converter().find(".converter-vertical-title").text()).toBe("换算器");
    expect(converter().find(".converter-icon-img").exists()).toBe(true);

    await setConverterSize("2x4");
    expect(converter().classes()).toContain("size-2-4");
    expect(converter().find(".converter-card-size-2-4").exists()).toBe(true);
    expect(converter().findAll(".converter-tool-tile")).toHaveLength(10);
    expect(converter().findAll(".converter-card-content svg")).toHaveLength(12);
    expect(converter().text()).toContain("质量单位");
    expectCssRule(
      ".itab-native .itab-native-widget.is-converter > .widget-card",
      {
        background:
          '#000 url("https://go.itab.link/assets/bg-CJNxJb1Y.jpg") center/cover no-repeat',
      },
    );
  });

  it("renders converter source opened shell and calculator interaction", async () => {
    await mountReplica();

    await wrapper!.find(".widget-converter-34").trigger("click");
    await nextTick();

    const openedWindow = wrapper!.find(".opened-window.opened-converter");
    expect(openedWindow.exists()).toBe(true);
    expect(openedWindow.attributes("style")).toContain(
      "width: min(800px, calc(100vw - 32px));",
    );
    expect(openedWindow.attributes("style")).toContain(
      "height: min(538px, calc(100vh - 32px));",
    );
    expect(wrapper!.find(".opened-converter-panel").exists()).toBe(true);
    const navItems = () => wrapper!.findAll(".opened-converter-nav .tab-item");
    expect(navItems()).toHaveLength(21);
    expect(
      wrapper!.find(".opened-converter-nav .tab-item.active").text(),
    ).toContain("计算器");
    expect(wrapper!.find(".opened-generic-panel").exists()).toBe(false);

    const display = () => {
      const input = wrapper!.find<HTMLInputElement>(
        ".converter-calculator-display",
      );
      return input.exists()
        ? input.element.value
        : wrapper!.find(".converter-calculator-result-text").text();
    };
    const expression = () =>
      wrapper!.find(".converter-calculator-expression-row").text();
    const calculatorButtons = () =>
      wrapper!.findAll(".converter-calculator-grid button");
    const calculatorButton = (label: string) =>
      calculatorButtons().find(
        (candidate) =>
          candidate.text() === label ||
          candidate.attributes("aria-label") === label,
      );
    expect(display()).toBe("0");
    expect(calculatorButtons()).toHaveLength(20);
    expect(
      calculatorButtons().map((button) => button.attributes("aria-label")),
    ).toEqual([
      "()",
      "%",
      "退格",
      "加",
      "7",
      "8",
      "9",
      "减",
      "4",
      "5",
      "6",
      "乘",
      "1",
      "2",
      "3",
      "除",
      "大写",
      "0",
      ".",
      "等于",
    ]);

    for (const label of ["7", "+", "8", "="]) {
      const button = calculatorButton(label);
      expect(button, `calculator key ${label}`).toBeTruthy();
      await button!.trigger("click");
      await nextTick();
    }
    expect(display()).toBe("15");
    expect(expression()).toBe("7+8");
    expect(calculatorButton("AC")).toBeTruthy();

    await calculatorButton("AC")!.trigger("click");
    await nextTick();
    expect(display()).toBe("");
    expect(expression()).toBe("");

    for (const label of ["(", "1", "+", "2", ")", "×", "3", "="]) {
      const keyLabel = label === "(" || label === ")" ? "()" : label;
      const button = calculatorButton(keyLabel);
      expect(button, `calculator key ${label}`).toBeTruthy();
      await button!.trigger("click");
      await nextTick();
    }
    expect(expression()).toBe("(1+2)×3");
    expect(display()).toBe("9");

    await calculatorButton("AC")!.trigger("click");
    await nextTick();
    for (const label of ["5", "0", "%"]) {
      await calculatorButton(label)!.trigger("click");
      await nextTick();
    }
    expect(display()).toBe("50%");

    await calculatorButton("退格")!.trigger("click");
    await calculatorButton("退格")!.trigger("click");
    await calculatorButton("退格")!.trigger("click");
    await nextTick();
    expect(display()).toBe("");

    for (const label of ["8", "÷", "0", "="]) {
      await calculatorButton(label)!.trigger("click");
      await nextTick();
    }
    expect(expression()).toBe("8÷0");
    expect(display()).toBe("Error");

    await calculatorButton("AC")!.trigger("click");
    await nextTick();
    for (const label of ["1", "2", "3", "大写"]) {
      await calculatorButton(label)!.trigger("click");
      await nextTick();
    }
    expect(expression()).toBe("");
    expect(display()).toBe("壹佰贰拾叁");

    const lengthButton = wrapper!
      .findAll(".opened-converter-nav .tab-item")
      .find((candidate) => candidate.text().includes("长度单位"));
    expect(lengthButton).toBeTruthy();
    await lengthButton!.trigger("click");
    await nextTick();

    expect(
      wrapper!.find(".opened-converter-nav .tab-item.active").text(),
    ).toContain("长度单位");
    expect(wrapper!.find(".converter-source-unit").exists()).toBe(true);

    const converterInput = () =>
      wrapper!.find<HTMLInputElement>('input[aria-label="换算器输入值"]');
    const converterSecondaryInput = () =>
      wrapper!.find<HTMLInputElement>('input[aria-label="换算器辅助输入"]');
    const converterOutput = () =>
      wrapper!.find<HTMLInputElement>('input[aria-label="换算器转换结果"]')
        .element.value;

    await converterInput().setValue("12");
    await nextTick();
    expect(
      wrapper!.find(".converter-source-unit .detail-container").text(),
    ).toContain("1200厘米 cm");
    expect(
      wrapper!.find(".converter-source-unit .detail-container").text(),
    ).toContain("12米 m");

    const currencyButton = wrapper!
      .findAll(".opened-converter-nav .tab-item")
      .find((candidate) => candidate.text().includes("货币汇率"));
    expect(currencyButton).toBeTruthy();
    await currencyButton!.trigger("click");
    await nextTick();
    await converterInput().setValue("2");
    await nextTick();
    expect(converterOutput()).toBe("14.4 人民币 CNY");

    const bmiButton = wrapper!
      .findAll(".opened-converter-nav .tab-item")
      .find((candidate) => candidate.text().includes("BMI计算"));
    expect(bmiButton).toBeTruthy();
    await bmiButton!.trigger("click");
    await nextTick();
    await converterInput().setValue("72");
    await converterSecondaryInput().setValue("180");
    await nextTick();
    expect(converterOutput()).toBe("BMI 22.22222222 正常");

    const relationshipButton = wrapper!
      .findAll(".opened-converter-nav .tab-item")
      .find((candidate) => candidate.text().includes("亲戚称呼"));
    expect(relationshipButton).toBeTruthy();
    await relationshipButton!.trigger("click");
    await nextTick();
    await converterInput().setValue("爸爸的妈妈");
    await nextTick();
    expect(converterOutput()).toBe("奶奶");

    const sourceUnitPanelLabels = new Set([
      "长度单位",
      "时间转换",
      "质量单位",
      "角度转换",
      "面积转换",
      "体积转换",
      "温度转换",
      "速度转换",
      "热能转换",
      "功率转换",
      "压强转换",
      "力转换",
    ]);

    for (const label of [
      "住房贷款",
      "个人所得税",
      "长度单位",
      "亲戚称呼",
      "货币汇率",
      "大写金额",
      "BMI计算",
      "日期计算",
      "时间转换",
      "质量单位",
      "角度转换",
      "进制转换",
      "面积转换",
      "体积转换",
      "温度转换",
      "速度转换",
      "热能转换",
      "功率转换",
      "压强转换",
      "力转换",
    ]) {
      const navButton = wrapper!
        .findAll(".opened-converter-nav .tab-item")
        .find((candidate) => candidate.text().includes(label));
      expect(navButton, `converter tool ${label}`).toBeTruthy();
      await navButton!.trigger("click");
      await nextTick();
      expect(converterInput().exists(), `input for ${label}`).toBe(true);
      if (sourceUnitPanelLabels.has(label)) {
        expect(
          wrapper!.findAll(".converter-source-unit .tax-card").length,
          `source unit cards for ${label}`,
        ).toBeGreaterThan(0);
      } else {
        expect(converterOutput(), `output for ${label}`).not.toBe("");
        expect(converterOutput(), `supported result for ${label}`).not.toBe(
          "暂未支持",
        );
      }
    }
  });

  it("binds movie calendar outer and opened states to the backend API", async () => {
    await mountReplica();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/itab/movie-calendar"),
      expect.objectContaining({
        cache: "no-store",
        credentials: "omit",
      }),
    );

    const movieWidget = wrapper!.find(".widget-movie-05");
    expect(movieWidget.text()).toContain("22");
    expect(movieWidget.text()).toContain("5月/周五");
    expect(movieWidget.text()).toContain("《波拉特》");
    expect(movieWidget.text()).toContain("豆瓣 7.4");
    expect(movieWidget.text()).toContain("美国以其幽默感闻名于世。");
    expect(movieWidget.find(".widget-card").attributes("style")).toContain(
      "c-202303231870044.webp",
    );

    await movieWidget.trigger("click");
    await nextTick();

    const panel = wrapper!.find(".opened-movie-panel");
    expect(panel.exists()).toBe(true);
    expect(panel.text()).toContain("波拉特");
    expect(panel.text()).toContain("7.4");
    expect(panel.text()).toContain("喜剧2006美国 英国");
    expect(panel.text()).toContain("导演：拉里·查尔斯");
    expect(panel.text()).toContain("“ 美国以其幽默感闻名于世。 ”");
    expect(panel.text()).toContain("电影用讽刺癫狂的手段展现一场文化之旅。");
    expect(panel.attributes("data-movie-source-status")).toBe("ok");
    expect(panel.find(".opened-movie-bg").exists()).toBe(true);
    expect(panel.find(".opened-movie-rating-star").exists()).toBe(true);
    expect(
      panel.find(".opened-movie-copy + .opened-movie-poster").exists(),
    ).toBe(true);
    const posterImages = panel.findAll(".opened-movie-poster img");
    expect(posterImages).toHaveLength(2);
    expect(posterImages[0].attributes("src")).toContain(
      "p-202303231870044.webp",
    );
    expect(panel.find(".opened-movie-source").attributes("href")).toBe(
      "https://movie.douban.com/subject/1870044/",
    );
    expect(wrapper!.find(".opened-generic-panel").exists()).toBe(false);
  });

  it("uses current source API data when the local movie calendar proxy fails", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/itab/movie-calendar")) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ success: false }),
        } as Response;
      }
      return defaultMockFetch(input);
    });

    await mountReplica();
    await flushReplicaAsync();

    const movieCalls = mockFetch.mock.calls
      .map(([input]) => String(input))
      .filter(
        (url) =>
          url.includes("/api/itab/movie-calendar") ||
          url.includes("api.codelife.cc/itab/todayMovie"),
      );
    expect(movieCalls[0]).toContain("/api/itab/movie-calendar");
    expect(movieCalls[1]).toBe(
      "https://api.codelife.cc/itab/todayMovie?version=v2",
    );

    const movieWidget = wrapper!.find(".widget-movie-05");
    expect(movieWidget.text()).toContain("23");
    expect(movieWidget.text()).toContain("5月/周六");
    expect(movieWidget.text()).toContain("《雌雄莫辨》");
    expect(movieWidget.text()).toContain("你不需要成为任何人，只需做你自己。");
    expect(movieWidget.text()).not.toContain("红气球之旅");
    expect(movieWidget.find(".widget-card").attributes("style")).toContain(
      "c-202303234712730.webp",
    );

    await movieWidget.trigger("click");
    await nextTick();

    const panel = wrapper!.find(".opened-movie-panel");
    expect(panel.exists()).toBe(true);
    expect(panel.attributes("data-movie-source-status")).toBe("direct");
    expect(panel.text()).toContain("雌雄莫辨");
    expect(panel.text()).toContain("剧情/同性2011英国 美国 爱尔兰");
    expect(panel.text()).toContain("导演：罗德里戈·加西亚");
    expect(panel.text()).toContain(
      "Albert Nobbs 在酒店谨慎生活，直到命运改变他的孤独世界。",
    );
    expect(
      panel.findAll(".opened-movie-poster img")[0].attributes("src"),
    ).toContain("p-202303234712730.webp");
    expect(panel.find(".opened-movie-source").attributes("href")).toBe(
      "https://movie.douban.com/subject/4712730/",
    );
  });

  it("shows an explicit movie calendar error state instead of stale sample data", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (
        url.includes("/api/itab/movie-calendar") ||
        url.includes("api.codelife.cc/itab/todayMovie")
      ) {
        return {
          ok: false,
          status: 500,
          json: async () => ({}),
        } as Response;
      }
      return defaultMockFetch(input);
    });

    await mountReplica();
    await flushReplicaAsync();

    const movieWidget = wrapper!.find(".widget-movie-05");
    expect(movieWidget.text()).toContain("电影日历加载失败");
    expect(movieWidget.text()).toContain("请检查电影日历接口连接");
    expect(movieWidget.text()).not.toContain("红气球之旅");
    expect(movieWidget.text()).not.toContain("波拉特");
    expect(movieWidget.find(".widget-card").attributes("style")).toContain(
      "--movie-cover-image: none",
    );

    await movieWidget.trigger("click");
    await nextTick();

    const panel = wrapper!.find(".opened-movie-panel");
    expect(panel.attributes("data-movie-source-status")).toBe("error");
    expect(panel.findAll(".opened-movie-poster img")).toHaveLength(0);
    expect(panel.text()).toContain("电影日历加载失败");
    expect(panel.text()).not.toContain("红气球之旅");
  });

  it("renders every movie calendar outer size branch with API data", async () => {
    await mountReplica();

    for (const size of ["1x1", "1x2", "2x1", "2x2", "2x4"]) {
      await setMovieSize(size);
      const normalizedSize = size.replace("x", "-");
      const movieWidget = wrapper!.find(".widget-movie-05");
      expect(movieWidget.classes()).toContain(`size-${normalizedSize}`);
      expect(movieWidget.find(`.movie-size-${normalizedSize}`).exists()).toBe(
        true,
      );
      if (size === "1x1") {
        expect(movieWidget.find(".movie-logo").text()).toBe("22");
      } else {
        expect(movieWidget.text()).toContain("波拉特");
      }
    }

    await setMovieSize("1x1");
    expect(wrapper!.find(".widget-movie-05 .movie-logo").text()).toBe("22");
    expect(wrapper!.find(".widget-movie-05 .movie-copy").exists()).toBe(false);

    await setMovieSize("1x2");
    expect(wrapper!.find(".widget-movie-05 .movie-date").exists()).toBe(false);
    expect(wrapper!.find(".widget-movie-05 .movie-inline").text()).toContain(
      "《波拉特》",
    );

    await setMovieSize("2x1");
    expect(wrapper!.find(".widget-movie-05 .movie-date").exists()).toBe(false);
    expect(
      wrapper!.find(".widget-movie-05 .movie-title-vertical").text(),
    ).toContain("波拉特");

    expectCssRule(".movie-rating", { "border-radius": "6px" });
    expectCssRule(".itab-native .itab-native-widget.is-movie > .widget-card", {
      "box-shadow": "rgba(0, 0, 0, 0.1) 0 0 5px 0",
    });
    expectCssRule(
      ".itab-native .itab-native-widget.is-movie.size-2-2 > .widget-card",
      { "box-shadow": "rgba(0, 0, 0, 0.3) 0 0 10px 0" },
    );
  });

  it("renders every source clock outer size branch", async () => {
    await mountReplica();

    await setClockSize("1x1");
    expect(wrapper!.find(".widget-clock-12").classes()).toContain("size-1-1");
    expect(wrapper!.find(".widget-clock-12 .clock-size-1-1").exists()).toBe(
      true,
    );
    expect(
      wrapper!.findAll(".widget-clock-12 .time.countdown time"),
    ).toHaveLength(2);
    expect(wrapper!.find(".widget-clock-12 .f16").exists()).toBe(false);
    expectClockGridSpan(1, 1);
    expectSmallClockSourceFont();
    expectFullscreenButtonNotHidden();
    expectCssRule(".is-clock .fullsrceen-btn", { opacity: "0.3" });
    expectCssRule(".is-clock.size-1-1 .time.countdown", {
      width: "85px",
      height: "24px",
      "justify-content": "center",
      "font-size": "24px",
      "line-height": "24px",
    });
    expectCssRule(".is-clock .time.countdown", { "font-weight": "700" });
    expectCssRule(".is-clock .time.countdown time", {
      width: "45px",
      "text-align": "left",
    });
    expectCssRule(".is-clock.size-1-1 .time.countdown time", {
      width: "auto",
    });
    expectCssRule(".is-clock.size-1-1 .time.countdown em", {
      width: "6px",
      height: "24px",
    });

    await setClockSize("1x2");
    expect(wrapper!.find(".widget-clock-12").classes()).toContain("size-1-2");
    expect(wrapper!.find(".widget-clock-12 .clock-size-1-2").exists()).toBe(
      true,
    );
    expect(
      wrapper!.findAll(".widget-clock-12 .time.countdown time"),
    ).toHaveLength(3);
    expect(wrapper!.find(".widget-clock-12 .f16").exists()).toBe(false);
    expectClockGridSpan(2, 1);
    expectSmallClockSourceFont();
    expectFullscreenButtonNotHidden();
    expectCssRule(".is-clock.size-1-2 .time.countdown", {
      width: "129px",
      height: "24px",
      "justify-content": "center",
      "font-size": "24px",
      "line-height": "24px",
    });
    expectCssRule(".is-clock.size-1-2 .time.countdown time", {
      width: "auto",
    });
    expectCssRule(".is-clock.size-1-2 .time.countdown em", {
      width: "6px",
      height: "24px",
    });

    await setClockSize("2x1");
    expect(wrapper!.find(".widget-clock-12").classes()).toContain("size-2-1");
    expect(
      wrapper!.find(".widget-clock-12 .clock-vertical-digits").exists(),
    ).toBe(true);
    expect(
      wrapper!.findAll(".widget-clock-12 .clock-vertical-digits time"),
    ).toHaveLength(2);
    expect(
      wrapper!.findAll(".widget-clock-12 .clock-vertical-digits small"),
    ).toHaveLength(2);
    expect(
      wrapper!
        .findAll(".widget-clock-12 .clock-vertical-digits small")
        .map((item) => item.text()),
    ).toEqual(["05/21", "周四"]);
    expectClockGridSpan(1, 2);
    expectSmallClockSourceFont();
    expectFullscreenButtonNotHidden();
    expectCssRule(".clock-vertical-digits", { "padding-top": "20px" });
    expectCssRule(".is-clock .clock-icon-center > .clock-vertical-digits", {
      display: "flex",
    });
    expectCssRule(".clock-vertical-time", {
      width: "28px",
      height: "90px",
      "font-family": "cursive",
      "font-style": "normal",
    });
    expectCssRule(".clock-vertical-digits time", {
      width: "28px",
      height: "45px",
      "font-size": "30px",
      "font-weight": "400",
      "line-height": "45px",
    });
    expectCssRule(".clock-vertical-date", { width: "33px", height: "36px" });

    await setClockSize("2x2");
    expect(wrapper!.find(".widget-clock-12").classes()).toContain("size-2-2");
    expect(wrapper!.find(".widget-clock-12 .clock-size-2-2").exists()).toBe(
      true,
    );
    expect(wrapper!.find(".widget-clock-12 .clock-large-stack").exists()).toBe(
      true,
    );
    expect(
      wrapper!.findAll(".widget-clock-12 .time.countdown time"),
    ).toHaveLength(2);
    expect(wrapper!.find(".widget-clock-12 .f16").text()).toBe("05/21 周四");
    expectClockGridSpan(2, 2);
    expectFullscreenButtonNotHidden();
    expectCssRule(".is-clock .d-watch-resize", { "font-size": "21px" });
    expectCssRule(".clock-large-stack", { width: "108px", height: "70px" });
    expectCssRule(".clock-large-stack .time.countdown", {
      width: "101px",
      height: "44.1px",
    });
    expectCssRule(".is-clock .time.countdown", {
      "font-size": "44.1px",
      "font-weight": "700",
      "line-height": "44.1px",
    });
    expectCssRule(".is-clock .time.countdown em", {
      width: "11px",
      height: "44.1px",
    });
    expectCssRule(".clock-large-stack .f16", {
      width: "108px",
      height: "24px",
    });
    expectCssRule(".is-clock .f16", {
      "font-size": "16px",
      "line-height": "24px",
    });

    await setClockSize("2x4");
    expect(wrapper!.find(".widget-clock-12").classes()).toContain("size-2-4");
    expect(wrapper!.find(".widget-clock-12 .clock-size-2-4").exists()).toBe(
      true,
    );
    expect(
      wrapper!.findAll(".widget-clock-12 .time.countdown time"),
    ).toHaveLength(3);
    expect(wrapper!.find(".widget-clock-12 .f16").text()).toBe("05/21 周四");
    expectClockGridSpan(4, 2);
    expectClockSelectedStacking();
    expectSpeedtestOutsideExpandedClock();
    expectFullscreenButtonNotHidden();
    expectCssRule(".is-clock.size-2-4 .clock-large-stack", {
      width: "202px",
      height: "79px",
    });
    expectCssRule(".is-clock.size-2-4 .time.countdown", {
      width: "202px",
      height: "54.6px",
      "font-size": "54.6px",
      "line-height": "54.6px",
    });
    expectCssRule(".is-clock.size-2-4 .time.countdown time", {
      width: "58px",
    });
    expectCssRule(".is-clock.size-2-4 .time.countdown em", {
      width: "14px",
      height: "54.6px",
    });
    expectCssRule(".is-clock.size-2-4 .f16", { width: "202px" });
  });

  it("renders daily quote from the live source API contract", async () => {
    vi.setSystemTime(new Date("2026-05-23T21:09:08+08:00"));
    await mountReplica();
    await flushReplicaAsync();

    expect(
      mockFetch.mock.calls.some(([input]) =>
        String(input).includes("https://base.itab.link/yiyan/info"),
      ),
    ).toBe(true);

    const quoteWidget = () => wrapper!.find(".widget-daily-quote-09");
    const quoteCard = () => quoteWidget().find(".daily-quote-card");

    expect(quoteWidget().exists()).toBe(true);
    expect(quoteWidget().classes()).toContain("size-2-2");
    expect(quoteCard().attributes("data-daily-quote-api")).toBe(
      "https://base.itab.link/yiyan/info",
    );
    expect(quoteCard().attributes("data-daily-quote-source-status")).toBe(
      "direct",
    );
    expect(quoteCard().attributes("data-daily-quote-date")).toBe("20260523");
    expect(quoteCard().attributes("style")).toContain("lkgaHBEg12pm2js5igPS57");
    expect(quoteWidget().find(".daily-quote-title").text()).toBe("每日一言");
    expect(quoteWidget().text()).toContain("真正的快乐");
    expect(quoteWidget().text()).not.toContain("维克多·弗兰克尔");

    await setDailyQuoteSize("1x1");
    expect(quoteWidget().classes()).toContain("size-1-1");
    expect(quoteWidget().find(".daily-quote-icon").attributes("src")).toBe(
      "/itab-live-assets/yiyan.svg",
    );
    expect(
      quoteWidget().find(".daily-quote-icon").attributes("data-source-src"),
    ).toBe("https://files.codelife.cc/icons/yiyan.svg");
    expect(quoteWidget().find(".daily-quote-wrap").exists()).toBe(false);

    await setDailyQuoteSize("1x2");
    expect(quoteWidget().classes()).toContain("size-1-2");
    expect(quoteWidget().find(".daily-quote-title").exists()).toBe(false);
    expect(quoteWidget().text()).toContain("真正的快乐");

    await setDailyQuoteSize("2x1");
    expect(quoteWidget().classes()).toContain("size-2-1");
    expect(quoteWidget().find(".daily-quote-title").exists()).toBe(false);
    expect(quoteWidget().text()).toContain("真正的快乐");

    await setDailyQuoteSize("2x2");
    expect(quoteWidget().classes()).toContain("size-2-2");
    expect(quoteWidget().find(".daily-quote-title").text()).toBe("每日一言");

    await setDailyQuoteSize("2x4");
    expect(quoteWidget().classes()).toContain("size-2-4");
    expect(quoteWidget().find(".daily-quote-text em").text()).toBe(
      "作家，三毛",
    );

    expectCssRule(
      ".itab-native .itab-native-widget.is-daily-quote > .widget-card",
      {
        background: "transparent",
        "box-shadow": "rgba(0, 0, 0, 0.1) 0 0 5px 0",
      },
    );
    expectCssRule(
      ".itab-native .itab-native-widget.is-daily-quote.size-2-2 > .widget-card,\n.itab-native .itab-native-widget.is-daily-quote.size-2-4 > .widget-card",
      {
        "box-shadow": "rgba(0, 0, 0, 0.3) 0 0 10px 0",
      },
    );
    expectCssRule(".daily-quote-icon", {
      background: "rgb(1, 18, 17)",
      "object-fit": "contain",
    });
    expectCssRule(".daily-quote-wrap", {
      padding: "10px",
      "background-size": "cover",
    });
    expectCssRule(".daily-quote-title", {
      color: "rgba(255, 255, 255, 0.6)",
      "font-size": "12px",
      "font-weight": "700",
      "line-height": "18px",
    });
    expectCssRule(".daily-quote-text", {
      "font-size": "12.6px",
      "font-weight": "400",
      "line-height": "17.64px",
    });
    expectCssRule(
      ".daily-quote-size-1-2 .daily-quote-text,\n.daily-quote-size-2-1 .daily-quote-text",
      {
        "font-size": "11.4px",
        "line-height": "15.96px",
      },
    );
    expectCssRule(".daily-quote-size-2-1 .daily-quote-content-layer", {
      "writing-mode": "vertical-lr",
    });
    expectCssRule(".daily-quote-size-2-4 .daily-quote-text", {
      "font-size": "14px",
      "line-height": "19.6px",
    });
    expectCssRule(".daily-quote-text em", {
      "font-size": "12px",
      "font-weight": "400",
    });
  });

  it("opens a source-shaped daily quote panel with safe native interactions", async () => {
    vi.setSystemTime(new Date("2026-05-23T21:09:08+08:00"));
    await mountReplica();
    await flushReplicaAsync();

    await wrapper!.find(".widget-daily-quote-09").trigger("click");
    await nextTick();

    const openedWindow = wrapper!.find(".opened-window.opened-daily-quote");
    const panel = wrapper!.find(".opened-daily-quote-panel");
    expect(openedWindow.exists()).toBe(true);
    expect(openedWindow.attributes("style")).toContain(
      "width: min(860px, calc(100vw - 42px));",
    );
    expect(openedWindow.attributes("style")).toContain(
      "height: min(552px, calc(100vh - 64px));",
    );
    expect(panel.exists()).toBe(true);
    expect(panel.attributes("data-daily-quote-api")).toBe(
      "https://base.itab.link/yiyan/info",
    );
    expect(panel.attributes("data-daily-quote-like-api")).toBe(
      "https://base.itab.link/yiyan/like",
    );
    expect(panel.attributes("data-daily-quote-share-api")).toBe(
      "https://base.itab.link/yiyan/share",
    );
    expect(panel.attributes("data-daily-quote-source-status")).toBe("direct");
    expect(panel.attributes("data-itab-no-iframe")).toBe("true");
    expect(wrapper!.find(".opened-generic-panel").exists()).toBe(false);
    expect(wrapper!.find(".opened-daily-quote-panel iframe").exists()).toBe(
      false,
    );
    expect(panel.attributes("style")).toContain("lkgaHBEg12pm2js5igPS57");
    expect(panel.find(".opened-daily-quote-date").text()).toBe(
      "2026.05.23 星期六",
    );
    expect(panel.find(".opened-daily-quote-time").text()).toBe("21:09");
    expect(panel.find("blockquote").text()).toContain("真正的快乐");
    expect(panel.find(".opened-daily-quote-author").text()).toBe("作家，三毛");
    expect(panel.findAll(".opened-daily-quote-chevron")).toHaveLength(2);
    expect(panel.findAll(".opened-daily-quote-actions button")).toHaveLength(3);
    expect(
      panel
        .find('[data-itab-hotspot-id="daily-quote-fullscreen"]')
        .attributes("aria-label"),
    ).toBe("设为屏保");
    expect(panel.find(".opened-daily-quote-source").text()).toContain(
      "数据来源于",
    );
    expect(panel.find(".opened-daily-quote-source").attributes("href")).toBe(
      "https://tide.fm/",
    );
    expect(panel.find(".opened-daily-quote-source img").attributes("src")).toBe(
      "https://go.itab.link/tide.png",
    );
    expect(panel.findAll(".opened-daily-quote-actions span")).toHaveLength(0);
    expect(
      panel
        .findAll(".opened-daily-quote-actions button")
        .map((button) => button.text()),
    ).toEqual(["", "", ""]);

    const shareButton = panel
      .findAll(".opened-daily-quote-actions button")
      .find((button) => button.attributes("aria-label") === "分享每日一言");
    expect(shareButton).toBeTruthy();
    expect(shareButton!.text()).toBe("");
    await shareButton!.trigger("click");
    await flushReplicaAsync();
    expect(
      mockFetch.mock.calls.some(([input]) => {
        const url = String(input);
        return (
          url.includes("https://base.itab.link/yiyan/share") &&
          url.includes("_id=daily-quote-current")
        );
      }),
    ).toBe(true);
    expect(
      panel
        .findAll(".opened-daily-quote-actions button")
        .find((button) => button.attributes("aria-label") === "分享每日一言")!
        .classes(),
    ).toContain("is-clicking");
    expect(panel.findAll(".opened-daily-quote-actions span")).toHaveLength(0);

    const likeButton = panel
      .findAll(".opened-daily-quote-actions button")
      .find((button) => button.attributes("aria-label") === "喜欢每日一言");
    expect(likeButton).toBeTruthy();
    expect(likeButton!.text()).toBe("");
    await likeButton!.trigger("click");
    await flushReplicaAsync();
    expect(
      mockFetch.mock.calls.some(([input]) => {
        const url = String(input);
        return (
          url.includes("https://base.itab.link/yiyan/like") &&
          url.includes("_id=daily-quote-current")
        );
      }),
    ).toBe(true);
    expect(
      panel
        .findAll(".opened-daily-quote-actions button")
        .find((button) => button.attributes("aria-label") === "喜欢每日一言")!
        .attributes("aria-pressed"),
    ).toBe("true");
    expect(
      panel
        .findAll(".opened-daily-quote-actions button")
        .find((button) => button.attributes("aria-label") === "喜欢每日一言")!
        .classes(),
    ).toContain("is-clicking");
    expect(panel.findAll(".opened-daily-quote-actions span")).toHaveLength(0);

    await panel
      .find('[data-itab-hotspot-id="daily-quote-prev"]')
      .trigger("click");
    await flushReplicaAsync();
    expect(
      mockFetch.mock.calls.some(([input]) => {
        const url = String(input);
        return (
          url.includes("https://base.itab.link/yiyan/info") &&
          url.includes("date=20260522")
        );
      }),
    ).toBe(true);
    expect(panel.find(".opened-daily-quote-date").text()).toBe(
      "2026.05 星期五",
    );
    expect(panel.find(".opened-daily-quote-time").text()).toBe("22");
    expect(panel.find("blockquote").text()).toContain("生活总是");

    await panel
      .find('[data-itab-hotspot-id="daily-quote-fullscreen"]')
      .trigger("click");
    await nextTick();
    expect(panel.classes()).toContain("is-fullscreen");
    expect(panel.attributes("data-daily-quote-fullscreen")).toBe("true");
    expect(panel.findAll(".opened-daily-quote-actions button")).toHaveLength(1);
    expect(
      panel.find('[data-itab-hotspot-id="daily-quote-fullscreen"]').classes(),
    ).toContain("is-clicking");
    expect(panel.findAll(".opened-daily-quote-actions span")).toHaveLength(0);

    expect(wrapper!.find(".opened-daily-quote-panel").exists()).toBe(true);

    expectCssRule(".opened-window.opened-daily-quote", {
      width: "min(860px, calc(100vw - 42px))",
      height: "min(552px, calc(100vh - 64px))",
      "border-radius": "20px",
      "box-shadow": "rgba(0, 0, 0, 0.48) 0 12px 32px 0",
    });
    expectCssRule(".opened-daily-quote-main", {
      "padding-top": "10%",
      "text-align": "center",
    });
    expectCssRule(".opened-daily-quote-date", {
      "font-size": "15px",
      "font-weight": "700",
    });
    expectCssRule(".opened-daily-quote-time", {
      "font-size": "66px",
      "font-weight": "700",
      "line-height": "1.6",
    });
    expectCssRule(".opened-daily-quote-main blockquote", {
      "font-size": "18px",
      "font-weight": "700",
      margin: "20px 20% 0",
    });
    expectCssRule(".opened-daily-quote-author", {
      "font-size": "12px",
      "font-weight": "400",
    });
    expectCssRule(".opened-daily-quote-actions", {
      "margin-top": "100px",
      gap: "0",
    });
    expectCssRule(".opened-daily-quote-actions button", {
      width: "80px",
      height: "80px",
      opacity: "0.4",
    });
    expectCssRule(".opened-daily-quote-actions svg", {
      width: "30px",
      height: "30px",
      "margin-top": "24px",
    });
    expectCssRule(".opened-daily-quote-actions button.is-clicking", {
      animation: "daily-quote-action-pop 0.36s cubic-bezier(0.22, 1, 0.36, 1)",
    });
    expect(replicaSource).toContain("@keyframes daily-quote-action-pop");
    expect(replicaSource).toContain('from "@lucide/vue"');
    expect(replicaSource).toContain("<CopyIcon");
    expect(replicaSource).toContain("<ScanIcon");
    expect(replicaSource).toContain("<HeartIcon");
    expect(replicaSource).not.toContain("M8 7.5h9.5A2.5");
    expect(replicaSource).not.toContain("M12 20.5s-7.5");
    expectCssRule(".opened-daily-quote-source", {
      bottom: "8px",
      "font-size": "10px",
      opacity: "0.3",
    });
    expectCssRule(".opened-daily-quote-source img", {
      height: "18px",
    });
    expectCssRule(".opened-daily-quote-chevron", {
      top: "calc(50% - 40px)",
      width: "20px",
      height: "40px",
      opacity: "0.2",
    });
  });

  it("renders daily English from the observed source API contract", async () => {
    await mountReplica();
    expect(
      mockFetch.mock.calls.some(([input]) =>
        String(input).includes("https://api.timelessq.com/english-sentence"),
      ),
    ).toBe(true);
    expect(
      mockFetch.mock.calls.some(([input]) =>
        String(input).includes("english-sentence?"),
      ),
    ).toBe(false);

    await setDailyEnglishSize("1x1");
    expect(wrapper!.find(".widget-english-14").classes()).toContain("size-1-1");
    expect(
      wrapper!.find(".widget-english-14 .daily-english-icon").exists(),
    ).toBe(true);
    expect(
      wrapper!.find(".widget-english-14 .daily-english-copy").exists(),
    ).toBe(false);
    expect(
      wrapper!
        .find(".widget-english-14 .daily-english-card")
        .attributes("style"),
    ).toContain("fa0ba1a3b8cc0bc45195b87a9e7dc82f.png");
    expect(
      wrapper!
        .find(".widget-english-14 .daily-english-card")
        .attributes("data-daily-english-api"),
    ).toBe("https://api.timelessq.com/english-sentence");
    expect(
      wrapper!
        .find(".widget-english-14 .daily-english-card")
        .attributes("data-daily-english-provider"),
    ).toBe("https://api.timelessq.com");

    await setDailyEnglishSize("1x2");
    expect(wrapper!.find(".widget-english-14").classes()).toContain("size-1-2");
    expect(
      wrapper!.find(".widget-english-14 .daily-english-icon svg").exists(),
    ).toBe(true);
    expect(
      wrapper!.find(".widget-english-14 .daily-english-follow").exists(),
    ).toBe(false);
    expect(
      wrapper!.find(".widget-english-14 .daily-english-copy").exists(),
    ).toBe(false);

    await setDailyEnglishSize("2x1");
    expect(wrapper!.find(".widget-english-14").classes()).toContain("size-2-1");
    expect(
      wrapper!.find(".widget-english-14 .daily-english-icon svg").exists(),
    ).toBe(true);
    expect(
      wrapper!.find(".widget-english-14 .daily-english-follow").exists(),
    ).toBe(false);
    expect(
      wrapper!.find(".widget-english-14 .daily-english-copy").exists(),
    ).toBe(false);

    await setDailyEnglishSize("2x2");
    expect(wrapper!.find(".widget-english-14").classes()).toContain("size-2-2");
    expect(
      wrapper!.find(".widget-english-14 .daily-english-follow").text(),
    ).toContain("跟读");
    expect(
      wrapper!.find(".widget-english-14 .daily-english-copy p").text(),
    ).toBe("Light stretches longer, painting walls gold.");
    expect(
      wrapper!.find(".widget-english-14 .daily-english-copy em").text(),
    ).toBe("日光拉得更长，把墙壁染成金色。");
    expect(
      wrapper!
        .find(".widget-english-14 .daily-english-audio")
        .attributes("src"),
    ).toBe("https://staticedu-wps-cache.iciba.com/audio/source-capture.mp3");

    await setDailyEnglishSize("2x4");
    expect(wrapper!.find(".widget-english-14").classes()).toContain("size-2-4");
    expect(
      wrapper!.find(".widget-english-14 .daily-english-copy p").text(),
    ).toBe("Light stretches longer, painting walls gold.");
    expectCssRule(
      ".itab-native .itab-native-widget.is-today-english > .widget-card",
      {
        background: "#000",
        "box-shadow": "rgba(0, 0, 0, 0.3) 0 0 10px 0",
      },
    );
    expectCssRule(
      ".itab-native .itab-native-widget.is-today-english.size-1-1 > .widget-card,\n.itab-native .itab-native-widget.is-today-english.size-1-2 > .widget-card,\n.itab-native .itab-native-widget.is-today-english.size-2-1 > .widget-card",
      {
        "box-shadow": "rgba(0, 0, 0, 0.1) 0 0 5px 0",
      },
    );
    expectCssRule(".daily-english-bg", { opacity: "0.3" });
    expectCssRule(".daily-english-icon", {
      "font-size": "19px",
    });
    expectCssRule(".daily-english-icon svg", {
      width: "1.4em",
      height: "1.4em",
    });
    expectCssRule(".daily-english-follow", {
      top: "10px",
      right: "10px",
      color: "rgba(255, 255, 255, 0.5)",
      "font-size": "12px",
      "line-height": "18px",
      transform: "scale(0.84)",
    });
    expectCssRule(".daily-english-follow svg", {
      width: "12px",
      height: "12px",
    });
    expectCssRule(".daily-english-copy p", {
      "font-size": "12px",
      "line-height": "18px",
    });
    expectCssRule(
      ".daily-english-size-2-4 .daily-english-copy p,\n.daily-english-size-2-4 .daily-english-copy em",
      {
        "font-size": "14px",
        "line-height": "21px",
      },
    );
  });

  it("opens a source-shaped daily English panel and toggles the play state", async () => {
    await mountReplica();

    await wrapper!.find(".widget-english-14").trigger("click");
    await nextTick();

    expect(wrapper!.find(".opened-window.opened-today-english").exists()).toBe(
      true,
    );
    expect(wrapper!.find(".opened-english-panel").exists()).toBe(true);
    expect(wrapper!.find(".opened-media-panel").exists()).toBe(false);
    expect(
      wrapper!.find(".opened-english-panel").attributes("style"),
    ).toContain("fa0ba1a3b8cc0bc45195b87a9e7dc82f.png");
    expect(wrapper!.find(".opened-english-copy p").text()).toBe(
      "Light stretches longer, painting walls gold.",
    );
    expect(wrapper!.find(".opened-english-copy em").text()).toBe(
      "日光拉得更长，把墙壁染成金色。",
    );
    expect(wrapper!.find(".opened-english-progress").text()).toBe("00:00");
    expect(wrapper!.find(".opened-english-audio").attributes("src")).toBe(
      "https://staticedu-wps-cache.iciba.com/audio/source-capture.mp3",
    );
    expect(
      wrapper!
        .find(".opened-english-panel")
        .attributes("data-daily-english-api"),
    ).toBe("https://api.timelessq.com/english-sentence");
    expect(
      wrapper!
        .find(".opened-english-panel")
        .attributes("data-daily-english-provider"),
    ).toBe("https://api.timelessq.com");

    const playButton = wrapper!.find(".opened-english-play");
    expect(playButton.attributes("aria-pressed")).toBe("false");
    expect(
      wrapper!
        .find(".opened-english-panel")
        .attributes("data-daily-english-state"),
    ).toBe("paused");
    await playButton.trigger("click");
    await nextTick();
    expect(
      wrapper!.find(".opened-english-play").attributes("aria-pressed"),
    ).toBe("true");
    expect(
      wrapper!
        .find(".opened-english-panel")
        .attributes("data-daily-english-state"),
    ).toBe("playing");
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(window.HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();

    await playButton.trigger("click");
    await nextTick();
    expect(
      wrapper!.find(".opened-english-play").attributes("aria-pressed"),
    ).toBe("false");
    expect(
      wrapper!
        .find(".opened-english-panel")
        .attributes("data-daily-english-state"),
    ).toBe("paused");
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);

    await playButton.trigger("click");
    await nextTick();
    await wrapper!.find(".opened-english-audio").trigger("ended");
    await nextTick();
    expect(
      wrapper!.find(".opened-english-play").attributes("aria-pressed"),
    ).toBe("false");
    expect(
      wrapper!
        .find(".opened-english-panel")
        .attributes("data-daily-english-state"),
    ).toBe("paused");
    expectCssRule(".opened-window.opened-today-english", {
      width: "min(860px, calc(100vw - 42px))",
      height: "min(552px, calc(100vh - 64px))",
      "border-radius": "20px",
      "box-shadow": "rgba(0, 0, 0, 0.48) 0 12px 32px 0",
    });
    expectCssRule(".opened-english-bg", { opacity: "0.5" });
    expect(replicaSource).toContain(
      ".opened-english-shade {\n  background: rgba(0, 0, 0, 0);\n}",
    );
    expectCssRule(".opened-english-copy", {
      position: "absolute",
      top: "214px",
      transform: "translateX(-50%)",
    });
    expectCssRule(".opened-english-play", {
      position: "absolute",
      top: "300px",
      width: "32px",
      height: "32px",
      "border-radius": "50%",
      background: "rgb(51, 51, 51)",
    });
  });

  it("uses the centralized opened shell for role, aria, sizing, and click isolation", async () => {
    await mountReplica();

    await wrapper!.find(".widget-english-14").trigger("click");
    await nextTick();

    const panel = wrapper!.find(".itab-native-panel");
    expect(panel.attributes("role")).toBe("dialog");
    expect(panel.attributes("aria-modal")).toBe("true");

    const openedWindow = wrapper!.find(".opened-window.opened-today-english");
    expect(openedWindow.exists()).toBe(true);
    expect(openedWindow.attributes("style")).toContain(
      "width: min(860px, calc(100vw - 42px));",
    );
    expect(openedWindow.attributes("style")).toContain(
      "height: min(552px, calc(100vh - 64px));",
    );

    await openedWindow.trigger("click");
    await nextTick();
    expect(wrapper!.find(".opened-window.opened-today-english").exists()).toBe(
      true,
    );

    await panel.trigger("click");
    await nextTick();
    expect(wrapper!.find(".itab-native-panel").exists()).toBe(false);
  });

  it("lets caller opened shell overrides win over kind defaults", async () => {
    await mountReplica({
      openedShellOverride: {
        width: 720,
        height: 480,
        maxWidthInset: 80,
        maxHeightInset: 40,
      },
    });

    await wrapper!.find(".widget-english-14").trigger("click");
    await nextTick();

    const style =
      wrapper!
        .find(".opened-window.opened-today-english")
        .attributes("style") ?? "";
    expect(style).toContain("width: min(720px, calc(100vw - 80px));");
    expect(style).toContain("height: min(480px, calc(100vh - 40px));");
  });

  it("routes traffic and embedded close controls through the named close path", async () => {
    await mountReplica();

    await wrapper!.find(".widget-english-14").trigger("click");
    await nextTick();
    await wrapper!.find(".itab-native-panel .traffic .red").trigger("click");
    await nextTick();
    expect(wrapper!.find(".itab-native-panel").exists()).toBe(false);

    await wrapper!.find(".widget-tomato-29").trigger("click");
    await nextTick();
    expect(wrapper!.find(".opened-window.opened-tomato").exists()).toBe(true);
    await wrapper!.find(".opened-tomato-close").trigger("click");
    await nextTick();
    expect(wrapper!.find(".itab-native-panel").exists()).toBe(false);

    await wrapper!.find(".widget-clock-12").trigger("click");
    await nextTick();
    expect(wrapper!.find(".opened-window.opened-clock").exists()).toBe(true);
    expect(
      wrapper!.find(".opened-window.opened-clock > .traffic").exists(),
    ).toBe(false);
    await wrapper!.find(".opened-clock-panel .close-window").trigger("click");
    await nextTick();
    expect(wrapper!.find(".itab-native-panel").exists()).toBe(false);
  });

  it("closes widget and blank context menus after click actions", async () => {
    await mountReplica();

    await wrapper!.find(".widget-clock-12").trigger("contextmenu", {
      clientX: 240,
      clientY: 240,
    });
    await nextTick();
    expect(wrapper!.find(".widget-menu").exists()).toBe(true);

    const sizeButton = wrapper!
      .findAll(".layout-buttons button")
      .find((candidate) => candidate.text() === "1x1");
    expect(sizeButton).toBeTruthy();
    await sizeButton!.trigger("click");
    await nextTick();
    expect(wrapper!.find(".widget-menu").exists()).toBe(false);

    await wrapper!.find(".itab-native").trigger("contextmenu", {
      clientX: 200,
      clientY: 180,
    });
    await nextTick();
    expect(wrapper!.find(".blank-menu").exists()).toBe(true);

    const wallpaperButton = wrapper!
      .findAll(".blank-menu button")
      .find((candidate) => candidate.text().includes("换壁纸"));
    expect(wallpaperButton).toBeTruthy();
    await wallpaperButton!.trigger("click");
    await nextTick();
    expect(wrapper!.find(".blank-menu").exists()).toBe(false);
  });

  it("replicates the simplified Bing-only wallpaper outer sizes and opened interactions", async () => {
    await mountReplica();

    const wallpaper = () => wrapper!.find(".widget-wallpaper-16");
    const copyright = () => wallpaper().find(".wallpaper-copyright");
    const firstBackendWallpaperDescription =
      "后端壁纸一 后端地点一 © Backend Credit";

    expect(wallpaper().classes()).toContain("size-2-2");
    expect(copyright().text()).toBe(firstBackendWallpaperDescription);
    expect(wallpaper().find(".widget-card").attributes("style")).toContain(
      "OHR.Backend1",
    );

    await setWidgetSize(".widget-wallpaper-16", "1x1");
    expect(copyright().exists()).toBe(false);

    await setWidgetSize(".widget-wallpaper-16", "2x1");
    expect(copyright().exists()).toBe(false);

    for (const size of ["1x2", "2x2", "2x4"]) {
      await setWidgetSize(".widget-wallpaper-16", size);
      expect(wallpaper().classes()).toContain(`size-${size.replace("x", "-")}`);
      expect(copyright().text()).toBe(firstBackendWallpaperDescription);
    }

    await wallpaper().trigger("click");
    await nextTick();

    const panel = wrapper!.find(".opened-wallpaper-panel");
    expect(wrapper!.find(".opened-window.opened-wallpaper").exists()).toBe(
      true,
    );
    expect(panel.exists()).toBe(true);
    expect(wrapper!.find(".opened-media-panel").exists()).toBe(false);
    expect(panel.text()).toContain("壁纸库");
    expect(panel.text()).toContain("必应每日壁纸");
    expect(panel.text()).toContain("点此下载4k高清壁纸");
    expect(panel.find(".wallpaper-featured-image span").exists()).toBe(false);
    for (const removedSource of [
      "纯色",
      "官方壁纸",
      "动态壁纸",
      "Wallhaven",
      "Deepin",
      "自定义壁纸",
      "我的收藏",
    ]) {
      expect(panel.text()).not.toContain(removedSource);
    }

    expect(panel.findAll(".wallpaper-bing-grid article")).toHaveLength(12);
    expect(panel.find(".wallpaper-settings-popover").exists()).toBe(false);
    await panel.find(".wallpaper-settings-trigger").trigger("click");
    await nextTick();
    expect(panel.find(".wallpaper-settings-popover").exists()).toBe(true);
    expect(
      panel.find(".wallpaper-settings-trigger").attributes("aria-expanded"),
    ).toBe("true");

    const range = panel.find(".wallpaper-range input");
    await range.setValue("7");
    await nextTick();
    expect(panel.find(".wallpaper-range b").text()).toBe("7");

    await panel.findAll(".wallpaper-thumb")[1].trigger("click");
    await nextTick();
    expect(wrapper!.find(".wallpaper-featured-copy strong").text()).toContain(
      "后端壁纸一",
    );
    expect(
      wrapper!.find(".wallpaper-featured-copy strong").text(),
    ).not.toContain("后端壁纸 2");
    expect(copyright().text()).toBe("后端壁纸 2 后端地点 2 © Bing");
    expect(wallpaper().find(".widget-card").attributes("style")).toContain(
      "OHR.Backend2",
    );

    expect(panel.find(".wallpaper-panel-actions button").text()).toBe(
      "加载更多",
    );
    expect(
      panel.find(".wallpaper-panel-actions button").attributes("disabled"),
    ).toBeUndefined();

    Object.defineProperties(panel.element, {
      clientHeight: { value: 420, configurable: true },
      scrollHeight: { value: 1000, configurable: true },
    });
    Object.defineProperty(panel.element, "scrollTop", {
      value: 430,
      configurable: true,
      writable: true,
    });
    await panel.trigger("scroll");
    await nextTick();
    expect(panel.findAll(".wallpaper-bing-grid article")).toHaveLength(20);
    expect(panel.find(".wallpaper-panel-actions button").text()).toBe(
      "加载更多",
    );
    expect(
      panel.find(".wallpaper-panel-actions button").attributes("disabled"),
    ).toBeUndefined();

    await panel.trigger("scroll");
    await flushReplicaAsync();
    expect(panel.findAll(".wallpaper-bing-grid article")).toHaveLength(28);
    expect(panel.findAll(".wallpaper-thumb")[24].attributes("aria-label")).toBe(
      "选中 后端壁纸 25",
    );
    expect(
      mockFetch.mock.calls.some(([input]) => {
        const requestUrl = new URL(String(input), "http://localhost");
        return (
          requestUrl.pathname.endsWith("/api/itab/bing-wallpapers") &&
          requestUrl.searchParams.get("page") === "2"
        );
      }),
    ).toBe(true);

    expectCssRule(".wallpaper-copyright", {
      position: "absolute",
      bottom: "0",
      height: "40px",
      "font-weight": "400",
    });
    expectCssRule(".wallpaper-copyright-text", {
      "-webkit-line-clamp": "2",
    });
    expectCssRule(".wallpaper-panel-head", {
      display: "flex",
      gap: "28px",
    });
    expectCssRule(".wallpaper-settings-trigger", {
      top: "11px",
      right: "73px",
      width: "16px",
      height: "16px",
    });
    expectCssRule(".wallpaper-bing-grid", {
      "grid-template-columns": "repeat(4, minmax(0, 1fr))",
    });
    expectCssRule(".wallpaper-panel-actions", {
      position: "relative",
      background: "transparent",
    });
    expectCssRule(".opened-window.opened-wallpaper", {
      "border-radius": "20px",
      "box-shadow": "rgba(0, 0, 0, 0.48) 0 12px 32px 0",
    });
    expectCssRule(
      ".itab-native .itab-native-widget.is-wallpaper > .widget-card",
      {
        display: "block",
        padding: "0",
        "background-position": "center",
        "background-size": "cover",
      },
    );
  });

  it("replicates the IP lookup outer sizes and opened native query panel", async () => {
    await mountReplica();

    const ipWidget = () => wrapper!.find(".widget-ip-30");

    expect(ipWidget().find(".widget-title").text()).toBe("本机IP");
    expect(
      mockFetch.mock.calls.some(([input]) =>
        String(input).includes("/api/ip?"),
      ),
    ).toBe(true);

    for (const size of ["1x1", "1x2", "2x1"]) {
      await setIpSize(size);
      expect(ipWidget().classes()).toContain(`size-${size.replace("x", "-")}`);
      const icon = ipWidget().find(".widget-card > img");
      expect(icon.exists()).toBe(true);
      expect(icon.attributes("src")).toBe("/itab-live-assets/ip.svg");
    }

    for (const size of ["2x2", "2x4"]) {
      await setIpSize(size);
      expect(ipWidget().classes()).toContain(`size-${size.replace("x", "-")}`);
      expect(ipWidget().find(".widget-card > img").exists()).toBe(false);
      const outerCard = ipWidget().find(".ip-outer-card");
      expect(outerCard.exists()).toBe(true);
      expect(outerCard.text()).toContain("163.125.214.27");
      expect(outerCard.text()).toContain("中国-广东-深圳");
      expect(ipWidget().find(".ip-outer-title").text()).toBe("163.125.214.27");
      expect(ipWidget().find(".ip-outer-subtitle").text()).toBe(
        "中国-广东-深圳",
      );
    }

    expectCssRule(
      ".itab-native .itab-native-widget.widget-ip-30 > .widget-card",
      {
        display: "block",
        background: "transparent",
        "box-shadow": "rgba(0, 0, 0, 0.1) 0 0 5px 0",
        "backdrop-filter": "none",
      },
    );
    expectCssRule(
      ".itab-native .itab-native-widget.widget-ip-30.size-2-2 > .widget-card",
      {
        background: "rgb(60, 102, 255)",
        "box-shadow": "rgba(0, 0, 0, 0.3) 0 0 10px 0",
      },
    );
    expectCssRule(
      ".itab-native .itab-native-widget.widget-ip-30.size-2-4 > .widget-card",
      {
        background: "rgb(60, 102, 255)",
        "box-shadow": "rgba(0, 0, 0, 0.3) 0 0 10px 0",
      },
    );
    expectCssRule(
      ".itab-native .itab-native-widget.widget-ip-30 > .widget-card img",
      {
        width: "100%",
        height: "100%",
        background: "rgb(60, 102, 255)",
        "object-fit": "contain",
      },
    );
    expectCssRule(".ip-outer-card", {
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      background: "rgb(60, 102, 255)",
      "text-align": "center",
    });
    expectCssRule(".ip-outer-title", {
      "font-size": "18px",
      "font-weight": "700",
      "line-height": "24px",
      "white-space": "nowrap",
    });
    expectCssRule(".ip-outer-subtitle", {
      "font-size": "14px",
      "font-weight": "500",
      "line-height": "19px",
      "white-space": "normal",
      "word-break": "break-word",
    });
    expectCssRule(".size-2-4 .ip-outer-title", {
      "font-size": "40px",
      "line-height": "48px",
    });
    expectCssRule(".size-2-4 .ip-outer-subtitle", {
      "font-size": "17px",
      "line-height": "23px",
    });
    expectCssRule(".ip-outer-card.is-long-address .ip-outer-title", {
      "word-break": "break-all",
    });

    await setIpSize("2x2");
    await ipWidget().trigger("click");
    await nextTick();
    await Promise.resolve();
    await nextTick();

    const openedWindow = wrapper!.find(".opened-window.opened-widget-ip-30");
    expect(openedWindow.exists()).toBe(true);
    expect(openedWindow.attributes("style")).toContain(
      "width: min(1000px, calc(100vw - 42px));",
    );
    expect(openedWindow.attributes("style")).toContain(
      "height: min(602px, calc(100vh - 64px));",
    );

    expect(openedWindow.find("iframe").exists()).toBe(false);
    expect(replicaSource).not.toContain("widget.codelife.cc/ip/index.html");
    expect(replicaSource).not.toContain("<iframe");

    const panel = wrapper!.find(".opened-ip-panel");
    expect(panel.exists()).toBe(true);
    expect(panel.find(".opened-ip-tabs").exists()).toBe(false);
    expect(panel.find(".opened-ip-search").exists()).toBe(false);
    expect(replicaSource).not.toContain("opened-ip-tabs");
    expect(replicaSource).not.toContain("opened-ip-search");
    expect(panel.text()).not.toContain("IP138");
    expect(panel.text()).not.toContain("请输入ip地址");
    expect(panel.text()).toContain("本机IP地址信息");
    expect(panel.text()).toContain("解析地址：");
    expect(panel.text()).toContain("163.125.214.27");
    expect(panel.text()).toContain("归属地：");
    expect(panel.text()).toContain("中国-广东-深圳");
    expect(panel.text()).toContain("网络：");
    expect(panel.text()).toContain("中国联通");
    expect(panel.text()).toContain("经纬度：");
    expect(panel.text()).toContain("114.045422,22.696667");
    expect(panel.text()).not.toContain("刷新当前 IP");
    expect(panel.text()).not.toContain("访问地址：");
    expect(panel.text()).not.toContain("更新时间：");
    expect(wrapper!.find(".ip-card").exists()).toBe(false);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/ip?"),
      expect.objectContaining({ headers: { accept: "application/json" } }),
    );

    expectCssRule(".opened-window.opened-widget-ip-30", {
      "border-radius": "20px",
      background: "#fff",
      "box-shadow": "rgba(0, 0, 0, 0.48) 0 12px 32px 0",
      "backdrop-filter": "none",
    });
    expectCssRule(".opened-window.opened-widget-ip-30 .traffic .yellow", {
      display: "none",
    });
    expectCssRule(".opened-ip-result", {
      width: "calc(100% - 60px)",
      margin: "78px 30px 0",
    });
    expectCssRule(".opened-ip-result h2", {
      "font-size": "16px",
      "line-height": "22px",
    });
    expectCssRule(".opened-ip-result dl div", {
      "grid-template-columns": "88px minmax(0, 1fr)",
      "min-height": "24px",
    });
    expectCssRule(".opened-ip-result dt", {
      "font-weight": "400",
      "text-align": "start",
    });
    expectCssRule(".opened-ip-result dd", {
      "font-weight": "400",
    });

    await wrapper!.find(".itab-native-panel .traffic .red").trigger("click");
    await nextTick();
    expect(wrapper!.find(".itab-native-panel").exists()).toBe(false);
  });

  it("keeps opened state clearing behind the named close handler", () => {
    expect(replicaSource).toContain("const closeOpenedWidget = () =>");
    expect(
      replicaSource.match(/openedWidgetId(?:\.value)?\s*=\s*['"]['"]/g),
    ).toHaveLength(1);

    const setWidgetSizeBlock =
      /const setWidgetSize = \([\s\S]*?const setOpenedWidgetSize =/.exec(
        replicaSource,
      )?.[0];
    expect(setWidgetSizeBlock).toBeTruthy();
    expect(setWidgetSizeBlock!.indexOf("closeMenus();")).toBeLessThan(
      setWidgetSizeBlock!.indexOf("if (!widget) return;"),
    );
    expect(setWidgetSizeBlock!.indexOf("closeMenus();")).toBeLessThan(
      setWidgetSizeBlock!.indexOf("!isItabReplicaWidgetSizeSupported"),
    );
  });

  it("blurs the focused widget trigger when Escape closes an opened panel", async () => {
    await mountReplica();
    const widget = wrapper!.find(".widget-memo-04");
    const widgetElement = widget.element as HTMLElement;
    widgetElement.focus();
    expect(document.activeElement).toBe(widgetElement);

    await widget.trigger("click");
    await nextTick();
    expect(wrapper!.find(".itab-native-panel").exists()).toBe(true);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();

    expect(wrapper!.find(".itab-native-panel").exists()).toBe(false);
    expect(document.activeElement).not.toBe(widgetElement);
  });

  it("opens the flip-clock dialog and animates digit changes", async () => {
    await mountReplica();

    await wrapper!.find(".widget-clock-12").trigger("click");
    await nextTick();

    expect(wrapper!.find(".opened-window.opened-clock").exists()).toBe(true);
    expect(wrapper!.find(".opened-clock-panel").exists()).toBe(true);
    expect(wrapper!.findAll(".opened-clock-panel .flip-card")).toHaveLength(6);
    expect(
      wrapper!.findAll(".opened-clock-panel .scoreboard-digit"),
    ).toHaveLength(6);
    expect(
      wrapper!.findAll(".opened-clock-panel .flip-card__top"),
    ).toHaveLength(6);
    expect(
      wrapper!.findAll(".opened-clock-panel .flip-card__bottom"),
    ).toHaveLength(6);
    expect(
      wrapper!.findAll(".opened-clock-panel .flip-card__back"),
    ).toHaveLength(6);
    expect(
      wrapper!.findAll(".opened-clock-panel .flip-card__front"),
    ).toHaveLength(6);
    expect(
      wrapper!.findAll(".opened-clock-panel .clock-flip-separator"),
    ).toHaveLength(2);
    expect(wrapper!.findAll(".opened-clock-panel .flip-down")).toHaveLength(0);
    expect(wrapper!.findAll(".opened-clock-panel .flip-up")).toHaveLength(0);
    expect(
      wrapper!
        .findAll(".opened-clock-panel .scoreboard-value")
        .map((item) => item.text())
        .join(""),
    ).toBe("210908");
    expect(
      wrapper!.find(".opened-clock-panel .clock-sound-toggle").exists(),
    ).toBe(true);
    expect(
      wrapper!.find(".opened-clock-panel .clock-bottom-fullscreen").exists(),
    ).toBe(true);

    vi.advanceTimersByTime(1000);
    await nextTick();
    expect(
      wrapper!.findAll(".opened-clock-panel .flip-down").length,
    ).toBeGreaterThan(0);
    expect(
      wrapper!.findAll(".opened-clock-panel .flip-up").length,
    ).toBeGreaterThan(0);
    const animatedSecondOnes = wrapper!
      .findAll(".opened-clock-panel .scoreboard-digit")
      .at(5)!;
    expect(animatedSecondOnes.find(".flip-card__top span").text()).toBe("9");
    expect(animatedSecondOnes.find(".flip-card__bottom span").text()).toBe("8");
    expect(animatedSecondOnes.find(".flip-card__back span").text()).toBe("8");
    expect(animatedSecondOnes.find(".flip-card__front span").text()).toBe("9");
    expect(animatedSecondOnes.find(".flip-card__back").classes()).toContain(
      "flip-down",
    );
    expect(animatedSecondOnes.find(".flip-card__front").classes()).toContain(
      "flip-up",
    );

    vi.advanceTimersByTime(700);
    await Promise.resolve();
    await nextTick();
    expect(wrapper!.findAll(".opened-clock-panel .flip-down")).toHaveLength(0);
    expect(wrapper!.findAll(".opened-clock-panel .flip-up")).toHaveLength(0);

    const switchControl = wrapper!.find(
      ".opened-clock-panel .el-switch.el-switch--small",
    );
    expect(switchControl.exists()).toBe(true);
    expect(switchControl.classes()).toContain("is-checked");

    await switchControl.trigger("click");
    await nextTick();
    expect(
      wrapper!.find(".opened-clock-panel .el-switch").classes(),
    ).not.toContain("is-checked");
    expect(
      (
        wrapper!.find(".opened-clock-panel .el-switch__input")
          .element as HTMLInputElement
      ).checked,
    ).toBe(false);
    expect(
      wrapper!.find(".opened-clock-panel .clock-flip-row").classes(),
    ).toContain("is-seconds-hidden");
    expect(
      wrapper!.findAll(".opened-clock-panel .scoreboard-digit"),
    ).toHaveLength(4);
    expect(wrapper!.findAll(".opened-clock-panel .flip-card")).toHaveLength(4);
    expect(
      wrapper!.findAll(".opened-clock-panel .flip-card__top"),
    ).toHaveLength(4);
    expect(
      wrapper!.findAll(".opened-clock-panel .flip-card__bottom"),
    ).toHaveLength(4);
    expect(
      wrapper!.findAll(".opened-clock-panel .flip-card__back"),
    ).toHaveLength(4);
    expect(
      wrapper!.findAll(".opened-clock-panel .flip-card__front"),
    ).toHaveLength(4);
    expect(
      wrapper!.findAll(".opened-clock-panel .clock-flip-separator"),
    ).toHaveLength(1);
    expect(
      wrapper!
        .findAll(".opened-clock-panel .scoreboard-value")
        .map((item) => item.text())
        .join(""),
    ).toBe("2109");

    vi.advanceTimersByTime(1000);
    await nextTick();
    expect(
      wrapper!
        .findAll(".opened-clock-panel .scoreboard-value")
        .map((item) => item.text())
        .join(""),
    ).toBe("2109");
    expect(
      wrapper!.findAll(".opened-clock-panel .scoreboard-digit"),
    ).toHaveLength(4);
  });

  it("loads tomato ambient sound from local assets while the countdown runs", async () => {
    await mountReplica();

    await wrapper!.find(".widget-tomato-29").trigger("click");
    await nextTick();

    const tomatoPanel = wrapper!.find(".opened-tomato-body");
    expect(tomatoPanel.exists()).toBe(true);
    expect(wrapper!.find(".opened-window.opened-tomato").exists()).toBe(true);
    expect(
      wrapper!.find(".opened-tomato-body .tomato-dial-face").exists(),
    ).toBe(false);
    expect(wrapper!.find(".widget-tomato-29 .tomato-dial-face").exists()).toBe(
      false,
    );
    expect(
      wrapper!.findAll(".opened-tomato-body .tomato-dial-ring path"),
    ).toHaveLength(48);
    expect(
      wrapper!.findAll(".widget-tomato-29 .tomato-progress-ring path"),
    ).toHaveLength(48);
    expect(replicaSource).toContain("const tomatoProgressRadius = 213.005;");
    expect(replicaSource).toContain(
      "const tomatoProgressCircumference = 1338;",
    );
    expect(replicaSource).toContain("stroke-width: 18;");
    expect(replicaSource).toContain("stroke-width: 4;");
    const openedTrack = wrapper!.find(
      ".opened-tomato-body .tomato-progress-track",
    );
    const openedInitialProgress = wrapper!.find(
      ".opened-tomato-body .tomato-progress-fill",
    );
    expect(openedTrack.attributes("cx")).toBe("224.198");
    expect(openedTrack.attributes("cy")).toBe("224.772");
    expect(openedTrack.attributes("r")).toBe("213.005");
    expect(openedInitialProgress.attributes("stroke-dasharray")).toBe(
      "1338, 1338",
    );
    expect(openedInitialProgress.attributes("transform")).toBe(
      "rotate(-90 224.198 224.772)",
    );
    expect(openedInitialProgress.attributes("stroke-linecap")).toBe("butt");
    expect(tomatoPanel.attributes("data-tomato-audio-src")).toBe(
      "/itab-live-assets/tomato-audio/hailang_128.m4a",
    );
    expect(tomatoPanel.attributes("data-tomato-progress")).toBe("0.0000");
    expect(
      wrapper!
        .find(".opened-tomato-controls")
        .attributes("data-tomato-control-state"),
    ).toBe("play");
    expect(wrapper!.find(".opened-tomato-start").attributes("aria-label")).toBe(
      "开始",
    );
    expect(
      wrapper!.find(".opened-tomato-start .tomato-control-play-icon").exists(),
    ).toBe(true);
    expect(wrapper!.find(".opened-tomato-stop").exists()).toBe(false);
    expect(
      wrapper!
        .find(".widget-tomato-29 .tomato-outer-controls")
        .attributes("data-tomato-control-state"),
    ).toBe("play");
    expect(
      wrapper!.find(".widget-tomato-29 .tomato-outer-control-stop").exists(),
    ).toBe(false);
    expect(
      wrapper!
        .find(".opened-tomato-audio")
        .attributes("data-tomato-audio-icon"),
    ).toBe("sound");

    await wrapper!.find(".opened-tomato-start").trigger("click");
    await nextTick();
    await Promise.resolve();

    expect(audioInstances).toHaveLength(1);
    const audio = audioInstances[0]!;
    expect(audio.src).toBe("/itab-live-assets/tomato-audio/hailang_128.m4a");
    expect(audio.loop).toBe(true);
    expect(audio.preload).toBe("auto");
    expect(audio.load).toHaveBeenCalled();
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(wrapper!.find(".opened-window.opened-tomato").exists()).toBe(true);
    expect(
      wrapper!.find(".opened-tomato-body").attributes("data-tomato-running"),
    ).toBe("true");
    expect(
      wrapper!
        .find(".opened-tomato-controls")
        .attributes("data-tomato-control-state"),
    ).toBe("pause");
    expect(wrapper!.find(".opened-tomato-start").attributes("aria-label")).toBe(
      "暂停",
    );
    expect(
      wrapper!.find(".opened-tomato-start .tomato-control-pause-icon").exists(),
    ).toBe(true);
    expect(wrapper!.find(".opened-tomato-stop").exists()).toBe(true);
    expect(
      wrapper!
        .find(".widget-tomato-29 .tomato-outer-controls")
        .attributes("data-tomato-control-state"),
    ).toBe("pause");
    expect(
      wrapper!.find(".widget-tomato-29 .tomato-outer-control-stop").exists(),
    ).toBe(true);
    expect(
      mockFetch.mock.calls.some(([input]) =>
        String(input).includes("/itab/widget/tomato/"),
      ),
    ).toBe(false);

    vi.advanceTimersByTime(5 * 60 * 1000);
    await nextTick();

    const openedProgress = wrapper!.find(
      ".opened-tomato-body .tomato-progress-fill",
    );
    const outerProgress = wrapper!.find(
      ".widget-tomato-29 .tomato-progress-fill",
    );
    expect(
      wrapper!.find(".opened-tomato-body").attributes("data-tomato-progress"),
    ).toBe("0.2000");
    expect(
      wrapper!.find(".opened-tomato-body").attributes("data-tomato-remaining"),
    ).toBe("1200");
    expect(wrapper!.find(".tomato-dial strong").text()).toBe("20:00");
    expect(Number(openedProgress.attributes("stroke-dashoffset"))).toBeLessThan(
      Number.parseFloat(openedProgress.attributes("stroke-dasharray") || "0"),
    );
    expect(outerProgress.attributes("stroke-dashoffset")).toBe(
      openedProgress.attributes("stroke-dashoffset"),
    );

    const themeButtons = wrapper!.findAll(".opened-tomato-theme button");
    expect(themeButtons).toHaveLength(2);
    await themeButtons[1]!.trigger("click");
    await nextTick();
    await Promise.resolve();

    expect(wrapper!.find(".opened-window.opened-tomato").exists()).toBe(true);
    expect(audio.src).toBe("/itab-live-assets/tomato-audio/bonfire_128.m4a");
    expect(
      wrapper!.find(".opened-tomato-body").attributes("data-tomato-audio-src"),
    ).toBe("/itab-live-assets/tomato-audio/bonfire_128.m4a");
    expect(audio.play).toHaveBeenCalledTimes(2);

    await wrapper!.find(".opened-tomato-start").trigger("click");
    await nextTick();
    expect(wrapper!.find(".opened-window.opened-tomato").exists()).toBe(true);
    expect(
      wrapper!.find(".opened-tomato-body").attributes("data-tomato-running"),
    ).toBe("false");
    expect(wrapper!.find(".opened-tomato-start").attributes("aria-label")).toBe(
      "继续",
    );
    expect(
      wrapper!.find(".opened-tomato-start .tomato-control-play-icon").exists(),
    ).toBe(true);
    expect(
      wrapper!
        .find(".opened-tomato-controls")
        .attributes("data-tomato-control-state"),
    ).toBe("play");
    expect(wrapper!.find(".opened-tomato-stop").exists()).toBe(true);
    expect(
      wrapper!.find(".widget-tomato-29 .tomato-outer-control-stop").exists(),
    ).toBe(true);
    const pausedRemaining = wrapper!
      .find(".opened-tomato-body")
      .attributes("data-tomato-remaining");
    vi.advanceTimersByTime(1200);
    await nextTick();
    expect(
      wrapper!.find(".opened-tomato-body").attributes("data-tomato-remaining"),
    ).toBe(pausedRemaining);

    await wrapper!.find(".opened-tomato-start").trigger("click");
    await nextTick();
    await Promise.resolve();
    expect(wrapper!.find(".opened-window.opened-tomato").exists()).toBe(true);
    expect(
      wrapper!.find(".opened-tomato-body").attributes("data-tomato-running"),
    ).toBe("true");
    expect(wrapper!.find(".opened-tomato-start").attributes("aria-label")).toBe(
      "暂停",
    );
    expect(audio.play).toHaveBeenCalledTimes(3);

    await wrapper!.find(".opened-tomato-stop").trigger("click");
    await nextTick();
    expect(wrapper!.find(".opened-window.opened-tomato").exists()).toBe(true);
    expect(
      wrapper!.find(".opened-tomato-body").attributes("data-tomato-running"),
    ).toBe("false");
    expect(
      wrapper!.find(".opened-tomato-body").attributes("data-tomato-phase"),
    ).toBe("idle");
    expect(
      wrapper!.find(".opened-tomato-body").attributes("data-tomato-progress"),
    ).toBe("0.0000");
    expect(
      wrapper!.find(".opened-tomato-body").attributes("data-tomato-remaining"),
    ).toBe("1500");
    expect(wrapper!.find(".tomato-dial strong").text()).toBe("25:00");
    expect(
      wrapper!.find(".widget-tomato-29 .tomato-time-grid time").text(),
    ).toBe("25:00");
    expect(wrapper!.find(".opened-tomato-stop").exists()).toBe(false);
    expect(
      wrapper!.find(".widget-tomato-29 .tomato-outer-control-stop").exists(),
    ).toBe(false);

    const audioButton = wrapper!.find(".opened-tomato-audio");
    expect(audioButton.attributes("aria-pressed")).toBe("true");
    await audioButton.trigger("click");
    await nextTick();

    expect(wrapper!.find(".opened-window.opened-tomato").exists()).toBe(true);
    expect(wrapper!.find(".opened-tomato-audio").classes()).not.toContain(
      "active",
    );
    expect(wrapper!.find(".opened-tomato-audio").classes()).toContain("muted");
    expect(
      wrapper!
        .find(".opened-tomato-body")
        .attributes("data-tomato-audio-enabled"),
    ).toBe("false");
    expect(
      wrapper!
        .find(".opened-tomato-audio")
        .attributes("data-tomato-audio-icon"),
    ).toBe("muted");
    expect(audio.pause).toHaveBeenCalled();
  });

  it("matches tomato source outer size branches and small-state controls", async () => {
    await mountReplica();

    expect(replicaSource).not.toContain(
      "grid-template-columns: repeat(14, 57px)",
    );
    expect(replicaSource).toContain("grid-template-columns: repeat(14, 60px);");
    expect(replicaSource).toContain("grid-auto-rows: 60px;");
    expect(replicaSource).toContain("gap: 30px;");

    await setWidgetSize(".widget-tomato-29", "1x1");
    expect(wrapper!.find(".widget-tomato-29").classes()).toContain("size-1-1");
    expect(wrapper!.find(".widget-tomato-29 .tomato-time-grid").text()).toBe(
      "25:00",
    );
    expect(
      wrapper!.find(".widget-tomato-29 .tomato-progress-ring").exists(),
    ).toBe(false);
    expect(
      wrapper!.find(".widget-tomato-29 .tomato-outer-controls").exists(),
    ).toBe(true);

    await setWidgetSize(".widget-tomato-29", "1x2");
    expect(wrapper!.find(".widget-tomato-29").classes()).toContain("size-1-2");
    expect(wrapper!.find(".widget-tomato-29 .tomato-time-grid").text()).toBe(
      "25:00",
    );
    expect(
      wrapper!.find(".widget-tomato-29 .tomato-progress-ring").exists(),
    ).toBe(false);
    expect(
      wrapper!.find(".widget-tomato-29 .tomato-outer-controls").exists(),
    ).toBe(true);

    await setWidgetSize(".widget-tomato-29", "2x1");
    expect(wrapper!.find(".widget-tomato-29").classes()).toContain("size-2-1");
    expect(
      wrapper!
        .findAll(".widget-tomato-29 .tomato-time-grid time")
        .map((item) => item.text()),
    ).toEqual(["25", "00"]);
    expect(
      wrapper!.find(".widget-tomato-29 .tomato-progress-ring").exists(),
    ).toBe(false);
    expect(
      wrapper!.find(".widget-tomato-29 .tomato-outer-controls").exists(),
    ).toBe(true);
    expect(replicaSource).toContain(
      ".size-1-1 .tomato-outer-controls,\n.size-1-2 .tomato-outer-controls,\n.size-2-1 .tomato-outer-controls {\n  inset: 0;\n  display: none;\n  background-color: #000;\n  margin-top: 0;\n  transform: none;\n}",
    );
    expect(replicaSource).toContain(
      ".size-1-1:hover .tomato-outer-controls,\n.size-1-2:hover .tomato-outer-controls,\n.size-2-1:hover .tomato-outer-controls {\n  display: flex;\n}",
    );
    expectCssRule(".size-1-1 .tomato-outer-control", {
      width: "22px",
      height: "22px",
    });
    expect(replicaSource).toContain(
      ".size-2-1 .tomato-outer-controls {\n  flex-direction: column;\n}",
    );

    await setWidgetSize(".widget-tomato-29", "2x2");
    expect(wrapper!.find(".widget-tomato-29").classes()).toContain("size-2-2");
    expect(
      wrapper!.findAll(".widget-tomato-29 .tomato-progress-ring path"),
    ).toHaveLength(48);
    expect(
      wrapper!
        .find(".widget-tomato-29 .tomato-outer-controls")
        .attributes("data-tomato-control-state"),
    ).toBe("play");
    expect(
      wrapper!.find(".widget-tomato-29 .tomato-outer-control-stop").exists(),
    ).toBe(false);
    expect(wrapper!.find(".widget-tomato-29 .tomato-sound-mark").exists()).toBe(
      false,
    );
    expect(
      wrapper!
        .find(".widget-tomato-29 .tomato-control-play-icon")
        .attributes("viewBox"),
    ).toBe("0 0 512 512");

    await setWidgetSize(".widget-tomato-29", "2x4");
    expect(wrapper!.find(".widget-tomato-29").classes()).toContain("size-2-4");
    expect(
      wrapper!.find(".widget-tomato-29 .tomato-switch-btn span").text(),
    ).toBe("海浪");
    expect(
      wrapper!.findAll(".widget-tomato-29 .tomato-switch-action"),
    ).toHaveLength(2);
    expectCssRule(".tomato-switch-btn", {
      top: "50%",
      left: "46%",
      "margin-top": "-11px",
    });
    expectCssRule(".size-2-4 .tomato-progress-box", {
      width: "70%",
    });
    expect(
      wrapper!.findAll(".widget-tomato-29 .tomato-progress-ring path"),
    ).toHaveLength(48);
    expect(
      wrapper!
        .find(".widget-tomato-29 .tomato-outer-controls")
        .attributes("data-tomato-control-state"),
    ).toBe("play");
    expect(
      wrapper!.find(".widget-tomato-29 .tomato-outer-control-stop").exists(),
    ).toBe(false);
    expect(wrapper!.find(".widget-tomato-29 .tomato-sound-mark").exists()).toBe(
      false,
    );
    expectCssRule(".tomato-outer-control", {
      width: "28px",
      height: "28px",
      margin: "0 2px",
      background: "transparent",
    });

    await wrapper!
      .findAll(".widget-tomato-29 .tomato-switch-action")[1]!
      .trigger("click");
    await nextTick();
    expect(
      wrapper!.find(".widget-tomato-29 .tomato-switch-btn span").text(),
    ).toBe("篝火");

    await wrapper!
      .find(".widget-tomato-29 .tomato-outer-control-primary")
      .trigger("click");
    await nextTick();
    await Promise.resolve();

    expect(wrapper!.find(".widget-tomato-29 .tomato-time-grid").text()).toBe(
      "25:00",
    );
    expect(
      wrapper!
        .find(".widget-tomato-29 .tomato-outer-controls")
        .attributes("data-tomato-control-state"),
    ).toBe("pause");
    expect(
      wrapper!.find(".widget-tomato-29 .tomato-outer-control-stop").exists(),
    ).toBe(true);

    await wrapper!
      .find(".widget-tomato-29 .tomato-outer-control-primary")
      .trigger("click");
    await nextTick();
    expect(
      wrapper!
        .find(".widget-tomato-29 .tomato-outer-controls")
        .attributes("data-tomato-control-state"),
    ).toBe("play");
    expect(
      wrapper!.find(".widget-tomato-29 .tomato-outer-control-stop").exists(),
    ).toBe(true);
  });

  it("keeps anniversary outer sizes source-specific instead of compressing the 2x2 card", async () => {
    await mountReplica();

    await setWidgetSize(".widget-anniversary-03", "2x1");
    expect(wrapper!.find(".widget-anniversary-03").classes()).toContain(
      "size-2-1",
    );
    expect(wrapper!.find(".widget-anniversary-03").text()).toContain(
      "你在世界已经",
    );
    expect(wrapper!.find(".widget-anniversary-03").text()).toContain(
      "1997-10-1",
    );
    expect(replicaSource).toContain(
      ".size-2-1 .anniversary-icon-content:not(.is-payday) .anniversary-days small",
    );
    expect(replicaSource).toContain("top: 63px;");
    expect(replicaSource).toContain("font-size: 16px;");

    await setWidgetSize(".widget-anniversary-03", "2x4");
    const outerContent = wrapper!.find(
      ".widget-anniversary-03 .anniversary-icon-content",
    );
    expect(outerContent.classes()).toContain("with-calendar");
    expect(
      wrapper!.findAll(".widget-anniversary-03 .anniversary-outer-calendar b"),
    ).toHaveLength(7);
    expect(
      wrapper!.findAll(".widget-anniversary-03 .anniversary-outer-calendar i"),
    ).toHaveLength(42);
    expect(
      wrapper!.find(".widget-anniversary-03 .anniversary-wide-list").exists(),
    ).toBe(false);
    expect(replicaSource).toContain(".anniversary-outer-calendar");
    expect(replicaSource).toContain("left: 140px;");
    expect(replicaSource).toContain("grid-template-columns: repeat(7, 26px);");
  });

  it("keeps the anniversary editor controls aligned with the source interaction model", async () => {
    await mountReplica();

    await wrapper!.find(".widget-anniversary-03").trigger("click");
    await nextTick();

    expect(wrapper!.find(".opened-anniversary-panel").exists()).toBe(true);
    expect(replicaSource).toContain("rgb(245, 245, 245) 374px 100%");
    expect(replicaSource).toContain("padding: 9.5px 7.6px;");
    expect(replicaSource).toContain("font-size: 34.2px;");
    expect(replicaSource).toContain("line-height: 51.3px;");
    expect(replicaSource).toContain("0 0 0 3px rgb(24, 144, 255)");
    expect(replicaSource).toContain("padding: 8px 0 4px 17px;");
    expect(
      wrapper!
        .findAll(".anniversary-template-card")[0]!
        .find(".anniversary-mini-card")
        .classes(),
    ).toContain("is-template-life");
    expect(wrapper!.find(".anniversary-live-preview").classes()).toContain(
      "size-2-2",
    );
    expect(
      wrapper!
        .find(".anniversary-carousel-dots span.active")
        .attributes("aria-label"),
    ).toBe("模板 4");

    const sizeTabs = wrapper!.findAll(".anniversary-size-row button");
    await sizeTabs[1]!.trigger("click");
    await nextTick();

    expect(wrapper!.find(".anniversary-template-grid").classes()).toContain(
      "size-2-4",
    );
    expect(wrapper!.find(".anniversary-live-preview").classes()).toContain(
      "size-2-2",
    );

    const templateCards = wrapper!.findAll(".anniversary-template-card");
    await templateCards[1]!.trigger("click");
    await nextTick();

    expect(wrapper!.find(".anniversary-live-preview").classes()).toContain(
      "size-2-4",
    );
    expect(wrapper!.find(".anniversary-live-preview").text()).toMatch(
      /^发工资还有\d+$/,
    );
    expect(
      (
        wrapper!.find('input[aria-label="事件名称"]')
          .element as HTMLInputElement
      ).value,
    ).toBe("发工资还有");
    expect(wrapper!.find('button[aria-label="日期"]').text()).toBe(
      "2023-12-01",
    );
    expect(
      wrapper!
        .find(".anniversary-repeat-select .anniversary-select-trigger span")
        .text(),
    ).toBe("每月");
    expect(wrapper!.findAll(".anniversary-preview-arrow")).toHaveLength(2);

    const previewDots = wrapper!.findAll(".anniversary-carousel-dots span");
    const previewSizes = [
      "size-1-1",
      "size-1-2",
      "size-2-1",
      "size-2-2",
      "size-2-4",
    ];
    for (const [index, sizeClass] of previewSizes.entries()) {
      await previewDots[index]!.trigger("click");
      await nextTick();
      const preview = wrapper!.find(".anniversary-live-preview");
      expect(preview.classes()).toContain(sizeClass);
      expect(preview.text()).toMatch(/^发工资还有\d+$/);
    }
    expect(replicaSource).toContain(
      ".anniversary-live-preview.is-payday.size-2-4",
    );
    expect(replicaSource).toContain("--payday-number-line: 71.4px;");
    expect(replicaSource).toContain(".anniversary-mini-card.is-payday {");
    expect(replicaSource).toContain("display: block;");
    expect(replicaSource).toContain("height: 44px;");
    expect(replicaSource).toContain("width: calc(100% + 32px);");

    await wrapper!.find(".anniversary-common-trigger").trigger("click");
    await nextTick();
    expect(wrapper!.find(".anniversary-event-popover").exists()).toBe(true);
    const sourceEventNames = [
      "和她❤️相爱已经",
      "Ta的生日🎈还有",
      "宝宝👶出生已经",
      "情人节🧑🏻‍❤️‍🧑🏼还有",
      "周末还有😃",
      "周年纪念日🥂",
      "聚餐🌮",
      "还款日💰",
      "派对🎉",
      "父亲节👨",
      "母亲节👩",
      "考试✍️还有",
      "面试🤝",
      "看医生🧑‍⚕️",
    ];
    expect(
      wrapper!
        .findAll(".anniversary-event-popover > div")
        .map((item) => item.text()),
    ).toEqual(sourceEventNames);

    document.body.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true }),
    );
    await nextTick();
    expect(wrapper!.find(".anniversary-event-popover").exists()).toBe(false);

    await wrapper!.find(".anniversary-common-trigger").trigger("click");
    await nextTick();

    await wrapper!
      .findAll(".anniversary-event-popover > div")[3]!
      .trigger("click");
    await nextTick();
    expect(wrapper!.find(".anniversary-event-popover").exists()).toBe(false);
    expect(
      (
        wrapper!.find('input[aria-label="事件名称"]')
          .element as HTMLInputElement
      ).value,
    ).toBe("情人节🧑🏻‍❤️‍🧑🏼还有");
    expect(wrapper!.find('button[aria-label="日期"]').text()).toBe(
      "2023-12-01",
    );
    expect(
      wrapper!
        .find(".anniversary-repeat-select .anniversary-select-trigger span")
        .text(),
    ).toBe("每月");
    const previewAfterCommonEvent = wrapper!
      .find(".anniversary-live-preview")
      .text();
    expect(previewAfterCommonEvent).toContain("情人节🧑🏻‍❤️‍🧑🏼还有");
    expect(previewAfterCommonEvent).toContain("2023-12-01");

    await wrapper!.find('button[aria-label="日期"]').trigger("click");
    await nextTick();
    expect(document.querySelector(".anniversary-date-popper")).toBeTruthy();
    const pickerColumns = Array.from(
      document.querySelectorAll<HTMLElement>(".anniversary-picker-column"),
    );
    expect(pickerColumns).toHaveLength(3);
    expect(
      pickerColumns[0]!.querySelector("button.is-select")?.textContent,
    ).toBe("2023");
    expect(
      pickerColumns[1]!.querySelector("button.is-select")?.textContent,
    ).toBe("12");
    expect(
      pickerColumns[2]!.querySelector("button.is-select")?.textContent,
    ).toBe("01");
    expect(
      pickerColumns[2]!
        .querySelectorAll("button")[3]!
        .classList.contains("is-select"),
    ).toBe(true);

    const secondDayButton = Array.from(
      pickerColumns[2]!.querySelectorAll("button"),
    ).find((item) => item.textContent === "02");
    expect(secondDayButton).toBeTruthy();
    secondDayButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(wrapper!.find('button[aria-label="日期"]').text()).toBe("2023-12-2");
    expect(
      document
        .querySelectorAll(".anniversary-picker-column")[2]!
        .querySelector("button.is-select")?.textContent,
    ).toBe("02");
    expect(
      document
        .querySelectorAll(".anniversary-picker-column")[2]!
        .querySelectorAll("button")[3]!
        .classList.contains("is-select"),
    ).toBe(true);

    document.querySelectorAll(".anniversary-picker-column")[2]!.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: 100,
      }),
    );
    await nextTick();
    expect(wrapper!.find('button[aria-label="日期"]').text()).toBe("2023-12-3");
    expect(
      document
        .querySelectorAll(".anniversary-picker-column")[2]!
        .querySelector("button.is-select")?.textContent,
    ).toBe("03");

    await wrapper!
      .find(".anniversary-repeat-select .anniversary-select-trigger")
      .trigger("click");
    await nextTick();
    expect(document.querySelector(".anniversary-date-popper")).toBeNull();
    expect(wrapper!.find(".anniversary-repeat-popper").text()).toBe(
      "不重复每周每月每年节日",
    );

    await wrapper!
      .findAll(".anniversary-background-mode button")[1]!
      .trigger("click");
    await nextTick();
    expect(wrapper!.find(".anniversary-image-strip").exists()).toBe(true);
    expect(wrapper!.findAll(".anniversary-image-strip button")).toHaveLength(
      25,
    );
    expect(
      wrapper!.findAll(".anniversary-image-strip img")[11]!.attributes("src"),
    ).toContain("/itab-live-assets/anniversary/yiyan-12-thumb.webp");
    expect(
      wrapper!.findAll(".anniversary-image-strip img")[24]!.attributes("src"),
    ).toContain("/itab-live-assets/anniversary/yiyan-25-thumb.webp");
    expect(
      wrapper!.find(".anniversary-live-preview").attributes("style"),
    ).toContain("/itab-live-assets/anniversary/yiyan-12.webp");

    await wrapper!
      .findAll(".anniversary-image-strip button")[0]!
      .trigger("click");
    await nextTick();
    expect(
      wrapper!.find(".anniversary-live-preview").attributes("style"),
    ).toContain("/itab-live-assets/anniversary/yiyan-1.webp");
    expect(wrapper!.find(".anniversary-mask-row").exists()).toBe(true);
    expect(
      (wrapper!.find('input[aria-label="蒙版"]').element as HTMLInputElement)
        .value,
    ).toBe("0");
    expect(wrapper!.find('input[aria-label="蒙版"]').attributes("type")).toBe(
      "range",
    );
    expect(wrapper!.find(".anniversary-mask-control output").text()).toBe(
      "0 %",
    );
    await wrapper!.find('input[aria-label="蒙版"]').setValue("35");
    await nextTick();
    expect(
      wrapper!.find(".anniversary-live-preview").attributes("style"),
    ).toContain("--anniversary-mask: 0.35;");
    expect(wrapper!.find(".anniversary-mask-control output").text()).toBe(
      "35 %",
    );
    expect(wrapper!.find(".anniversary-font-select").exists()).toBe(false);
    expect(replicaSource).not.toContain("anniversaryFontDropdownOpen");
    expect(replicaSource).not.toContain("anniversaryFontOptions");
    expect(replicaSource).toContain('class="anniversary-image-panel"');
    expect(replicaSource).toContain("height: 100px;");
    expect(replicaSource).toContain("anniversary-image-strip");
    expect(replicaSource).toContain("overflow: visible;");
  });
});
