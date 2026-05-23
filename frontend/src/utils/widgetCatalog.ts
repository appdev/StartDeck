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
import { createDefaultItabWeatherWidget } from "@/features/itab-weather/itabWeatherModel";
import { createDefaultItabTodoWidget } from "@/features/itab-todo/itabTodoModel";
import { createDefaultItabMemoWidget } from "@/features/itab-memo/itabMemoModel";
import { createDefaultItabClockWidget } from "@/features/itab-clock/itabClockModel";
import { createDefaultItabDailyEnglishWidget } from "@/features/itab-daily-english/itabDailyEnglishModel";
import { createDefaultItabPoemWidget } from "@/features/itab-poem/itabPoemModel";
import { createDefaultItabPomodoroWidget } from "@/features/itab-pomodoro/itabPomodoroModel";
import { createDefaultItabAnniversaryWidget } from "@/features/itab-anniversary/itabAnniversaryModel";
import { withItabGridData } from "@/features/itab-widgets/itabGrid";
import {
  resolveRuntimeWidgetSizeFamily,
  type RuntimeWidgetSizeFamily,
  type RuntimeWidgetSizeKey,
  type RuntimeWidgetSizePreset,
} from "@/features/widget-runtime/widgetRuntimeSizes";

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
    id: "search",
    type: "search",
    title: "搜索",
    description: "搜索入口、最近命令与结果预览",
    category: "common",
    mode: "singleton",
    glyph: "搜",
  }),
  catalogItem({
    id: "div-card",
    type: "div-card",
    title: "导航卡片",
    description: "创建一个可配置链接卡片",
    category: "common",
    mode: "multi",
    glyph: "卡",
  }),
  catalogItem({
    id: "bookmarks",
    type: "bookmarks",
    title: "书签",
    description: "常用链接、分组和完整网格",
    category: "content",
    mode: "singleton",
    glyph: "签",
  }),
  catalogItem({
    id: "iframe",
    type: "iframe",
    title: "万能窗口",
    description: "嵌入一个网页或服务面板",
    category: "content",
    mode: "multi",
    glyph: "窗",
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
    id: "countdown",
    type: "countdown",
    title: "倒计时",
    description: "追踪一个未来时间点",
    category: "content",
    mode: "multi",
    glyph: "倒",
  }),
  catalogItem({
    id: "countup",
    type: "countup",
    title: "正计时",
    description: "记录已经过去的时间",
    category: "content",
    mode: "multi",
    glyph: "正",
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
    id: "calculator",
    type: "calculator",
    title: "计算器",
    description: "桌面快速计算",
    category: "tool",
    mode: "singleton",
    glyph: "算",
  }),
  catalogItem({
    id: "file-transfer",
    type: "file-transfer",
    title: "文件传输",
    description: "收发文件与文本",
    category: "tool",
    mode: "singleton",
    glyph: "传",
  }),
  catalogItem({
    id: "hot",
    type: "hot",
    title: "热榜",
    description: "查看热门资讯榜单",
    category: "content",
    mode: "singleton",
    glyph: "榜",
  }),
  catalogItem({
    id: "rss",
    type: "rss",
    title: "RSS",
    description: "订阅源、摘要和完整阅读流",
    category: "content",
    mode: "singleton",
    glyph: "R",
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
  catalogItem({
    id: "ip",
    type: "ip",
    title: "IP 信息",
    description: "内外网地址、延迟和诊断",
    category: "system",
    mode: "singleton",
    glyph: "IP",
  }),
  catalogItem({
    id: "status-monitor",
    type: "status-monitor",
    title: "状态监控",
    description: "服务健康、异常和诊断列表",
    category: "system",
    mode: "singleton",
    glyph: "监",
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
]);

export const getWidgetCatalogItem = (id: string) => {
  const resolvedId = WIDGET_CATALOG_ALIASES.get(id) || id;
  return WIDGET_CATALOG.find((item) => item.id === resolvedId);
};

export const findExistingCatalogWidget = (
  widgets: WidgetConfig[],
  item: WidgetCatalogItem,
): WidgetConfig | undefined => {
  if (item.mode === "singleton") {
    if (item.type === ITAB_WEATHER_WIDGET_TYPE) {
      return widgets.find(
        (widget) =>
          widget.type === ITAB_WEATHER_WIDGET_TYPE ||
          (widget.id === item.id && widget.type === ITAB_WEATHER_WIDGET_TYPE),
      );
    }
    if (item.type === ITAB_TODO_WIDGET_TYPE) {
      return widgets.find(
        (widget) =>
          widget.type === ITAB_TODO_WIDGET_TYPE ||
          (widget.id === item.id && widget.type === ITAB_TODO_WIDGET_TYPE),
      );
    }
    if (item.type === ITAB_MEMO_WIDGET_TYPE) {
      return widgets.find(
        (widget) =>
          widget.type === ITAB_MEMO_WIDGET_TYPE ||
          (widget.id === item.id && widget.type === ITAB_MEMO_WIDGET_TYPE),
      );
    }
    if (item.type === ITAB_CLOCK_WIDGET_TYPE) {
      return widgets.find(
        (widget) =>
          widget.type === ITAB_CLOCK_WIDGET_TYPE ||
          (widget.id === item.id && widget.type === ITAB_CLOCK_WIDGET_TYPE),
      );
    }
    if (item.type === ITAB_DAILY_ENGLISH_WIDGET_TYPE) {
      return widgets.find(
        (widget) =>
          widget.type === ITAB_DAILY_ENGLISH_WIDGET_TYPE ||
          (widget.id === item.id &&
            widget.type === ITAB_DAILY_ENGLISH_WIDGET_TYPE),
      );
    }
    if (item.type === ITAB_POEM_WIDGET_TYPE) {
      return widgets.find(
        (widget) =>
          widget.type === ITAB_POEM_WIDGET_TYPE ||
          (widget.id === item.id && widget.type === ITAB_POEM_WIDGET_TYPE),
      );
    }
    if (item.type === ITAB_POMODORO_WIDGET_TYPE) {
      return widgets.find(
        (widget) =>
          widget.type === ITAB_POMODORO_WIDGET_TYPE ||
          (widget.id === item.id && widget.type === ITAB_POMODORO_WIDGET_TYPE),
      );
    }
    if (item.type === ITAB_ANNIVERSARY_WIDGET_TYPE) {
      return widgets.find(
        (widget) =>
          widget.type === ITAB_ANNIVERSARY_WIDGET_TYPE ||
          (widget.id === item.id &&
            widget.type === ITAB_ANNIVERSARY_WIDGET_TYPE),
      );
    }
    return widgets.find(
      (widget) => widget.type === item.type || widget.id === item.id,
    );
  }
  return undefined;
};

export const getWidgetCatalogAction = (
  widgets: WidgetConfig[],
  item: WidgetCatalogItem,
): WidgetCatalogAction => {
  const existing = findExistingCatalogWidget(widgets, item);
  if (!existing) return item.mode === "singleton" ? "enable" : "add";
  return existing.enable === false ? "enable" : "enabled";
};

export const createWidgetFromCatalog = (
  item: WidgetCatalogItem,
): WidgetConfig => {
  if (item.type === ITAB_WEATHER_WIDGET_TYPE) {
    const widget = createDefaultItabWeatherWidget();
    widget.enable = true;
    return widget;
  }
  if (item.type === ITAB_TODO_WIDGET_TYPE) {
    const widget = createDefaultItabTodoWidget();
    widget.enable = true;
    return widget;
  }
  if (item.type === ITAB_MEMO_WIDGET_TYPE) {
    const widget = createDefaultItabMemoWidget();
    widget.enable = true;
    return widget;
  }
  if (item.type === ITAB_CLOCK_WIDGET_TYPE) {
    const widget = createDefaultItabClockWidget();
    widget.enable = true;
    return widget;
  }
  if (item.type === ITAB_DAILY_ENGLISH_WIDGET_TYPE) {
    const widget = createDefaultItabDailyEnglishWidget();
    widget.enable = true;
    return widget;
  }
  if (item.type === ITAB_POEM_WIDGET_TYPE) {
    const widget = createDefaultItabPoemWidget();
    widget.enable = true;
    return widget;
  }
  if (item.type === ITAB_POMODORO_WIDGET_TYPE) {
    const widget = createDefaultItabPomodoroWidget();
    widget.enable = true;
    return widget;
  }
  if (item.type === ITAB_ANNIVERSARY_WIDGET_TYPE) {
    const widget = createDefaultItabAnniversaryWidget();
    widget.id = createId(ITAB_ANNIVERSARY_CATALOG_ID);
    widget.enable = true;
    return widget;
  }

  const defaults = defaultWidgetByType();
  const defaultWidget = defaults.get(item.type);
  if (defaultWidget) {
    const widget = cloneWidget(defaultWidget);
    widget.enable = true;
    widget.isPublic = widget.isPublic ?? true;
    widget.colSpan = item.colSpan;
    widget.rowSpan = item.rowSpan;
    widget.w = item.colSpan;
    widget.h = item.rowSpan;
    return withItabGridData(widget);
  }

  const base: WidgetConfig = {
    id: item.mode === "singleton" ? item.id : createId(item.type),
    type: item.type,
    enable: true,
    isPublic: true,
    colSpan: item.colSpan,
    rowSpan: item.rowSpan,
  };

  switch (item.type) {
    case "div-card":
      return withItabGridData({
        ...base,
        w: item.colSpan,
        h: item.rowSpan,
        data: {
          title: "div 卡片",
          iconSize: 180,
        },
      });
    case "iframe":
      return withItabGridData({
        ...base,
        data: { url: "" },
      });
    case "custom-css":
      return withItabGridData({
        ...base,
        data: {
          title: "自定义组件",
          html: '<div class="my-custom-component">\n  <h3>自定义组件</h3>\n  <p>点击右上角编辑按钮修改内容</p>\n</div>',
          css: ".my-custom-component {\n  padding: 10px;\n  background: linear-gradient(to right, #e0eafc, #cfdef3);\n  border-radius: 8px;\n  text-align: center;\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  justify-content: center;\n}\n.my-custom-component h3 {\n  margin: 0 0 5px 0;\n  color: #333;\n}",
        },
      });
    case "countdown":
      return withItabGridData({
        ...base,
        data: {
          targetDate: "",
          title: "重要时刻",
          style: "card",
        },
      });
    case "countup":
      return withItabGridData({
        ...base,
        data: {
          startTime: new Date().toISOString().slice(0, 16),
          title: "正计时",
          style: "card",
          isRunning: false,
          totalPauseDuration: 0,
          pauseStartTime: null,
        },
      });
    case "docker":
      return withItabGridData({
        ...base,
        id: "docker",
        data: { useMock: false },
      });
    case "system-status":
      return withItabGridData({
        ...base,
        id: "system-status",
        data: { useMock: false },
      });
    default:
      return withItabGridData(base);
  }
};
