import type { Component } from "vue";
import type { WidgetConfig } from "@/types";
import {
  SD_WIDGET_SIZE_BY_KEY,
  type SdWidgetSizeKey,
} from "@/features/sd-widgets/sdSizePresets";
import DockerWidget from "@/components/DockerWidget.vue";
import SystemStatusWidget from "@/components/SystemStatusWidget.vue";
import CustomCssWidget from "@/components/CustomCssWidget.vue";
import DockerOpenedPanel from "./DockerOpenedPanel.vue";
import SystemStatusOpenedPanel from "./SystemStatusOpenedPanel.vue";
import CustomCssOpenedPanel from "./CustomCssOpenedPanel.vue";
import SdWeatherOpenedPanel from "@/features/sd-weather/SdWeatherOpenedPanel.vue";
import SdWeatherWidget from "@/features/sd-weather/SdWeatherWidget.vue";
import SdTodoOpenedPanel from "@/features/sd-todo/SdTodoOpenedPanel.vue";
import SdTodoWidget from "@/features/sd-todo/SdTodoWidget.vue";
import SdMemoOpenedPanel from "@/features/sd-memo/SdMemoOpenedPanel.vue";
import SdMemoWidget from "@/features/sd-memo/SdMemoWidget.vue";
import SdClockOpenedPanel from "@/features/sd-clock/SdClockOpenedPanel.vue";
import SdClockWidget from "@/features/sd-clock/SdClockWidget.vue";
import SdDailyEnglishOpenedPanel from "@/features/sd-daily-english/SdDailyEnglishOpenedPanel.vue";
import SdDailyEnglishWidget from "@/features/sd-daily-english/SdDailyEnglishWidget.vue";
import SdPoemOpenedPanel from "@/features/sd-poem/SdPoemOpenedPanel.vue";
import SdPoemWidget from "@/features/sd-poem/SdPoemWidget.vue";
import SdPomodoroOpenedPanel from "@/features/sd-pomodoro/SdPomodoroOpenedPanel.vue";
import SdPomodoroWidget from "@/features/sd-pomodoro/SdPomodoroWidget.vue";
import SdAnniversaryOpenedPanel from "@/features/sd-anniversary/SdAnniversaryOpenedPanel.vue";
import SdAnniversaryWidget from "@/features/sd-anniversary/SdAnniversaryWidget.vue";
import SdWallpaperOpenedPanel from "@/features/sd-wallpaper/SdWallpaperOpenedPanel.vue";
import SdWallpaperWidget from "@/features/sd-wallpaper/SdWallpaperWidget.vue";
import SdMovieCalendarOpenedPanel from "@/features/sd-movie-calendar/SdMovieCalendarOpenedPanel.vue";
import SdMovieCalendarWidget from "@/features/sd-movie-calendar/SdMovieCalendarWidget.vue";
import SdIpOpenedPanel from "@/features/sd-ip/SdIpOpenedPanel.vue";
import SdIpWidget from "@/features/sd-ip/SdIpWidget.vue";
import SdCalendarOpenedPanel from "@/features/sd-calendar/SdCalendarOpenedPanel.vue";
import SdCalendarWidget from "@/features/sd-calendar/SdCalendarWidget.vue";
import SdNumberUppercaseOpenedPanel from "@/features/sd-number-uppercase/SdNumberUppercaseOpenedPanel.vue";
import SdNumberUppercaseWidget from "@/features/sd-number-uppercase/SdNumberUppercaseWidget.vue";
import SdFoodPickerOpenedPanel from "@/features/sd-food-picker/SdFoodPickerOpenedPanel.vue";
import SdFoodPickerWidget from "@/features/sd-food-picker/SdFoodPickerWidget.vue";
import AiUsageOpenedPanel from "@/features/ai-usage/AiUsageOpenedPanel.vue";
import AiUsageWidget from "@/features/ai-usage/AiUsageWidget.vue";
import TapdDefectsOpenedPanel from "@/features/tapd-defects/TapdDefectsOpenedPanel.vue";
import TapdDefectsWidget from "@/features/tapd-defects/TapdDefectsWidget.vue";
import {
  SD_WEATHER_DEFAULT_SIZE,
  SD_WEATHER_RUNTIME,
  SD_WEATHER_WIDGET_TYPE,
  type SdWeatherWidgetData,
} from "@/features/sd-weather/sdWeatherTypes";
import {
  SD_TODO_DEFAULT_SIZE,
  SD_TODO_RUNTIME,
  SD_TODO_WIDGET_TYPE,
  type SdTodoWidgetData,
} from "@/features/sd-todo/sdTodoTypes";
import {
  SD_MEMO_DEFAULT_SIZE,
  SD_MEMO_RUNTIME,
  SD_MEMO_WIDGET_TYPE,
  type SdMemoWidgetData,
} from "@/features/sd-memo/sdMemoTypes";
import {
  SD_CLOCK_DEFAULT_SIZE,
  SD_CLOCK_RUNTIME,
  SD_CLOCK_WIDGET_TYPE,
  type SdClockWidgetData,
} from "@/features/sd-clock/sdClockTypes";
import {
  SD_DAILY_ENGLISH_DEFAULT_SIZE,
  SD_DAILY_ENGLISH_RUNTIME,
  SD_DAILY_ENGLISH_WIDGET_TYPE,
  type SdDailyEnglishWidgetData,
} from "@/features/sd-daily-english/sdDailyEnglishTypes";
import {
  SD_POEM_DEFAULT_SIZE,
  SD_POEM_RUNTIME,
  SD_POEM_WIDGET_TYPE,
  type SdPoemWidgetData,
} from "@/features/sd-poem/sdPoemTypes";
import {
  SD_POMODORO_DEFAULT_SIZE,
  SD_POMODORO_RUNTIME,
  SD_POMODORO_WIDGET_TYPE,
  type SdPomodoroWidgetData,
} from "@/features/sd-pomodoro/sdPomodoroTypes";
import {
  SD_ANNIVERSARY_DEFAULT_SIZE,
  SD_ANNIVERSARY_RUNTIME,
  SD_ANNIVERSARY_WIDGET_TYPE,
  type SdAnniversaryWidgetData,
} from "@/features/sd-anniversary/sdAnniversaryTypes";
import {
  SD_WALLPAPER_DEFAULT_SIZE,
  SD_WALLPAPER_RUNTIME,
  SD_WALLPAPER_WIDGET_TYPE,
  type SdWallpaperWidgetData,
} from "@/features/sd-wallpaper/sdWallpaperTypes";
import {
  SD_MOVIE_CALENDAR_DEFAULT_SIZE,
  SD_MOVIE_CALENDAR_RUNTIME,
  SD_MOVIE_CALENDAR_WIDGET_TYPE,
  type SdMovieCalendarWidgetData,
} from "@/features/sd-movie-calendar/sdMovieCalendarTypes";
import {
  SD_IP_DEFAULT_SIZE,
  SD_IP_RUNTIME,
  SD_IP_WIDGET_TYPE,
  type SdIpWidgetData,
} from "@/features/sd-ip/sdIpTypes";
import {
  SD_CALENDAR_DEFAULT_SIZE,
  SD_CALENDAR_RUNTIME,
  SD_CALENDAR_WIDGET_TYPE,
  type SdCalendarWidgetData,
} from "@/features/sd-calendar/sdCalendarTypes";
import {
  SD_NUMBER_UPPERCASE_DEFAULT_SIZE,
  SD_NUMBER_UPPERCASE_RUNTIME,
  SD_NUMBER_UPPERCASE_WIDGET_TYPE,
  type SdNumberUppercaseWidgetData,
} from "@/features/sd-number-uppercase/sdNumberUppercaseTypes";
import {
  SD_FOOD_PICKER_DEFAULT_SIZE,
  SD_FOOD_PICKER_RUNTIME,
  SD_FOOD_PICKER_WIDGET_TYPE,
  type SdFoodPickerWidgetData,
} from "@/features/sd-food-picker/sdFoodPickerTypes";
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
  normalizeSdWeatherWidgetData,
  applySdWeatherSizeToWidget,
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
  applySdWallpaperSizeToWidget,
  normalizeSdWallpaperWidgetData,
} from "@/features/sd-wallpaper/sdWallpaperModel";
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

const sdWeatherFamily = resolveRuntimeWidgetSizeFamily(
  SD_WEATHER_WIDGET_TYPE,
);
const sdTodoFamily = resolveRuntimeWidgetSizeFamily(SD_TODO_WIDGET_TYPE);
const sdMemoFamily = resolveRuntimeWidgetSizeFamily(SD_MEMO_WIDGET_TYPE);
const sdClockFamily = resolveRuntimeWidgetSizeFamily(SD_CLOCK_WIDGET_TYPE);
const sdDailyEnglishFamily = resolveRuntimeWidgetSizeFamily(
  SD_DAILY_ENGLISH_WIDGET_TYPE,
);
const sdPoemFamily = resolveRuntimeWidgetSizeFamily(SD_POEM_WIDGET_TYPE);
const sdPomodoroFamily = resolveRuntimeWidgetSizeFamily(
  SD_POMODORO_WIDGET_TYPE,
);
const sdAnniversaryFamily = resolveRuntimeWidgetSizeFamily(
  SD_ANNIVERSARY_WIDGET_TYPE,
);
const sdWallpaperFamily = resolveRuntimeWidgetSizeFamily(
  SD_WALLPAPER_WIDGET_TYPE,
);
const sdMovieCalendarFamily = resolveRuntimeWidgetSizeFamily(
  SD_MOVIE_CALENDAR_WIDGET_TYPE,
);
const sdIpFamily = resolveRuntimeWidgetSizeFamily(SD_IP_WIDGET_TYPE);
const sdCalendarFamily = resolveRuntimeWidgetSizeFamily(
  SD_CALENDAR_WIDGET_TYPE,
);
const sdNumberUppercaseFamily = resolveRuntimeWidgetSizeFamily(
  SD_NUMBER_UPPERCASE_WIDGET_TYPE,
);
const sdFoodPickerFamily = resolveRuntimeWidgetSizeFamily(
  SD_FOOD_PICKER_WIDGET_TYPE,
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
  | SdWeatherWidgetData
  | SdTodoWidgetData
  | SdMemoWidgetData
  | SdClockWidgetData
  | SdDailyEnglishWidgetData
  | SdPoemWidgetData
  | SdPomodoroWidgetData
  | SdAnniversaryWidgetData
  | SdWallpaperWidgetData
  | SdMovieCalendarWidgetData
  | SdIpWidgetData
  | SdCalendarWidgetData
  | SdNumberUppercaseWidgetData
  | SdFoodPickerWidgetData
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
  [SD_WEATHER_WIDGET_TYPE]: {
    type: SD_WEATHER_WIDGET_TYPE,
    runtime: SD_WEATHER_RUNTIME,
    title: "天气",
    component: SdWeatherWidget,
    openedPanel: SdWeatherOpenedPanel,
    defaultSizeKey: SD_WEATHER_DEFAULT_SIZE,
    supportedSizes: sdWeatherFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 42,
      maxHeightInset: 18,
      trafficVisible: true,
    },
  },
  [SD_TODO_WIDGET_TYPE]: {
    type: SD_TODO_WIDGET_TYPE,
    runtime: SD_TODO_RUNTIME,
    title: "待办事项",
    component: SdTodoWidget,
    openedPanel: SdTodoOpenedPanel,
    defaultSizeKey: SD_TODO_DEFAULT_SIZE,
    supportedSizes: sdTodoFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 32,
      maxHeightInset: 32,
      trafficVisible: true,
    },
  },
  [SD_MEMO_WIDGET_TYPE]: {
    type: SD_MEMO_WIDGET_TYPE,
    runtime: SD_MEMO_RUNTIME,
    title: "备忘录",
    component: SdMemoWidget,
    openedPanel: SdMemoOpenedPanel,
    defaultSizeKey: SD_MEMO_DEFAULT_SIZE,
    supportedSizes: sdMemoFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 32,
      maxHeightInset: 32,
      trafficVisible: true,
    },
  },
  [SD_CLOCK_WIDGET_TYPE]: {
    type: SD_CLOCK_WIDGET_TYPE,
    runtime: SD_CLOCK_RUNTIME,
    title: "时钟",
    component: SdClockWidget,
    openedPanel: SdClockOpenedPanel,
    defaultSizeKey: SD_CLOCK_DEFAULT_SIZE,
    supportedSizes: sdClockFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 32,
      maxHeightInset: 32,
      trafficVisible: false,
    },
  },
  [SD_DAILY_ENGLISH_WIDGET_TYPE]: {
    type: SD_DAILY_ENGLISH_WIDGET_TYPE,
    runtime: SD_DAILY_ENGLISH_RUNTIME,
    title: "今日英语",
    component: SdDailyEnglishWidget,
    openedPanel: SdDailyEnglishOpenedPanel,
    defaultSizeKey: SD_DAILY_ENGLISH_DEFAULT_SIZE,
    supportedSizes: sdDailyEnglishFamily?.supported || [],
    openedShell: {
      width: 860,
      height: 552,
      maxWidthInset: 42,
      maxHeightInset: 64,
      trafficVisible: true,
    },
  },
  [SD_POEM_WIDGET_TYPE]: {
    type: SD_POEM_WIDGET_TYPE,
    runtime: SD_POEM_RUNTIME,
    title: "今日诗词",
    component: SdPoemWidget,
    openedPanel: SdPoemOpenedPanel,
    defaultSizeKey: SD_POEM_DEFAULT_SIZE,
    supportedSizes: sdPoemFamily?.supported || [],
    openedShell: {
      width: 860,
      height: 552,
      maxWidthInset: 42,
      maxHeightInset: 64,
      trafficVisible: true,
    },
  },
  [SD_POMODORO_WIDGET_TYPE]: {
    type: SD_POMODORO_WIDGET_TYPE,
    runtime: SD_POMODORO_RUNTIME,
    title: "番茄时钟",
    component: SdPomodoroWidget,
    openedPanel: SdPomodoroOpenedPanel,
    defaultSizeKey: SD_POMODORO_DEFAULT_SIZE,
    supportedSizes: sdPomodoroFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 42,
      maxHeightInset: 64,
      trafficVisible: true,
    },
  },
  [SD_ANNIVERSARY_WIDGET_TYPE]: {
    type: SD_ANNIVERSARY_WIDGET_TYPE,
    runtime: SD_ANNIVERSARY_RUNTIME,
    title: "纪念日",
    component: SdAnniversaryWidget,
    openedPanel: SdAnniversaryOpenedPanel,
    defaultSizeKey: SD_ANNIVERSARY_DEFAULT_SIZE,
    supportedSizes: sdAnniversaryFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 42,
      maxHeightInset: 64,
      trafficVisible: true,
    },
  },
  [SD_WALLPAPER_WIDGET_TYPE]: {
    type: SD_WALLPAPER_WIDGET_TYPE,
    runtime: SD_WALLPAPER_RUNTIME,
    title: "壁纸",
    component: SdWallpaperWidget,
    openedPanel: SdWallpaperOpenedPanel,
    defaultSizeKey: SD_WALLPAPER_DEFAULT_SIZE,
    supportedSizes: sdWallpaperFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 42,
      maxHeightInset: 18,
      trafficVisible: true,
    },
  },
  [SD_MOVIE_CALENDAR_WIDGET_TYPE]: {
    type: SD_MOVIE_CALENDAR_WIDGET_TYPE,
    runtime: SD_MOVIE_CALENDAR_RUNTIME,
    title: "电影日历",
    component: SdMovieCalendarWidget,
    openedPanel: SdMovieCalendarOpenedPanel,
    defaultSizeKey: SD_MOVIE_CALENDAR_DEFAULT_SIZE,
    supportedSizes: sdMovieCalendarFamily?.supported || [],
    openedShell: {
      width: 860,
      height: 552,
      maxWidthInset: 42,
      maxHeightInset: 64,
      trafficVisible: true,
    },
  },
  [SD_IP_WIDGET_TYPE]: {
    type: SD_IP_WIDGET_TYPE,
    runtime: SD_IP_RUNTIME,
    title: "本机IP",
    component: SdIpWidget,
    openedPanel: SdIpOpenedPanel,
    defaultSizeKey: SD_IP_DEFAULT_SIZE,
    supportedSizes: sdIpFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 42,
      maxHeightInset: 18,
      trafficVisible: true,
    },
  },
  [SD_CALENDAR_WIDGET_TYPE]: {
    type: SD_CALENDAR_WIDGET_TYPE,
    runtime: SD_CALENDAR_RUNTIME,
    title: "日历",
    component: SdCalendarWidget,
    openedPanel: SdCalendarOpenedPanel,
    defaultSizeKey: SD_CALENDAR_DEFAULT_SIZE,
    supportedSizes: sdCalendarFamily?.supported || [],
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 42,
      maxHeightInset: 18,
      trafficVisible: true,
    },
  },
  [SD_NUMBER_UPPERCASE_WIDGET_TYPE]: {
    type: SD_NUMBER_UPPERCASE_WIDGET_TYPE,
    runtime: SD_NUMBER_UPPERCASE_RUNTIME,
    title: "金额换算",
    component: SdNumberUppercaseWidget,
    openedPanel: SdNumberUppercaseOpenedPanel,
    defaultSizeKey: SD_NUMBER_UPPERCASE_DEFAULT_SIZE,
    supportedSizes: sdNumberUppercaseFamily?.supported || [],
    openedShell: {
      width: 900,
      height: 554,
      maxWidthInset: 42,
      maxHeightInset: 64,
      trafficVisible: true,
    },
  },
  [SD_FOOD_PICKER_WIDGET_TYPE]: {
    type: SD_FOOD_PICKER_WIDGET_TYPE,
    runtime: SD_FOOD_PICKER_RUNTIME,
    title: "今天吃什么",
    component: SdFoodPickerWidget,
    openedPanel: SdFoodPickerOpenedPanel,
    defaultSizeKey: SD_FOOD_PICKER_DEFAULT_SIZE,
    supportedSizes: sdFoodPickerFamily?.supported || [],
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
  if (type === SD_WEATHER_WIDGET_TYPE) {
    return normalizeSdWeatherWidgetData(data);
  }
  if (type === SD_TODO_WIDGET_TYPE) {
    return normalizeSdTodoWidgetData(data);
  }
  if (type === SD_MEMO_WIDGET_TYPE) {
    return normalizeSdMemoWidgetData(data);
  }
  if (type === SD_CLOCK_WIDGET_TYPE) {
    return normalizeSdClockWidgetData(data);
  }
  if (type === SD_DAILY_ENGLISH_WIDGET_TYPE) {
    return normalizeSdDailyEnglishWidgetData(data);
  }
  if (type === SD_POEM_WIDGET_TYPE) {
    return normalizeSdPoemWidgetData(data);
  }
  if (type === SD_POMODORO_WIDGET_TYPE) {
    return normalizeSdPomodoroWidgetData(data);
  }
  if (type === SD_ANNIVERSARY_WIDGET_TYPE) {
    return normalizeSdAnniversaryWidgetData(data);
  }
  if (type === SD_WALLPAPER_WIDGET_TYPE) {
    return normalizeSdWallpaperWidgetData(data);
  }
  if (type === SD_MOVIE_CALENDAR_WIDGET_TYPE) {
    return normalizeSdMovieCalendarWidgetData(data);
  }
  if (type === SD_IP_WIDGET_TYPE) {
    return normalizeSdIpWidgetData(data);
  }
  if (type === SD_CALENDAR_WIDGET_TYPE) {
    return normalizeSdCalendarWidgetData(data);
  }
  if (type === SD_NUMBER_UPPERCASE_WIDGET_TYPE) {
    return normalizeSdNumberUppercaseWidgetData(data);
  }
  if (type === SD_FOOD_PICKER_WIDGET_TYPE) {
    return normalizeSdFoodPickerWidgetData(data);
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
  const sdSizeKey = SD_WIDGET_SIZE_BY_KEY.has(
    resolvedSizeKey as SdWidgetSizeKey,
  )
    ? (resolvedSizeKey as SdWidgetSizeKey)
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
  if (widget.type === SD_WEATHER_WIDGET_TYPE) {
    if (sdSizeKey) applySdWeatherSizeToWidget(widget, sdSizeKey);
  }
  if (widget.type === SD_TODO_WIDGET_TYPE) {
    applySdTodoSizeToWidget(widget, resolvedSizeKey);
  }
  if (widget.type === SD_MEMO_WIDGET_TYPE) {
    applySdMemoSizeToWidget(widget, resolvedSizeKey);
  }
  if (widget.type === SD_CLOCK_WIDGET_TYPE) {
    if (sdSizeKey) applySdClockSizeToWidget(widget, sdSizeKey);
  }
  if (widget.type === SD_DAILY_ENGLISH_WIDGET_TYPE) {
    if (sdSizeKey) applySdDailyEnglishSizeToWidget(widget, sdSizeKey);
  }
  if (widget.type === SD_POEM_WIDGET_TYPE) {
    if (sdSizeKey) applySdPoemSizeToWidget(widget, sdSizeKey);
  }
  if (widget.type === SD_POMODORO_WIDGET_TYPE) {
    if (sdSizeKey) applySdPomodoroSizeToWidget(widget, sdSizeKey);
  }
  if (widget.type === SD_ANNIVERSARY_WIDGET_TYPE) {
    if (sdSizeKey) applySdAnniversarySizeToWidget(widget, sdSizeKey);
  }
  if (widget.type === SD_WALLPAPER_WIDGET_TYPE) {
    if (sdSizeKey) applySdWallpaperSizeToWidget(widget, sdSizeKey);
  }
  if (widget.type === SD_MOVIE_CALENDAR_WIDGET_TYPE) {
    if (sdSizeKey) applySdMovieCalendarSizeToWidget(widget, sdSizeKey);
  }
  if (widget.type === SD_IP_WIDGET_TYPE) {
    if (sdSizeKey) applySdIpSizeToWidget(widget, sdSizeKey);
  }
  if (widget.type === SD_CALENDAR_WIDGET_TYPE) {
    if (sdSizeKey) applySdCalendarSizeToWidget(widget, sdSizeKey);
  }
  if (widget.type === SD_NUMBER_UPPERCASE_WIDGET_TYPE) {
    if (sdSizeKey) applySdNumberUppercaseSizeToWidget(widget, sdSizeKey);
  }
  if (widget.type === SD_FOOD_PICKER_WIDGET_TYPE) {
    if (sdSizeKey) applySdFoodPickerSizeToWidget(widget, sdSizeKey);
  }
  if (widget.type === AI_USAGE_WIDGET_TYPE) {
    if (sdSizeKey) applyAiUsageSizeToWidget(widget, sdSizeKey);
  }
  if (widget.type === TAPD_DEFECTS_WIDGET_TYPE) {
    if (sdSizeKey) applyTapdDefectSizeToWidget(widget, sdSizeKey);
  }
};
