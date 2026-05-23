import { describe, expect, it } from "vitest";
import type { WidgetConfig } from "@/types";
import {
  createDefaultWidgetList,
  normalizeIncomingWidgets,
} from "./widgetUtils";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import { ITAB_TODO_WIDGET_TYPE } from "@/features/itab-todo/itabTodoTypes";
import { ITAB_MEMO_WIDGET_TYPE } from "@/features/itab-memo/itabMemoTypes";
import { ITAB_CLOCK_WIDGET_TYPE } from "@/features/itab-clock/itabClockTypes";
import { ITAB_DAILY_ENGLISH_WIDGET_TYPE } from "@/features/itab-daily-english/itabDailyEnglishTypes";
import { ITAB_POMODORO_WIDGET_TYPE } from "@/features/itab-pomodoro/itabPomodoroTypes";
import { ITAB_POEM_WIDGET_TYPE } from "@/features/itab-poem/itabPoemTypes";
import { ITAB_ANNIVERSARY_WIDGET_TYPE } from "@/features/itab-anniversary/itabAnniversaryTypes";

const publicClock: WidgetConfig = {
  id: "clock-public",
  type: "clock",
  enable: true,
  isPublic: true,
};

describe("normalizeIncomingWidgets", () => {
  it("does not include removed widgets in default authenticated payloads", () => {
    const widgets = createDefaultWidgetList(true);

    expect(widgets.some((widget) => widget.type === "memo")).toBe(false);
    expect(widgets.some((widget) => widget.type === "todo")).toBe(false);
    expect(widgets.some((widget) => widget.type === "pomodoro")).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_TODO_WIDGET_TYPE),
    ).toBe(true);
    expect(
      widgets.some((widget) => widget.type === ITAB_MEMO_WIDGET_TYPE),
    ).toBe(true);
    expect(
      widgets.some((widget) => widget.type === ITAB_DAILY_ENGLISH_WIDGET_TYPE),
    ).toBe(true);
    expect(
      widgets.some((widget) => widget.type === ITAB_POMODORO_WIDGET_TYPE),
    ).toBe(true);
    expect(
      widgets.some((widget) => widget.type === ITAB_ANNIVERSARY_WIDGET_TYPE),
    ).toBe(true);
    expect(widgets.some((widget) => widget.type === "music")).toBe(false);
    expect(widgets.some((widget) => widget.type === "player")).toBe(false);
  });

  it("rebuilds unversioned guest widget payloads from iTab defaults", () => {
    const widgets = normalizeIncomingWidgets([publicClock], false);

    expect(widgets.some((widget) => widget.type === "clock")).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_CLOCK_WIDGET_TYPE),
    ).toBe(true);
    expect(widgets.some((widget) => widget.type === "memo")).toBe(false);
    expect(widgets.some((widget) => widget.type === "todo")).toBe(false);
    expect(widgets.some((widget) => widget.type === "pomodoro")).toBe(false);
    expect(widgets.some((widget) => widget.type === "clock")).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_CLOCK_WIDGET_TYPE),
    ).toBe(true);
    expect(
      widgets.some((widget) => widget.type === ITAB_TODO_WIDGET_TYPE),
    ).toBe(true);
    expect(
      widgets.some((widget) => widget.type === ITAB_MEMO_WIDGET_TYPE),
    ).toBe(true);
    expect(
      widgets.some((widget) => widget.type === ITAB_DAILY_ENGLISH_WIDGET_TYPE),
    ).toBe(true);
    expect(
      widgets.some((widget) => widget.type === ITAB_POMODORO_WIDGET_TYPE),
    ).toBe(true);
    expect(
      widgets.some((widget) => widget.type === ITAB_ANNIVERSARY_WIDGET_TYPE),
    ).toBe(true);
  });

  it("keeps an empty server-filtered guest widget list empty", () => {
    expect(normalizeIncomingWidgets([], false)).toEqual([]);
  });

  it("still restores missing default widgets for authenticated users", () => {
    const widgets = normalizeIncomingWidgets([publicClock], true);

    expect(widgets.some((widget) => widget.type === "memo")).toBe(false);
    expect(widgets.some((widget) => widget.type === "todo")).toBe(false);
    expect(widgets.some((widget) => widget.type === "clock")).toBe(false);
    expect(widgets.some((widget) => widget.type === "pomodoro")).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_CLOCK_WIDGET_TYPE),
    ).toBe(true);
    expect(
      widgets.some((widget) => widget.type === ITAB_TODO_WIDGET_TYPE),
    ).toBe(true);
    expect(
      widgets.some((widget) => widget.type === ITAB_MEMO_WIDGET_TYPE),
    ).toBe(true);
    expect(
      widgets.some((widget) => widget.type === ITAB_DAILY_ENGLISH_WIDGET_TYPE),
    ).toBe(true);
    expect(
      widgets.some((widget) => widget.type === ITAB_POMODORO_WIDGET_TYPE),
    ).toBe(true);
    expect(widgets.some((widget) => widget.type === "music")).toBe(false);
    expect(widgets.some((widget) => widget.type === "player")).toBe(false);
  });

  it("filters removed widgets from mixed authenticated payloads before fallback restore", () => {
    const widgets = normalizeIncomingWidgets(
      [
        publicClock,
        { id: "memo", type: "memo", enable: true, isPublic: true },
        { id: "todo", type: "todo", enable: true, isPublic: true },
        { id: "pomodoro", type: "pomodoro", enable: true, isPublic: true },
        { id: "music", type: "music", enable: true, isPublic: true },
        { id: "player", type: "player", enable: true, isPublic: true },
      ],
      true,
    );

    expect(widgets.some((widget) => widget.type === "clock")).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_CLOCK_WIDGET_TYPE),
    ).toBe(true);
    expect(widgets.some((widget) => widget.type === "memo")).toBe(false);
    expect(widgets.some((widget) => widget.type === "todo")).toBe(false);
    expect(widgets.some((widget) => widget.type === "pomodoro")).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_TODO_WIDGET_TYPE),
    ).toBe(true);
    expect(
      widgets.some((widget) => widget.type === ITAB_MEMO_WIDGET_TYPE),
    ).toBe(true);
    expect(
      widgets.some((widget) => widget.type === ITAB_DAILY_ENGLISH_WIDGET_TYPE),
    ).toBe(true);
    expect(
      widgets.some((widget) => widget.type === ITAB_POMODORO_WIDGET_TYPE),
    ).toBe(true);
    expect(widgets.some((widget) => widget.type === "music")).toBe(false);
    expect(widgets.some((widget) => widget.type === "player")).toBe(false);
  });

  it("filters removed widgets from guest and server-filtered payloads", () => {
    const widgets = normalizeIncomingWidgets(
      [
        { id: "memo", type: "memo", enable: true, isPublic: true },
        { id: "todo", type: "todo", enable: true, isPublic: true },
        { id: "pomodoro", type: "pomodoro", enable: true, isPublic: true },
        { id: "music", type: "music", enable: true, isPublic: true },
        { id: "player", type: "player", enable: true, isPublic: true },
      ],
      false,
    );

    expect(widgets).toEqual([]);
  });

  it("does not restore removed widgets when fallback defaults are used", () => {
    const widgets = normalizeIncomingWidgets(undefined, true);

    expect(widgets.length).toBeGreaterThan(0);
    expect(widgets.some((widget) => widget.type === "memo")).toBe(false);
    expect(widgets.some((widget) => widget.type === "todo")).toBe(false);
    expect(widgets.some((widget) => widget.type === "clock")).toBe(false);
    expect(widgets.some((widget) => widget.type === "pomodoro")).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_CLOCK_WIDGET_TYPE),
    ).toBe(true);
    expect(
      widgets.some((widget) => widget.type === ITAB_TODO_WIDGET_TYPE),
    ).toBe(true);
    expect(
      widgets.some((widget) => widget.type === ITAB_MEMO_WIDGET_TYPE),
    ).toBe(true);
    expect(
      widgets.some((widget) => widget.type === ITAB_DAILY_ENGLISH_WIDGET_TYPE),
    ).toBe(true);
    expect(
      widgets.some((widget) => widget.type === ITAB_POMODORO_WIDGET_TYPE),
    ).toBe(true);
    expect(widgets.some((widget) => widget.type === "music")).toBe(false);
    expect(widgets.some((widget) => widget.type === "player")).toBe(false);
  });

  it("uses canonical iTab weather defaults and destructively removes old weather widgets", () => {
    const defaults = createDefaultWidgetList(true);
    const defaultWeather = defaults.find((widget) => widget.id === "weather");

    expect(defaultWeather).toMatchObject({
      id: "weather",
      type: "itab-weather-00",
      colSpan: 2,
      rowSpan: 1,
      w: 2,
      h: 1,
      data: {
        runtime: "itab-weather",
        version: 1,
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        sizeKey: "1x2",
      },
    });

    const normalized = normalizeIncomingWidgets(
      [
        { id: "old-weather", type: "weather", enable: true, isPublic: true },
        publicClock,
      ],
      true,
    );

    expect(normalized.some((widget) => widget.type === "weather")).toBe(false);
    expect(normalized.some((widget) => widget.type === "clock")).toBe(false);
    expect(normalized.find((widget) => widget.id === "weather")).toMatchObject({
      type: "itab-weather-00",
      data: expect.objectContaining({ sizeKey: "1x2" }),
    });
  });

  it("uses canonical iTab clock defaults and destructively removes old clock widgets", () => {
    const defaults = createDefaultWidgetList(true);
    const defaultClock = defaults.find((widget) => widget.id === "clock");

    expect(defaultClock).toMatchObject({
      id: "clock",
      type: ITAB_CLOCK_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "itab-clock",
        version: 1,
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        sizeKey: "2x2",
        showSeconds: true,
      },
    });

    const normalized = normalizeIncomingWidgets(
      [
        {
          id: "old-clock",
          type: "clock",
          enable: true,
          isPublic: true,
          data: { style: "retro" },
        },
        {
          id: "weather",
          type: "itab-weather-00",
          enable: true,
          isPublic: true,
          data: {
            runtime: "itab-weather",
            version: 1,
            layoutSystem: ITAB_GRID_SCHEMA_VERSION,
            sizeKey: "1x2",
          },
        },
      ],
      true,
    );

    expect(normalized.some((widget) => widget.type === "clock")).toBe(false);
    expect(normalized.find((widget) => widget.id === "clock")).toMatchObject({
      type: ITAB_CLOCK_WIDGET_TYPE,
      data: expect.objectContaining({ sizeKey: "2x2" }),
    });
  });

  it("keeps persisted canonical iTab clock id, seconds setting, and size", () => {
    const normalized = normalizeIncomingWidgets(
      [
        {
          id: "legacy-clock-id",
          type: ITAB_CLOCK_WIDGET_TYPE,
          enable: true,
          isPublic: true,
          w: 4,
          h: 2,
          colSpan: 4,
          rowSpan: 2,
          data: {
            runtime: "itab-clock",
            version: 1,
            layoutSystem: ITAB_GRID_SCHEMA_VERSION,
            sizeKey: "2x4",
            showSeconds: false,
          },
        },
      ],
      true,
    );

    expect(normalized.find((widget) => widget.id === "clock")).toMatchObject({
      type: ITAB_CLOCK_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({
        sizeKey: "2x4",
        showSeconds: false,
      }),
    });
  });

  it("normalizes canonical iTab weather size data without StartDeck size inversion", () => {
    const normalized = normalizeIncomingWidgets(
      [
        {
          id: "legacy-id",
          type: "itab-weather-00",
          enable: true,
          isPublic: true,
          data: {
            runtime: "itab-weather",
            version: 1,
            layoutSystem: ITAB_GRID_SCHEMA_VERSION,
            sizeKey: "1x2",
          },
        },
      ],
      true,
    );

    expect(normalized.find((widget) => widget.id === "weather")).toMatchObject({
      type: "itab-weather-00",
      colSpan: 2,
      rowSpan: 1,
      data: expect.objectContaining({ sizeKey: "1x2" }),
    });
  });

  it("keeps persisted canonical iTab weather id and size", () => {
    const normalized = normalizeIncomingWidgets(
      [
        {
          id: "weather",
          type: "itab-weather-00",
          enable: true,
          isPublic: true,
          w: 2,
          h: 2,
          colSpan: 2,
          rowSpan: 2,
          data: {
            runtime: "itab-weather",
            version: 1,
            layoutSystem: ITAB_GRID_SCHEMA_VERSION,
            sizeKey: "2x2",
          },
        },
        {
          id: "old-weather",
          type: "weather",
          enable: true,
          isPublic: true,
        },
      ],
      true,
    );

    expect(normalized.some((widget) => widget.type === "weather")).toBe(false);
    expect(normalized.find((widget) => widget.id === "weather")).toMatchObject({
      type: "itab-weather-00",
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: expect.objectContaining({ sizeKey: "2x2" }),
    });
  });

  it("uses canonical iTab Todo defaults and destructively removes old Todo widgets", () => {
    const defaults = createDefaultWidgetList(true);
    const defaultTodo = defaults.find((widget) => widget.id === "todo");

    expect(defaultTodo).toMatchObject({
      id: "todo",
      type: ITAB_TODO_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "itab-todo",
        version: 1,
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        sizeKey: "2x2",
        tasks: [],
      },
    });

    const normalized = normalizeIncomingWidgets(
      [
        {
          id: "old-todo",
          type: "todo",
          enable: true,
          isPublic: true,
          data: [{ id: "legacy", text: "legacy task", done: false }],
        },
        publicClock,
      ],
      true,
    );

    expect(normalized.some((widget) => widget.type === "todo")).toBe(false);
    expect(normalized.find((widget) => widget.id === "todo")).toMatchObject({
      type: ITAB_TODO_WIDGET_TYPE,
      data: expect.objectContaining({ sizeKey: "2x2", tasks: [] }),
    });
  });

  it("keeps persisted canonical iTab Todo id, tasks, and size", () => {
    const normalized = normalizeIncomingWidgets(
      [
        {
          id: "legacy-todo-id",
          type: ITAB_TODO_WIDGET_TYPE,
          enable: true,
          isPublic: true,
          w: 4,
          h: 2,
          colSpan: 4,
          rowSpan: 2,
          data: {
            runtime: "itab-todo",
            version: 1,
            layoutSystem: ITAB_GRID_SCHEMA_VERSION,
            sizeKey: "2x4",
            tasks: [{ id: "task-1", text: "评审 UI", done: false }],
          },
        },
      ],
      true,
    );

    expect(normalized.find((widget) => widget.id === "todo")).toMatchObject({
      type: ITAB_TODO_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({
        sizeKey: "2x4",
        tasks: [{ id: "task-1", text: "评审 UI", done: false }],
      }),
    });
  });

  it("uses canonical iTab Memo defaults and destructively removes old Memo widgets", () => {
    const defaults = createDefaultWidgetList(true);
    const defaultMemo = defaults.find((widget) => widget.id === "memo");

    expect(defaultMemo).toMatchObject({
      id: "memo",
      type: ITAB_MEMO_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "itab-memo",
        version: 1,
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        sizeKey: "2x2",
      },
    });
    expect(defaultMemo?.data.notes[0]).toMatchObject({
      id: "memo-tip",
      title: "iTab操作小技巧",
    });

    const normalized = normalizeIncomingWidgets(
      [
        {
          id: "old-memo",
          type: "memo",
          enable: true,
          isPublic: true,
          data: { content: "legacy memo", server_ts: 1, mode: "simple" },
        },
        publicClock,
      ],
      true,
    );

    expect(normalized.some((widget) => widget.type === "memo")).toBe(false);
    const memo = normalized.find((widget) => widget.id === "memo");
    expect(memo).toMatchObject({
      type: ITAB_MEMO_WIDGET_TYPE,
      data: expect.objectContaining({ sizeKey: "2x2" }),
    });
    expect(memo?.data.notes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "memo-tip" })]),
    );
  });

  it("keeps persisted canonical iTab Memo id, notes, and size", () => {
    const normalized = normalizeIncomingWidgets(
      [
        {
          id: "legacy-memo-id",
          type: ITAB_MEMO_WIDGET_TYPE,
          enable: true,
          isPublic: true,
          w: 4,
          h: 2,
          colSpan: 4,
          rowSpan: 2,
          data: {
            runtime: "itab-memo",
            version: 1,
            layoutSystem: ITAB_GRID_SCHEMA_VERSION,
            sizeKey: "2x4",
            notes: [
              {
                id: "note-1",
                title: "评审 UI",
                body: "补充检查",
                pinned: true,
                createdAt: "2026-05-22T00:00:00.000Z",
                updatedAt: "2026-05-22T00:01:00.000Z",
              },
            ],
          },
        },
      ],
      true,
    );

    expect(normalized.find((widget) => widget.id === "memo")).toMatchObject({
      type: ITAB_MEMO_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({
        sizeKey: "2x4",
        notes: [
          expect.objectContaining({
            id: "note-1",
            title: "评审 UI",
            pinned: true,
          }),
        ],
      }),
    });
  });

  it("destructively removes old poem widgets and keeps canonical poem size data", () => {
    const normalized = normalizeIncomingWidgets(
      [
        { id: "old-poem", type: "poem", enable: true, isPublic: true },
        {
          id: "legacy-poem-id",
          type: ITAB_POEM_WIDGET_TYPE,
          enable: true,
          isPublic: true,
          w: 4,
          h: 2,
          colSpan: 4,
          rowSpan: 2,
          data: {
            runtime: "itab-poem",
            version: 1,
            layoutSystem: ITAB_GRID_SCHEMA_VERSION,
            sizeKey: "2x4",
          },
        },
      ],
      true,
    );

    expect(normalized.some((widget) => widget.type === "poem")).toBe(false);
    expect(normalized.find((widget) => widget.id === "poem")).toMatchObject({
      type: ITAB_POEM_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({ sizeKey: "2x4" }),
    });
  });

  it("uses canonical iTab daily English defaults and size metadata", () => {
    const defaults = createDefaultWidgetList(true);
    const dailyEnglish = defaults.find(
      (widget) => widget.id === "daily-english",
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
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        sizeKey: "2x2",
      },
    });
  });

  it("keeps persisted canonical iTab daily English id and size", () => {
    const normalized = normalizeIncomingWidgets(
      [
        {
          id: "legacy-daily-id",
          type: ITAB_DAILY_ENGLISH_WIDGET_TYPE,
          enable: true,
          isPublic: true,
          w: 4,
          h: 2,
          colSpan: 4,
          rowSpan: 2,
          data: {
            runtime: "itab-daily-english",
            version: 1,
            layoutSystem: ITAB_GRID_SCHEMA_VERSION,
            sizeKey: "2x4",
            sentence: "do not persist",
          },
        },
      ],
      true,
    );

    expect(
      normalized.find((widget) => widget.id === "daily-english"),
    ).toMatchObject({
      type: ITAB_DAILY_ENGLISH_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: {
        runtime: "itab-daily-english",
        version: 1,
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        sizeKey: "2x4",
      },
    });
  });

  it("uses canonical iTab Pomodoro defaults and destructively removes old Pomodoro widgets", () => {
    const defaults = createDefaultWidgetList(true);
    const defaultPomodoro = defaults.find((widget) => widget.id === "pomodoro");

    expect(defaultPomodoro).toMatchObject({
      id: "pomodoro",
      type: ITAB_POMODORO_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "itab-pomodoro",
        version: 1,
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        sizeKey: "2x2",
        duration: 1500,
        remainingSeconds: 1500,
        phase: "idle",
        isRunning: false,
        sessions: 0,
        themeIndex: 0,
        audioEnabled: true,
      },
    });

    const normalized = normalizeIncomingWidgets(
      [
        {
          id: "old-pomodoro",
          type: "pomodoro",
          enable: true,
          isPublic: true,
          data: { remainingSeconds: 900, isRunning: true },
        },
        publicClock,
      ],
      true,
    );

    expect(normalized.some((widget) => widget.type === "pomodoro")).toBe(false);
    expect(normalized.find((widget) => widget.id === "pomodoro")).toMatchObject(
      {
        type: ITAB_POMODORO_WIDGET_TYPE,
        data: expect.objectContaining({
          sizeKey: "2x2",
          remainingSeconds: 1500,
          isRunning: false,
        }),
      },
    );
  });

  it("keeps persisted canonical iTab Pomodoro id, timer state, and size", () => {
    const normalized = normalizeIncomingWidgets(
      [
        {
          id: "legacy-pomodoro-id",
          type: ITAB_POMODORO_WIDGET_TYPE,
          enable: true,
          isPublic: true,
          w: 4,
          h: 2,
          colSpan: 4,
          rowSpan: 2,
          data: {
            runtime: "itab-pomodoro",
            version: 1,
            layoutSystem: ITAB_GRID_SCHEMA_VERSION,
            sizeKey: "2x4",
            duration: 1800,
            remainingSeconds: 900,
            phase: "focus",
            isRunning: true,
            sessions: 3,
            themeIndex: 2,
            audioEnabled: false,
          },
        },
      ],
      true,
    );

    expect(normalized.find((widget) => widget.id === "pomodoro")).toMatchObject(
      {
        type: ITAB_POMODORO_WIDGET_TYPE,
        colSpan: 4,
        rowSpan: 2,
        w: 4,
        h: 2,
        data: expect.objectContaining({
          sizeKey: "2x4",
          duration: 1800,
          remainingSeconds: 900,
          phase: "focus",
          isRunning: true,
          sessions: 3,
          themeIndex: 2,
          audioEnabled: false,
        }),
      },
    );
  });

  it("uses canonical iTab anniversary defaults and keeps persisted size/style data", () => {
    const defaults = createDefaultWidgetList(true);
    const defaultAnniversary = defaults.find(
      (widget) => widget.id === "anniversary",
    );

    expect(defaultAnniversary).toMatchObject({
      id: "anniversary",
      type: ITAB_ANNIVERSARY_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "itab-anniversary",
        version: 1,
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        sizeKey: "2x2",
        title: "纪念日",
        eventName: "你在世界已经",
        backgroundMode: "image",
        mask: 0,
      },
    });

    const normalized = normalizeIncomingWidgets(
      [
        {
          id: "legacy-anniversary-id",
          type: ITAB_ANNIVERSARY_WIDGET_TYPE,
          enable: true,
          isPublic: true,
          w: 4,
          h: 2,
          colSpan: 4,
          rowSpan: 2,
          data: {
            runtime: "itab-anniversary",
            version: 1,
            layoutSystem: ITAB_GRID_SCHEMA_VERSION,
            sizeKey: "2x4",
            title: "发薪提醒",
            label: "发工资还有",
            eventName: "发工资还有",
            date: "2023-12-01",
            mode: "remaining",
            repeat: "每月",
            textColor: "#2196f3",
            backgroundMode: "color",
            backgroundColor: "#ffffff",
            backgroundImage: "/itab-live-assets/anniversary/yiyan-12.webp",
            mask: 35,
          },
        },
      ],
      true,
    );

    expect(
      normalized.find((widget) => widget.id === "legacy-anniversary-id"),
    ).toMatchObject({
      type: ITAB_ANNIVERSARY_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({
        sizeKey: "2x4",
        eventName: "发工资还有",
        repeat: "每月",
        mask: 35,
      }),
    });
  });

  it("destructively rebuilds old StartDeck layout payloads instead of converting them", () => {
    const normalized = normalizeIncomingWidgets(
      [
        {
          id: "legacy-clock",
          type: "clock",
          enable: true,
          isPublic: true,
          x: 9,
          y: 9,
          w: 3,
          h: 2,
          colSpan: 3,
          rowSpan: 2,
        },
      ],
      true,
    );

    expect(
      normalized.find((widget) => widget.id === "legacy-clock"),
    ).toBeUndefined();
    expect(
      normalized.every(
        (widget) =>
          widget.data &&
          typeof widget.data === "object" &&
          (widget.data as { layoutSystem?: unknown }).layoutSystem ===
            ITAB_GRID_SCHEMA_VERSION,
      ),
    ).toBe(true);
  });
});
