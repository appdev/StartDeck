/**
 * Widget-related utility functions extracted from main.ts.
 * These functions handle widget normalization, deduplication, and defaults.
 */

import type { WidgetConfig } from "@/types";
import { resolveWidgetDefaultSize } from "@/utils/widgetSizePresets";
import {
  SD_WEATHER_CATALOG_ID,
  SD_WEATHER_WIDGET_TYPE,
} from "@/features/sd-weather/sdWeatherTypes";
import {
  SD_TODO_CATALOG_ID,
  SD_TODO_WIDGET_TYPE,
} from "@/features/sd-todo/sdTodoTypes";
import {
  SD_MEMO_CATALOG_ID,
  SD_MEMO_WIDGET_TYPE,
} from "@/features/sd-memo/sdMemoTypes";
import {
  SD_CLOCK_CATALOG_ID,
  SD_CLOCK_WIDGET_TYPE,
} from "@/features/sd-clock/sdClockTypes";
import {
  SD_DAILY_ENGLISH_CATALOG_ID,
  SD_DAILY_ENGLISH_WIDGET_TYPE,
} from "@/features/sd-daily-english/sdDailyEnglishTypes";
import {
  SD_POEM_CATALOG_ID,
  SD_POEM_WIDGET_TYPE,
} from "@/features/sd-poem/sdPoemTypes";
import {
  SD_POMODORO_CATALOG_ID,
  SD_POMODORO_WIDGET_TYPE,
} from "@/features/sd-pomodoro/sdPomodoroTypes";
import { SD_ANNIVERSARY_WIDGET_TYPE } from "@/features/sd-anniversary/sdAnniversaryTypes";
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
import { SD_NUMBER_UPPERCASE_WIDGET_TYPE } from "@/features/sd-number-uppercase/sdNumberUppercaseTypes";
import { SD_FOOD_PICKER_WIDGET_TYPE } from "@/features/sd-food-picker/sdFoodPickerTypes";
import { AI_USAGE_WIDGET_TYPE } from "@/features/ai-usage/aiUsageTypes";
import { TAPD_DEFECTS_WIDGET_TYPE } from "@/features/tapd-defects/tapdDefectTypes";
import {
  applySdWeatherSizeToWidget,
  normalizeSdWeatherWidgetData,
} from "@/features/sd-weather/sdWeatherModel";
import {
  applySdTodoSizeToWidget,
  normalizeSdTodoWidgetData,
} from "@/features/sd-todo/sdTodoModel";
import {
  applySdMemoSizeToWidget,
  normalizeSdMemoWidgetData,
} from "@/features/sd-memo/sdMemoModel";
import {
  applySdClockSizeToWidget,
  normalizeSdClockWidgetData,
} from "@/features/sd-clock/sdClockModel";
import {
  applySdDailyEnglishSizeToWidget,
  normalizeSdDailyEnglishWidgetData,
} from "@/features/sd-daily-english/sdDailyEnglishModel";
import {
  applySdPoemSizeToWidget,
  normalizeSdPoemWidgetData,
} from "@/features/sd-poem/sdPoemModel";
import {
  applySdPomodoroSizeToWidget,
  normalizeSdPomodoroWidgetData,
} from "@/features/sd-pomodoro/sdPomodoroModel";
import {
  applySdAnniversarySizeToWidget,
  normalizeSdAnniversaryWidgetData,
} from "@/features/sd-anniversary/sdAnniversaryModel";
import {
  applySdMovieCalendarSizeToWidget,
  normalizeSdMovieCalendarWidgetData,
} from "@/features/sd-movie-calendar/sdMovieCalendarModel";
import {
  applySdIpSizeToWidget,
  normalizeSdIpWidgetData,
} from "@/features/sd-ip/sdIpModel";
import {
  applySdCalendarSizeToWidget,
  normalizeSdCalendarWidgetData,
} from "@/features/sd-calendar/sdCalendarModel";
import {
  applySdNumberUppercaseSizeToWidget,
  normalizeSdNumberUppercaseWidgetData,
} from "@/features/sd-number-uppercase/sdNumberUppercaseModel";
import {
  applySdFoodPickerSizeToWidget,
  normalizeSdFoodPickerWidgetData,
} from "@/features/sd-food-picker/sdFoodPickerModel";
import {
  applyAiUsageSizeToWidget,
  normalizeAiUsageWidgetData,
} from "@/features/ai-usage/aiUsageModel";
import {
  applyTapdDefectSizeToWidget,
  normalizeTapdDefectWidgetData,
} from "@/features/tapd-defects/tapdDefectModel";
import {
  hasSdGridSchema,
  withSdGridData,
} from "@/features/sd-widgets/sdGrid";
import { migrateLegacyWidgetConfig } from "@/utils/legacyWidgetMigration";
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
  return withSdGridData({
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
        .map((widget) => migrateLegacyWidgetConfig({ ...widget }))
    : [];

  if (nextWidgets.length === 0) {
    if (!isLoggedIn && hasIncomingList) {
      return [];
    }
    return createDefaultWidgetList(!!isLoggedIn);
  }

  if (hasIncomingList && !nextWidgets.some(hasSdGridSchema)) {
    return createDefaultWidgetList(!!isLoggedIn);
  }

  const withoutLegacyClock = nextWidgets.filter(
    (widget) => widget.type !== "clock",
  );
  if (withoutLegacyClock.length !== nextWidgets.length) {
    nextWidgets.length = 0;
    nextWidgets.push(...withoutLegacyClock);
  }

  const sdWeatherCandidates = nextWidgets.filter(
    (widget) => widget.type === SD_WEATHER_WIDGET_TYPE,
  );
  if (sdWeatherCandidates.length > 0) {
    const keep =
      sdWeatherCandidates.find(
        (widget) => widget.id === SD_WEATHER_CATALOG_ID,
      ) || sdWeatherCandidates[0]!;
    const normalizedData = normalizeSdWeatherWidgetData(keep.data);
    keep.id = SD_WEATHER_CATALOG_ID;
    keep.type = SD_WEATHER_WIDGET_TYPE;
    keep.enable = keep.enable !== false;
    applySdWeatherSizeToWidget(keep, normalizedData.sizeKey);
    const withoutSdWeather = nextWidgets.filter(
      (widget) => widget.type !== SD_WEATHER_WIDGET_TYPE,
    );
    nextWidgets.length = 0;
    nextWidgets.push(...withoutSdWeather, keep);
  }

  const sdTodoCandidates = nextWidgets.filter(
    (widget) => widget.type === SD_TODO_WIDGET_TYPE,
  );
  if (sdTodoCandidates.length > 0) {
    const keep =
      sdTodoCandidates.find((widget) => widget.id === SD_TODO_CATALOG_ID) ||
      sdTodoCandidates[0]!;
    const normalizedData = normalizeSdTodoWidgetData(keep.data);
    keep.id = SD_TODO_CATALOG_ID;
    keep.type = SD_TODO_WIDGET_TYPE;
    keep.enable = keep.enable !== false;
    applySdTodoSizeToWidget(keep, normalizedData.sizeKey);
    const withoutSdTodo = nextWidgets.filter(
      (widget) => widget.type !== SD_TODO_WIDGET_TYPE,
    );
    nextWidgets.length = 0;
    nextWidgets.push(...withoutSdTodo, keep);
  }

  const sdMemoCandidates = nextWidgets.filter(
    (widget) => widget.type === SD_MEMO_WIDGET_TYPE,
  );
  if (sdMemoCandidates.length > 0) {
    const keep =
      sdMemoCandidates.find((widget) => widget.id === SD_MEMO_CATALOG_ID) ||
      sdMemoCandidates[0]!;
    const normalizedData = normalizeSdMemoWidgetData(keep.data);
    keep.id = SD_MEMO_CATALOG_ID;
    keep.type = SD_MEMO_WIDGET_TYPE;
    keep.enable = keep.enable !== false;
    keep.data = normalizedData;
    applySdMemoSizeToWidget(keep, normalizedData.sizeKey);
    const withoutSdMemo = nextWidgets.filter(
      (widget) => widget.type !== SD_MEMO_WIDGET_TYPE,
    );
    nextWidgets.length = 0;
    nextWidgets.push(...withoutSdMemo, keep);
  }

  const sdClockCandidates = nextWidgets.filter(
    (widget) => widget.type === SD_CLOCK_WIDGET_TYPE,
  );
  if (sdClockCandidates.length > 0) {
    const keep =
      sdClockCandidates.find(
        (widget) => widget.id === SD_CLOCK_CATALOG_ID,
      ) || sdClockCandidates[0]!;
    const normalizedData = normalizeSdClockWidgetData(keep.data);
    keep.id = SD_CLOCK_CATALOG_ID;
    keep.type = SD_CLOCK_WIDGET_TYPE;
    keep.enable = keep.enable !== false;
    keep.data = normalizedData;
    applySdClockSizeToWidget(keep, normalizedData.sizeKey);
    const withoutSdClock = nextWidgets.filter(
      (widget) => widget.type !== SD_CLOCK_WIDGET_TYPE,
    );
    nextWidgets.length = 0;
    nextWidgets.push(...withoutSdClock, keep);
  }

  const sdDailyEnglishCandidates = nextWidgets.filter(
    (widget) => widget.type === SD_DAILY_ENGLISH_WIDGET_TYPE,
  );
  if (sdDailyEnglishCandidates.length > 0) {
    const keep =
      sdDailyEnglishCandidates.find(
        (widget) => widget.id === SD_DAILY_ENGLISH_CATALOG_ID,
      ) || sdDailyEnglishCandidates[0]!;
    const normalizedData = normalizeSdDailyEnglishWidgetData(keep.data);
    keep.id = SD_DAILY_ENGLISH_CATALOG_ID;
    keep.type = SD_DAILY_ENGLISH_WIDGET_TYPE;
    keep.enable = keep.enable !== false;
    applySdDailyEnglishSizeToWidget(keep, normalizedData.sizeKey);
    const withoutSdDailyEnglish = nextWidgets.filter(
      (widget) => widget.type !== SD_DAILY_ENGLISH_WIDGET_TYPE,
    );
    nextWidgets.length = 0;
    nextWidgets.push(...withoutSdDailyEnglish, keep);
  }

  const sdPoemCandidates = nextWidgets.filter(
    (widget) => widget.type === SD_POEM_WIDGET_TYPE,
  );
  if (sdPoemCandidates.length > 0) {
    const keep =
      sdPoemCandidates.find((widget) => widget.id === SD_POEM_CATALOG_ID) ||
      sdPoemCandidates[0]!;
    const normalizedData = normalizeSdPoemWidgetData(keep.data);
    keep.id = SD_POEM_CATALOG_ID;
    keep.type = SD_POEM_WIDGET_TYPE;
    keep.enable = keep.enable !== false;
    applySdPoemSizeToWidget(keep, normalizedData.sizeKey);
    const withoutSdPoem = nextWidgets.filter(
      (widget) => widget.type !== SD_POEM_WIDGET_TYPE,
    );
    nextWidgets.length = 0;
    nextWidgets.push(...withoutSdPoem, keep);
  }

  const sdPomodoroCandidates = nextWidgets.filter(
    (widget) => widget.type === SD_POMODORO_WIDGET_TYPE,
  );
  if (sdPomodoroCandidates.length > 0) {
    const keep =
      sdPomodoroCandidates.find(
        (widget) => widget.id === SD_POMODORO_CATALOG_ID,
      ) || sdPomodoroCandidates[0]!;
    const normalizedData = normalizeSdPomodoroWidgetData(keep.data);
    keep.id = SD_POMODORO_CATALOG_ID;
    keep.type = SD_POMODORO_WIDGET_TYPE;
    keep.enable = keep.enable !== false;
    applySdPomodoroSizeToWidget(keep, normalizedData.sizeKey);
    const withoutSdPomodoro = nextWidgets.filter(
      (widget) => widget.type !== SD_POMODORO_WIDGET_TYPE,
    );
    nextWidgets.length = 0;
    nextWidgets.push(...withoutSdPomodoro, keep);
  }

  const sdAnniversaryCandidates = nextWidgets.filter(
    (widget) => widget.type === SD_ANNIVERSARY_WIDGET_TYPE,
  );
  for (const widget of sdAnniversaryCandidates) {
    const normalizedData = normalizeSdAnniversaryWidgetData(widget.data);
    widget.type = SD_ANNIVERSARY_WIDGET_TYPE;
    widget.enable = widget.enable !== false;
    applySdAnniversarySizeToWidget(widget, normalizedData.sizeKey);
  }

  const sdMovieCalendarCandidates = nextWidgets.filter(
    (widget) => widget.type === SD_MOVIE_CALENDAR_WIDGET_TYPE,
  );
  if (sdMovieCalendarCandidates.length > 0) {
    const keep =
      sdMovieCalendarCandidates.find(
        (widget) => widget.id === SD_MOVIE_CALENDAR_CATALOG_ID,
      ) || sdMovieCalendarCandidates[0]!;
    const normalizedData = normalizeSdMovieCalendarWidgetData(keep.data);
    keep.id = SD_MOVIE_CALENDAR_CATALOG_ID;
    keep.type = SD_MOVIE_CALENDAR_WIDGET_TYPE;
    keep.enable = keep.enable !== false;
    applySdMovieCalendarSizeToWidget(keep, normalizedData.sizeKey);
    const withoutSdMovieCalendar = nextWidgets.filter(
      (widget) => widget.type !== SD_MOVIE_CALENDAR_WIDGET_TYPE,
    );
    nextWidgets.length = 0;
    nextWidgets.push(...withoutSdMovieCalendar, keep);
  }

  const sdIpCandidates = nextWidgets.filter(
    (widget) => widget.type === SD_IP_WIDGET_TYPE,
  );
  if (sdIpCandidates.length > 0) {
    const keep =
      sdIpCandidates.find((widget) => widget.id === SD_IP_CATALOG_ID) ||
      sdIpCandidates[0]!;
    const normalizedData = normalizeSdIpWidgetData(keep.data);
    keep.id = SD_IP_CATALOG_ID;
    keep.type = SD_IP_WIDGET_TYPE;
    keep.enable = keep.enable !== false;
    applySdIpSizeToWidget(keep, normalizedData.sizeKey);
    const withoutSdIp = nextWidgets.filter(
      (widget) => widget.type !== SD_IP_WIDGET_TYPE,
    );
    nextWidgets.length = 0;
    nextWidgets.push(...withoutSdIp, keep);
  }

  const sdCalendarCandidates = nextWidgets.filter(
    (widget) => widget.type === SD_CALENDAR_WIDGET_TYPE,
  );
  if (sdCalendarCandidates.length > 0) {
    const keep =
      sdCalendarCandidates.find(
        (widget) => widget.id === SD_CALENDAR_CATALOG_ID,
      ) || sdCalendarCandidates[0]!;
    const normalizedData = normalizeSdCalendarWidgetData(keep.data);
    keep.id = SD_CALENDAR_CATALOG_ID;
    keep.type = SD_CALENDAR_WIDGET_TYPE;
    keep.enable = keep.enable !== false;
    applySdCalendarSizeToWidget(keep, normalizedData.sizeKey);
    const withoutSdCalendar = nextWidgets.filter(
      (widget) => widget.type !== SD_CALENDAR_WIDGET_TYPE,
    );
    nextWidgets.length = 0;
    nextWidgets.push(...withoutSdCalendar, keep);
  }

  const sdNumberUppercaseCandidates = nextWidgets.filter(
    (widget) => widget.type === SD_NUMBER_UPPERCASE_WIDGET_TYPE,
  );
  for (const widget of sdNumberUppercaseCandidates) {
    const normalizedData = normalizeSdNumberUppercaseWidgetData(widget.data);
    widget.type = SD_NUMBER_UPPERCASE_WIDGET_TYPE;
    widget.enable = widget.enable !== false;
    applySdNumberUppercaseSizeToWidget(widget, normalizedData.sizeKey);
  }

  const sdFoodPickerCandidates = nextWidgets.filter(
    (widget) => widget.type === SD_FOOD_PICKER_WIDGET_TYPE,
  );
  for (const widget of sdFoodPickerCandidates) {
    const normalizedData = normalizeSdFoodPickerWidgetData(widget.data);
    widget.type = SD_FOOD_PICKER_WIDGET_TYPE;
    widget.enable = widget.enable !== false;
    applySdFoodPickerSizeToWidget(widget, normalizedData.sizeKey);
  }

  const aiUsageCandidates = nextWidgets.filter(
    (widget) => widget.type === AI_USAGE_WIDGET_TYPE,
  );
  for (const widget of aiUsageCandidates) {
    const normalizedData = normalizeAiUsageWidgetData(widget.data);
    widget.type = AI_USAGE_WIDGET_TYPE;
    widget.enable = widget.enable !== false;
    applyAiUsageSizeToWidget(widget, normalizedData.sizeKey);
  }

  const tapdDefectCandidates = nextWidgets.filter(
    (widget) => widget.type === TAPD_DEFECTS_WIDGET_TYPE,
  );
  for (const widget of tapdDefectCandidates) {
    const normalizedData = normalizeTapdDefectWidgetData(widget.data);
    widget.type = TAPD_DEFECTS_WIDGET_TYPE;
    widget.enable = widget.enable !== false;
    applyTapdDefectSizeToWidget(widget, normalizedData.sizeKey);
  }

  const customCssCandidates = nextWidgets.filter(
    (widget) => widget.type === "custom-css",
  );
  for (const widget of customCssCandidates) {
    const normalizedData = normalizeCustomCssWidgetData(widget.data);
    widget.type = "custom-css";
    widget.enable = widget.enable !== false;
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
  } else if (isLoggedIn) {
    finalDockerWidget = withDefaultWidgetSize({
      id: "docker",
      type: "docker",
      enable: false,
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
  }
  if (finalSystemStatusWidget) {
    listWithoutSystemStatus.push(finalSystemStatusWidget);
  }

  nextWidgets.length = 0;
  nextWidgets.push(...listWithoutSystemStatus);

  // 游客数据来自后端默认模板；登录数据才补齐管理员默认组件。
  if (isLoggedIn) {
    for (const fallback of createDefaultWidgetList(true)) {
      if (!nextWidgets.some((widget) => widget.type === fallback.type)) {
        nextWidgets.push(fallback);
      }
    }
  }

  return nextWidgets.map((widget) =>
    isRuntimeWidgetType(widget.type) ? widget : withSdGridData(widget),
  );
}
