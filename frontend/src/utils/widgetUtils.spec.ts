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
import {
  ITAB_MOVIE_CALENDAR_CATALOG_ID,
  ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
} from "@/features/itab-movie-calendar/itabMovieCalendarTypes";
import {
  ITAB_IP_CATALOG_ID,
  ITAB_IP_WIDGET_TYPE,
} from "@/features/itab-ip/itabIpTypes";
import {
  ITAB_CALENDAR_CATALOG_ID,
  ITAB_CALENDAR_WIDGET_TYPE,
} from "@/features/itab-calendar/itabCalendarTypes";
import { ITAB_NUMBER_UPPERCASE_WIDGET_TYPE } from "@/features/itab-number-uppercase/itabNumberUppercaseTypes";
import { ITAB_FOOD_PICKER_WIDGET_TYPE } from "@/features/itab-food-picker/itabFoodPickerTypes";

const publicClock: WidgetConfig = {
  id: "clock-public",
  type: "clock",
  enable: true,
  isPublic: true,
};

const removedMainLegacyWidgetTypes = [
  "search",
  "div-card",
  "bookmarks",
  "countdown",
  "countup",
  "calculator",
  "hot",
  "rss",
  "sidebar",
];

const expectOnlyDockerDefault = (widgets: WidgetConfig[]) => {
  expect(widgets).toHaveLength(1);
  expect(widgets[0]).toMatchObject({
    id: "docker",
    type: "docker",
    enable: true,
    isPublic: false,
    hideOnMobile: true,
    colSpan: 2,
    rowSpan: 2,
    w: 2,
    h: 2,
  });
};

describe("normalizeIncomingWidgets", () => {
  it("only includes Docker in default authenticated widget payloads", () => {
    const widgets = createDefaultWidgetList(true);

    expectOnlyDockerDefault(widgets);
    expect(widgets.some((widget) => widget.type === "memo")).toBe(false);
    expect(widgets.some((widget) => widget.type === "todo")).toBe(false);
    expect(widgets.some((widget) => widget.type === "pomodoro")).toBe(false);
    expect(widgets.some((widget) => widget.type === "calendar")).toBe(false);
    for (const type of removedMainLegacyWidgetTypes) {
      expect(widgets.some((widget) => widget.type === type)).toBe(false);
    }
    expect(
      widgets.some((widget) => widget.type === ITAB_TODO_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_MEMO_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_DAILY_ENGLISH_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_POMODORO_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_ANNIVERSARY_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_MOVIE_CALENDAR_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_CALENDAR_WIDGET_TYPE),
    ).toBe(false);
    expect(widgets.some((widget) => widget.type === ITAB_IP_WIDGET_TYPE)).toBe(
      false,
    );
    expect(widgets.some((widget) => widget.type === "music")).toBe(false);
    expect(widgets.some((widget) => widget.type === "player")).toBe(false);
  });

  it("removes unversioned guest widget payloads instead of rebuilding defaults", () => {
    const widgets = normalizeIncomingWidgets([publicClock], false);

    expect(widgets).toEqual([]);
  });

  it("keeps an empty server-filtered guest widget list empty", () => {
    expect(normalizeIncomingWidgets([], false)).toEqual([]);
  });

  it("restores only Docker as the authenticated default widget", () => {
    const widgets = normalizeIncomingWidgets([publicClock], true);

    expectOnlyDockerDefault(widgets);
    expect(widgets.some((widget) => widget.type === "memo")).toBe(false);
    expect(widgets.some((widget) => widget.type === "todo")).toBe(false);
    expect(widgets.some((widget) => widget.type === "clock")).toBe(false);
    expect(widgets.some((widget) => widget.type === "pomodoro")).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_CLOCK_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_TODO_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_MEMO_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_DAILY_ENGLISH_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_POMODORO_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_MOVIE_CALENDAR_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_CALENDAR_WIDGET_TYPE),
    ).toBe(false);
    expect(widgets.some((widget) => widget.type === "music")).toBe(false);
    expect(widgets.some((widget) => widget.type === "player")).toBe(false);
  });

  it("filters removed widgets from mixed authenticated payloads before Docker fallback restore", () => {
    const widgets = normalizeIncomingWidgets(
      [
        publicClock,
        { id: "memo", type: "memo", enable: true, isPublic: true },
        { id: "todo", type: "todo", enable: true, isPublic: true },
        { id: "pomodoro", type: "pomodoro", enable: true, isPublic: true },
        { id: "calendar", type: "calendar", enable: true, isPublic: true },
        { id: "music", type: "music", enable: true, isPublic: true },
        { id: "player", type: "player", enable: true, isPublic: true },
        ...removedMainLegacyWidgetTypes.map((type) => ({
          id: type,
          type,
          enable: true,
          isPublic: true,
        })),
      ],
      true,
    );

    expectOnlyDockerDefault(widgets);
    expect(widgets.some((widget) => widget.type === "clock")).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_CLOCK_WIDGET_TYPE),
    ).toBe(false);
    expect(widgets.some((widget) => widget.type === "memo")).toBe(false);
    expect(widgets.some((widget) => widget.type === "todo")).toBe(false);
    expect(widgets.some((widget) => widget.type === "pomodoro")).toBe(false);
    expect(widgets.some((widget) => widget.type === "calendar")).toBe(false);
    for (const type of removedMainLegacyWidgetTypes) {
      expect(widgets.some((widget) => widget.type === type)).toBe(false);
    }
    expect(
      widgets.some((widget) => widget.type === ITAB_TODO_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_MEMO_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_DAILY_ENGLISH_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_POMODORO_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_MOVIE_CALENDAR_WIDGET_TYPE),
    ).toBe(false);
    expect(widgets.some((widget) => widget.type === "music")).toBe(false);
    expect(widgets.some((widget) => widget.type === "player")).toBe(false);
  });

  it("filters removed widgets from guest and server-filtered payloads", () => {
    const widgets = normalizeIncomingWidgets(
      [
        { id: "memo", type: "memo", enable: true, isPublic: true },
        { id: "todo", type: "todo", enable: true, isPublic: true },
        { id: "pomodoro", type: "pomodoro", enable: true, isPublic: true },
        { id: "calendar", type: "calendar", enable: true, isPublic: true },
        { id: "music", type: "music", enable: true, isPublic: true },
        { id: "player", type: "player", enable: true, isPublic: true },
        ...removedMainLegacyWidgetTypes.map((type) => ({
          id: type,
          type,
          enable: true,
          isPublic: true,
        })),
      ],
      false,
    );

    expect(widgets).toEqual([]);
  });

  it("restores only Docker when fallback defaults are used", () => {
    const widgets = normalizeIncomingWidgets(undefined, true);

    expectOnlyDockerDefault(widgets);
    expect(widgets.some((widget) => widget.type === "memo")).toBe(false);
    expect(widgets.some((widget) => widget.type === "todo")).toBe(false);
    expect(widgets.some((widget) => widget.type === "clock")).toBe(false);
    expect(widgets.some((widget) => widget.type === "pomodoro")).toBe(false);
    expect(widgets.some((widget) => widget.type === "calendar")).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_CLOCK_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_TODO_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_MEMO_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_DAILY_ENGLISH_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_POMODORO_WIDGET_TYPE),
    ).toBe(false);
    expect(
      widgets.some((widget) => widget.type === ITAB_MOVIE_CALENDAR_WIDGET_TYPE),
    ).toBe(false);
    expect(widgets.some((widget) => widget.type === "music")).toBe(false);
    expect(widgets.some((widget) => widget.type === "player")).toBe(false);
  });

  it("keeps Docker singleton settings, unknown keys, and runtime size data", () => {
    const normalized = normalizeIncomingWidgets(
      [
        {
          id: "docker-copy",
          type: "docker",
          enable: true,
          isPublic: false,
          hideOnMobile: true,
          w: 4,
          h: 2,
          colSpan: 4,
          rowSpan: 2,
          data: {
            layoutSystem: ITAB_GRID_SCHEMA_VERSION,
            autoUpdate: true,
            autoUpdateKeepImages: 5,
            autoUpdateMinFreeGB: 8,
            lanHost: "nas.local",
            publicHost: "public.example.com",
            publicHosts: { nginx: "nginx.example.com" },
            disabledContainers: ["nginx"],
            unknownDockerKey: { keep: true },
          },
        },
      ],
      true,
    );

    expect(
      normalized.filter((widget) => widget.type === "docker"),
    ).toHaveLength(1);
    expect(normalized.find((widget) => widget.id === "docker")).toMatchObject({
      type: "docker",
      enable: true,
      isPublic: false,
      hideOnMobile: true,
      w: 4,
      h: 2,
      colSpan: 4,
      rowSpan: 2,
      data: {
        runtime: "docker",
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        sizeKey: "2x4",
        autoUpdate: true,
        publicHosts: { nginx: "nginx.example.com" },
        disabledContainers: ["nginx"],
        unknownDockerKey: { keep: true },
      },
    });
  });

  it("keeps SystemStatus top-level visibility fields and runtime data keys", () => {
    const normalized = normalizeIncomingWidgets(
      [
        {
          id: "system-copy",
          type: "system-status",
          enable: false,
          isPublic: false,
          hideOnMobile: true,
          w: 1,
          h: 2,
          colSpan: 1,
          rowSpan: 2,
          data: {
            layoutSystem: ITAB_GRID_SCHEMA_VERSION,
            unknownTelemetryKey: "keep",
          },
        },
      ],
      true,
    );

    expect(
      normalized.filter((widget) => widget.type === "system-status"),
    ).toHaveLength(1);
    expect(
      normalized.find((widget) => widget.id === "system-status"),
    ).toMatchObject({
      type: "system-status",
      enable: false,
      isPublic: false,
      hideOnMobile: true,
      w: 1,
      h: 2,
      colSpan: 1,
      rowSpan: 2,
      data: {
        runtime: "system-status",
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        sizeKey: "2x1",
        unknownTelemetryKey: "keep",
      },
    });
  });

  it("filters persisted iframe and status-monitor widgets for logged-in and guest normalization", () => {
    const persistedWidgets: WidgetConfig[] = [
      {
        id: "legacy-frame",
        type: "iframe",
        enable: true,
        isPublic: true,
        data: {
          layoutSystem: ITAB_GRID_SCHEMA_VERSION,
          sizeKey: "2x2",
          url: "https://example.com/embed",
        },
      },
      {
        id: "legacy-status-monitor",
        type: "status-monitor",
        enable: true,
        isPublic: true,
        data: {
          layoutSystem: ITAB_GRID_SCHEMA_VERSION,
          sizeKey: "1x1",
        },
      },
      {
        id: "custom-public",
        type: "custom-css",
        enable: true,
        isPublic: true,
        data: {
          layoutSystem: ITAB_GRID_SCHEMA_VERSION,
          sizeKey: "2x2",
          title: "Public HTML",
          html: '<iframe title="普通嵌入" src="https://example.com"></iframe>',
          css: "iframe { width: 100%; height: 100%; border: 0; }",
        },
      },
    ];

    const loggedIn = normalizeIncomingWidgets(persistedWidgets, true);
    const guest = normalizeIncomingWidgets(persistedWidgets, false);

    for (const normalized of [loggedIn, guest]) {
      expect(normalized.some((widget) => widget.type === "iframe")).toBe(false);
      expect(
        normalized.some((widget) => widget.type === "status-monitor"),
      ).toBe(false);
      expect(
        normalized.find((widget) => widget.id === "custom-public"),
      ).toMatchObject({
        type: "custom-css",
        data: expect.objectContaining({
          html: expect.stringContaining("<iframe"),
          sizeKey: "2x2",
        }),
      });
    }
  });

  it("normalizes and preserves custom-css runtime data", () => {
    const normalized = normalizeIncomingWidgets(
      [
        {
          id: "custom-runtime",
          type: "custom-css",
          enable: false,
          isPublic: false,
          hideOnMobile: true,
          w: 4,
          h: 2,
          colSpan: 4,
          rowSpan: 2,
          data: {
            layoutSystem: ITAB_GRID_SCHEMA_VERSION,
            sizeKey: "2x4",
            version: 7,
            title: "Operations Embed",
            html: '<section data-panel="ops">OK</section>',
            css: "[data-panel='ops'] { color: lime; }",
            js: "window.__ops = true;",
            ordinaryIframeEmbed:
              '<iframe title="普通 HTML 嵌入" src="https://example.com"></iframe>',
            unknownCustomKey: { keep: true },
          },
        },
      ],
      true,
    );

    expect(
      normalized.find((widget) => widget.id === "custom-runtime"),
    ).toMatchObject({
      type: "custom-css",
      enable: false,
      isPublic: false,
      hideOnMobile: true,
      w: 4,
      h: 2,
      colSpan: 4,
      rowSpan: 2,
      data: {
        runtime: "custom-css",
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        sizeKey: "2x4",
        version: 7,
        title: "Operations Embed",
        html: '<section data-panel="ops">OK</section>',
        css: "[data-panel='ops'] { color: lime; }",
        js: "window.__ops = true;",
        ordinaryIframeEmbed:
          '<iframe title="普通 HTML 嵌入" src="https://example.com"></iframe>',
        unknownCustomKey: { keep: true },
      },
    });
  });

  it("keeps iTab weather out of release defaults and destructively removes old weather widgets", () => {
    const defaults = createDefaultWidgetList(true);
    const defaultWeather = defaults.find((widget) => widget.id === "weather");

    expect(defaultWeather).toBeUndefined();

    const normalized = normalizeIncomingWidgets(
      [
        { id: "old-weather", type: "weather", enable: true, isPublic: true },
        publicClock,
      ],
      true,
    );

    expect(normalized.some((widget) => widget.type === "weather")).toBe(false);
    expect(normalized.some((widget) => widget.type === "clock")).toBe(false);
    expect(
      normalized.find((widget) => widget.id === "weather"),
    ).toBeUndefined();
    expectOnlyDockerDefault(normalized);
  });

  it("keeps iTab IP out of release defaults and destructively removes old IP widgets", () => {
    const defaults = createDefaultWidgetList(true);
    const defaultIp = defaults.find(
      (widget) => widget.id === ITAB_IP_CATALOG_ID,
    );

    expect(defaultIp).toBeUndefined();

    const normalized = normalizeIncomingWidgets(
      [{ id: "old-ip", type: "ip", enable: true, isPublic: true }, publicClock],
      true,
    );

    expect(normalized.some((widget) => widget.type === "ip")).toBe(false);
    expect(
      normalized.find((widget) => widget.id === ITAB_IP_CATALOG_ID),
    ).toBeUndefined();
    expectOnlyDockerDefault(normalized);
  });

  it("keeps iTab calendar out of release defaults and destructively removes old calendar widgets", () => {
    const defaults = createDefaultWidgetList(true);
    const defaultCalendar = defaults.find(
      (widget) => widget.id === ITAB_CALENDAR_CATALOG_ID,
    );

    expect(defaultCalendar).toBeUndefined();

    const normalized = normalizeIncomingWidgets(
      [
        { id: "old-calendar", type: "calendar", enable: true, isPublic: true },
        publicClock,
      ],
      true,
    );

    expect(normalized.some((widget) => widget.type === "calendar")).toBe(false);
    expect(
      normalized.find((widget) => widget.id === ITAB_CALENDAR_CATALOG_ID),
    ).toBeUndefined();
    expectOnlyDockerDefault(normalized);
  });

  it("keeps iTab clock out of release defaults and destructively removes old clock widgets", () => {
    const defaults = createDefaultWidgetList(true);
    const defaultClock = defaults.find((widget) => widget.id === "clock");

    expect(defaultClock).toBeUndefined();

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
    expect(normalized.find((widget) => widget.id === "clock")).toBeUndefined();
    expect(normalized.find((widget) => widget.id === "weather")).toMatchObject({
      type: "itab-weather-00",
      data: expect.objectContaining({ sizeKey: "1x2" }),
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

  it("keeps iTab Todo out of release defaults and destructively removes old Todo widgets", () => {
    const defaults = createDefaultWidgetList(true);
    const defaultTodo = defaults.find((widget) => widget.id === "todo");

    expect(defaultTodo).toBeUndefined();

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
    expect(normalized.find((widget) => widget.id === "todo")).toBeUndefined();
    expectOnlyDockerDefault(normalized);
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

  it("keeps iTab Memo out of release defaults and destructively removes old Memo widgets", () => {
    const defaults = createDefaultWidgetList(true);
    const defaultMemo = defaults.find((widget) => widget.id === "memo");

    expect(defaultMemo).toBeUndefined();

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
    expect(memo).toBeUndefined();
    expectOnlyDockerDefault(normalized);
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

  it.each([
    [
      "Todo",
      "legacy-todo-id",
      ITAB_TODO_WIDGET_TYPE,
      {
        runtime: "itab-todo",
        version: 1,
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        sizeKey: "4x4",
        tasks: [{ id: "task-1", text: "评审 UI", done: false }],
      },
      "todo",
    ],
    [
      "Memo",
      "legacy-memo-id",
      ITAB_MEMO_WIDGET_TYPE,
      {
        runtime: "itab-memo",
        version: 1,
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        sizeKey: "4x4",
        notes: [
          {
            id: "note-1",
            title: "评审 UI",
            body: "补充检查",
            pinned: false,
            createdAt: "2026-05-22T00:00:00.000Z",
            updatedAt: "2026-05-22T00:01:00.000Z",
          },
        ],
      },
      "memo",
    ],
  ])(
    "keeps persisted %s 4x4 geometry during incoming refresh normalization",
    (_label, id, type, data, canonicalId) => {
      const normalized = normalizeIncomingWidgets(
        [
          {
            id,
            type,
            enable: true,
            isPublic: true,
            w: 4,
            h: 4,
            colSpan: 4,
            rowSpan: 4,
            data,
          },
        ],
        true,
      );

      expect(
        normalized.find((widget) => widget.id === canonicalId),
      ).toMatchObject({
        type,
        colSpan: 4,
        rowSpan: 4,
        w: 4,
        h: 4,
        data: expect.objectContaining({ sizeKey: "4x4" }),
      });
    },
  );

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

  it("keeps iTab daily English out of release defaults", () => {
    const defaults = createDefaultWidgetList(true);
    const dailyEnglish = defaults.find(
      (widget) => widget.id === "daily-english",
    );

    expect(dailyEnglish).toBeUndefined();
  });

  it("keeps iTab movie calendar out of release defaults", () => {
    const defaults = createDefaultWidgetList(true);
    const movieCalendar = defaults.find(
      (widget) => widget.id === ITAB_MOVIE_CALENDAR_CATALOG_ID,
    );

    expect(movieCalendar).toBeUndefined();
  });

  it("keeps persisted canonical iTab movie calendar id and size", () => {
    const normalized = normalizeIncomingWidgets(
      [
        {
          id: "legacy-movie-calendar-id",
          type: ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
          enable: true,
          isPublic: true,
          w: 4,
          h: 2,
          colSpan: 4,
          rowSpan: 2,
          data: {
            runtime: "itab-movie-calendar",
            version: 1,
            layoutSystem: ITAB_GRID_SCHEMA_VERSION,
            sizeKey: "2x4",
            movieTitle: "红气球之旅",
          },
        },
      ],
      true,
    );

    expect(
      normalized.find((widget) => widget.id === ITAB_MOVIE_CALENDAR_CATALOG_ID),
    ).toMatchObject({
      type: ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: {
        runtime: "itab-movie-calendar",
        version: 1,
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        sizeKey: "2x4",
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

  it("keeps iTab Pomodoro out of release defaults and destructively removes old Pomodoro widgets", () => {
    const defaults = createDefaultWidgetList(true);
    const defaultPomodoro = defaults.find((widget) => widget.id === "pomodoro");

    expect(defaultPomodoro).toBeUndefined();

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
    expect(
      normalized.find((widget) => widget.id === "pomodoro"),
    ).toBeUndefined();
    expectOnlyDockerDefault(normalized);
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

  it("keeps multiple persisted canonical iTab food picker widgets and size data", () => {
    const normalized = normalizeIncomingWidgets(
      [
        {
          id: "food-a",
          type: ITAB_FOOD_PICKER_WIDGET_TYPE,
          enable: true,
          isPublic: true,
          w: 4,
          h: 2,
          colSpan: 4,
          rowSpan: 2,
          data: {
            runtime: "itab-food-picker",
            version: 1,
            layoutSystem: ITAB_GRID_SCHEMA_VERSION,
            sizeKey: "2x4",
            menuItems: ["面", "饭", "面"],
            currentItem: "饭",
          },
        },
        {
          id: "food-b",
          type: ITAB_FOOD_PICKER_WIDGET_TYPE,
          enable: false,
          isPublic: true,
          data: {
            runtime: "itab-food-picker",
            version: 1,
            sizeKey: "bad",
            menuItems: [],
            currentItem: "不存在",
          },
        },
      ],
      true,
    );

    expect(
      normalized.filter(
        (widget) => widget.type === ITAB_FOOD_PICKER_WIDGET_TYPE,
      ),
    ).toHaveLength(2);
    expect(normalized.find((widget) => widget.id === "food-a")).toMatchObject({
      type: ITAB_FOOD_PICKER_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({
        sizeKey: "2x4",
        menuItems: ["面", "饭"],
        currentItem: "饭",
      }),
    });
    expect(normalized.find((widget) => widget.id === "food-b")).toMatchObject({
      enable: false,
      type: ITAB_FOOD_PICKER_WIDGET_TYPE,
      data: expect.objectContaining({
        sizeKey: "2x2",
        currentItem: "",
      }),
    });
  });

  it("keeps multiple persisted canonical iTab number uppercase widgets and size data", () => {
    const normalized = normalizeIncomingWidgets(
      [
        {
          id: "amount-a",
          type: ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
          enable: true,
          isPublic: true,
          w: 4,
          h: 2,
          colSpan: 4,
          rowSpan: 2,
          data: {
            runtime: "itab-number-uppercase",
            version: 1,
            layoutSystem: ITAB_GRID_SCHEMA_VERSION,
            sizeKey: "2x4",
            inputNumber: "10001.05",
            uppercaseResult: "stale",
            formatMode: "currency",
          },
        },
        {
          id: "amount-b",
          type: ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
          enable: false,
          isPublic: true,
          data: {
            runtime: "itab-number-uppercase",
            version: 1,
            sizeKey: "bad",
            inputNumber: "1024",
            uppercaseResult: "stale",
            formatMode: "currency",
          },
        },
      ],
      true,
    );

    expect(
      normalized.filter(
        (widget) => widget.type === ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
      ),
    ).toHaveLength(2);
    expect(normalized.find((widget) => widget.id === "amount-a")).toMatchObject(
      {
        type: ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
        colSpan: 4,
        rowSpan: 2,
        w: 4,
        h: 2,
        data: expect.objectContaining({
          sizeKey: "2x4",
          inputNumber: "10001.05",
          uppercaseResult: "壹万零壹元伍分",
        }),
      },
    );
    expect(normalized.find((widget) => widget.id === "amount-b")).toMatchObject(
      {
        enable: false,
        type: ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
        data: expect.objectContaining({
          sizeKey: "2x2",
          uppercaseResult: "壹仟零贰拾肆元整",
        }),
      },
    );
  });

  it("keeps iTab anniversary out of release defaults and keeps persisted size/style data", () => {
    const defaults = createDefaultWidgetList(true);
    const defaultAnniversary = defaults.find(
      (widget) => widget.id === "anniversary",
    );

    expect(defaultAnniversary).toBeUndefined();

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
