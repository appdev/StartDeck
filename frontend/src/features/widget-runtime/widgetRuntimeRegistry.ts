import type { Component } from "vue";
import type { WidgetConfig } from "@/types";
import {
  ITAB_WIDGET_SIZE_BY_KEY,
  type ItabWidgetSizeKey,
} from "@/features/itab-widgets/itabSizePresets";
import DockerWidget from "@/components/DockerWidget.vue";
import SystemStatusWidget from "@/components/SystemStatusWidget.vue";
import CustomCssWidget from "@/components/CustomCssWidget.vue";
import DockerOpenedPanel from "./DockerOpenedPanel.vue";
import SystemStatusOpenedPanel from "./SystemStatusOpenedPanel.vue";
import CustomCssOpenedPanel from "./CustomCssOpenedPanel.vue";
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
import ItabWallpaperOpenedPanel from "@/features/itab-wallpaper/ItabWallpaperOpenedPanel.vue";
import ItabWallpaperWidget from "@/features/itab-wallpaper/ItabWallpaperWidget.vue";
import ItabMovieCalendarOpenedPanel from "@/features/itab-movie-calendar/ItabMovieCalendarOpenedPanel.vue";
import ItabMovieCalendarWidget from "@/features/itab-movie-calendar/ItabMovieCalendarWidget.vue";
import ItabIpOpenedPanel from "@/features/itab-ip/ItabIpOpenedPanel.vue";
import ItabIpWidget from "@/features/itab-ip/ItabIpWidget.vue";
import ItabCalendarOpenedPanel from "@/features/itab-calendar/ItabCalendarOpenedPanel.vue";
import ItabCalendarWidget from "@/features/itab-calendar/ItabCalendarWidget.vue";
import ItabNumberUppercaseOpenedPanel from "@/features/itab-number-uppercase/ItabNumberUppercaseOpenedPanel.vue";
import ItabNumberUppercaseWidget from "@/features/itab-number-uppercase/ItabNumberUppercaseWidget.vue";
import ItabFoodPickerOpenedPanel from "@/features/itab-food-picker/ItabFoodPickerOpenedPanel.vue";
import ItabFoodPickerWidget from "@/features/itab-food-picker/ItabFoodPickerWidget.vue";
import AiUsageOpenedPanel from "@/features/ai-usage/AiUsageOpenedPanel.vue";
import AiUsageWidget from "@/features/ai-usage/AiUsageWidget.vue";
import TapdDefectsOpenedPanel from "@/features/tapd-defects/TapdDefectsOpenedPanel.vue";
import TapdDefectsWidget from "@/features/tapd-defects/TapdDefectsWidget.vue";
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
  ITAB_WALLPAPER_DEFAULT_SIZE,
  ITAB_WALLPAPER_RUNTIME,
  ITAB_WALLPAPER_WIDGET_TYPE,
  type ItabWallpaperWidgetData,
} from "@/features/itab-wallpaper/itabWallpaperTypes";
import {
  ITAB_MOVIE_CALENDAR_DEFAULT_SIZE,
  ITAB_MOVIE_CALENDAR_RUNTIME,
  ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
  type ItabMovieCalendarWidgetData,
} from "@/features/itab-movie-calendar/itabMovieCalendarTypes";
import {
  ITAB_IP_DEFAULT_SIZE,
  ITAB_IP_RUNTIME,
  ITAB_IP_WIDGET_TYPE,
  type ItabIpWidgetData,
} from "@/features/itab-ip/itabIpTypes";
import {
  ITAB_CALENDAR_DEFAULT_SIZE,
  ITAB_CALENDAR_RUNTIME,
  ITAB_CALENDAR_WIDGET_TYPE,
  type ItabCalendarWidgetData,
} from "@/features/itab-calendar/itabCalendarTypes";
import {
  ITAB_NUMBER_UPPERCASE_DEFAULT_SIZE,
  ITAB_NUMBER_UPPERCASE_RUNTIME,
  ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
  type ItabNumberUppercaseWidgetData,
} from "@/features/itab-number-uppercase/itabNumberUppercaseTypes";
import {
  ITAB_FOOD_PICKER_DEFAULT_SIZE,
  ITAB_FOOD_PICKER_RUNTIME,
  ITAB_FOOD_PICKER_WIDGET_TYPE,
  type ItabFoodPickerWidgetData,
} from "@/features/itab-food-picker/itabFoodPickerTypes";
import {
  AI_USAGE_DEFAULT_SIZE,
  AI_USAGE_RUNTIME,
  AI_USAGE_WIDGET_TYPE,
  type AiUsageWidgetData,
} from "@/features/ai-usage/aiUsageTypes";
import {
  TAPD_DEFECTS_DEFAULT_SIZE,
  TAPD_DEFECTS_RUNTIME,
  TAPD_DEFECTS_WIDGET_TYPE,
  type TapdDefectWidgetData,
} from "@/features/tapd-defects/tapdDefectTypes";
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
  applyItabWallpaperSizeToWidget,
  normalizeItabWallpaperWidgetData,
} from "@/features/itab-wallpaper/itabWallpaperModel";
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
  DOCKER_DEFAULT_SIZE,
  DOCKER_RUNTIME,
  DOCKER_WIDGET_TYPE,
  SYSTEM_STATUS_DEFAULT_SIZE,
  SYSTEM_STATUS_RUNTIME,
  SYSTEM_STATUS_WIDGET_TYPE,
  applyDockerWidgetSizeToWidget,
  applySystemStatusWidgetSizeToWidget,
  normalizeDockerWidgetData,
  normalizeSystemStatusWidgetData,
  type DockerWidgetRuntimeData,
  type SystemStatusWidgetRuntimeData,
} from "./systemComponentRuntimeModel";
import {
  CUSTOM_CSS_DEFAULT_SIZE,
  CUSTOM_CSS_RUNTIME,
  CUSTOM_CSS_WIDGET_TYPE,
  applyCustomCssWidgetSizeToWidget,
  normalizeCustomCssWidgetData,
  type CustomCssWidgetRuntimeData,
} from "./customCssRuntimeModel";
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
const itabWallpaperFamily = resolveRuntimeWidgetSizeFamily(
  ITAB_WALLPAPER_WIDGET_TYPE,
);
const itabMovieCalendarFamily = resolveRuntimeWidgetSizeFamily(
  ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
);
const itabIpFamily = resolveRuntimeWidgetSizeFamily(ITAB_IP_WIDGET_TYPE);
const itabCalendarFamily = resolveRuntimeWidgetSizeFamily(
  ITAB_CALENDAR_WIDGET_TYPE,
);
const itabNumberUppercaseFamily = resolveRuntimeWidgetSizeFamily(
  ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
);
const itabFoodPickerFamily = resolveRuntimeWidgetSizeFamily(
  ITAB_FOOD_PICKER_WIDGET_TYPE,
);
const aiUsageFamily = resolveRuntimeWidgetSizeFamily(AI_USAGE_WIDGET_TYPE);
const tapdDefectsFamily = resolveRuntimeWidgetSizeFamily(
  TAPD_DEFECTS_WIDGET_TYPE,
);
const dockerFamily = resolveRuntimeWidgetSizeFamily(DOCKER_WIDGET_TYPE);
const systemStatusFamily = resolveRuntimeWidgetSizeFamily(
  SYSTEM_STATUS_WIDGET_TYPE,
);
const customCssFamily = resolveRuntimeWidgetSizeFamily(CUSTOM_CSS_WIDGET_TYPE);

export type WidgetRuntimeData =
  | DockerWidgetRuntimeData
  | SystemStatusWidgetRuntimeData
  | CustomCssWidgetRuntimeData
  | ItabWeatherWidgetData
  | ItabTodoWidgetData
  | ItabMemoWidgetData
  | ItabClockWidgetData
  | ItabDailyEnglishWidgetData
  | ItabPoemWidgetData
  | ItabPomodoroWidgetData
  | ItabAnniversaryWidgetData
  | ItabWallpaperWidgetData
  | ItabMovieCalendarWidgetData
  | ItabIpWidgetData
  | ItabCalendarWidgetData
  | ItabNumberUppercaseWidgetData
  | ItabFoodPickerWidgetData
  | AiUsageWidgetData
  | TapdDefectWidgetData;

export const WIDGET_RUNTIME_DEFINITIONS: Record<
  string,
  WidgetRuntimeDefinition
> = {
  [DOCKER_WIDGET_TYPE]: {
    type: DOCKER_WIDGET_TYPE,
    runtime: DOCKER_RUNTIME,
    title: "Docker",
    component: DockerWidget,
    openedPanel: DockerOpenedPanel,
    defaultSizeKey: DOCKER_DEFAULT_SIZE,
    supportedSizes: dockerFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 42,
      maxHeightInset: 18,
      trafficVisible: true,
    },
  },
  [SYSTEM_STATUS_WIDGET_TYPE]: {
    type: SYSTEM_STATUS_WIDGET_TYPE,
    runtime: SYSTEM_STATUS_RUNTIME,
    title: "系统状态",
    component: SystemStatusWidget,
    openedPanel: SystemStatusOpenedPanel,
    defaultSizeKey: SYSTEM_STATUS_DEFAULT_SIZE,
    supportedSizes: systemStatusFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 42,
      maxHeightInset: 18,
      trafficVisible: true,
    },
  },
  [CUSTOM_CSS_WIDGET_TYPE]: {
    type: CUSTOM_CSS_WIDGET_TYPE,
    runtime: CUSTOM_CSS_RUNTIME,
    title: "自定义组件",
    component: CustomCssWidget,
    openedPanel: CustomCssOpenedPanel,
    defaultSizeKey: CUSTOM_CSS_DEFAULT_SIZE,
    supportedSizes: customCssFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 42,
      maxHeightInset: 18,
      trafficVisible: true,
    },
  },
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
  [ITAB_WALLPAPER_WIDGET_TYPE]: {
    type: ITAB_WALLPAPER_WIDGET_TYPE,
    runtime: ITAB_WALLPAPER_RUNTIME,
    title: "壁纸",
    component: ItabWallpaperWidget,
    openedPanel: ItabWallpaperOpenedPanel,
    defaultSizeKey: ITAB_WALLPAPER_DEFAULT_SIZE,
    supportedSizes: itabWallpaperFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 42,
      maxHeightInset: 18,
      trafficVisible: true,
    },
  },
  [ITAB_MOVIE_CALENDAR_WIDGET_TYPE]: {
    type: ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
    runtime: ITAB_MOVIE_CALENDAR_RUNTIME,
    title: "电影日历",
    component: ItabMovieCalendarWidget,
    openedPanel: ItabMovieCalendarOpenedPanel,
    defaultSizeKey: ITAB_MOVIE_CALENDAR_DEFAULT_SIZE,
    supportedSizes: itabMovieCalendarFamily?.supported || [],
    openedShell: {
      width: 860,
      height: 552,
      maxWidthInset: 42,
      maxHeightInset: 64,
      trafficVisible: true,
    },
  },
  [ITAB_IP_WIDGET_TYPE]: {
    type: ITAB_IP_WIDGET_TYPE,
    runtime: ITAB_IP_RUNTIME,
    title: "本机IP",
    component: ItabIpWidget,
    openedPanel: ItabIpOpenedPanel,
    defaultSizeKey: ITAB_IP_DEFAULT_SIZE,
    supportedSizes: itabIpFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 42,
      maxHeightInset: 18,
      trafficVisible: true,
    },
  },
  [ITAB_CALENDAR_WIDGET_TYPE]: {
    type: ITAB_CALENDAR_WIDGET_TYPE,
    runtime: ITAB_CALENDAR_RUNTIME,
    title: "日历",
    component: ItabCalendarWidget,
    openedPanel: ItabCalendarOpenedPanel,
    defaultSizeKey: ITAB_CALENDAR_DEFAULT_SIZE,
    supportedSizes: itabCalendarFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 42,
      maxHeightInset: 18,
      trafficVisible: true,
    },
  },
  [ITAB_NUMBER_UPPERCASE_WIDGET_TYPE]: {
    type: ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
    runtime: ITAB_NUMBER_UPPERCASE_RUNTIME,
    title: "金额换算",
    component: ItabNumberUppercaseWidget,
    openedPanel: ItabNumberUppercaseOpenedPanel,
    defaultSizeKey: ITAB_NUMBER_UPPERCASE_DEFAULT_SIZE,
    supportedSizes: itabNumberUppercaseFamily?.supported || [],
    openedShell: {
      width: 900,
      height: 554,
      maxWidthInset: 42,
      maxHeightInset: 64,
      trafficVisible: true,
    },
  },
  [ITAB_FOOD_PICKER_WIDGET_TYPE]: {
    type: ITAB_FOOD_PICKER_WIDGET_TYPE,
    runtime: ITAB_FOOD_PICKER_RUNTIME,
    title: "今天吃什么",
    component: ItabFoodPickerWidget,
    openedPanel: ItabFoodPickerOpenedPanel,
    defaultSizeKey: ITAB_FOOD_PICKER_DEFAULT_SIZE,
    supportedSizes: itabFoodPickerFamily?.supported || [],
    openedShell: {
      width: 998,
      height: 600,
      maxWidthInset: 42,
      maxHeightInset: 64,
      trafficVisible: true,
    },
  },
  [AI_USAGE_WIDGET_TYPE]: {
    type: AI_USAGE_WIDGET_TYPE,
    runtime: AI_USAGE_RUNTIME,
    title: "AI 使用量",
    component: AiUsageWidget,
    openedPanel: AiUsageOpenedPanel,
    defaultSizeKey: AI_USAGE_DEFAULT_SIZE,
    supportedSizes: aiUsageFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 42,
      maxHeightInset: 64,
      trafficVisible: true,
    },
  },
  [TAPD_DEFECTS_WIDGET_TYPE]: {
    type: TAPD_DEFECTS_WIDGET_TYPE,
    runtime: TAPD_DEFECTS_RUNTIME,
    title: "TAPD 缺陷",
    component: TapdDefectsWidget,
    openedPanel: TapdDefectsOpenedPanel,
    defaultSizeKey: TAPD_DEFECTS_DEFAULT_SIZE,
    supportedSizes: tapdDefectsFamily?.supported || [],
    openedShell: {
      width: 1100,
      height: 720,
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
    sizeKey:
      widget.data &&
      typeof widget.data === "object" &&
      typeof widget.data.sizeKey === "string"
        ? widget.data.sizeKey
        : undefined,
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  }) || normalizeWidgetRuntimeData(widget.type, widget.data)?.sizeKey;

export const normalizeWidgetRuntimeData = (
  type: string,
  data: unknown,
): WidgetRuntimeData | undefined => {
  if (type === DOCKER_WIDGET_TYPE) {
    return normalizeDockerWidgetData(data);
  }
  if (type === SYSTEM_STATUS_WIDGET_TYPE) {
    return normalizeSystemStatusWidgetData(data);
  }
  if (type === CUSTOM_CSS_WIDGET_TYPE) {
    return normalizeCustomCssWidgetData(data);
  }
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
  if (type === ITAB_WALLPAPER_WIDGET_TYPE) {
    return normalizeItabWallpaperWidgetData(data);
  }
  if (type === ITAB_MOVIE_CALENDAR_WIDGET_TYPE) {
    return normalizeItabMovieCalendarWidgetData(data);
  }
  if (type === ITAB_IP_WIDGET_TYPE) {
    return normalizeItabIpWidgetData(data);
  }
  if (type === ITAB_CALENDAR_WIDGET_TYPE) {
    return normalizeItabCalendarWidgetData(data);
  }
  if (type === ITAB_NUMBER_UPPERCASE_WIDGET_TYPE) {
    return normalizeItabNumberUppercaseWidgetData(data);
  }
  if (type === ITAB_FOOD_PICKER_WIDGET_TYPE) {
    return normalizeItabFoodPickerWidgetData(data);
  }
  if (type === AI_USAGE_WIDGET_TYPE) {
    return normalizeAiUsageWidgetData(data);
  }
  if (type === TAPD_DEFECTS_WIDGET_TYPE) {
    return normalizeTapdDefectWidgetData(data);
  }
  return undefined;
};

export const applyRuntimeWidgetSize = (
  widget: WidgetConfig,
  sizeKey: RuntimeWidgetSizeKey,
) => {
  const resolvedSizeKey = resolveRuntimeSizeKey(widget.type, { sizeKey });
  if (!resolvedSizeKey) return;
  const itabSizeKey = ITAB_WIDGET_SIZE_BY_KEY.has(
    resolvedSizeKey as ItabWidgetSizeKey,
  )
    ? (resolvedSizeKey as ItabWidgetSizeKey)
    : undefined;
  if (widget.type === DOCKER_WIDGET_TYPE) {
    applyDockerWidgetSizeToWidget(widget, resolvedSizeKey);
  }
  if (widget.type === SYSTEM_STATUS_WIDGET_TYPE) {
    applySystemStatusWidgetSizeToWidget(widget, resolvedSizeKey);
  }
  if (widget.type === CUSTOM_CSS_WIDGET_TYPE) {
    applyCustomCssWidgetSizeToWidget(widget, resolvedSizeKey);
  }
  if (widget.type === ITAB_WEATHER_WIDGET_TYPE) {
    if (itabSizeKey) applyItabWeatherSizeToWidget(widget, itabSizeKey);
  }
  if (widget.type === ITAB_TODO_WIDGET_TYPE) {
    applyItabTodoSizeToWidget(widget, resolvedSizeKey);
  }
  if (widget.type === ITAB_MEMO_WIDGET_TYPE) {
    applyItabMemoSizeToWidget(widget, resolvedSizeKey);
  }
  if (widget.type === ITAB_CLOCK_WIDGET_TYPE) {
    if (itabSizeKey) applyItabClockSizeToWidget(widget, itabSizeKey);
  }
  if (widget.type === ITAB_DAILY_ENGLISH_WIDGET_TYPE) {
    if (itabSizeKey) applyItabDailyEnglishSizeToWidget(widget, itabSizeKey);
  }
  if (widget.type === ITAB_POEM_WIDGET_TYPE) {
    if (itabSizeKey) applyItabPoemSizeToWidget(widget, itabSizeKey);
  }
  if (widget.type === ITAB_POMODORO_WIDGET_TYPE) {
    if (itabSizeKey) applyItabPomodoroSizeToWidget(widget, itabSizeKey);
  }
  if (widget.type === ITAB_ANNIVERSARY_WIDGET_TYPE) {
    if (itabSizeKey) applyItabAnniversarySizeToWidget(widget, itabSizeKey);
  }
  if (widget.type === ITAB_WALLPAPER_WIDGET_TYPE) {
    if (itabSizeKey) applyItabWallpaperSizeToWidget(widget, itabSizeKey);
  }
  if (widget.type === ITAB_MOVIE_CALENDAR_WIDGET_TYPE) {
    if (itabSizeKey) applyItabMovieCalendarSizeToWidget(widget, itabSizeKey);
  }
  if (widget.type === ITAB_IP_WIDGET_TYPE) {
    if (itabSizeKey) applyItabIpSizeToWidget(widget, itabSizeKey);
  }
  if (widget.type === ITAB_CALENDAR_WIDGET_TYPE) {
    if (itabSizeKey) applyItabCalendarSizeToWidget(widget, itabSizeKey);
  }
  if (widget.type === ITAB_NUMBER_UPPERCASE_WIDGET_TYPE) {
    if (itabSizeKey) applyItabNumberUppercaseSizeToWidget(widget, itabSizeKey);
  }
  if (widget.type === ITAB_FOOD_PICKER_WIDGET_TYPE) {
    if (itabSizeKey) applyItabFoodPickerSizeToWidget(widget, itabSizeKey);
  }
  if (widget.type === AI_USAGE_WIDGET_TYPE) {
    if (itabSizeKey) applyAiUsageSizeToWidget(widget, itabSizeKey);
  }
  if (widget.type === TAPD_DEFECTS_WIDGET_TYPE) {
    if (itabSizeKey) applyTapdDefectSizeToWidget(widget, itabSizeKey);
  }
};
