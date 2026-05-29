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
import { AI_USAGE_WIDGET_TYPE } from "@/features/ai-usage/aiUsageTypes";
import { TAPD_DEFECTS_WIDGET_TYPE } from "@/features/tapd-defects/tapdDefectTypes";
import {
  applyItabWeatherSizeToWidget,
  normalizeItabWeatherWidgetData,
} from "@/features/itab-weather/itabWeatherModel";
import {
  applyItabTodoSizeToWidget,
  normalizeItabTodoWidgetData,
} from "@/features/itab-todo/itabTodoModel";
import {
  applyItabMemoSizeToWidget,
  normalizeItabMemoWidgetData,
} from "@/features/itab-memo/itabMemoModel";
import {
  applyItabClockSizeToWidget,
  normalizeItabClockWidgetData,
} from "@/features/itab-clock/itabClockModel";
import {
  applyItabDailyEnglishSizeToWidget,
  normalizeItabDailyEnglishWidgetData,
} from "@/features/itab-daily-english/itabDailyEnglishModel";
import {
  applyItabPoemSizeToWidget,
  normalizeItabPoemWidgetData,
} from "@/features/itab-poem/itabPoemModel";
import {
  applyItabPomodoroSizeToWidget,
  normalizeItabPomodoroWidgetData,
} from "@/features/itab-pomodoro/itabPomodoroModel";
import {
  applyItabAnniversarySizeToWidget,
  normalizeItabAnniversaryWidgetData,
} from "@/features/itab-anniversary/itabAnniversaryModel";
import {
  applyItabMovieCalendarSizeToWidget,
  normalizeItabMovieCalendarWidgetData,
} from "@/features/itab-movie-calendar/itabMovieCalendarModel";
import {
  applyItabIpSizeToWidget,
  normalizeItabIpWidgetData,
} from "@/features/itab-ip/itabIpModel";
import {
  applyItabCalendarSizeToWidget,
  normalizeItabCalendarWidgetData,
} from "@/features/itab-calendar/itabCalendarModel";
import {
  applyItabNumberUppercaseSizeToWidget,
  normalizeItabNumberUppercaseWidgetData,
} from "@/features/itab-number-uppercase/itabNumberUppercaseModel";
import {
  applyItabFoodPickerSizeToWidget,
  normalizeItabFoodPickerWidgetData,
} from "@/features/itab-food-picker/itabFoodPickerModel";
import {
  applyAiUsageSizeToWidget,
  normalizeAiUsageWidgetData,
} from "@/features/ai-usage/aiUsageModel";
import {
  applyTapdDefectSizeToWidget,
  normalizeTapdDefectWidgetData,
} from "@/features/tapd-defects/tapdDefectModel";
import {
  hasItabGridSchema,
  withItabGridData,
} from "@/features/itab-widgets/itabGrid";
import {
  applyDockerWidgetSizeToWidget,
  applySystemStatusWidgetSizeToWidget,
  normalizeDockerWidgetData,
  normalizeSystemStatusWidgetData,
} from "@/features/widget-runtime/systemComponentRuntimeModel";
import {
  applyCustomCssWidgetSizeToWidget,
  normalizeCustomCssWidgetData,
} from "@/features/widget-runtime/customCssRuntimeModel";
import {
  isRuntimeWidgetType,
  resolveRuntimeWidgetSizeKey,
} from "@/features/widget-runtime/widgetRuntimeSizes";

const REMOVED_WIDGET_TYPES = new Set([
  "iframe",
  "status-monitor",
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
  "ip",
  "search",
  "div-card",
  "bookmarks",
  "countdown",
  "countup",
  "calculator",
  "hot",
  "rss",
  "sidebar",
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
  if (!isLoggedIn) return [];

  const base: WidgetConfig[] = [
    withDefaultWidgetSize({
      id: "docker",
      type: "docker",
      enable: true,
      isPublic: false,
      hideOnMobile: true,
      data: normalizeDockerWidgetData({}),
    }),
  ];

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

  const itabMovieCalendarCandidates = nextWidgets.filter(
    (widget) => widget.type === ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
  );
  if (itabMovieCalendarCandidates.length > 0) {
    const keep =
      itabMovieCalendarCandidates.find(
        (widget) => widget.id === ITAB_MOVIE_CALENDAR_CATALOG_ID,
      ) || itabMovieCalendarCandidates[0]!;
    const normalizedData = normalizeItabMovieCalendarWidgetData(keep.data);
    keep.id = ITAB_MOVIE_CALENDAR_CATALOG_ID;
    keep.type = ITAB_MOVIE_CALENDAR_WIDGET_TYPE;
    keep.enable = keep.enable !== false;
    keep.isPublic = keep.isPublic ?? true;
    applyItabMovieCalendarSizeToWidget(keep, normalizedData.sizeKey);
    const withoutItabMovieCalendar = nextWidgets.filter(
      (widget) => widget.type !== ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
    );
    nextWidgets.length = 0;
    nextWidgets.push(...withoutItabMovieCalendar, keep);
  }

  const itabIpCandidates = nextWidgets.filter(
    (widget) => widget.type === ITAB_IP_WIDGET_TYPE,
  );
  if (itabIpCandidates.length > 0) {
    const keep =
      itabIpCandidates.find((widget) => widget.id === ITAB_IP_CATALOG_ID) ||
      itabIpCandidates[0]!;
    const normalizedData = normalizeItabIpWidgetData(keep.data);
    keep.id = ITAB_IP_CATALOG_ID;
    keep.type = ITAB_IP_WIDGET_TYPE;
    keep.enable = keep.enable !== false;
    keep.isPublic = keep.isPublic ?? true;
    applyItabIpSizeToWidget(keep, normalizedData.sizeKey);
    const withoutItabIp = nextWidgets.filter(
      (widget) => widget.type !== ITAB_IP_WIDGET_TYPE,
    );
    nextWidgets.length = 0;
    nextWidgets.push(...withoutItabIp, keep);
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

  const itabNumberUppercaseCandidates = nextWidgets.filter(
    (widget) => widget.type === ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
  );
  for (const widget of itabNumberUppercaseCandidates) {
    const normalizedData = normalizeItabNumberUppercaseWidgetData(widget.data);
    widget.type = ITAB_NUMBER_UPPERCASE_WIDGET_TYPE;
    widget.enable = widget.enable !== false;
    widget.isPublic = widget.isPublic ?? true;
    applyItabNumberUppercaseSizeToWidget(widget, normalizedData.sizeKey);
  }

  const itabFoodPickerCandidates = nextWidgets.filter(
    (widget) => widget.type === ITAB_FOOD_PICKER_WIDGET_TYPE,
  );
  for (const widget of itabFoodPickerCandidates) {
    const normalizedData = normalizeItabFoodPickerWidgetData(widget.data);
    widget.type = ITAB_FOOD_PICKER_WIDGET_TYPE;
    widget.enable = widget.enable !== false;
    widget.isPublic = widget.isPublic ?? true;
    applyItabFoodPickerSizeToWidget(widget, normalizedData.sizeKey);
  }

  const aiUsageCandidates = nextWidgets.filter(
    (widget) => widget.type === AI_USAGE_WIDGET_TYPE,
  );
  for (const widget of aiUsageCandidates) {
    const normalizedData = normalizeAiUsageWidgetData(widget.data);
    widget.type = AI_USAGE_WIDGET_TYPE;
    widget.enable = widget.enable !== false;
    widget.isPublic = widget.isPublic ?? false;
    applyAiUsageSizeToWidget(widget, normalizedData.sizeKey);
  }

  const tapdDefectCandidates = nextWidgets.filter(
    (widget) => widget.type === TAPD_DEFECTS_WIDGET_TYPE,
  );
  for (const widget of tapdDefectCandidates) {
    const normalizedData = normalizeTapdDefectWidgetData(widget.data);
    widget.type = TAPD_DEFECTS_WIDGET_TYPE;
    widget.enable = widget.enable !== false;
    widget.isPublic = widget.isPublic ?? false;
    applyTapdDefectSizeToWidget(widget, normalizedData.sizeKey);
  }

  const customCssCandidates = nextWidgets.filter(
    (widget) => widget.type === "custom-css",
  );
  for (const widget of customCssCandidates) {
    const normalizedData = normalizeCustomCssWidgetData(widget.data);
    widget.type = "custom-css";
    widget.enable = widget.enable !== false;
    widget.isPublic = widget.isPublic ?? true;
    applyCustomCssWidgetSizeToWidget(widget, normalizedData.sizeKey);
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
    const dockerData =
      finalDockerWidget.data && typeof finalDockerWidget.data === "object"
        ? (finalDockerWidget.data as Record<string, unknown>)
        : {};
    const dockerSizeKey =
      resolveRuntimeWidgetSizeKey("docker", {
        sizeKey:
          typeof dockerData.sizeKey === "string"
            ? dockerData.sizeKey
            : undefined,
        colSpan: finalDockerWidget.w ?? finalDockerWidget.colSpan,
        rowSpan: finalDockerWidget.h ?? finalDockerWidget.rowSpan,
      }) || "2x2";
    finalDockerWidget.data = normalizeDockerWidgetData({
      ...dockerData,
      sizeKey: dockerSizeKey,
    });
    applyDockerWidgetSizeToWidget(finalDockerWidget, dockerSizeKey);
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
      data: normalizeDockerWidgetData({}),
    });
  }
  if (finalDockerWidget) {
    listWithoutDocker.push(finalDockerWidget);
  }

  nextWidgets.length = 0;
  nextWidgets.push(...listWithoutDocker);

  // Normalize host system status widget
  let systemStatusCandidate = nextWidgets.find(
    (widget) => widget.id === "system-status",
  );
  if (!systemStatusCandidate) {
    systemStatusCandidate = nextWidgets.find(
      (widget) => widget.type === "system-status",
    );
  }
  const listWithoutSystemStatus = nextWidgets.filter(
    (widget) =>
      widget.id !== "system-status" && widget.type !== "system-status",
  );
  let finalSystemStatusWidget: WidgetConfig | undefined;
  if (systemStatusCandidate) {
    finalSystemStatusWidget = systemStatusCandidate;
    finalSystemStatusWidget.id = "system-status";
    finalSystemStatusWidget.type = "system-status";
    const systemStatusData =
      finalSystemStatusWidget.data &&
      typeof finalSystemStatusWidget.data === "object"
        ? (finalSystemStatusWidget.data as Record<string, unknown>)
        : {};
    const systemStatusSizeKey =
      resolveRuntimeWidgetSizeKey("system-status", {
        sizeKey:
          typeof systemStatusData.sizeKey === "string"
            ? systemStatusData.sizeKey
            : undefined,
        colSpan: finalSystemStatusWidget.w ?? finalSystemStatusWidget.colSpan,
        rowSpan: finalSystemStatusWidget.h ?? finalSystemStatusWidget.rowSpan,
      }) || "1x1";
    finalSystemStatusWidget.data = normalizeSystemStatusWidgetData({
      ...systemStatusData,
      sizeKey: systemStatusSizeKey,
    });
    applySystemStatusWidgetSizeToWidget(
      finalSystemStatusWidget,
      systemStatusSizeKey,
    );
    if (typeof finalSystemStatusWidget.enable !== "boolean")
      finalSystemStatusWidget.enable = false;
    if (typeof finalSystemStatusWidget.isPublic !== "boolean")
      finalSystemStatusWidget.isPublic = true;
  }
  if (finalSystemStatusWidget) {
    listWithoutSystemStatus.push(finalSystemStatusWidget);
  }

  nextWidgets.length = 0;
  nextWidgets.push(...listWithoutSystemStatus);

  // 游客数据已经由后端按公开权限过滤，不能补齐缺失默认组件，避免私有组件被重新显示。
  if (isLoggedIn) {
    for (const fallback of createDefaultWidgetList(true)) {
      if (!nextWidgets.some((widget) => widget.type === fallback.type)) {
        nextWidgets.push(fallback);
      }
    }
  }

  return nextWidgets.map((widget) =>
    isRuntimeWidgetType(widget.type) ? widget : withItabGridData(widget),
  );
}
