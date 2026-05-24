/**
 * Widget-related utility functions extracted from main.ts.
 * These functions handle widget normalization, deduplication, and defaults.
 */

import type { WidgetConfig } from "@/types";
import { resolveWidgetDefaultSize } from "@/utils/widgetSizePresets";
import {
  ITAB_WEATHER_CATALOG_ID,
  ITAB_WEATHER_WIDGET_TYPE,
} from "@/features/itab-weather/itabWeatherTypes";
import {
  ITAB_TODO_CATALOG_ID,
  ITAB_TODO_WIDGET_TYPE,
} from "@/features/itab-todo/itabTodoTypes";
import {
  ITAB_MEMO_CATALOG_ID,
  ITAB_MEMO_WIDGET_TYPE,
} from "@/features/itab-memo/itabMemoTypes";
import {
  ITAB_CLOCK_CATALOG_ID,
  ITAB_CLOCK_WIDGET_TYPE,
} from "@/features/itab-clock/itabClockTypes";
import {
  ITAB_DAILY_ENGLISH_CATALOG_ID,
  ITAB_DAILY_ENGLISH_WIDGET_TYPE,
} from "@/features/itab-daily-english/itabDailyEnglishTypes";
import {
  ITAB_POEM_CATALOG_ID,
  ITAB_POEM_WIDGET_TYPE,
} from "@/features/itab-poem/itabPoemTypes";
import {
  ITAB_POMODORO_CATALOG_ID,
  ITAB_POMODORO_WIDGET_TYPE,
} from "@/features/itab-pomodoro/itabPomodoroTypes";
import {
  ITAB_ANNIVERSARY_CATALOG_ID,
  ITAB_ANNIVERSARY_WIDGET_TYPE,
} from "@/features/itab-anniversary/itabAnniversaryTypes";
import {
  ITAB_CALENDAR_CATALOG_ID,
  ITAB_CALENDAR_WIDGET_TYPE,
} from "@/features/itab-calendar/itabCalendarTypes";
import {
  applyItabWeatherSizeToWidget,
  createDefaultItabWeatherWidget,
  normalizeItabWeatherWidgetData,
} from "@/features/itab-weather/itabWeatherModel";
import {
  applyItabTodoSizeToWidget,
  createDefaultItabTodoWidget,
  normalizeItabTodoWidgetData,
} from "@/features/itab-todo/itabTodoModel";
import {
  applyItabMemoSizeToWidget,
  createDefaultItabMemoWidget,
  normalizeItabMemoWidgetData,
} from "@/features/itab-memo/itabMemoModel";
import {
  applyItabClockSizeToWidget,
  createDefaultItabClockWidget,
  normalizeItabClockWidgetData,
} from "@/features/itab-clock/itabClockModel";
import {
  applyItabDailyEnglishSizeToWidget,
  createDefaultItabDailyEnglishWidget,
  normalizeItabDailyEnglishWidgetData,
} from "@/features/itab-daily-english/itabDailyEnglishModel";
import {
  applyItabPoemSizeToWidget,
  normalizeItabPoemWidgetData,
} from "@/features/itab-poem/itabPoemModel";
import {
  applyItabPomodoroSizeToWidget,
  createDefaultItabPomodoroWidget,
  normalizeItabPomodoroWidgetData,
} from "@/features/itab-pomodoro/itabPomodoroModel";
import {
  applyItabAnniversarySizeToWidget,
  createDefaultItabAnniversaryWidget,
  normalizeItabAnniversaryWidgetData,
} from "@/features/itab-anniversary/itabAnniversaryModel";
import {
  applyItabCalendarSizeToWidget,
  createDefaultItabCalendarWidget,
  normalizeItabCalendarWidgetData,
} from "@/features/itab-calendar/itabCalendarModel";
import {
  hasItabGridSchema,
  withItabGridData,
} from "@/features/itab-widgets/itabGrid";

const REMOVED_WIDGET_TYPES = new Set([
  "memo",
  "todo",
  "pomodoro",
  ["mus", "ic"].join(""),
  ["pla", "yer"].join(""),
  "calendar",
  "clockweather",
  "weather",
  "amap-weather",
  "anniversary",
  "poem",
  "quote",
]);
const REMOVED_WIDGET_IDS = new Set([
  ["mus", "ic"].join(""),
  ["pla", "yer"].join(""),
  "w7",
]);

const withDefaultWidgetSize = <T extends WidgetConfig>(widget: T): T => {
  const size = resolveWidgetDefaultSize(widget.type);
  return withItabGridData({
    ...widget,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
  });
};

/**
 * Create default widget list when no widgets are provided.
 */
export function createDefaultWidgetList(isLoggedIn: boolean): WidgetConfig[] {
  const base: WidgetConfig[] = [
    createDefaultItabClockWidget(),
    createDefaultItabWeatherWidget(),
    withDefaultWidgetSize({
      id: "w5",
      type: "search",
      enable: true,
      isPublic: true,
    }),
    withDefaultWidgetSize({
      id: "sidebar",
      type: "sidebar",
      enable: false,
      isPublic: true,
    }),
    withDefaultWidgetSize({
      id: "docker",
      type: "docker",
      enable: false,
      isPublic: true,
    }),
    withDefaultWidgetSize({
      id: "file-transfer",
      type: "file-transfer",
      enable: true,
      isPublic: true,
    }),
    withDefaultWidgetSize({
      id: "system-status",
      type: "system-status",
      enable: false,
      isPublic: true,
      data: { useMock: false },
    }),
    createDefaultItabTodoWidget(),
    createDefaultItabMemoWidget(),
    createDefaultItabPomodoroWidget(),
    createDefaultItabAnniversaryWidget(),
    createDefaultItabCalendarWidget(),
    createDefaultItabDailyEnglishWidget(),
    withDefaultWidgetSize({
      id: "calculator",
      type: "calculator",
      enable: true,
      isPublic: true,
    }),
    withDefaultWidgetSize({
      id: "ip",
      type: "ip",
      enable: true,
      isPublic: true,
    }),
    withDefaultWidgetSize({
      id: "hot",
      type: "hot",
      enable: true,
      isPublic: true,
    }),
    withDefaultWidgetSize({
      id: "status-monitor",
      type: "status-monitor",
      enable: false,
      isPublic: true,
    }),
  ];

  // Filter out login-only widgets for guests
  if (!isLoggedIn) {
    return base.filter((w) => {
      const loginOnly = [
        "docker",
        "file-transfer",
        "system-status",
        "sidebar",
        "status-monitor",
      ];
      return !loginOnly.includes(w.id);
    });
  }

  return base;
}

/**
 * Normalize incoming widget list: fix duplicates, missing defaults, ID conflicts.
 */
export function normalizeIncomingWidgets(
  input?: WidgetConfig[],
  isLoggedIn?: boolean,
): WidgetConfig[] {
  const hasIncomingList = Array.isArray(input);
  const nextWidgets = hasIncomingList
    ? input
        .filter(
          (widget) =>
            !REMOVED_WIDGET_TYPES.has(widget.type) &&
            !REMOVED_WIDGET_IDS.has(widget.id),
        )
        .map((widget) => ({ ...widget }))
    : [];

  if (nextWidgets.length === 0) {
    if (!isLoggedIn && hasIncomingList) {
      return [];
    }
    return createDefaultWidgetList(!!isLoggedIn);
  }

  if (hasIncomingList && !nextWidgets.some(hasItabGridSchema)) {
    return createDefaultWidgetList(!!isLoggedIn);
  }

  const withoutLegacyClock = nextWidgets.filter(
    (widget) => widget.type !== "clock",
  );
  if (withoutLegacyClock.length !== nextWidgets.length) {
    nextWidgets.length = 0;
    nextWidgets.push(...withoutLegacyClock);
  }

  const itabWeatherCandidates = nextWidgets.filter(
    (widget) => widget.type === ITAB_WEATHER_WIDGET_TYPE,
  );
  if (itabWeatherCandidates.length > 0) {
    const keep =
      itabWeatherCandidates.find(
        (widget) => widget.id === ITAB_WEATHER_CATALOG_ID,
      ) || itabWeatherCandidates[0]!;
    const normalizedData = normalizeItabWeatherWidgetData(keep.data);
    keep.id = ITAB_WEATHER_CATALOG_ID;
    keep.type = ITAB_WEATHER_WIDGET_TYPE;
    keep.enable = keep.enable !== false;
    keep.isPublic = keep.isPublic ?? true;
    applyItabWeatherSizeToWidget(keep, normalizedData.sizeKey);
    const withoutItabWeather = nextWidgets.filter(
      (widget) => widget.type !== ITAB_WEATHER_WIDGET_TYPE,
    );
    nextWidgets.length = 0;
    nextWidgets.push(...withoutItabWeather, keep);
  }

  const itabTodoCandidates = nextWidgets.filter(
    (widget) => widget.type === ITAB_TODO_WIDGET_TYPE,
  );
  if (itabTodoCandidates.length > 0) {
    const keep =
      itabTodoCandidates.find((widget) => widget.id === ITAB_TODO_CATALOG_ID) ||
      itabTodoCandidates[0]!;
    const normalizedData = normalizeItabTodoWidgetData(keep.data);
    keep.id = ITAB_TODO_CATALOG_ID;
    keep.type = ITAB_TODO_WIDGET_TYPE;
    keep.enable = keep.enable !== false;
    keep.isPublic = keep.isPublic ?? true;
    applyItabTodoSizeToWidget(keep, normalizedData.sizeKey);
    const withoutItabTodo = nextWidgets.filter(
      (widget) => widget.type !== ITAB_TODO_WIDGET_TYPE,
    );
    nextWidgets.length = 0;
    nextWidgets.push(...withoutItabTodo, keep);
  }

  const itabMemoCandidates = nextWidgets.filter(
    (widget) => widget.type === ITAB_MEMO_WIDGET_TYPE,
  );
  if (itabMemoCandidates.length > 0) {
    const keep =
      itabMemoCandidates.find((widget) => widget.id === ITAB_MEMO_CATALOG_ID) ||
      itabMemoCandidates[0]!;
    const normalizedData = normalizeItabMemoWidgetData(keep.data);
    keep.id = ITAB_MEMO_CATALOG_ID;
    keep.type = ITAB_MEMO_WIDGET_TYPE;
    keep.enable = keep.enable !== false;
    keep.isPublic = keep.isPublic ?? true;
    keep.data = normalizedData;
    applyItabMemoSizeToWidget(keep, normalizedData.sizeKey);
    const withoutItabMemo = nextWidgets.filter(
      (widget) => widget.type !== ITAB_MEMO_WIDGET_TYPE,
    );
    nextWidgets.length = 0;
    nextWidgets.push(...withoutItabMemo, keep);
  }

  const itabClockCandidates = nextWidgets.filter(
    (widget) => widget.type === ITAB_CLOCK_WIDGET_TYPE,
  );
  if (itabClockCandidates.length > 0) {
    const keep =
      itabClockCandidates.find(
        (widget) => widget.id === ITAB_CLOCK_CATALOG_ID,
      ) || itabClockCandidates[0]!;
    const normalizedData = normalizeItabClockWidgetData(keep.data);
    keep.id = ITAB_CLOCK_CATALOG_ID;
    keep.type = ITAB_CLOCK_WIDGET_TYPE;
    keep.enable = keep.enable !== false;
    keep.isPublic = keep.isPublic ?? true;
    keep.data = normalizedData;
    applyItabClockSizeToWidget(keep, normalizedData.sizeKey);
    const withoutItabClock = nextWidgets.filter(
      (widget) => widget.type !== ITAB_CLOCK_WIDGET_TYPE,
    );
    nextWidgets.length = 0;
    nextWidgets.push(...withoutItabClock, keep);
  }

  const itabDailyEnglishCandidates = nextWidgets.filter(
    (widget) => widget.type === ITAB_DAILY_ENGLISH_WIDGET_TYPE,
  );
  if (itabDailyEnglishCandidates.length > 0) {
    const keep =
      itabDailyEnglishCandidates.find(
        (widget) => widget.id === ITAB_DAILY_ENGLISH_CATALOG_ID,
      ) || itabDailyEnglishCandidates[0]!;
    const normalizedData = normalizeItabDailyEnglishWidgetData(keep.data);
    keep.id = ITAB_DAILY_ENGLISH_CATALOG_ID;
    keep.type = ITAB_DAILY_ENGLISH_WIDGET_TYPE;
    keep.enable = keep.enable !== false;
    keep.isPublic = keep.isPublic ?? true;
    applyItabDailyEnglishSizeToWidget(keep, normalizedData.sizeKey);
    const withoutItabDailyEnglish = nextWidgets.filter(
      (widget) => widget.type !== ITAB_DAILY_ENGLISH_WIDGET_TYPE,
    );
    nextWidgets.length = 0;
    nextWidgets.push(...withoutItabDailyEnglish, keep);
  }

  const itabPoemCandidates = nextWidgets.filter(
    (widget) => widget.type === ITAB_POEM_WIDGET_TYPE,
  );
  if (itabPoemCandidates.length > 0) {
    const keep =
      itabPoemCandidates.find((widget) => widget.id === ITAB_POEM_CATALOG_ID) ||
      itabPoemCandidates[0]!;
    const normalizedData = normalizeItabPoemWidgetData(keep.data);
    keep.id = ITAB_POEM_CATALOG_ID;
    keep.type = ITAB_POEM_WIDGET_TYPE;
    keep.enable = keep.enable !== false;
    keep.isPublic = keep.isPublic ?? true;
    applyItabPoemSizeToWidget(keep, normalizedData.sizeKey);
    const withoutItabPoem = nextWidgets.filter(
      (widget) => widget.type !== ITAB_POEM_WIDGET_TYPE,
    );
    nextWidgets.length = 0;
    nextWidgets.push(...withoutItabPoem, keep);
  }

  const itabPomodoroCandidates = nextWidgets.filter(
    (widget) => widget.type === ITAB_POMODORO_WIDGET_TYPE,
  );
  if (itabPomodoroCandidates.length > 0) {
    const keep =
      itabPomodoroCandidates.find(
        (widget) => widget.id === ITAB_POMODORO_CATALOG_ID,
      ) || itabPomodoroCandidates[0]!;
    const normalizedData = normalizeItabPomodoroWidgetData(keep.data);
    keep.id = ITAB_POMODORO_CATALOG_ID;
    keep.type = ITAB_POMODORO_WIDGET_TYPE;
    keep.enable = keep.enable !== false;
    keep.isPublic = keep.isPublic ?? true;
    applyItabPomodoroSizeToWidget(keep, normalizedData.sizeKey);
    const withoutItabPomodoro = nextWidgets.filter(
      (widget) => widget.type !== ITAB_POMODORO_WIDGET_TYPE,
    );
    nextWidgets.length = 0;
    nextWidgets.push(...withoutItabPomodoro, keep);
  }

  const itabAnniversaryCandidates = nextWidgets.filter(
    (widget) => widget.type === ITAB_ANNIVERSARY_WIDGET_TYPE,
  );
  for (const widget of itabAnniversaryCandidates) {
    const normalizedData = normalizeItabAnniversaryWidgetData(widget.data);
    widget.type = ITAB_ANNIVERSARY_WIDGET_TYPE;
    widget.enable = widget.enable !== false;
    widget.isPublic = widget.isPublic ?? true;
    applyItabAnniversarySizeToWidget(widget, normalizedData.sizeKey);
  }

  const itabCalendarCandidates = nextWidgets.filter(
    (widget) => widget.type === ITAB_CALENDAR_WIDGET_TYPE,
  );
  if (itabCalendarCandidates.length > 0) {
    const keep =
      itabCalendarCandidates.find(
        (widget) => widget.id === ITAB_CALENDAR_CATALOG_ID,
      ) || itabCalendarCandidates[0]!;
    const normalizedData = normalizeItabCalendarWidgetData(keep.data);
    keep.id = ITAB_CALENDAR_CATALOG_ID;
    keep.type = ITAB_CALENDAR_WIDGET_TYPE;
    keep.enable = keep.enable !== false;
    keep.isPublic = keep.isPublic ?? true;
    applyItabCalendarSizeToWidget(keep, normalizedData.sizeKey);
    const withoutItabCalendar = nextWidgets.filter(
      (widget) => widget.type !== ITAB_CALENDAR_WIDGET_TYPE,
    );
    nextWidgets.length = 0;
    nextWidgets.push(...withoutItabCalendar, keep);
  }

  // Normalize Docker widget
  let dockerCandidate = nextWidgets.find((widget) => widget.id === "docker");
  if (!dockerCandidate) {
    dockerCandidate = nextWidgets.find((widget) => widget.type === "docker");
  }
  const listWithoutDocker = nextWidgets.filter(
    (widget) => widget.id !== "docker" && widget.type !== "docker",
  );
  let finalDockerWidget: WidgetConfig | undefined;
  if (dockerCandidate) {
    finalDockerWidget = dockerCandidate;
    finalDockerWidget.id = "docker";
    finalDockerWidget.type = "docker";
    const dockerSize = resolveWidgetDefaultSize("docker");
    if (typeof finalDockerWidget.colSpan !== "number")
      finalDockerWidget.colSpan = dockerSize.colSpan;
    if (typeof finalDockerWidget.rowSpan !== "number")
      finalDockerWidget.rowSpan = dockerSize.rowSpan;
    if (typeof finalDockerWidget.enable !== "boolean")
      finalDockerWidget.enable = false;
    if (typeof finalDockerWidget.isPublic !== "boolean")
      finalDockerWidget.isPublic = true;
  } else if (isLoggedIn) {
    finalDockerWidget = withDefaultWidgetSize({
      id: "docker",
      type: "docker",
      enable: false,
      isPublic: true,
    });
  }
  if (finalDockerWidget) {
    listWithoutDocker.push(finalDockerWidget);
  }

  // Normalize File Transfer widget (deduplicate)
  const fileTransferList = listWithoutDocker.filter(
    (widget) => widget.type === "file-transfer",
  );
  if (fileTransferList.length > 1) {
    const keep =
      fileTransferList.find((widget) => widget.id === "file-transfer") ||
      fileTransferList[0]!;
    const filtered = listWithoutDocker.filter(
      (widget) => widget.type !== "file-transfer" || widget === keep,
    );
    if (
      keep.id !== "file-transfer" &&
      !filtered.some(
        (widget) =>
          widget.id === "file-transfer" && widget.type !== "file-transfer",
      )
    ) {
      keep.id = "file-transfer";
    }
    nextWidgets.length = 0;
    nextWidgets.push(...filtered);
  } else if (
    fileTransferList.length === 1 &&
    fileTransferList[0]!.id !== "file-transfer" &&
    !listWithoutDocker.some(
      (widget) =>
        widget.id === "file-transfer" && widget.type !== "file-transfer",
    )
  ) {
    fileTransferList[0]!.id = "file-transfer";
    nextWidgets.length = 0;
    nextWidgets.push(...listWithoutDocker);
  } else if (fileTransferList.length === 0 && isLoggedIn) {
    listWithoutDocker.push(
      withDefaultWidgetSize({
        id: "file-transfer",
        type: "file-transfer",
        enable: true,
        isPublic: true,
      }),
    );
    nextWidgets.length = 0;
    nextWidgets.push(...listWithoutDocker);
  } else {
    nextWidgets.length = 0;
    nextWidgets.push(...listWithoutDocker);
  }

  // 游客数据已经由后端按公开权限过滤，不能补齐缺失默认组件，避免私有组件被重新显示。
  if (isLoggedIn) {
    for (const fallback of createDefaultWidgetList(true)) {
      if (!nextWidgets.some((widget) => widget.type === fallback.type)) {
        nextWidgets.push(fallback);
      }
    }
  }

  return nextWidgets.map((widget) => withItabGridData(widget));
}
