import type { Component } from "vue";
import type { WidgetConfig } from "@/types";
import ItabWeatherOpenedPanel from "@/features/itab-weather/ItabWeatherOpenedPanel.vue";
import ItabWeatherWidget from "@/features/itab-weather/ItabWeatherWidget.vue";
import ItabTodoOpenedPanel from "@/features/itab-todo/ItabTodoOpenedPanel.vue";
import ItabTodoWidget from "@/features/itab-todo/ItabTodoWidget.vue";
import ItabMemoOpenedPanel from "@/features/itab-memo/ItabMemoOpenedPanel.vue";
import ItabMemoWidget from "@/features/itab-memo/ItabMemoWidget.vue";
import ItabClockOpenedPanel from "@/features/itab-clock/ItabClockOpenedPanel.vue";
import ItabClockWidget from "@/features/itab-clock/ItabClockWidget.vue";
import ItabDailyEnglishOpenedPanel from "@/features/itab-daily-english/ItabDailyEnglishOpenedPanel.vue";
import ItabDailyEnglishWidget from "@/features/itab-daily-english/ItabDailyEnglishWidget.vue";
import ItabPoemOpenedPanel from "@/features/itab-poem/ItabPoemOpenedPanel.vue";
import ItabPoemWidget from "@/features/itab-poem/ItabPoemWidget.vue";
import ItabPomodoroOpenedPanel from "@/features/itab-pomodoro/ItabPomodoroOpenedPanel.vue";
import ItabPomodoroWidget from "@/features/itab-pomodoro/ItabPomodoroWidget.vue";
import ItabAnniversaryOpenedPanel from "@/features/itab-anniversary/ItabAnniversaryOpenedPanel.vue";
import ItabAnniversaryWidget from "@/features/itab-anniversary/ItabAnniversaryWidget.vue";
import {
  ITAB_WEATHER_DEFAULT_SIZE,
  ITAB_WEATHER_RUNTIME,
  ITAB_WEATHER_WIDGET_TYPE,
  type ItabWeatherWidgetData,
} from "@/features/itab-weather/itabWeatherTypes";
import {
  ITAB_TODO_DEFAULT_SIZE,
  ITAB_TODO_RUNTIME,
  ITAB_TODO_WIDGET_TYPE,
  type ItabTodoWidgetData,
} from "@/features/itab-todo/itabTodoTypes";
import {
  ITAB_MEMO_DEFAULT_SIZE,
  ITAB_MEMO_RUNTIME,
  ITAB_MEMO_WIDGET_TYPE,
  type ItabMemoWidgetData,
} from "@/features/itab-memo/itabMemoTypes";
import {
  ITAB_CLOCK_DEFAULT_SIZE,
  ITAB_CLOCK_RUNTIME,
  ITAB_CLOCK_WIDGET_TYPE,
  type ItabClockWidgetData,
} from "@/features/itab-clock/itabClockTypes";
import {
  ITAB_DAILY_ENGLISH_DEFAULT_SIZE,
  ITAB_DAILY_ENGLISH_RUNTIME,
  ITAB_DAILY_ENGLISH_WIDGET_TYPE,
  type ItabDailyEnglishWidgetData,
} from "@/features/itab-daily-english/itabDailyEnglishTypes";
import {
  ITAB_POEM_DEFAULT_SIZE,
  ITAB_POEM_RUNTIME,
  ITAB_POEM_WIDGET_TYPE,
  type ItabPoemWidgetData,
} from "@/features/itab-poem/itabPoemTypes";
import {
  ITAB_POMODORO_DEFAULT_SIZE,
  ITAB_POMODORO_RUNTIME,
  ITAB_POMODORO_WIDGET_TYPE,
  type ItabPomodoroWidgetData,
} from "@/features/itab-pomodoro/itabPomodoroTypes";
import {
  ITAB_ANNIVERSARY_DEFAULT_SIZE,
  ITAB_ANNIVERSARY_RUNTIME,
  ITAB_ANNIVERSARY_WIDGET_TYPE,
  type ItabAnniversaryWidgetData,
} from "@/features/itab-anniversary/itabAnniversaryTypes";
import {
  normalizeItabWeatherWidgetData,
  applyItabWeatherSizeToWidget,
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
  resolveRuntimeWidgetSizeFamily,
  resolveRuntimeWidgetSizeKey as resolveRuntimeSizeKey,
  isRuntimeWidgetType,
  type RuntimeWidgetSizeKey,
  type RuntimeWidgetSizePreset,
} from "./widgetRuntimeSizes";

export interface WidgetOpenedShellDefaults {
  width: number;
  height: number;
  maxWidthInset: number;
  maxHeightInset: number;
  trafficVisible: boolean;
}

export interface WidgetRuntimeDefinition {
  type: string;
  runtime: string;
  title: string;
  component: Component;
  openedPanel: Component;
  defaultSizeKey: RuntimeWidgetSizeKey;
  supportedSizes: RuntimeWidgetSizePreset[];
  openedShell: WidgetOpenedShellDefaults;
}

const itabWeatherFamily = resolveRuntimeWidgetSizeFamily(
  ITAB_WEATHER_WIDGET_TYPE,
);
const itabTodoFamily = resolveRuntimeWidgetSizeFamily(ITAB_TODO_WIDGET_TYPE);
const itabMemoFamily = resolveRuntimeWidgetSizeFamily(ITAB_MEMO_WIDGET_TYPE);
const itabClockFamily = resolveRuntimeWidgetSizeFamily(ITAB_CLOCK_WIDGET_TYPE);
const itabDailyEnglishFamily = resolveRuntimeWidgetSizeFamily(
  ITAB_DAILY_ENGLISH_WIDGET_TYPE,
);
const itabPoemFamily = resolveRuntimeWidgetSizeFamily(ITAB_POEM_WIDGET_TYPE);
const itabPomodoroFamily = resolveRuntimeWidgetSizeFamily(
  ITAB_POMODORO_WIDGET_TYPE,
);
const itabAnniversaryFamily = resolveRuntimeWidgetSizeFamily(
  ITAB_ANNIVERSARY_WIDGET_TYPE,
);

export type WidgetRuntimeData =
  | ItabWeatherWidgetData
  | ItabTodoWidgetData
  | ItabMemoWidgetData
  | ItabClockWidgetData
  | ItabDailyEnglishWidgetData
  | ItabPoemWidgetData
  | ItabPomodoroWidgetData
  | ItabAnniversaryWidgetData;

export const WIDGET_RUNTIME_DEFINITIONS: Record<
  string,
  WidgetRuntimeDefinition
> = {
  [ITAB_WEATHER_WIDGET_TYPE]: {
    type: ITAB_WEATHER_WIDGET_TYPE,
    runtime: ITAB_WEATHER_RUNTIME,
    title: "天气",
    component: ItabWeatherWidget,
    openedPanel: ItabWeatherOpenedPanel,
    defaultSizeKey: ITAB_WEATHER_DEFAULT_SIZE,
    supportedSizes: itabWeatherFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 42,
      maxHeightInset: 18,
      trafficVisible: true,
    },
  },
  [ITAB_TODO_WIDGET_TYPE]: {
    type: ITAB_TODO_WIDGET_TYPE,
    runtime: ITAB_TODO_RUNTIME,
    title: "待办事项",
    component: ItabTodoWidget,
    openedPanel: ItabTodoOpenedPanel,
    defaultSizeKey: ITAB_TODO_DEFAULT_SIZE,
    supportedSizes: itabTodoFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 32,
      maxHeightInset: 32,
      trafficVisible: true,
    },
  },
  [ITAB_MEMO_WIDGET_TYPE]: {
    type: ITAB_MEMO_WIDGET_TYPE,
    runtime: ITAB_MEMO_RUNTIME,
    title: "备忘录",
    component: ItabMemoWidget,
    openedPanel: ItabMemoOpenedPanel,
    defaultSizeKey: ITAB_MEMO_DEFAULT_SIZE,
    supportedSizes: itabMemoFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 32,
      maxHeightInset: 32,
      trafficVisible: true,
    },
  },
  [ITAB_CLOCK_WIDGET_TYPE]: {
    type: ITAB_CLOCK_WIDGET_TYPE,
    runtime: ITAB_CLOCK_RUNTIME,
    title: "时钟",
    component: ItabClockWidget,
    openedPanel: ItabClockOpenedPanel,
    defaultSizeKey: ITAB_CLOCK_DEFAULT_SIZE,
    supportedSizes: itabClockFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 32,
      maxHeightInset: 32,
      trafficVisible: false,
    },
  },
  [ITAB_DAILY_ENGLISH_WIDGET_TYPE]: {
    type: ITAB_DAILY_ENGLISH_WIDGET_TYPE,
    runtime: ITAB_DAILY_ENGLISH_RUNTIME,
    title: "今日英语",
    component: ItabDailyEnglishWidget,
    openedPanel: ItabDailyEnglishOpenedPanel,
    defaultSizeKey: ITAB_DAILY_ENGLISH_DEFAULT_SIZE,
    supportedSizes: itabDailyEnglishFamily?.supported || [],
    openedShell: {
      width: 860,
      height: 552,
      maxWidthInset: 42,
      maxHeightInset: 64,
      trafficVisible: true,
    },
  },
  [ITAB_POEM_WIDGET_TYPE]: {
    type: ITAB_POEM_WIDGET_TYPE,
    runtime: ITAB_POEM_RUNTIME,
    title: "今日诗词",
    component: ItabPoemWidget,
    openedPanel: ItabPoemOpenedPanel,
    defaultSizeKey: ITAB_POEM_DEFAULT_SIZE,
    supportedSizes: itabPoemFamily?.supported || [],
    openedShell: {
      width: 860,
      height: 552,
      maxWidthInset: 42,
      maxHeightInset: 64,
      trafficVisible: true,
    },
  },
  [ITAB_POMODORO_WIDGET_TYPE]: {
    type: ITAB_POMODORO_WIDGET_TYPE,
    runtime: ITAB_POMODORO_RUNTIME,
    title: "番茄时钟",
    component: ItabPomodoroWidget,
    openedPanel: ItabPomodoroOpenedPanel,
    defaultSizeKey: ITAB_POMODORO_DEFAULT_SIZE,
    supportedSizes: itabPomodoroFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 42,
      maxHeightInset: 64,
      trafficVisible: true,
    },
  },
  [ITAB_ANNIVERSARY_WIDGET_TYPE]: {
    type: ITAB_ANNIVERSARY_WIDGET_TYPE,
    runtime: ITAB_ANNIVERSARY_RUNTIME,
    title: "纪念日",
    component: ItabAnniversaryWidget,
    openedPanel: ItabAnniversaryOpenedPanel,
    defaultSizeKey: ITAB_ANNIVERSARY_DEFAULT_SIZE,
    supportedSizes: itabAnniversaryFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 42,
      maxHeightInset: 64,
      trafficVisible: true,
    },
  },
};

export const getWidgetRuntimeDefinition = (type: string) =>
  WIDGET_RUNTIME_DEFINITIONS[type];

export const isRuntimeWidget = (widget: Pick<WidgetConfig, "type">) =>
  isRuntimeWidgetType(widget.type);

export const resolveWidgetRuntimeSizeKey = (widget: WidgetConfig) =>
  resolveRuntimeSizeKey(widget.type, {
    sizeKey: normalizeWidgetRuntimeData(widget.type, widget.data)?.sizeKey,
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });

export const normalizeWidgetRuntimeData = (
  type: string,
  data: unknown,
): WidgetRuntimeData | undefined => {
  if (type === ITAB_WEATHER_WIDGET_TYPE) {
    return normalizeItabWeatherWidgetData(data);
  }
  if (type === ITAB_TODO_WIDGET_TYPE) {
    return normalizeItabTodoWidgetData(data);
  }
  if (type === ITAB_MEMO_WIDGET_TYPE) {
    return normalizeItabMemoWidgetData(data);
  }
  if (type === ITAB_CLOCK_WIDGET_TYPE) {
    return normalizeItabClockWidgetData(data);
  }
  if (type === ITAB_DAILY_ENGLISH_WIDGET_TYPE) {
    return normalizeItabDailyEnglishWidgetData(data);
  }
  if (type === ITAB_POEM_WIDGET_TYPE) {
    return normalizeItabPoemWidgetData(data);
  }
  if (type === ITAB_POMODORO_WIDGET_TYPE) {
    return normalizeItabPomodoroWidgetData(data);
  }
  if (type === ITAB_ANNIVERSARY_WIDGET_TYPE) {
    return normalizeItabAnniversaryWidgetData(data);
  }
  return undefined;
};

export const applyRuntimeWidgetSize = (
  widget: WidgetConfig,
  sizeKey: RuntimeWidgetSizeKey,
) => {
  if (widget.type === ITAB_WEATHER_WIDGET_TYPE) {
    applyItabWeatherSizeToWidget(widget, sizeKey);
  }
  if (widget.type === ITAB_TODO_WIDGET_TYPE) {
    applyItabTodoSizeToWidget(widget, sizeKey);
  }
  if (widget.type === ITAB_MEMO_WIDGET_TYPE) {
    applyItabMemoSizeToWidget(widget, sizeKey);
  }
  if (widget.type === ITAB_CLOCK_WIDGET_TYPE) {
    applyItabClockSizeToWidget(widget, sizeKey);
  }
  if (widget.type === ITAB_DAILY_ENGLISH_WIDGET_TYPE) {
    applyItabDailyEnglishSizeToWidget(widget, sizeKey);
  }
  if (widget.type === ITAB_POEM_WIDGET_TYPE) {
    applyItabPoemSizeToWidget(widget, sizeKey);
  }
  if (widget.type === ITAB_POMODORO_WIDGET_TYPE) {
    applyItabPomodoroSizeToWidget(widget, sizeKey);
  }
  if (widget.type === ITAB_ANNIVERSARY_WIDGET_TYPE) {
    applyItabAnniversarySizeToWidget(widget, sizeKey);
  }
};
