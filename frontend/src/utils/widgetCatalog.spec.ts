import { describe, expect, it, vi } from "vitest";
import {
  WIDGET_CATALOG,
  createWidgetFromCatalog,
  findExistingCatalogWidget,
  getWidgetCatalogAction,
  getWidgetCatalogItem,
} from "./widgetCatalog";
import type { WidgetConfig } from "@/types";
import {
  WIDGET_SIZE_FAMILY_TYPES,
  resolveWidgetSizeFamily,
} from "./widgetSizePresets";
import { resolveSdWidgetSize } from "@/features/sd-widgets/sdSizePresets";
import { SD_TODO_WIDGET_TYPE } from "@/features/sd-todo/sdTodoTypes";
import { SD_MEMO_WIDGET_TYPE } from "@/features/sd-memo/sdMemoTypes";
import { SD_CLOCK_WIDGET_TYPE } from "@/features/sd-clock/sdClockTypes";
import { SD_POEM_WIDGET_TYPE } from "@/features/sd-poem/sdPoemTypes";
import { SD_DAILY_ENGLISH_WIDGET_TYPE } from "@/features/sd-daily-english/sdDailyEnglishTypes";
import { SD_POMODORO_WIDGET_TYPE } from "@/features/sd-pomodoro/sdPomodoroTypes";
import { SD_ANNIVERSARY_WIDGET_TYPE } from "@/features/sd-anniversary/sdAnniversaryTypes";
import {
  SD_WALLPAPER_CATALOG_ID,
  SD_WALLPAPER_WIDGET_TYPE,
} from "@/features/sd-wallpaper/sdWallpaperTypes";
import {
  SD_MOVIE_CALENDAR_CATALOG_ID,
  SD_MOVIE_CALENDAR_WIDGET_TYPE,
} from "@/features/sd-movie-calendar/sdMovieCalendarTypes";
import {
  SD_IP_CATALOG_ID,
  SD_IP_WIDGET_TYPE,
} from "@/features/sd-ip/sdIpTypes";
import {
  SD_CALENDAR_CATALOG_ID,
  SD_CALENDAR_WIDGET_TYPE,
} from "@/features/sd-calendar/sdCalendarTypes";
import {
  SD_NUMBER_UPPERCASE_CATALOG_ID,
  SD_NUMBER_UPPERCASE_WIDGET_TYPE,
} from "@/features/sd-number-uppercase/sdNumberUppercaseTypes";
import {
  SD_FOOD_PICKER_CATALOG_ID,
  SD_FOOD_PICKER_WIDGET_TYPE,
} from "@/features/sd-food-picker/sdFoodPickerTypes";
import {
  AI_USAGE_CATALOG_ID,
  AI_USAGE_WIDGET_TYPE,
} from "@/features/ai-usage/aiUsageTypes";
import {
  TAPD_DEFECTS_CATALOG_ID,
  TAPD_DEFECTS_WIDGET_TYPE,
} from "@/features/tapd-defects/tapdDefectTypes";

const runtimeTypes = [
  "docker",
  "system-status",
  "custom-css",
  "sd-weather-00",
  SD_MEMO_WIDGET_TYPE,
  SD_TODO_WIDGET_TYPE,
  SD_CLOCK_WIDGET_TYPE,
  SD_POEM_WIDGET_TYPE,
  SD_DAILY_ENGLISH_WIDGET_TYPE,
  SD_POMODORO_WIDGET_TYPE,
  SD_ANNIVERSARY_WIDGET_TYPE,
  SD_WALLPAPER_WIDGET_TYPE,
  SD_MOVIE_CALENDAR_WIDGET_TYPE,
  SD_IP_WIDGET_TYPE,
  SD_CALENDAR_WIDGET_TYPE,
  SD_NUMBER_UPPERCASE_WIDGET_TYPE,
  SD_FOOD_PICKER_WIDGET_TYPE,
  AI_USAGE_WIDGET_TYPE,
  TAPD_DEFECTS_WIDGET_TYPE,
];
const catalogSdTypes = [
  ...new Set([...WIDGET_SIZE_FAMILY_TYPES, ...runtimeTypes]),
];

describe("widgetCatalog", () => {
  it("exposes approved main-project catalog entries from scoped size metadata", () => {
    expect(WIDGET_CATALOG).toHaveLength(catalogSdTypes.length);
    expect(WIDGET_CATALOG.map((item) => item.type)).not.toContain("music");
    expect(WIDGET_CATALOG.map((item) => item.type)).not.toContain("player");
    expect(
      WIDGET_CATALOG.filter((item) => item.sizeScope === "sd")
        .map((item) => item.type)
        .sort(),
    ).toEqual([...catalogSdTypes].sort());

    for (const item of WIDGET_CATALOG.filter(
      (candidate) => candidate.sizeScope === "sd",
    )) {
      if (runtimeTypes.includes(item.type)) continue;
      const family = resolveWidgetSizeFamily(item.type);
      expect(item.colSpan).toBe(family.defaultSize.colSpan);
      expect(item.rowSpan).toBe(family.defaultSize.rowSpan);
      expect(item.supportedSizes.map((size) => size.key)).toEqual(
        family.supported.map((size) => size.key),
      );
    }
  });

  it("exposes weather as canonical weather catalog item with scoped sizes", () => {
    const weather = getWidgetCatalogItem("weather");
    expect(weather).toBeTruthy();
    expect(weather).toMatchObject({
      id: "weather",
      type: "sd-weather-00",
      title: "天气",
      mode: "singleton",
      sizeScope: "sd",
    });
    expect(getWidgetCatalogItem("sd-weather-00")?.id).toBe("weather");
    expect(weather?.supportedSizes.map((size) => size.key)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
    expect(resolveSdWidgetSize("1x2")).toMatchObject({
      colSpan: 2,
      rowSpan: 1,
    });
    expect(resolveSdWidgetSize("2x1")).toMatchObject({
      colSpan: 1,
      rowSpan: 2,
    });
  });

  it("creates custom-css runtime widgets with unique ids and empty content", () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1001);
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.123456)
      .mockReturnValueOnce(0.654321);

    const item = getWidgetCatalogItem("custom-css");
    expect(item).toBeTruthy();

    const first = createWidgetFromCatalog(item!);
    const second = createWidgetFromCatalog(item!);

    expect(first.type).toBe("custom-css");
    expect(second.type).toBe("custom-css");
    expect(first.id).not.toBe(second.id);
    expect(first.data).toEqual(
      expect.objectContaining({
        runtime: "custom-css",
        layoutSystem: "sd-grid/2026-05-22",
        title: "",
        html: "",
        css: "",
        sizeKey: "1x1",
      }),
    );

    vi.restoreAllMocks();
  });

  it("reports Docker and system status as reusable singleton widgets", () => {
    const item = getWidgetCatalogItem("docker");
    const systemItem = getWidgetCatalogItem("system-status");
    expect(item).toBeTruthy();
    expect(systemItem).toBeTruthy();

    const disabled: WidgetConfig[] = [
      { id: "docker", type: "docker", enable: false, isPublic: true },
    ];
    const enabled: WidgetConfig[] = [
      { id: "docker", type: "docker", enable: true, isPublic: true },
    ];

    expect(getWidgetCatalogAction([], item!)).toBe("add");
    expect(getWidgetCatalogAction(disabled, item!)).toBe("enable");
    expect(getWidgetCatalogAction(enabled, item!)).toBe("enabled");
    expect(findExistingCatalogWidget(enabled, item!)).toBe(enabled[0]);
    expect(
      getWidgetCatalogAction(
        [
          {
            id: "status-1",
            type: "system-status",
            enable: false,
            isPublic: true,
          },
        ],
        systemItem!,
      ),
    ).toBe("enable");
  });

  it("exposes clock as canonical clock catalog item with scoped sizes", () => {
    const clock = getWidgetCatalogItem("clock");
    expect(clock).toBeTruthy();
    expect(clock).toMatchObject({
      id: "clock",
      type: SD_CLOCK_WIDGET_TYPE,
      title: "时钟",
      mode: "singleton",
      sizeScope: "sd",
    });
    expect(getWidgetCatalogItem(SD_CLOCK_WIDGET_TYPE)?.id).toBe("clock");
    expect(clock?.supportedSizes.map((size) => size.key)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
  });

  it("reports weather singleton state through normal id and legacy recommendation alias", () => {
    const item = getWidgetCatalogItem("sd-weather-00");
    expect(item).toBeTruthy();

    const disabled: WidgetConfig[] = [
      { id: "weather", type: "sd-weather-00", enable: false, isPublic: true },
    ];
    const enabled: WidgetConfig[] = [
      { id: "weather", type: "sd-weather-00", enable: true, isPublic: true },
    ];
    const oldWeather: WidgetConfig[] = [
      { id: "weather", type: "weather", enable: true, isPublic: true },
    ];

    expect(getWidgetCatalogAction([], item!)).toBe("add");
    expect(getWidgetCatalogAction(disabled, item!)).toBe("enable");
    expect(getWidgetCatalogAction(enabled, item!)).toBe("enabled");
    expect(getWidgetCatalogAction(oldWeather, item!)).toBe("enabled");
  });

  it("exposes Todo as canonical Todo catalog item with scoped sizes", () => {
    const todo = getWidgetCatalogItem("todo");
    expect(todo).toBeTruthy();
    expect(todo).toMatchObject({
      id: "todo",
      type: SD_TODO_WIDGET_TYPE,
      title: "待办",
      mode: "singleton",
      sizeScope: "sd",
    });
    expect(getWidgetCatalogItem(SD_TODO_WIDGET_TYPE)?.id).toBe("todo");
    expect(todo?.supportedSizes.map((size) => size.key)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
      "4x4",
    ]);
  });

  it("reports Todo singleton state through normal id and legacy recommendation alias", () => {
    const item = getWidgetCatalogItem(SD_TODO_WIDGET_TYPE);
    expect(item).toBeTruthy();

    const disabled: WidgetConfig[] = [
      {
        id: "todo",
        type: SD_TODO_WIDGET_TYPE,
        enable: false,
        isPublic: true,
      },
    ];
    const enabled: WidgetConfig[] = [
      { id: "todo", type: SD_TODO_WIDGET_TYPE, enable: true, isPublic: true },
    ];
    const oldTodo: WidgetConfig[] = [
      { id: "todo", type: "todo", enable: true, isPublic: true },
    ];

    expect(getWidgetCatalogAction([], item!)).toBe("add");
    expect(getWidgetCatalogAction(disabled, item!)).toBe("enable");
    expect(getWidgetCatalogAction(enabled, item!)).toBe("enabled");
    expect(getWidgetCatalogAction(oldTodo, item!)).toBe("enabled");
  });

  it("exposes Memo as canonical Memo catalog item with scoped sizes", () => {
    const memo = getWidgetCatalogItem("memo");
    expect(memo).toBeTruthy();
    expect(memo).toMatchObject({
      id: "memo",
      type: SD_MEMO_WIDGET_TYPE,
      title: "备忘录",
      mode: "singleton",
      sizeScope: "sd",
    });
    expect(getWidgetCatalogItem(SD_MEMO_WIDGET_TYPE)?.id).toBe("memo");
    expect(memo?.supportedSizes.map((size) => size.key)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
      "4x4",
    ]);
  });

  it("exposes poem as canonical poem catalog item with scoped sizes", () => {
    const poem = getWidgetCatalogItem("poem");
    expect(poem).toBeTruthy();
    expect(poem).toMatchObject({
      id: "poem",
      type: SD_POEM_WIDGET_TYPE,
      title: "今日诗词",
      mode: "singleton",
      sizeScope: "sd",
    });
    expect(getWidgetCatalogItem(SD_POEM_WIDGET_TYPE)?.id).toBe("poem");
    expect(poem?.supportedSizes.map((size) => size.key)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
  });

  it("exposes daily English as canonical catalog item with scoped sizes", () => {
    const dailyEnglish = getWidgetCatalogItem("daily-english");
    expect(dailyEnglish).toBeTruthy();
    expect(dailyEnglish).toMatchObject({
      id: "daily-english",
      type: SD_DAILY_ENGLISH_WIDGET_TYPE,
      title: "今日英语",
      mode: "singleton",
      sizeScope: "sd",
    });
    expect(getWidgetCatalogItem(SD_DAILY_ENGLISH_WIDGET_TYPE)?.id).toBe(
      "daily-english",
    );
    expect(dailyEnglish?.supportedSizes.map((size) => size.key)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
  });

  it("exposes movie calendar as canonical catalog item with scoped sizes", () => {
    const movieCalendar = getWidgetCatalogItem(SD_MOVIE_CALENDAR_CATALOG_ID);
    expect(movieCalendar).toBeTruthy();
    expect(movieCalendar).toMatchObject({
      id: SD_MOVIE_CALENDAR_CATALOG_ID,
      type: SD_MOVIE_CALENDAR_WIDGET_TYPE,
      title: "电影日历",
      mode: "singleton",
      sizeScope: "sd",
    });
    expect(getWidgetCatalogItem(SD_MOVIE_CALENDAR_WIDGET_TYPE)?.id).toBe(
      SD_MOVIE_CALENDAR_CATALOG_ID,
    );
    expect(movieCalendar?.supportedSizes.map((size) => size.key)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
  });

  it("exposes IP as canonical catalog item with scoped sizes", () => {
    const ip = getWidgetCatalogItem(SD_IP_CATALOG_ID);
    expect(ip).toBeTruthy();
    expect(ip).toMatchObject({
      id: SD_IP_CATALOG_ID,
      type: SD_IP_WIDGET_TYPE,
      title: "本机IP",
      mode: "singleton",
      sizeScope: "sd",
    });
    expect(getWidgetCatalogItem(SD_IP_WIDGET_TYPE)?.id).toBe(
      SD_IP_CATALOG_ID,
    );
    expect(ip?.supportedSizes.map((size) => size.key)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
  });

  it("exposes calendar as canonical catalog item with scoped sizes", () => {
    const calendar = getWidgetCatalogItem(SD_CALENDAR_CATALOG_ID);
    expect(calendar).toBeTruthy();
    expect(calendar).toMatchObject({
      id: SD_CALENDAR_CATALOG_ID,
      type: SD_CALENDAR_WIDGET_TYPE,
      title: "日历",
      mode: "singleton",
      sizeScope: "sd",
    });
    expect(getWidgetCatalogItem(SD_CALENDAR_WIDGET_TYPE)?.id).toBe(
      SD_CALENDAR_CATALOG_ID,
    );
    expect(calendar?.supportedSizes.map((size) => size.key)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
  });

  it("exposes food picker as a multi-instance catalog item with scoped sizes", () => {
    const foodPicker = getWidgetCatalogItem(SD_FOOD_PICKER_CATALOG_ID);
    expect(foodPicker).toBeTruthy();
    expect(foodPicker).toMatchObject({
      id: SD_FOOD_PICKER_CATALOG_ID,
      type: SD_FOOD_PICKER_WIDGET_TYPE,
      title: "今天吃什么",
      mode: "multi",
      sizeScope: "sd",
    });
    expect(getWidgetCatalogItem(SD_FOOD_PICKER_WIDGET_TYPE)?.id).toBe(
      SD_FOOD_PICKER_CATALOG_ID,
    );
    expect(foodPicker?.supportedSizes.map((size) => size.key)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
  });

  it("exposes number uppercase as a migrated tool catalog item", () => {
    const numberUppercase = getWidgetCatalogItem(
      SD_NUMBER_UPPERCASE_CATALOG_ID,
    );
    expect(numberUppercase).toBeTruthy();
    expect(numberUppercase).toMatchObject({
      id: SD_NUMBER_UPPERCASE_CATALOG_ID,
      type: SD_NUMBER_UPPERCASE_WIDGET_TYPE,
      title: "金额换算",
      mode: "multi",
      sizeScope: "sd",
    });
    expect(getWidgetCatalogItem(SD_NUMBER_UPPERCASE_WIDGET_TYPE)?.id).toBe(
      SD_NUMBER_UPPERCASE_CATALOG_ID,
    );
    expect(numberUppercase?.supportedSizes.map((size) => size.key)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
  });

  it("exposes Pomodoro as canonical Pomodoro catalog item with scoped sizes", () => {
    const pomodoro = getWidgetCatalogItem("pomodoro");
    expect(pomodoro).toBeTruthy();
    expect(pomodoro).toMatchObject({
      id: "pomodoro",
      type: SD_POMODORO_WIDGET_TYPE,
      title: "番茄时钟",
      mode: "singleton",
      sizeScope: "sd",
    });
    expect(getWidgetCatalogItem(SD_POMODORO_WIDGET_TYPE)?.id).toBe(
      "pomodoro",
    );
    expect(pomodoro?.supportedSizes.map((size) => size.key)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
  });

  it("reports Memo singleton state through canonical ids and aliases", () => {
    const item = getWidgetCatalogItem(SD_MEMO_WIDGET_TYPE);
    expect(item).toBeTruthy();

    const disabled: WidgetConfig[] = [
      {
        id: "memo",
        type: SD_MEMO_WIDGET_TYPE,
        enable: false,
        isPublic: true,
      },
    ];
    const enabled: WidgetConfig[] = [
      { id: "memo", type: SD_MEMO_WIDGET_TYPE, enable: true, isPublic: true },
    ];
    const oldMemo: WidgetConfig[] = [
      { id: "memo", type: "memo", enable: true, isPublic: true },
    ];

    expect(getWidgetCatalogAction([], item!)).toBe("add");
    expect(getWidgetCatalogAction(disabled, item!)).toBe("enable");
    expect(getWidgetCatalogAction(enabled, item!)).toBe("enabled");
    expect(getWidgetCatalogAction(oldMemo, item!)).toBe("enabled");
  });

  it("reports clock singleton state through canonical ids and aliases", () => {
    const item = getWidgetCatalogItem(SD_CLOCK_WIDGET_TYPE);
    expect(item).toBeTruthy();

    const disabled: WidgetConfig[] = [
      {
        id: "clock",
        type: SD_CLOCK_WIDGET_TYPE,
        enable: false,
        isPublic: true,
      },
    ];
    const enabled: WidgetConfig[] = [
      {
        id: "clock",
        type: SD_CLOCK_WIDGET_TYPE,
        enable: true,
        isPublic: true,
      },
    ];
    const oldClock: WidgetConfig[] = [
      { id: "clock", type: "clock", enable: true, isPublic: true },
    ];

    expect(getWidgetCatalogAction([], item!)).toBe("add");
    expect(getWidgetCatalogAction(disabled, item!)).toBe("enable");
    expect(getWidgetCatalogAction(enabled, item!)).toBe("enabled");
    expect(getWidgetCatalogAction(oldClock, item!)).toBe("enabled");
  });

  it("reports poem singleton state through canonical ids and aliases", () => {
    const item = getWidgetCatalogItem(SD_POEM_WIDGET_TYPE);
    expect(item).toBeTruthy();

    const disabled: WidgetConfig[] = [
      {
        id: "poem",
        type: SD_POEM_WIDGET_TYPE,
        enable: false,
        isPublic: true,
      },
    ];
    const enabled: WidgetConfig[] = [
      {
        id: "poem",
        type: SD_POEM_WIDGET_TYPE,
        enable: true,
        isPublic: true,
      },
    ];
    const oldPoem: WidgetConfig[] = [
      { id: "poem", type: "poem", enable: true, isPublic: true },
    ];

    expect(getWidgetCatalogAction([], item!)).toBe("add");
    expect(getWidgetCatalogAction(disabled, item!)).toBe("enable");
    expect(getWidgetCatalogAction(enabled, item!)).toBe("enabled");
    expect(getWidgetCatalogAction(oldPoem, item!)).toBe("enabled");
  });

  it("reports daily English singleton state through the legacy recommendation alias", () => {
    const item = getWidgetCatalogItem(SD_DAILY_ENGLISH_WIDGET_TYPE);
    expect(item).toBeTruthy();

    const disabled: WidgetConfig[] = [
      {
        id: "daily-english",
        type: SD_DAILY_ENGLISH_WIDGET_TYPE,
        enable: false,
        isPublic: true,
      },
    ];
    const enabled: WidgetConfig[] = [
      {
        id: "daily-english",
        type: SD_DAILY_ENGLISH_WIDGET_TYPE,
        enable: true,
        isPublic: true,
      },
    ];

    expect(getWidgetCatalogAction([], item!)).toBe("add");
    expect(getWidgetCatalogAction(disabled, item!)).toBe("enable");
    expect(getWidgetCatalogAction(enabled, item!)).toBe("enabled");
  });

  it("reports movie calendar singleton state through the legacy recommendation alias", () => {
    const item = getWidgetCatalogItem(SD_MOVIE_CALENDAR_WIDGET_TYPE);
    expect(item).toBeTruthy();

    const disabled: WidgetConfig[] = [
      {
        id: SD_MOVIE_CALENDAR_CATALOG_ID,
        type: SD_MOVIE_CALENDAR_WIDGET_TYPE,
        enable: false,
        isPublic: true,
      },
    ];
    const enabled: WidgetConfig[] = [
      {
        id: SD_MOVIE_CALENDAR_CATALOG_ID,
        type: SD_MOVIE_CALENDAR_WIDGET_TYPE,
        enable: true,
        isPublic: true,
      },
    ];

    expect(getWidgetCatalogAction([], item!)).toBe("add");
    expect(getWidgetCatalogAction(disabled, item!)).toBe("enable");
    expect(getWidgetCatalogAction(enabled, item!)).toBe("enabled");
  });

  it("reports IP singleton state through canonical ids and aliases", () => {
    const item = getWidgetCatalogItem(SD_IP_WIDGET_TYPE);
    expect(item).toBeTruthy();

    const disabled: WidgetConfig[] = [
      {
        id: SD_IP_CATALOG_ID,
        type: SD_IP_WIDGET_TYPE,
        enable: false,
        isPublic: true,
      },
    ];
    const enabled: WidgetConfig[] = [
      {
        id: SD_IP_CATALOG_ID,
        type: SD_IP_WIDGET_TYPE,
        enable: true,
        isPublic: true,
      },
    ];
    const oldIp: WidgetConfig[] = [
      { id: "ip", type: "ip", enable: true, isPublic: true },
    ];

    expect(getWidgetCatalogAction([], item!)).toBe("add");
    expect(getWidgetCatalogAction(disabled, item!)).toBe("enable");
    expect(getWidgetCatalogAction(enabled, item!)).toBe("enabled");
    expect(getWidgetCatalogAction(oldIp, item!)).toBe("enabled");
  });

  it("reports Pomodoro singleton state through canonical ids and aliases", () => {
    const item = getWidgetCatalogItem(SD_POMODORO_WIDGET_TYPE);
    expect(item).toBeTruthy();

    const disabled: WidgetConfig[] = [
      {
        id: "pomodoro",
        type: SD_POMODORO_WIDGET_TYPE,
        enable: false,
        isPublic: true,
      },
    ];
    const enabled: WidgetConfig[] = [
      {
        id: "pomodoro",
        type: SD_POMODORO_WIDGET_TYPE,
        enable: true,
        isPublic: true,
      },
    ];
    const oldPomodoro: WidgetConfig[] = [
      { id: "pomodoro", type: "pomodoro", enable: true, isPublic: true },
    ];

    expect(getWidgetCatalogAction([], item!)).toBe("add");
    expect(getWidgetCatalogAction(disabled, item!)).toBe("enable");
    expect(getWidgetCatalogAction(enabled, item!)).toBe("enabled");
    expect(getWidgetCatalogAction(oldPomodoro, item!)).toBe("enabled");
  });

  it("does not expose removed main-project legacy widgets", () => {
    for (const id of [
      "search",
      "div-card",
      "bookmarks",
      "countdown",
      "countup",
      "calculator",
      "hot",
      "rss",
    ]) {
      expect(getWidgetCatalogItem(id)).toBeUndefined();
    }
    expect(getWidgetCatalogItem("quote")).toBeUndefined();
  });

  it("creates canonical weather widgets from the user-facing weather item", () => {
    const weather = createWidgetFromCatalog(getWidgetCatalogItem("weather")!);

    expect(weather).toMatchObject({
      type: "sd-weather-00",
      colSpan: 2,
      rowSpan: 1,
      w: 2,
      h: 1,
      data: {
        runtime: "sd-weather",
        version: 1,
        sizeKey: "1x2",
      },
    });
    expect(weather.id).toMatch(/^weather-/);
  });

  it("creates canonical clock widgets from the user-facing clock item", () => {
    const clock = createWidgetFromCatalog(getWidgetCatalogItem("clock")!);

    expect(clock).toMatchObject({
      type: SD_CLOCK_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "sd-clock",
        version: 1,
        sizeKey: "2x2",
        showSeconds: true,
      },
    });
    expect(clock.id).toMatch(/^clock-/);
  });

  it("creates canonical Todo widgets from the user-facing Todo item", () => {
    const todo = createWidgetFromCatalog(getWidgetCatalogItem("todo")!);

    expect(todo).toMatchObject({
      type: SD_TODO_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "sd-todo",
        version: 1,
        sizeKey: "2x2",
        tasks: [],
      },
    });
    expect(todo.id).toMatch(/^todo-/);
  });

  it("creates canonical Memo widgets from the user-facing Memo item", () => {
    const memo = createWidgetFromCatalog(getWidgetCatalogItem("memo")!);

    expect(memo).toMatchObject({
      type: SD_MEMO_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "sd-memo",
        version: 1,
        sizeKey: "2x2",
      },
    });
    expect(memo.id).toMatch(/^memo-/);
    expect(memo.data.notes).toEqual([]);
  });

  it("creates canonical poem widgets from the user-facing poem item", () => {
    const poem = createWidgetFromCatalog(getWidgetCatalogItem("poem")!);

    expect(poem).toMatchObject({
      type: SD_POEM_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "sd-poem",
        version: 1,
        sizeKey: "2x2",
      },
    });
    expect(poem.id).toMatch(/^poem-/);
  });

  it("creates canonical daily English widgets from the user-facing item", () => {
    const dailyEnglish = createWidgetFromCatalog(
      getWidgetCatalogItem("daily-english")!,
    );

    expect(dailyEnglish).toMatchObject({
      type: SD_DAILY_ENGLISH_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "sd-daily-english",
        version: 1,
        sizeKey: "2x2",
      },
    });
    expect(dailyEnglish.id).toMatch(/^daily-english-/);
  });

  it("creates canonical movie calendar widgets from the user-facing item", () => {
    const movieCalendar = createWidgetFromCatalog(
      getWidgetCatalogItem(SD_MOVIE_CALENDAR_CATALOG_ID)!,
    );

    expect(movieCalendar).toMatchObject({
      type: SD_MOVIE_CALENDAR_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "sd-movie-calendar",
        version: 1,
        sizeKey: "2x2",
      },
    });
    expect(movieCalendar.id).toMatch(/^movie-calendar-/);
  });

  it("creates canonical IP widgets from the user-facing item", () => {
    const ip = createWidgetFromCatalog(
      getWidgetCatalogItem(SD_IP_CATALOG_ID)!,
    );

    expect(ip).toMatchObject({
      type: SD_IP_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "sd-ip",
        version: 1,
        sizeKey: "2x2",
      },
    });
    expect(ip.id).toMatch(/^ip-/);
  });

  it("creates canonical calendar widgets from the user-facing item", () => {
    const calendar = createWidgetFromCatalog(
      getWidgetCatalogItem(SD_CALENDAR_CATALOG_ID)!,
    );

    expect(calendar).toMatchObject({
      type: SD_CALENDAR_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "sd-calendar",
        version: 1,
        sizeKey: "2x2",
      },
    });
    expect(calendar.id).toMatch(/^calendar-/);
  });

  it("creates canonical number uppercase widgets from the user-facing item", () => {
    const numberUppercase = createWidgetFromCatalog(
      getWidgetCatalogItem(SD_NUMBER_UPPERCASE_CATALOG_ID)!,
    );

    expect(numberUppercase).toMatchObject({
      type: SD_NUMBER_UPPERCASE_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "sd-number-uppercase",
        version: 1,
        sizeKey: "2x2",
        inputNumber: "",
        uppercaseResult: "",
        formatMode: "currency",
      },
    });
    expect(numberUppercase.id).toMatch(/^sd-number-uppercase-35-/);
  });

  it("creates addable food picker widgets from the user-facing item", () => {
    const foodPicker = createWidgetFromCatalog(
      getWidgetCatalogItem(SD_FOOD_PICKER_CATALOG_ID)!,
    );

    expect(foodPicker).toMatchObject({
      type: SD_FOOD_PICKER_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "sd-food-picker",
        version: 1,
        sizeKey: "2x2",
        currentItem: "",
      },
    });
    expect(foodPicker.data.menuItems).toEqual([]);
    expect(foodPicker.id).toMatch(/^food-picker-/);
  });

  it("creates addable AI usage widgets from the user-facing item", () => {
    const aiUsage = createWidgetFromCatalog(
      getWidgetCatalogItem(AI_USAGE_CATALOG_ID)!,
    );

    expect(aiUsage).toMatchObject({
      type: AI_USAGE_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "ai-usage",
        version: 1,
        sizeKey: "2x2",
        providerId: "openai",
        credentialStorage: "browser",
      },
    });
    expect(aiUsage.id).toMatch(/^ai-usage-/);
    expect(getWidgetCatalogItem(AI_USAGE_WIDGET_TYPE)?.id).toBe(
      AI_USAGE_CATALOG_ID,
    );
  });

  it("creates addable TAPD defect widgets from the user-facing item", () => {
    const tapdDefects = createWidgetFromCatalog(
      getWidgetCatalogItem(TAPD_DEFECTS_CATALOG_ID)!,
    );

    expect(tapdDefects).toMatchObject({
      type: TAPD_DEFECTS_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "tapd-defects",
        version: 1,
        sizeKey: "2x2",
        visibilityScope: "owned-by-current-user",
        query: {
          limit: 100,
          order: "modified desc",
        },
      },
    });
    expect(tapdDefects.id).toMatch(/^tapd-defects-/);
    expect(getWidgetCatalogItem(TAPD_DEFECTS_WIDGET_TYPE)?.id).toBe(
      TAPD_DEFECTS_CATALOG_ID,
    );
  });

  it("creates canonical Pomodoro widgets from the user-facing Pomodoro item", () => {
    const pomodoro = createWidgetFromCatalog(getWidgetCatalogItem("pomodoro")!);

    expect(pomodoro).toMatchObject({
      type: SD_POMODORO_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "sd-pomodoro",
        version: 1,
        sizeKey: "2x2",
        duration: 1500,
        remainingSeconds: 1500,
        isRunning: false,
        sessions: 0,
      },
    });
    expect(pomodoro.id).toMatch(/^pomodoro-/);
  });

  it("creates canonical anniversary widgets from the user-facing anniversary item", () => {
    const anniversary = createWidgetFromCatalog(
      getWidgetCatalogItem("anniversary")!,
    );

    expect(getWidgetCatalogItem(SD_ANNIVERSARY_WIDGET_TYPE)?.id).toBe(
      "anniversary",
    );
    expect(anniversary).toMatchObject({
      type: SD_ANNIVERSARY_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "sd-anniversary",
        version: 1,
        sizeKey: "2x2",
        title: "",
        eventName: "",
        date: "",
        backgroundMode: "image",
        mask: 0,
      },
    });
    expect(anniversary.id).toMatch(/^anniversary-/);
  });

  it("creates addable wallpaper widgets from the user-facing wallpaper item", () => {
    const item = getWidgetCatalogItem(SD_WALLPAPER_CATALOG_ID);
    expect(item).toMatchObject({
      id: SD_WALLPAPER_CATALOG_ID,
      type: SD_WALLPAPER_WIDGET_TYPE,
      title: "壁纸",
      mode: "multi",
      sizeScope: "sd",
    });

    const wallpaper = createWidgetFromCatalog(item!);

    expect(wallpaper).toMatchObject({
      type: SD_WALLPAPER_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "sd-wallpaper",
        version: 1,
        sd: {
          captureIndex: 16,
          catalogId: "sd-wallpaper-16",
          adapterKind: "wallpaper",
        },
        sizeKey: "2x2",
      },
    });
    expect(wallpaper.id).toMatch(/^wallpaper-/);
    expect(getWidgetCatalogItem(SD_WALLPAPER_WIDGET_TYPE)?.id).toBe(
      SD_WALLPAPER_CATALOG_ID,
    );
  });
});
