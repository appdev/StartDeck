import type { WidgetConfig } from "@/types";
import {
  resolveWidgetSizeFamily,
  type WidgetSizeFamily,
  type CatalogWidgetSizePreset,
} from "@/utils/widgetSizePresets";
import { createDefaultWidgetList } from "@/utils/widgetUtils";
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
  ITAB_WALLPAPER_CATALOG_ID,
  ITAB_WALLPAPER_WIDGET_TYPE,
} from "@/features/itab-wallpaper/itabWallpaperTypes";
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
import {
  ITAB_NUMBER_UPPERCASE_CATALOG_ID,
  ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
} from "@/features/itab-number-uppercase/itabNumberUppercaseTypes";
import {
  ITAB_FOOD_PICKER_CATALOG_ID,
  ITAB_FOOD_PICKER_WIDGET_TYPE,
} from "@/features/itab-food-picker/itabFoodPickerTypes";
import { createDefaultItabWeatherWidget } from "@/features/itab-weather/itabWeatherModel";
import { createDefaultItabTodoWidget } from "@/features/itab-todo/itabTodoModel";
import { createDefaultItabMemoWidget } from "@/features/itab-memo/itabMemoModel";
import { createDefaultItabClockWidget } from "@/features/itab-clock/itabClockModel";
import { createDefaultItabDailyEnglishWidget } from "@/features/itab-daily-english/itabDailyEnglishModel";
import { createDefaultItabPoemWidget } from "@/features/itab-poem/itabPoemModel";
import { createDefaultItabPomodoroWidget } from "@/features/itab-pomodoro/itabPomodoroModel";
import { createDefaultItabAnniversaryWidget } from "@/features/itab-anniversary/itabAnniversaryModel";
import { createDefaultItabWallpaperWidget } from "@/features/itab-wallpaper/itabWallpaperModel";
import { createDefaultItabMovieCalendarWidget } from "@/features/itab-movie-calendar/itabMovieCalendarModel";
import { createDefaultItabIpWidget } from "@/features/itab-ip/itabIpModel";
import { createDefaultItabCalendarWidget } from "@/features/itab-calendar/itabCalendarModel";
import { createDefaultItabNumberUppercaseWidget } from "@/features/itab-number-uppercase/itabNumberUppercaseModel";
import { createDefaultItabFoodPickerWidget } from "@/features/itab-food-picker/itabFoodPickerModel";
import { buildItabPersistedData } from "@/features/itab-widgets/itabAdapters";
import { withItabGridData } from "@/features/itab-widgets/itabGrid";
import { resolveItabWidgetEntry } from "@/features/itab-widgets/itabWidgetRegistry";
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
export type WidgetCatalogSizeScope = "itab";
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
    sizeScope: sizeFamily.scope || "itab",
    sizeFamily,
    supportedSizes: sizeFamily.supported,
  };
};

export const WIDGET_CATALOG: WidgetCatalogItem[] = [
  catalogItem({
    id: ITAB_CLOCK_CATALOG_ID,
    type: ITAB_CLOCK_WIDGET_TYPE,
    title: "时钟",
    description: "iTab 翻页时钟、日期和打开态大屏",
    category: "common",
    mode: "singleton",
    glyph: "时",
  }),
  catalogItem({
    id: "weather",
    type: ITAB_WEATHER_WIDGET_TYPE,
    title: "天气",
    description: "温度、空气质量与预报",
    category: "common",
    mode: "singleton",
    glyph: "晴",
  }),
  catalogItem({
    id: ITAB_ANNIVERSARY_CATALOG_ID,
    type: ITAB_ANNIVERSARY_WIDGET_TYPE,
    title: "纪念日",
    description: "纪念日、倒数日和事件日期模板",
    category: "common",
    mode: "multi",
    glyph: "纪",
  }),
  catalogItem({
    id: ITAB_CALENDAR_CATALOG_ID,
    type: ITAB_CALENDAR_WIDGET_TYPE,
    title: "日历",
    description: "公历、农历、节气和节假日",
    category: "common",
    mode: "singleton",
    glyph: "历",
  }),
  catalogItem({
    id: ITAB_WALLPAPER_CATALOG_ID,
    type: ITAB_WALLPAPER_WIDGET_TYPE,
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
    id: ITAB_MEMO_CATALOG_ID,
    type: ITAB_MEMO_WIDGET_TYPE,
    title: "备忘录",
    description: "记录、搜索和固定便签",
    category: "common",
    mode: "singleton",
    glyph: "备",
  }),
  catalogItem({
    id: ITAB_TODO_CATALOG_ID,
    type: ITAB_TODO_WIDGET_TYPE,
    title: "待办",
    description: "管理简单任务列表",
    category: "common",
    mode: "singleton",
    glyph: "办",
  }),
  catalogItem({
    id: ITAB_POMODORO_CATALOG_ID,
    type: ITAB_POMODORO_WIDGET_TYPE,
    title: "番茄时钟",
    description: "专注计时、背景音和会话进度",
    category: "common",
    mode: "singleton",
    glyph: "番",
  }),
  catalogItem({
    id: ITAB_POEM_CATALOG_ID,
    type: ITAB_POEM_WIDGET_TYPE,
    title: "今日诗词",
    description: "每日诗词名句、出处和全文释义",
    category: "content",
    mode: "singleton",
    glyph: "诗",
  }),
  catalogItem({
    id: ITAB_DAILY_ENGLISH_CATALOG_ID,
    type: ITAB_DAILY_ENGLISH_WIDGET_TYPE,
    title: "今日英语",
    description: "每日英语句子、翻译和跟读音频",
    category: "content",
    mode: "singleton",
    glyph: "英",
  }),
  catalogItem({
    id: ITAB_MOVIE_CALENDAR_CATALOG_ID,
    type: ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
    title: "电影日历",
    description: "每日电影推荐、评分和影评短句",
    category: "content",
    mode: "singleton",
    glyph: "影",
  }),
  catalogItem({
    id: ITAB_IP_CATALOG_ID,
    type: ITAB_IP_WIDGET_TYPE,
    title: "本机IP",
    description: "显示当前 IP 地址、归属地和网络信息",
    category: "tool",
    mode: "singleton",
    glyph: "IP",
  }),
  catalogItem({
    id: ITAB_NUMBER_UPPERCASE_CATALOG_ID,
    type: ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
    title: "金额换算",
    description: "将金额转为大写",
    category: "tool",
    mode: "multi",
    glyph: "¥",
  }),
  catalogItem({
    id: ITAB_FOOD_PICKER_CATALOG_ID,
    type: ITAB_FOOD_PICKER_WIDGET_TYPE,
    title: "今天吃什么",
    description: "随机抽取用餐候选并维护本地菜单",
    category: "tool",
    mode: "multi",
    glyph: "吃",
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
  [ITAB_CLOCK_WIDGET_TYPE, ITAB_CLOCK_CATALOG_ID],
  ["itab-weather-00", ITAB_WEATHER_CATALOG_ID],
  [ITAB_TODO_WIDGET_TYPE, ITAB_TODO_CATALOG_ID],
  [ITAB_MEMO_WIDGET_TYPE, ITAB_MEMO_CATALOG_ID],
  [ITAB_DAILY_ENGLISH_WIDGET_TYPE, ITAB_DAILY_ENGLISH_CATALOG_ID],
  [ITAB_POEM_WIDGET_TYPE, ITAB_POEM_CATALOG_ID],
  [ITAB_POMODORO_WIDGET_TYPE, ITAB_POMODORO_CATALOG_ID],
  [ITAB_ANNIVERSARY_WIDGET_TYPE, ITAB_ANNIVERSARY_CATALOG_ID],
  [ITAB_WALLPAPER_WIDGET_TYPE, ITAB_WALLPAPER_CATALOG_ID],
  [ITAB_MOVIE_CALENDAR_WIDGET_TYPE, ITAB_MOVIE_CALENDAR_CATALOG_ID],
  [ITAB_IP_WIDGET_TYPE, ITAB_IP_CATALOG_ID],
  [ITAB_CALENDAR_WIDGET_TYPE, ITAB_CALENDAR_CATALOG_ID],
  [ITAB_NUMBER_UPPERCASE_WIDGET_TYPE, ITAB_NUMBER_UPPERCASE_CATALOG_ID],
  [ITAB_FOOD_PICKER_WIDGET_TYPE, ITAB_FOOD_PICKER_CATALOG_ID],
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
  if (item.type === ITAB_WEATHER_WIDGET_TYPE) {
    const widget = createDefaultItabWeatherWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === ITAB_TODO_WIDGET_TYPE) {
    const widget = createDefaultItabTodoWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === ITAB_MEMO_WIDGET_TYPE) {
    const widget = createDefaultItabMemoWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === ITAB_CLOCK_WIDGET_TYPE) {
    const widget = createDefaultItabClockWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === ITAB_DAILY_ENGLISH_WIDGET_TYPE) {
    const widget = createDefaultItabDailyEnglishWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === ITAB_POEM_WIDGET_TYPE) {
    const widget = createDefaultItabPoemWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === ITAB_POMODORO_WIDGET_TYPE) {
    const widget = createDefaultItabPomodoroWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === ITAB_ANNIVERSARY_WIDGET_TYPE) {
    const widget = createDefaultItabAnniversaryWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === ITAB_WALLPAPER_WIDGET_TYPE) {
    const entry = resolveItabWidgetEntry(ITAB_WALLPAPER_WIDGET_TYPE);
    const widget = createDefaultItabWallpaperWidget();
    return withItabGridData({
      ...widget,
      id: createId(item.id),
      enable: true,
      colSpan: item.colSpan,
      rowSpan: item.rowSpan,
      w: item.colSpan,
      h: item.rowSpan,
      data: {
        ...(widget.data || {}),
        ...(entry ? buildItabPersistedData(entry) : {}),
      },
    });
  }
  if (item.type === ITAB_MOVIE_CALENDAR_WIDGET_TYPE) {
    const widget = createDefaultItabMovieCalendarWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === ITAB_IP_WIDGET_TYPE) {
    const widget = createDefaultItabIpWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === ITAB_CALENDAR_WIDGET_TYPE) {
    const widget = createDefaultItabCalendarWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === ITAB_NUMBER_UPPERCASE_WIDGET_TYPE) {
    const widget = createDefaultItabNumberUppercaseWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }
  if (item.type === ITAB_FOOD_PICKER_WIDGET_TYPE) {
    const widget = createDefaultItabFoodPickerWidget();
    widget.enable = true;
    return assignCatalogInstanceId(widget, item);
  }

  const defaults = defaultWidgetByType();
  const defaultWidget = defaults.get(item.type);
  if (defaultWidget) {
    const widget = cloneWidget(defaultWidget);
    widget.id = createId(item.id || item.type);
    widget.enable = true;
    widget.isPublic = widget.isPublic ?? true;
    widget.colSpan = item.colSpan;
    widget.rowSpan = item.rowSpan;
    widget.w = item.colSpan;
    widget.h = item.rowSpan;
    return withItabGridData(widget);
  }

  const base: WidgetConfig = {
    id: createId(item.id || item.type),
    type: item.type,
    enable: true,
    isPublic: true,
    colSpan: item.colSpan,
    rowSpan: item.rowSpan,
  };

  switch (item.type) {
    case "custom-css":
      return withItabGridData({
        ...base,
        data: normalizeCustomCssWidgetData({
          title: "自定义组件",
          html: '<div class="my-custom-component">\n  <h3>自定义组件</h3>\n  <p>点击打开后编辑内容</p>\n</div>',
          css: ".my-custom-component {\n  padding: 10px;\n  background: linear-gradient(to right, #e0eafc, #cfdef3);\n  border-radius: 8px;\n  text-align: center;\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  justify-content: center;\n}\n.my-custom-component h3 {\n  margin: 0 0 5px 0;\n  color: #333;\n}",
        }),
      });
    case "docker":
      return withItabGridData(base);
    case "system-status":
      return withItabGridData(base);
    default:
      return withItabGridData(base);
  }
};
