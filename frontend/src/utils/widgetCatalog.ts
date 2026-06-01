import type { WidgetConfig } from "@/types";
import {
  resolveWidgetSizeFamily,
  type WidgetSizeFamily,
  type CatalogWidgetSizePreset,
} from "@/utils/widgetSizePresets";
import { createDefaultWidgetList } from "@/utils/widgetUtils";
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
import {
  SD_ANNIVERSARY_CATALOG_ID,
  SD_ANNIVERSARY_WIDGET_TYPE,
} from "@/features/sd-anniversary/sdAnniversaryTypes";
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
import { createDefaultSdWeatherWidget } from "@/features/sd-weather/sdWeatherModel";
import { createDefaultSdTodoWidget } from "@/features/sd-todo/sdTodoModel";
import { createDefaultSdMemoWidget } from "@/features/sd-memo/sdMemoModel";
import { createDefaultSdClockWidget } from "@/features/sd-clock/sdClockModel";
import { createDefaultSdDailyEnglishWidget } from "@/features/sd-daily-english/sdDailyEnglishModel";
import { createDefaultSdPoemWidget } from "@/features/sd-poem/sdPoemModel";
import { createDefaultSdPomodoroWidget } from "@/features/sd-pomodoro/sdPomodoroModel";
import { createDefaultSdAnniversaryWidget } from "@/features/sd-anniversary/sdAnniversaryModel";
import { createDefaultSdWallpaperWidget } from "@/features/sd-wallpaper/sdWallpaperModel";
import { createDefaultSdMovieCalendarWidget } from "@/features/sd-movie-calendar/sdMovieCalendarModel";
import { createDefaultSdIpWidget } from "@/features/sd-ip/sdIpModel";
import { createDefaultSdCalendarWidget } from "@/features/sd-calendar/sdCalendarModel";
import { createDefaultSdNumberUppercaseWidget } from "@/features/sd-number-uppercase/sdNumberUppercaseModel";
import { createDefaultSdFoodPickerWidget } from "@/features/sd-food-picker/sdFoodPickerModel";
import { createDefaultAiUsageWidget } from "@/features/ai-usage/aiUsageModel";
import { createDefaultTapdDefectWidget } from "@/features/tapd-defects/tapdDefectModel";
import { buildSdPersistedData } from "@/features/sd-widgets/sdAdapters";
import { withSdGridData } from "@/features/sd-widgets/sdGrid";
import { resolveSdWidgetEntry } from "@/features/sd-widgets/sdWidgetRegistry";
import {
  resolveRuntimeWidgetSizeFamily,
  type RuntimeWidgetSizeFamily,
  type RuntimeWidgetSizeKey,
  type RuntimeWidgetSizePreset,
} from "@/features/widget-runtime/widgetRuntimeSizes";
import { normalizeCustomCssWidgetData } from "@/features/widget-runtime/customCssRuntimeModel";

export type WidgetCatalogCategory =
  | "common"
  | "content"
  | "tool"
  | "system"
  | "custom";
export type WidgetCatalogMode = "multi" | "singleton";
export type WidgetCatalogAction = "add" | "enable" | "enabled";
export type WidgetCatalogSizeScope = "sd";
export type WidgetCatalogSizeKey =
  | CatalogWidgetSizePreset["key"]
  | RuntimeWidgetSizeKey;
export type WidgetCatalogSizePreset =
  | CatalogWidgetSizePreset
  | RuntimeWidgetSizePreset;
export type WidgetCatalogSizeFamily =
  | WidgetSizeFamily
  | RuntimeWidgetSizeFamily;

export interface WidgetCatalogItem {
  id: string;
  type: string;
  title: string;
  description: string;
  category: WidgetCatalogCategory;
  mode: WidgetCatalogMode;
  glyph: string;
  colSpan: number;
  rowSpan: number;
  sizeScope: WidgetCatalogSizeScope;
  sizeFamily: WidgetCatalogSizeFamily;
  supportedSizes: WidgetCatalogSizePreset[];
}

export const WIDGET_CATALOG_CATEGORIES: {
  id: WidgetCatalogCategory;
  label: string;
}[] = [
  { id: "common", label: "常用" },
  { id: "content", label: "内容" },
  { id: "tool", label: "工具" },
  { id: "system", label: "系统" },
  { id: "custom", label: "自定义" },
];

const catalogItem = (
  input: Omit<
    WidgetCatalogItem,
    "colSpan" | "rowSpan" | "sizeScope" | "sizeFamily" | "supportedSizes"
  >,
): WidgetCatalogItem => {
  const sizeFamily =
    resolveRuntimeWidgetSizeFamily(input.type) ||
    resolveWidgetSizeFamily(input.type);
  return {
    ...input,
    colSpan: sizeFamily.defaultSize.colSpan,
    rowSpan: sizeFamily.defaultSize.rowSpan,
    sizeScope: sizeFamily.scope || "sd",
    sizeFamily,
    supportedSizes: sizeFamily.supported,
  };
};

export const WIDGET_CATALOG: WidgetCatalogItem[] = [
  catalogItem({
    id: SD_CLOCK_CATALOG_ID,
    type: SD_CLOCK_WIDGET_TYPE,
    title: "时钟",
    description: "翻页时钟、日期和打开态大屏",
    category: "common",
    mode: "singleton",
    glyph: "时",
  }),
  catalogItem({
    id: "weather",
    type: SD_WEATHER_WIDGET_TYPE,
    title: "天气",
    description: "温度、空气质量与预报",
    category: "common",
    mode: "singleton",
    glyph: "晴",
  }),
  catalogItem({
    id: SD_ANNIVERSARY_CATALOG_ID,
    type: SD_ANNIVERSARY_WIDGET_TYPE,
    title: "纪念日",
    description: "纪念日、倒数日和事件日期模板",
    category: "common",
    mode: "multi",
    glyph: "纪",
  }),
  catalogItem({
    id: SD_CALENDAR_CATALOG_ID,
    type: SD_CALENDAR_WIDGET_TYPE,
    title: "日历",
    description: "公历、农历、节气和节假日",
    category: "common",
    mode: "singleton",
    glyph: "历",
  }),
  catalogItem({
    id: SD_WALLPAPER_CATALOG_ID,
    type: SD_WALLPAPER_WIDGET_TYPE,
    title: "壁纸",
    description: "必应壁纸库，打开后可一键应用桌面背景",
    category: "content",
    mode: "multi",
    glyph: "壁",
  }),
  catalogItem({
    id: "custom-css",
    type: "custom-css",
    title: "自定义组件",
    description: "使用 HTML 与 CSS 制作组件",
    category: "custom",
    mode: "multi",
    glyph: "自",
  }),
  catalogItem({
    id: SD_MEMO_CATALOG_ID,
    type: SD_MEMO_WIDGET_TYPE,
    title: "备忘录",
    description: "记录、搜索和固定便签",
    category: "common",
    mode: "singleton",
    glyph: "备",
  }),
  catalogItem({
    id: SD_TODO_CATALOG_ID,
    type: SD_TODO_WIDGET_TYPE,
    title: "待办",
    description: "管理简单任务列表",
    category: "common",
    mode: "singleton",
    glyph: "办",
  }),
  catalogItem({
    id: SD_POMODORO_CATALOG_ID,
    type: SD_POMODORO_WIDGET_TYPE,
    title: "番茄时钟",
    description: "专注计时、背景音和会话进度",
    category: "common",
    mode: "singleton",
    glyph: "番",
  }),
  catalogItem({
    id: SD_POEM_CATALOG_ID,
    type: SD_POEM_WIDGET_TYPE,
    title: "今日诗词",
    description: "每日诗词名句、出处和全文释义",
    category: "content",
    mode: "singleton",
    glyph: "诗",
  }),
  catalogItem({
    id: SD_DAILY_ENGLISH_CATALOG_ID,
    type: SD_DAILY_ENGLISH_WIDGET_TYPE,
    title: "今日英语",
    description: "每日英语句子、翻译和跟读音频",
    category: "content",
    mode: "singleton",
    glyph: "英",
  }),
  catalogItem({
    id: SD_MOVIE_CALENDAR_CATALOG_ID,
    type: SD_MOVIE_CALENDAR_WIDGET_TYPE,
    title: "电影日历",
    description: "每日电影推荐、评分和影评短句",
    category: "content",
    mode: "singleton",
    glyph: "影",
  }),
  catalogItem({
    id: SD_IP_CATALOG_ID,
    type: SD_IP_WIDGET_TYPE,
    title: "本机IP",
    description: "显示当前 IP 地址、归属地和网络信息",
    category: "tool",
    mode: "singleton",
    glyph: "IP",
  }),
  catalogItem({
    id: SD_NUMBER_UPPERCASE_CATALOG_ID,
    type: SD_NUMBER_UPPERCASE_WIDGET_TYPE,
    title: "金额换算",
    description: "将金额转为大写",
    category: "tool",
    mode: "multi",
    glyph: "¥",
  }),
  catalogItem({
    id: SD_FOOD_PICKER_CATALOG_ID,
    type: SD_FOOD_PICKER_WIDGET_TYPE,
    title: "今天吃什么",
    description: "随机抽取用餐候选并维护本地菜单",
    category: "tool",
    mode: "multi",
    glyph: "吃",
  }),
  catalogItem({
    id: AI_USAGE_CATALOG_ID,
    type: AI_USAGE_WIDGET_TYPE,
    title: "AI 使用量",
    description: "查看 OpenAI/Codex 等 provider 的额度余额",
    category: "tool",
    mode: "multi",
    glyph: "AI",
  }),
  catalogItem({
    id: TAPD_DEFECTS_CATALOG_ID,
    type: TAPD_DEFECTS_WIDGET_TYPE,
    title: "TAPD 缺陷",
    description: "浏览当前账号可见缺陷、待验证状态和屏蔽列表",
    category: "tool",
    mode: "multi",
    glyph: "TAPD",
  }),
  catalogItem({
    id: "docker",
    type: "docker",
    title: "Docker",
    description: "查看容器运行状态",
    category: "system",
    mode: "singleton",
    glyph: "D",
  }),
  catalogItem({
    id: "system-status",
    type: "system-status",
    title: "系统状态",
    description: "查看 CPU、内存和磁盘状态",
    category: "system",
    mode: "singleton",
    glyph: "系",
  }),
];

const defaultWidgetByType = () => {
  return new Map(
    createDefaultWidgetList(true).map(
      (widget) => [widget.type, widget] as const,
    ),
  );
};

const cloneWidget = (widget: WidgetConfig): WidgetConfig => {
  return JSON.parse(JSON.stringify(widget)) as WidgetConfig;
};

const createId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const WIDGET_CATALOG_ALIASES = new Map([
  [SD_CLOCK_WIDGET_TYPE, SD_CLOCK_CATALOG_ID],
  ["sd-weather-00", SD_WEATHER_CATALOG_ID],
  [SD_TODO_WIDGET_TYPE, SD_TODO_CATALOG_ID],
  [SD_MEMO_WIDGET_TYPE, SD_MEMO_CATALOG_ID],
  [SD_DAILY_ENGLISH_WIDGET_TYPE, SD_DAILY_ENGLISH_CATALOG_ID],
  [SD_POEM_WIDGET_TYPE, SD_POEM_CATALOG_ID],
  [SD_POMODORO_WIDGET_TYPE, SD_POMODORO_CATALOG_ID],
  [SD_ANNIVERSARY_WIDGET_TYPE, SD_ANNIVERSARY_CATALOG_ID],
  [SD_WALLPAPER_WIDGET_TYPE, SD_WALLPAPER_CATALOG_ID],
  [SD_MOVIE_CALENDAR_WIDGET_TYPE, SD_MOVIE_CALENDAR_CATALOG_ID],
  [SD_IP_WIDGET_TYPE, SD_IP_CATALOG_ID],
  [SD_CALENDAR_WIDGET_TYPE, SD_CALENDAR_CATALOG_ID],
  [SD_NUMBER_UPPERCASE_WIDGET_TYPE, SD_NUMBER_UPPERCASE_CATALOG_ID],
  [SD_FOOD_PICKER_WIDGET_TYPE, SD_FOOD_PICKER_CATALOG_ID],
  [AI_USAGE_WIDGET_TYPE, AI_USAGE_CATALOG_ID],
  [TAPD_DEFECTS_WIDGET_TYPE, TAPD_DEFECTS_CATALOG_ID],
]);

export const getWidgetCatalogItem = (id: string) => {
  const resolvedId = WIDGET_CATALOG_ALIASES.get(id) || id;
  return WIDGET_CATALOG.find((item) => item.id === resolvedId);
};

export const findExistingCatalogWidget = (
  widgets: WidgetConfig[],
  item: WidgetCatalogItem,
): WidgetConfig | undefined => {
  if (item.mode !== "singleton") return undefined;
  return widgets.find(
    (widget) =>
      widget.id === item.id ||
      widget.type === item.type ||
      WIDGET_CATALOG_ALIASES.get(widget.type) === item.id,
  );
};

export const getWidgetCatalogAction = (
  widgets: WidgetConfig[],
  item: WidgetCatalogItem,
): WidgetCatalogAction => {
  const existing = findExistingCatalogWidget(widgets, item);
  if (!existing) return "add";
  return existing.enable === false ? "enable" : "enabled";
};

const assignCatalogInstanceId = (
  widget: WidgetConfig,
  item: WidgetCatalogItem,
): WidgetConfig => {
  widget.id = createId(item.id || item.type);
  return widget;
};

export const createWidgetFromCatalog = (
  item: WidgetCatalogItem,
): WidgetConfig => {
  if (item.type === SD_WEATHER_WIDGET_TYPE) {
    const widget = createDefaultSdWeatherWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === SD_TODO_WIDGET_TYPE) {
    const widget = createDefaultSdTodoWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === SD_MEMO_WIDGET_TYPE) {
    const widget = createDefaultSdMemoWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === SD_CLOCK_WIDGET_TYPE) {
    const widget = createDefaultSdClockWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === SD_DAILY_ENGLISH_WIDGET_TYPE) {
    const widget = createDefaultSdDailyEnglishWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === SD_POEM_WIDGET_TYPE) {
    const widget = createDefaultSdPoemWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === SD_POMODORO_WIDGET_TYPE) {
    const widget = createDefaultSdPomodoroWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === SD_ANNIVERSARY_WIDGET_TYPE) {
    const widget = createDefaultSdAnniversaryWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === SD_WALLPAPER_WIDGET_TYPE) {
    const entry = resolveSdWidgetEntry(SD_WALLPAPER_WIDGET_TYPE);
    const widget = createDefaultSdWallpaperWidget();
    return withSdGridData({
      ...widget,
      id: createId(item.id),
      enable: true,
      colSpan: item.colSpan,
      rowSpan: item.rowSpan,
      w: item.colSpan,
      h: item.rowSpan,
      data: {
        ...(widget.data || {}),
        ...(entry ? buildSdPersistedData(entry) : {}),
      },
    });
  }
  if (item.type === SD_MOVIE_CALENDAR_WIDGET_TYPE) {
    const widget = createDefaultSdMovieCalendarWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === SD_IP_WIDGET_TYPE) {
    const widget = createDefaultSdIpWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === SD_CALENDAR_WIDGET_TYPE) {
    const widget = createDefaultSdCalendarWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === SD_NUMBER_UPPERCASE_WIDGET_TYPE) {
    const widget = createDefaultSdNumberUppercaseWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === SD_FOOD_PICKER_WIDGET_TYPE) {
    const widget = createDefaultSdFoodPickerWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === AI_USAGE_WIDGET_TYPE) {
    const widget = createDefaultAiUsageWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === TAPD_DEFECTS_WIDGET_TYPE) {
    const widget = createDefaultTapdDefectWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }

  const defaults = defaultWidgetByType();
  const defaultWidget = defaults.get(item.type);
  if (defaultWidget) {
    const widget = cloneWidget(defaultWidget);
    widget.id = createId(item.id || item.type);
    widget.enable = true;
    widget.colSpan = item.colSpan;
    widget.rowSpan = item.rowSpan;
    widget.w = item.colSpan;
    widget.h = item.rowSpan;
    return withSdGridData(widget);
  }

  const base: WidgetConfig = {
    id: createId(item.id || item.type),
    type: item.type,
    enable: true,
    colSpan: item.colSpan,
    rowSpan: item.rowSpan,
  };

  switch (item.type) {
    case "custom-css":
      return withSdGridData({
        ...base,
        data: normalizeCustomCssWidgetData({}),
      });
    case "docker":
      return withSdGridData(base);
    case "system-status":
      return withSdGridData(base);
    default:
      return withSdGridData(base);
  }
};
