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
import { resolveItabWidgetSize } from "@/features/itab-widgets/itabSizePresets";
import { ITAB_TODO_WIDGET_TYPE } from "@/features/itab-todo/itabTodoTypes";
import { ITAB_MEMO_WIDGET_TYPE } from "@/features/itab-memo/itabMemoTypes";
import { ITAB_CLOCK_WIDGET_TYPE } from "@/features/itab-clock/itabClockTypes";
import { ITAB_POEM_WIDGET_TYPE } from "@/features/itab-poem/itabPoemTypes";
import { ITAB_DAILY_ENGLISH_WIDGET_TYPE } from "@/features/itab-daily-english/itabDailyEnglishTypes";
import { ITAB_POMODORO_WIDGET_TYPE } from "@/features/itab-pomodoro/itabPomodoroTypes";
import { ITAB_ANNIVERSARY_WIDGET_TYPE } from "@/features/itab-anniversary/itabAnniversaryTypes";

const runtimeTypes = [
  "itab-weather-00",
  ITAB_MEMO_WIDGET_TYPE,
  ITAB_TODO_WIDGET_TYPE,
  ITAB_CLOCK_WIDGET_TYPE,
  ITAB_POEM_WIDGET_TYPE,
  ITAB_DAILY_ENGLISH_WIDGET_TYPE,
  ITAB_POMODORO_WIDGET_TYPE,
  ITAB_ANNIVERSARY_WIDGET_TYPE,
];

describe("widgetCatalog", () => {
  it("exposes approved main-project catalog entries from iTab size metadata", () => {
    expect(WIDGET_CATALOG).toHaveLength(
      WIDGET_SIZE_FAMILY_TYPES.length + runtimeTypes.length,
    );
    expect(WIDGET_CATALOG.map((item) => item.type)).not.toContain("music");
    expect(WIDGET_CATALOG.map((item) => item.type)).not.toContain("player");
    expect(
      WIDGET_CATALOG.filter((item) => item.sizeScope === "itab")
        .map((item) => item.type)
        .sort(),
    ).toEqual([...WIDGET_SIZE_FAMILY_TYPES, ...runtimeTypes].sort());

    for (const item of WIDGET_CATALOG.filter(
      (candidate) => candidate.sizeScope === "itab",
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

  it("exposes iTab weather as canonical weather catalog item with scoped sizes", () => {
    const weather = getWidgetCatalogItem("weather");
    expect(weather).toBeTruthy();
    expect(weather).toMatchObject({
      id: "weather",
      type: "itab-weather-00",
      title: "天气",
      mode: "singleton",
      sizeScope: "itab",
    });
    expect(getWidgetCatalogItem("itab-weather-00")?.id).toBe("weather");
    expect(weather?.supportedSizes.map((size) => size.key)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
    expect(resolveItabWidgetSize("1x2")).toMatchObject({
      colSpan: 2,
      rowSpan: 1,
    });
    expect(resolveItabWidgetSize("2x1")).toMatchObject({
      colSpan: 1,
      rowSpan: 2,
    });
  });

  it("creates multi-instance widgets with unique ids and default data", () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1001);
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.123456)
      .mockReturnValueOnce(0.654321);

    const item = getWidgetCatalogItem("iframe");
    expect(item).toBeTruthy();

    const first = createWidgetFromCatalog(item!);
    const second = createWidgetFromCatalog(item!);

    expect(first.type).toBe("iframe");
    expect(second.type).toBe("iframe");
    expect(first.id).not.toBe(second.id);
    expect(first.data).toEqual(
      expect.objectContaining({
        url: "",
        layoutSystem: "itab-grid/2026-05-22",
        sizeKey: "2x2",
      }),
    );

    vi.restoreAllMocks();
  });

  it("reports singleton state without creating duplicates", () => {
    const item = getWidgetCatalogItem("docker");
    expect(item).toBeTruthy();

    const disabled: WidgetConfig[] = [
      { id: "docker", type: "docker", enable: false, isPublic: true },
    ];
    const enabled: WidgetConfig[] = [
      { id: "docker", type: "docker", enable: true, isPublic: true },
    ];

    expect(getWidgetCatalogAction([], item!)).toBe("enable");
    expect(getWidgetCatalogAction(disabled, item!)).toBe("enable");
    expect(getWidgetCatalogAction(enabled, item!)).toBe("enabled");
    expect(findExistingCatalogWidget(enabled, item!)?.id).toBe("docker");
  });

  it("exposes iTab clock as canonical clock catalog item with scoped sizes", () => {
    const clock = getWidgetCatalogItem("clock");
    expect(clock).toBeTruthy();
    expect(clock).toMatchObject({
      id: "clock",
      type: ITAB_CLOCK_WIDGET_TYPE,
      title: "时钟",
      mode: "singleton",
      sizeScope: "itab",
    });
    expect(getWidgetCatalogItem(ITAB_CLOCK_WIDGET_TYPE)?.id).toBe("clock");
    expect(clock?.supportedSizes.map((size) => size.key)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
  });

  it("reports weather singleton state through normal id and iTab recommendation alias", () => {
    const item = getWidgetCatalogItem("itab-weather-00");
    expect(item).toBeTruthy();

    const disabled: WidgetConfig[] = [
      { id: "weather", type: "itab-weather-00", enable: false, isPublic: true },
    ];
    const enabled: WidgetConfig[] = [
      { id: "weather", type: "itab-weather-00", enable: true, isPublic: true },
    ];
    const oldWeather: WidgetConfig[] = [
      { id: "weather", type: "weather", enable: true, isPublic: true },
    ];

    expect(getWidgetCatalogAction([], item!)).toBe("enable");
    expect(getWidgetCatalogAction(disabled, item!)).toBe("enable");
    expect(getWidgetCatalogAction(enabled, item!)).toBe("enabled");
    expect(getWidgetCatalogAction(oldWeather, item!)).toBe("enable");
  });

  it("exposes iTab Todo as canonical Todo catalog item with scoped sizes", () => {
    const todo = getWidgetCatalogItem("todo");
    expect(todo).toBeTruthy();
    expect(todo).toMatchObject({
      id: "todo",
      type: ITAB_TODO_WIDGET_TYPE,
      title: "待办",
      mode: "singleton",
      sizeScope: "itab",
    });
    expect(getWidgetCatalogItem(ITAB_TODO_WIDGET_TYPE)?.id).toBe("todo");
    expect(todo?.supportedSizes.map((size) => size.key)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
  });

  it("reports Todo singleton state through normal id and iTab recommendation alias", () => {
    const item = getWidgetCatalogItem(ITAB_TODO_WIDGET_TYPE);
    expect(item).toBeTruthy();

    const disabled: WidgetConfig[] = [
      {
        id: "todo",
        type: ITAB_TODO_WIDGET_TYPE,
        enable: false,
        isPublic: true,
      },
    ];
    const enabled: WidgetConfig[] = [
      { id: "todo", type: ITAB_TODO_WIDGET_TYPE, enable: true, isPublic: true },
    ];
    const oldTodo: WidgetConfig[] = [
      { id: "todo", type: "todo", enable: true, isPublic: true },
    ];

    expect(getWidgetCatalogAction([], item!)).toBe("enable");
    expect(getWidgetCatalogAction(disabled, item!)).toBe("enable");
    expect(getWidgetCatalogAction(enabled, item!)).toBe("enabled");
    expect(getWidgetCatalogAction(oldTodo, item!)).toBe("enable");
  });

  it("exposes iTab Memo as canonical Memo catalog item with scoped sizes", () => {
    const memo = getWidgetCatalogItem("memo");
    expect(memo).toBeTruthy();
    expect(memo).toMatchObject({
      id: "memo",
      type: ITAB_MEMO_WIDGET_TYPE,
      title: "备忘录",
      mode: "singleton",
      sizeScope: "itab",
    });
    expect(getWidgetCatalogItem(ITAB_MEMO_WIDGET_TYPE)?.id).toBe("memo");
    expect(memo?.supportedSizes.map((size) => size.key)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
  });

  it("exposes iTab poem as canonical poem catalog item with scoped sizes", () => {
    const poem = getWidgetCatalogItem("poem");
    expect(poem).toBeTruthy();
    expect(poem).toMatchObject({
      id: "poem",
      type: ITAB_POEM_WIDGET_TYPE,
      title: "今日诗词",
      mode: "singleton",
      sizeScope: "itab",
    });
    expect(getWidgetCatalogItem(ITAB_POEM_WIDGET_TYPE)?.id).toBe("poem");
    expect(poem?.supportedSizes.map((size) => size.key)).toEqual([
      "1x1",
      "1x2",
      "2x1",
      "2x2",
      "2x4",
    ]);
  });

  it("exposes iTab daily English as canonical catalog item with scoped sizes", () => {
    const dailyEnglish = getWidgetCatalogItem("daily-english");
    expect(dailyEnglish).toBeTruthy();
    expect(dailyEnglish).toMatchObject({
      id: "daily-english",
      type: ITAB_DAILY_ENGLISH_WIDGET_TYPE,
      title: "今日英语",
      mode: "singleton",
      sizeScope: "itab",
    });
    expect(getWidgetCatalogItem(ITAB_DAILY_ENGLISH_WIDGET_TYPE)?.id).toBe(
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

  it("exposes iTab Pomodoro as canonical Pomodoro catalog item with scoped sizes", () => {
    const pomodoro = getWidgetCatalogItem("pomodoro");
    expect(pomodoro).toBeTruthy();
    expect(pomodoro).toMatchObject({
      id: "pomodoro",
      type: ITAB_POMODORO_WIDGET_TYPE,
      title: "番茄时钟",
      mode: "singleton",
      sizeScope: "itab",
    });
    expect(getWidgetCatalogItem(ITAB_POMODORO_WIDGET_TYPE)?.id).toBe(
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

  it("reports Memo singleton state without letting old memo block the new runtime", () => {
    const item = getWidgetCatalogItem(ITAB_MEMO_WIDGET_TYPE);
    expect(item).toBeTruthy();

    const disabled: WidgetConfig[] = [
      {
        id: "memo",
        type: ITAB_MEMO_WIDGET_TYPE,
        enable: false,
        isPublic: true,
      },
    ];
    const enabled: WidgetConfig[] = [
      { id: "memo", type: ITAB_MEMO_WIDGET_TYPE, enable: true, isPublic: true },
    ];
    const oldMemo: WidgetConfig[] = [
      { id: "memo", type: "memo", enable: true, isPublic: true },
    ];

    expect(getWidgetCatalogAction([], item!)).toBe("enable");
    expect(getWidgetCatalogAction(disabled, item!)).toBe("enable");
    expect(getWidgetCatalogAction(enabled, item!)).toBe("enabled");
    expect(getWidgetCatalogAction(oldMemo, item!)).toBe("enable");
  });

  it("reports clock singleton state without letting old clock block the new runtime", () => {
    const item = getWidgetCatalogItem(ITAB_CLOCK_WIDGET_TYPE);
    expect(item).toBeTruthy();

    const disabled: WidgetConfig[] = [
      {
        id: "clock",
        type: ITAB_CLOCK_WIDGET_TYPE,
        enable: false,
        isPublic: true,
      },
    ];
    const enabled: WidgetConfig[] = [
      {
        id: "clock",
        type: ITAB_CLOCK_WIDGET_TYPE,
        enable: true,
        isPublic: true,
      },
    ];
    const oldClock: WidgetConfig[] = [
      { id: "clock", type: "clock", enable: true, isPublic: true },
    ];

    expect(getWidgetCatalogAction([], item!)).toBe("enable");
    expect(getWidgetCatalogAction(disabled, item!)).toBe("enable");
    expect(getWidgetCatalogAction(enabled, item!)).toBe("enabled");
    expect(getWidgetCatalogAction(oldClock, item!)).toBe("enable");
  });

  it("reports poem singleton state without letting old poem block the new runtime", () => {
    const item = getWidgetCatalogItem(ITAB_POEM_WIDGET_TYPE);
    expect(item).toBeTruthy();

    const disabled: WidgetConfig[] = [
      {
        id: "poem",
        type: ITAB_POEM_WIDGET_TYPE,
        enable: false,
        isPublic: true,
      },
    ];
    const enabled: WidgetConfig[] = [
      {
        id: "poem",
        type: ITAB_POEM_WIDGET_TYPE,
        enable: true,
        isPublic: true,
      },
    ];
    const oldPoem: WidgetConfig[] = [
      { id: "poem", type: "poem", enable: true, isPublic: true },
    ];

    expect(getWidgetCatalogAction([], item!)).toBe("enable");
    expect(getWidgetCatalogAction(disabled, item!)).toBe("enable");
    expect(getWidgetCatalogAction(enabled, item!)).toBe("enabled");
    expect(getWidgetCatalogAction(oldPoem, item!)).toBe("enable");
  });

  it("reports daily English singleton state through the iTab recommendation alias", () => {
    const item = getWidgetCatalogItem(ITAB_DAILY_ENGLISH_WIDGET_TYPE);
    expect(item).toBeTruthy();

    const disabled: WidgetConfig[] = [
      {
        id: "daily-english",
        type: ITAB_DAILY_ENGLISH_WIDGET_TYPE,
        enable: false,
        isPublic: true,
      },
    ];
    const enabled: WidgetConfig[] = [
      {
        id: "daily-english",
        type: ITAB_DAILY_ENGLISH_WIDGET_TYPE,
        enable: true,
        isPublic: true,
      },
    ];

    expect(getWidgetCatalogAction([], item!)).toBe("enable");
    expect(getWidgetCatalogAction(disabled, item!)).toBe("enable");
    expect(getWidgetCatalogAction(enabled, item!)).toBe("enabled");
  });

  it("reports Pomodoro singleton state without letting old pomodoro block the new runtime", () => {
    const item = getWidgetCatalogItem(ITAB_POMODORO_WIDGET_TYPE);
    expect(item).toBeTruthy();

    const disabled: WidgetConfig[] = [
      {
        id: "pomodoro",
        type: ITAB_POMODORO_WIDGET_TYPE,
        enable: false,
        isPublic: true,
      },
    ];
    const enabled: WidgetConfig[] = [
      {
        id: "pomodoro",
        type: ITAB_POMODORO_WIDGET_TYPE,
        enable: true,
        isPublic: true,
      },
    ];
    const oldPomodoro: WidgetConfig[] = [
      { id: "pomodoro", type: "pomodoro", enable: true, isPublic: true },
    ];

    expect(getWidgetCatalogAction([], item!)).toBe("enable");
    expect(getWidgetCatalogAction(disabled, item!)).toBe("enable");
    expect(getWidgetCatalogAction(enabled, item!)).toBe("enabled");
    expect(getWidgetCatalogAction(oldPomodoro, item!)).toBe("enable");
  });

  it("restores default singleton widgets enabled", () => {
    const item = getWidgetCatalogItem("calculator");
    expect(item).toBeTruthy();

    const widget = createWidgetFromCatalog(item!);

    expect(widget.id).toBe("calculator");
    expect(widget.type).toBe("calculator");
    expect(widget.enable).toBe(true);
    expect(widget.isPublic).toBe(true);
  });

  it("creates search widgets with default finite sizes", () => {
    const search = createWidgetFromCatalog(getWidgetCatalogItem("search")!);

    expect(search).toMatchObject({ type: "search", colSpan: 2, rowSpan: 1 });
    expect(getWidgetCatalogItem("quote")).toBeUndefined();
  });

  it("creates canonical iTab weather widgets from the user-facing weather item", () => {
    const weather = createWidgetFromCatalog(getWidgetCatalogItem("weather")!);

    expect(weather).toMatchObject({
      id: "weather",
      type: "itab-weather-00",
      colSpan: 2,
      rowSpan: 1,
      w: 2,
      h: 1,
      data: {
        runtime: "itab-weather",
        version: 1,
        sizeKey: "1x2",
      },
    });
  });

  it("creates canonical iTab clock widgets from the user-facing clock item", () => {
    const clock = createWidgetFromCatalog(getWidgetCatalogItem("clock")!);

    expect(clock).toMatchObject({
      id: "clock",
      type: ITAB_CLOCK_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "itab-clock",
        version: 1,
        sizeKey: "2x2",
        showSeconds: true,
      },
    });
  });

  it("creates canonical iTab Todo widgets from the user-facing Todo item", () => {
    const todo = createWidgetFromCatalog(getWidgetCatalogItem("todo")!);

    expect(todo).toMatchObject({
      id: "todo",
      type: ITAB_TODO_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "itab-todo",
        version: 1,
        sizeKey: "2x2",
        tasks: [],
      },
    });
  });

  it("creates canonical iTab Memo widgets from the user-facing Memo item", () => {
    const memo = createWidgetFromCatalog(getWidgetCatalogItem("memo")!);

    expect(memo).toMatchObject({
      id: "memo",
      type: ITAB_MEMO_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "itab-memo",
        version: 1,
        sizeKey: "2x2",
      },
    });
    expect(memo.data.notes[0]).toMatchObject({
      id: "memo-tip",
      title: "iTab操作小技巧",
    });
  });

  it("creates canonical iTab poem widgets from the user-facing poem item", () => {
    const poem = createWidgetFromCatalog(getWidgetCatalogItem("poem")!);

    expect(poem).toMatchObject({
      id: "poem",
      type: ITAB_POEM_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "itab-poem",
        version: 1,
        sizeKey: "2x2",
      },
    });
  });

  it("creates canonical iTab daily English widgets from the user-facing item", () => {
    const dailyEnglish = createWidgetFromCatalog(
      getWidgetCatalogItem("daily-english")!,
    );

    expect(dailyEnglish).toMatchObject({
      id: "daily-english",
      type: ITAB_DAILY_ENGLISH_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "itab-daily-english",
        version: 1,
        sizeKey: "2x2",
      },
    });
  });

  it("creates canonical iTab Pomodoro widgets from the user-facing Pomodoro item", () => {
    const pomodoro = createWidgetFromCatalog(getWidgetCatalogItem("pomodoro")!);

    expect(pomodoro).toMatchObject({
      id: "pomodoro",
      type: ITAB_POMODORO_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "itab-pomodoro",
        version: 1,
        sizeKey: "2x2",
        duration: 1500,
        remainingSeconds: 1500,
        isRunning: false,
        sessions: 0,
      },
    });
  });

  it("creates canonical iTab anniversary widgets from the user-facing anniversary item", () => {
    const anniversary = createWidgetFromCatalog(
      getWidgetCatalogItem("anniversary")!,
    );

    expect(getWidgetCatalogItem(ITAB_ANNIVERSARY_WIDGET_TYPE)?.id).toBe(
      "anniversary",
    );
    expect(anniversary).toMatchObject({
      type: ITAB_ANNIVERSARY_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "itab-anniversary",
        version: 1,
        sizeKey: "2x2",
        title: "纪念日",
        eventName: "你在世界已经",
        date: "1997-10-1",
        backgroundMode: "image",
        mask: 0,
      },
    });
    expect(anniversary.id).toMatch(/^anniversary-/);
  });
});
