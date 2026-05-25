<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import {
  Copy as CopyIcon,
  Heart as HeartIcon,
  Scan as ScanIcon,
} from "@lucide/vue";
import { HolidayUtil, Lunar, Solar } from "lunar-javascript";
import {
  createItabReplicaSizeMenuOptions,
  isItabReplicaWidgetSizeSupported,
  ITAB_REPLICA_WIDGET_SIZE_OPTIONS,
  shouldRenderItabReplicaIconOnly,
  type ItabReplicaOpenedShellOverride,
  type ItabReplicaWidgetKind,
  type ItabReplicaWidgetSize,
} from "../itab-widgets/itabWidgetContract";
import type { ItabWidgetSizeKey } from "../itab-widgets/itabSizePresets";
import { toApiUrl } from "@/utils/runtimeUrls";
import type { WidgetConfig } from "@/types";
import ItabWeatherOpenedPanel from "@/features/itab-weather/ItabWeatherOpenedPanel.vue";
import ItabWeatherWidget from "@/features/itab-weather/ItabWeatherWidget.vue";
import {
  applyItabWeatherSizeToWidget,
  createDefaultItabWeatherWidget,
  normalizeItabWeatherWidgetData,
} from "@/features/itab-weather/itabWeatherModel";
import type { ItabWeatherWidgetData } from "@/features/itab-weather/itabWeatherTypes";
import ItabMemoFixedLayer from "@/features/itab-memo/ItabMemoFixedLayer.vue";
import ItabMemoOpenedPanel from "@/features/itab-memo/ItabMemoOpenedPanel.vue";
import ItabMemoWidget from "@/features/itab-memo/ItabMemoWidget.vue";
import {
  applyItabMemoSizeToWidget,
  createDefaultItabMemoWidget,
  normalizeItabMemoWidgetData,
} from "@/features/itab-memo/itabMemoModel";
import type { ItabMemoWidgetData } from "@/features/itab-memo/itabMemoTypes";
import ItabPoemOpenedPanel from "@/features/itab-poem/ItabPoemOpenedPanel.vue";
import ItabPoemWidget from "@/features/itab-poem/ItabPoemWidget.vue";
import {
  applyItabPoemSizeToWidget,
  createDefaultItabPoemWidget,
  normalizeItabPoemWidgetData,
} from "@/features/itab-poem/itabPoemModel";
import type { ItabPoemWidgetData } from "@/features/itab-poem/itabPoemTypes";
import { ITAB_POEM_FALLBACK_ENTRIES } from "@/features/itab-poem/useItabPoemRuntime";
import { useItabWallpaperRuntime } from "@/features/itab-wallpaper/useItabWallpaperRuntime";
import type { ItabWallpaperEntry } from "@/features/itab-wallpaper/itabWallpaperTypes";
import ItabFlipCard from "./ItabFlipCard.vue";
import ItabLiveOpenedShell from "./ItabLiveOpenedShell.vue";
import ItabLiveWidgetFrame from "./ItabLiveWidgetFrame.vue";
import { blurActiveElementMatching } from "@/utils/focus";

type WidgetSize = ItabReplicaWidgetSize;
type WidgetKind = ItabReplicaWidgetKind;

type WidgetItem = {
  id: string;
  kind: WidgetKind;
  title: string;
  size: WidgetSize;
  col: number;
  row: number;
  anniversaryTemplateId?: string;
  icon?: string;
  bg?: string;
  note?: string;
  url?: string;
  openedShell?: ItabReplicaOpenedShellOverride;
};

type TomatoPhase = "idle" | "focus" | "completed";

type Point = {
  x: number;
  y: number;
};

type CalendarCell = {
  dateKey: string;
  day: string;
  lunar: string;
  muted?: boolean;
  weekend?: boolean;
  holiday?: boolean;
  workday?: boolean;
  tag?: string;
  label?: string;
  currentMonth?: boolean;
};

type CalendarDetail = {
  dateLabel: string;
  day: string;
  lunarDate: string;
  yearLabel: string;
  weekText: string;
  distance?: string;
  zodiac: string;
  constellation: string;
  festival: string;
  yi: string;
  ji: string;
  moon: string;
  phenology: string;
  directions: string[];
};

type TodoTask = {
  id: string;
  title: string;
  done: boolean;
};

type AnniversaryMode = "elapsed" | "remaining";
type AnniversaryBackgroundMode = "image" | "color";

type AnniversaryTemplate = {
  id: string;
  title: string;
  label: string;
  eventName: string;
  date: string;
  mode: AnniversaryMode;
  repeat: string;
  size: WidgetSize;
  textColor: string;
  backgroundColor: string;
  backgroundImage?: string;
  backgroundMode: AnniversaryBackgroundMode;
  mask: string;
};

type DailyEnglishEntry = {
  mode: "跟读";
  sentence: string;
  translation: string;
  progressLabel: string;
  imageUrl: string;
  audioUrl: string;
  dateline: string;
};

type DailyQuoteEntry = {
  id: string;
  date: string;
  dateLabel: string;
  timeLabel: string;
  quote: string;
  author: string;
  source: string;
  like: number;
  share: number;
  picUrl: string;
  thumbUrl: string;
  sourceStatus: "loading" | "direct" | "fallback" | "error";
};

type DailyQuoteAction = "share" | "fullscreen" | "like";

type MovieCalendarEntry = {
  date: string;
  day: string;
  monthLabel: string;
  weekday: string;
  movieTitle: string;
  rating: string;
  quote: string;
  posterUrl: string;
  coverUrl: string;
  sourceUrl: string;
  year: string;
  area: string;
  director: string;
  intro: string;
  genres: string[];
  bgColor: string;
  textColor: string;
  sourceStatus: string;
};

type IpLookupStatus = "idle" | "loading" | "success" | "error";
type IpLookupResult = {
  ip: string;
  location: string;
  country: string;
  region: string;
  city: string;
  isp: string;
  queryIp: string;
  clientIp: string;
  clientIpSource: string;
  latitude: string;
  longitude: string;
  updatedAt: string;
};

type OffworkCountdownMetric = {
  key: string;
  label: string;
  value: string;
  suffix: string;
};

type ConverterTool = {
  label: string;
  iconPath: string;
  accent: string;
};

type ConverterToolMode =
  | "unit"
  | "temperature"
  | "base"
  | "mortgage"
  | "tax"
  | "bmi"
  | "date"
  | "relationship"
  | "uppercase";

type ConverterUnitOption = {
  label: string;
  value: string;
  factor?: number;
};

type ConverterSourceUnitCard = {
  value: string;
  name: string;
  active?: boolean;
};

type ConverterSourceUnitPanel = {
  inputUnit: string;
  baseInput: string;
  cards: readonly ConverterSourceUnitCard[];
};

type ConverterToolConfig = {
  label: string;
  mode: ConverterToolMode;
  inputLabel: string;
  inputType?: "number" | "text" | "date";
  secondaryLabel?: string;
  secondaryInputType?: "number" | "text" | "date";
  fromLabel?: string;
  toLabel?: string;
  options?: readonly ConverterUnitOption[];
  defaultInput: string;
  defaultSecondary?: string;
  defaultFrom: string;
  defaultTo: string;
};

type ConverterToolState = {
  input: string;
  secondary: string;
  fromUnit: string;
  toUnit: string;
};

type ConverterCalculatorKey = {
  label: string;
  kind: "number" | "operator" | "action" | "equals";
  ariaLabel?: string;
  svgPath?: string;
};

const anniversaryBackgroundImages = Array.from({ length: 25 }, (_, index) => {
  const imageIndex = index + 1;
  return {
    id: `${imageIndex}`,
    full: `/itab-live-assets/anniversary/yiyan-${imageIndex}.webp`,
    thumb: `/itab-live-assets/anniversary/yiyan-${imageIndex}-thumb.webp`,
  };
});

const defaultAnniversaryBackgroundImage = anniversaryBackgroundImages[11]!.full;
const countdownOffworkImageUrl =
  "https://files.codelife.cc/itab/widget/countdown/offwork.png?x-oss-process=image/resize,limit_0,m_fill,w_300,h_300/quality,q_92/format,webp";
const countdownOnworkImageUrl =
  "https://files.codelife.cc/itab/widget/countdown/onwork.png?x-oss-process=image/resize,limit_0,m_fill,w_300,h_300/quality,q_92/format,webp";

const sourceAssets = {
  search: "/itab-live-assets/search-baidu.svg",
  weatherIcon: "/itab/weather/icon/104-fill.svg",
  anniversary: defaultAnniversaryBackgroundImage,
  movie:
    "https://files.codelife.cc/itab/movieCalendar/c-202303231856436.webp?x-oss-process=image/resize,limit_0,m_fill,w_400/quality,q_90/format,webp",
  countdown: countdownOffworkImageUrl,
  countdownOnwork: countdownOnworkImageUrl,
  english:
    "https://staticedu-wps-cache.iciba.com/image/fa0ba1a3b8cc0bc45195b87a9e7dc82f.png",
  muyu: "/itab-live-assets/muyu.webp",
  speedtest: "/itab-live-assets/speedtest.svg",
  game2048: "/itab-live-assets/2048.svg",
  qwerty: "/itab-live-assets/qwerty-learner.svg",
  gradient: "/itab-live-assets/web-gradients.svg",
  timestamp: "/itab-live-assets/timestamp.svg",
  ip: "/itab-live-assets/ip.svg",
  avatar: "/itab-live-assets/multiavatar.svg",
  relative: "/itab-live-assets/relationship.svg",
  uppercase: "/itab-live-assets/uppercase.svg",
  todo: "/itab/todo/todo.svg",
  usd: "/itab-live-assets/usd.png",
  hkd: "/itab-live-assets/hkd.png",
  eur: "/itab-live-assets/eur.png",
};

const converterIconImage = "https://go.itab.link/assets/x-icon-qPAB74ev.png";

const converterTools = [
  {
    label: "计算器",
    accent: "#59d6bd",
    iconPath:
      "M5 3.5h14A2.5 2.5 0 0 1 21.5 6v12A2.5 2.5 0 0 1 19 20.5H5A2.5 2.5 0 0 1 2.5 18V6A2.5 2.5 0 0 1 5 3.5Zm1.5 3v3h11v-3h-11Zm0 6.5h2.2m3.3 0h2.2m3.3 0h.5m-11.5 4h2.2m3.3 0h2.2m3.3 0h.5",
  },
  {
    label: "住房贷款",
    accent: "#6cb8ff",
    iconPath: "M3.5 10.5 12 3l8.5 7.5M5.5 9.5V20h13V9.5M9 20v-6h6v6",
  },
  {
    label: "个人所得税",
    accent: "#ffb15f",
    iconPath:
      "M6 4.5h12v16H6zM8.5 8h7M8.5 11.5h7M8.5 15h3.5M15.5 15l2.5 2.5M18 15l-2.5 2.5",
  },
  {
    label: "长度单位",
    accent: "#8fd16a",
    iconPath:
      "M3.5 16.5 16.5 3.5l4 4-13 13-4-4Zm4-1 1.5 1.5m1.5-4.5 1.5 1.5m1.5-4.5 1.5 1.5",
  },
  {
    label: "亲戚称呼",
    accent: "#ff8e9e",
    iconPath:
      "M8.5 9a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 8.5 9Zm7 1.5a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4ZM3.5 20c.5-4 2.3-6.2 5-6.2s4.5 2.2 5 6.2m-.6-1.6c.7-2.5 1.9-3.8 3.7-3.8 1.9 0 3.1 1.4 3.7 4",
  },
  {
    label: "货币汇率",
    accent: "#ffd35a",
    iconPath:
      "M7 4h7.5A3.5 3.5 0 0 1 18 7.5 3.5 3.5 0 0 1 14.5 11H7V4Zm0 7h8A3.5 3.5 0 0 1 18.5 14.5 3.5 3.5 0 0 1 15 18H7v-7ZM4 4h4m-4 14h4",
  },
  {
    label: "大写金额",
    accent: "#c9a2ff",
    iconPath: "M5 5h14M12 5v15M7.5 10h9M8 15h8M4 20h16",
  },
  {
    label: "BMI计算",
    accent: "#74d9ff",
    iconPath:
      "M6.5 20.5h11A2.5 2.5 0 0 0 20 18V7a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 7v11a2.5 2.5 0 0 0 2.5 2.5ZM8 10a4 4 0 0 1 8 0m-4 0 3-3",
  },
  {
    label: "日期计算",
    accent: "#ff7fb8",
    iconPath:
      "M5 5.5h14A2.5 2.5 0 0 1 21.5 8v10A2.5 2.5 0 0 1 19 20.5H5A2.5 2.5 0 0 1 2.5 18V8A2.5 2.5 0 0 1 5 5.5Zm0 4h16M8 3.5v4m8-4v4M7 13h2m3 0h2m3 0h2M7 17h2m3 0h2",
  },
  {
    label: "时间转换",
    accent: "#8ac8ff",
    iconPath:
      "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm0 4.5v4.6l3.5 2.1",
  },
  {
    label: "质量单位",
    accent: "#9fe682",
    iconPath: "M7.5 8.5h9l2.2 11H5.3l2.2-11ZM9 8.5a3 3 0 0 1 6 0",
  },
  {
    label: "角度转换",
    accent: "#ffad73",
    iconPath: "M4 19h16M6 17a8 8 0 0 1 8-8v8H6Zm8-8 4-4",
  },
  {
    label: "进制转换",
    accent: "#9ea9ff",
    iconPath: "M4 7h7M4 12h12M4 17h7M14 5l4 4-4 4M10 19l-4-4 4-4",
  },
  {
    label: "面积转换",
    accent: "#68dec5",
    iconPath: "M4.5 4.5h15v15h-15zM8 8h8v8H8z",
  },
  {
    label: "体积转换",
    accent: "#7ab2ff",
    iconPath: "M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Zm0 0V12m8-4-8 4-8-4m8 4v8.5",
  },
  {
    label: "温度转换",
    accent: "#ff876f",
    iconPath: "M10 4a2 2 0 0 1 4 0v8.1a4.5 4.5 0 1 1-4 0V4Zm2 10v-5",
  },
  {
    label: "速度转换",
    accent: "#6ad7ff",
    iconPath: "M4 16a8 8 0 1 1 16 0M8 16h8m-4 0 4-6",
  },
  {
    label: "热能转换",
    accent: "#ffb55c",
    iconPath:
      "M12 20.5c3 0 5.4-2 5.4-5 0-2.5-1.4-4-3.2-5.5.2 2-1.1 2.8-2.2 3.7.2-3.4-2-5.2-4-7.2.4 4.1-2.6 5.6-2.6 9 0 3 2.4 5 5.4 5Z",
  },
  {
    label: "功率转换",
    accent: "#f2d45c",
    iconPath: "M12 3.5 5 13h5l-1 7.5 7-9.5h-5l1-7.5Z",
  },
  {
    label: "压强转换",
    accent: "#8bd5a0",
    iconPath: "M4 17h16M7 17V8m5 9V4m5 13v-6M5.5 8h3M10.5 4h3M15.5 11h3",
  },
  {
    label: "力转换",
    accent: "#ff8ba0",
    iconPath: "M5 12h13M14 8l4 4-4 4M9 5 5 12l4 7",
  },
] as const satisfies readonly ConverterTool[];

const converterSourceIconClassByLabel = {
  计算器: "x-icon-iconCalculator",
  住房贷款: "x-icon-iconHouse",
  个人所得税: "x-icon-iconTax",
  长度单位: "x-icon-iconLength",
  亲戚称呼: "x-icon-iconRelationship",
  货币汇率: "x-icon-iconExchangerate",
  大写金额: "x-icon-iconUppercase",
  BMI计算: "x-icon-iconBmi",
  日期计算: "x-icon-iconDate",
  时间转换: "x-icon-iconTime",
  质量单位: "x-icon-iconWeight",
  角度转换: "x-icon-iconAngle",
  进制转换: "x-icon-iconHex",
  面积转换: "x-icon-iconArea",
  体积转换: "x-icon-iconVolume",
  温度转换: "x-icon-iconTemperature",
  速度转换: "x-icon-iconSpeed",
  热能转换: "x-icon-iconWork",
  功率转换: "x-icon-iconPower",
  压强转换: "x-icon-iconPressure",
  力转换: "x-icon-iconStrength",
} as const;

const converterCalculatorKeys: readonly ConverterCalculatorKey[] = [
  { label: "()", kind: "action" },
  { label: "%", kind: "action" },
  {
    label: "⌫",
    kind: "action",
    ariaLabel: "退格",
    svgPath:
      "M8 6h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8l-5-6 5-6Zm3 3 6 6m0-6-6 6",
  },
  { label: "+", kind: "operator", ariaLabel: "加" },
  { label: "7", kind: "number" },
  { label: "8", kind: "number" },
  { label: "9", kind: "number" },
  { label: "-", kind: "operator", ariaLabel: "减" },
  { label: "4", kind: "number" },
  { label: "5", kind: "number" },
  { label: "6", kind: "number" },
  { label: "×", kind: "operator", ariaLabel: "乘" },
  { label: "1", kind: "number" },
  { label: "2", kind: "number" },
  { label: "3", kind: "number" },
  { label: "÷", kind: "operator", ariaLabel: "除" },
  { label: "大写", kind: "action" },
  { label: "0", kind: "number" },
  { label: ".", kind: "number" },
  { label: "=", kind: "equals", ariaLabel: "等于" },
];

const converterLengthUnits = [
  { label: "米 m", value: "m", factor: 1 },
  { label: "厘米 cm", value: "cm", factor: 0.01 },
  { label: "毫米 mm", value: "mm", factor: 0.001 },
  { label: "千米 km", value: "km", factor: 1000 },
  { label: "英寸 in", value: "in", factor: 0.0254 },
  { label: "英尺 ft", value: "ft", factor: 0.3048 },
] as const satisfies readonly ConverterUnitOption[];

const converterMassUnits = [
  { label: "千克 kg", value: "kg", factor: 1 },
  { label: "克 g", value: "g", factor: 0.001 },
  { label: "吨 t", value: "t", factor: 1000 },
  { label: "磅 lb", value: "lb", factor: 0.45359237 },
  { label: "盎司 oz", value: "oz", factor: 0.028349523125 },
] as const satisfies readonly ConverterUnitOption[];

const converterAreaUnits = [
  { label: "平方米 m2", value: "m2", factor: 1 },
  { label: "平方厘米 cm2", value: "cm2", factor: 0.0001 },
  { label: "平方千米 km2", value: "km2", factor: 1_000_000 },
  { label: "公顷 ha", value: "ha", factor: 10_000 },
  { label: "亩", value: "mu", factor: 666.6666667 },
] as const satisfies readonly ConverterUnitOption[];

const converterVolumeUnits = [
  { label: "立方米 m3", value: "m3", factor: 1 },
  { label: "升 L", value: "l", factor: 0.001 },
  { label: "毫升 mL", value: "ml", factor: 0.000001 },
  { label: "立方厘米 cm3", value: "cm3", factor: 0.000001 },
] as const satisfies readonly ConverterUnitOption[];

const converterTimeUnits = [
  { label: "秒 s", value: "s", factor: 1 },
  { label: "分钟 min", value: "min", factor: 60 },
  { label: "小时 h", value: "h", factor: 3600 },
  { label: "天 d", value: "d", factor: 86400 },
] as const satisfies readonly ConverterUnitOption[];

const converterAngleUnits = [
  { label: "度 deg", value: "deg", factor: 1 },
  { label: "弧度 rad", value: "rad", factor: 180 / Math.PI },
] as const satisfies readonly ConverterUnitOption[];

const converterSpeedUnits = [
  { label: "米/秒 m/s", value: "mps", factor: 1 },
  { label: "千米/小时 km/h", value: "kph", factor: 1 / 3.6 },
  { label: "英里/小时 mph", value: "mph", factor: 0.44704 },
] as const satisfies readonly ConverterUnitOption[];

const converterEnergyUnits = [
  { label: "焦耳 J", value: "j", factor: 1 },
  { label: "千焦 kJ", value: "kj", factor: 1000 },
  { label: "卡 cal", value: "cal", factor: 4.184 },
  { label: "千卡 kcal", value: "kcal", factor: 4184 },
] as const satisfies readonly ConverterUnitOption[];

const converterPowerUnits = [
  { label: "瓦 W", value: "w", factor: 1 },
  { label: "千瓦 kW", value: "kw", factor: 1000 },
  { label: "马力 hp", value: "hp", factor: 745.699872 },
] as const satisfies readonly ConverterUnitOption[];

const converterPressureUnits = [
  { label: "帕 Pa", value: "pa", factor: 1 },
  { label: "千帕 kPa", value: "kpa", factor: 1000 },
  { label: "兆帕 MPa", value: "mpa", factor: 1_000_000 },
  { label: "标准大气压 atm", value: "atm", factor: 101325 },
] as const satisfies readonly ConverterUnitOption[];

const converterForceUnits = [
  { label: "牛 N", value: "n", factor: 1 },
  { label: "千牛 kN", value: "kn", factor: 1000 },
  { label: "千克力 kgf", value: "kgf", factor: 9.80665 },
] as const satisfies readonly ConverterUnitOption[];

const converterCurrencyUnits = [
  { label: "人民币 CNY", value: "cny", factor: 1 },
  { label: "美元 USD", value: "usd", factor: 7.2 },
  { label: "欧元 EUR", value: "eur", factor: 7.8 },
  { label: "港币 HKD", value: "hkd", factor: 0.92 },
  { label: "日元 JPY", value: "jpy", factor: 0.046 },
] as const satisfies readonly ConverterUnitOption[];

const converterBaseUnits = [
  { label: "二进制", value: "2" },
  { label: "八进制", value: "8" },
  { label: "十进制", value: "10" },
  { label: "十六进制", value: "16" },
] as const satisfies readonly ConverterUnitOption[];

const converterTemperatureUnits = [
  { label: "摄氏度 C", value: "c" },
  { label: "华氏度 F", value: "f" },
  { label: "开尔文 K", value: "k" },
] as const satisfies readonly ConverterUnitOption[];

const sourceUnitCards = (
  cards: readonly (readonly [value: string, name: string, active?: boolean])[],
): readonly ConverterSourceUnitCard[] =>
  cards.map(([value, name, active]) => ({ value, name, active }));

const converterSourceUnitPanels: Record<string, ConverterSourceUnitPanel> = {
  长度单位: {
    inputUnit: "米 m",
    baseInput: "1",
    cards: sourceUnitCards([
      ["0.001", "千米 km"],
      ["1", "米 m", true],
      ["10", "分米 dm"],
      ["100", "厘米 cm"],
      ["1000", "毫米 mm"],
      ["1000000", "微米 um"],
      ["1000000000", "纳米 nm"],
      ["1e+12", "皮米 pm"],
      ["1.0570e-16", "光年 ly"],
      ["6.6846e-12", "天文单位 AU"],
      ["0.001", "公里 km"],
      ["1", "公尺 m"],
      ["100", "公分 cm"],
      ["39.3701", "英寸 in"],
      ["39.3701", "inch in"],
      ["3.2808", "英尺 ft"],
      ["1.0936", "码 yd"],
      ["0.0006214", "英里 mi"],
      ["0.00054", "海里 nmi"],
      ["0.5468066", "英寻 fm"],
      ["0.004971", "弗隆 fg"],
      ["39370.0787", "密耳 mil"],
      ["0.002", "里"],
      ["0.3", "丈"],
      ["3", "尺"],
      ["30", "寸"],
      ["300", "分"],
      ["3000", "厘"],
      ["30000", "毫"],
    ]),
  },
  时间转换: {
    inputUnit: "分 min",
    baseInput: "1",
    cards: sourceUnitCards([
      ["1.9026e-6", "年 yr"],
      ["0.0000228", "月 month"],
      ["0.0000992", "周 week"],
      ["0.0006944", "天 d"],
      ["0.0166667", "时 h"],
      ["1", "分 min", true],
      ["60", "秒 s"],
      ["60000", "毫秒 ms"],
      ["60000000", "微秒 μs"],
      ["6e+10", "纳秒 ns"],
    ]),
  },
  质量单位: {
    inputUnit: "千克 kg",
    baseInput: "1",
    cards: sourceUnitCards([
      ["1", "千克 kg", true],
      ["1000", "克 g"],
      ["1000000", "毫克 mg"],
      ["1000000000", "微克 μg"],
      ["0.001", "吨 t"],
      ["0.01", "公担 q"],
      ["1e+12", "纳克 ng"],
      ["1e+15", "皮克 pg"],
      ["1e+18", "飞克 fg"],
      ["1e+21", "阿克 ag"],
      ["1e+24", "介克 zg"],
      ["1e+24", "仄克 zg"],
      ["1e+27", "攸克 yg"],
      ["1e+27", "幺克 yg"],
      ["1e+30", "洛克 rg"],
      ["1e-33", "夸克 qg"],
      ["1e-27", "奎克 Qg"],
      ["1e-24", "罗克 Rg"],
      ["1e-21", "佑克 Yg"],
      ["1e-21", "尧克 Yg"],
      ["1e-18", "皆克 Zg"],
      ["1e-18", "泽克 Zg"],
      ["1e-15", "艾克 Eg"],
      ["1e-12", "拍克 Pg"],
      ["1e-9", "兆克 Tg"],
      ["1e-9", "太克 Tg"],
      ["1e-6", "吉克 Gg"],
      ["0.001", "公吨 Mg"],
      ["0.001", "百万克 Mg"],
      ["1", "公斤 kg"],
      ["2.2046", "磅 lb"],
      ["35.274", "盎司 oz"],
      ["5000", "克拉 ct"],
      ["15432.3584", "格令 gr"],
      ["0.0009842", "长吨 lt"],
      ["0.0011023", "短吨 st"],
      ["0.0196841", "英担"],
      ["0.0220462", "美担"],
      ["0.157473", "英石 st"],
      ["564.3834", "打兰 dr"],
      ["0.02", "担"],
      ["2", "斤"],
      ["20", "两"],
      ["200", "钱"],
      ["500000", "分"],
    ]),
  },
  角度转换: {
    inputUnit: "度 °",
    baseInput: "1",
    cards: sourceUnitCards([
      ["0.0027778", "圆周 circle"],
      ["0.0111111", "直角"],
      ["1.111111", "百分度 gon"],
      ["1", "度 °", true],
      ["60", "分 ′"],
      ["3600", "秒 “"],
      ["0.0174533", "弧度 rad"],
      ["17.453293", "毫弧度 mrad"],
      ["3600000", "毫秒 mas"],
      ["3600000000", "微秒 μas"],
    ]),
  },
  面积转换: {
    inputUnit: "平方米 ㎡",
    baseInput: "1",
    cards: sourceUnitCards([
      ["1e-6", "平方千米 km²"],
      ["0.0001", "公顷 ha"],
      ["0.01", "公亩 are"],
      ["1", "平方米 ㎡", true],
      ["100", "平方分米 dm²"],
      ["10000", "平方厘米 cm²"],
      ["1000000", "平方毫米 mm²"],
      ["1e-6", "平方公里 km²"],
      ["0.0001", "平方百米 hm²"],
      ["0.0002471", "英亩 acre"],
      ["3.8610e-7", "平方英里 sq.mi"],
      ["1.196", "平方码 sq.yd"],
      ["10.7639", "平方英尺 sq.ft"],
      ["1550.0031", "平方英寸 sq.in"],
      ["0.0395369", "平方竿 sq.rd"],
      ["0.000015", "顷"],
      ["0.0015", "亩"],
      ["0.015", "分"],
      ["9", "平方尺"],
      ["900", "平方寸"],
    ]),
  },
  体积转换: {
    inputUnit: "立方米 m³",
    baseInput: "1",
    cards: sourceUnitCards([
      ["1e-9", "立方千米 km³"],
      ["1", "立方米 m³", true],
      ["1000", "立方分米 dm³"],
      ["1000000", "立方厘米 cm³"],
      ["1000000000", "立方毫米 mm³"],
      ["1000", "升 l"],
      ["10000", "分升 dl"],
      ["1000000", "毫升 ml"],
      ["100000", "厘升 cl"],
      ["10", "公石 hl"],
      ["1000000000", "微升 ul"],
      ["35.3147", "立方英尺 cu ft"],
      ["61023.8445", "立方英寸 cu in"],
      ["1.308", "立方码 cu yd"],
      ["0.0008107", "亩英尺"],
      ["219.9692", "英制加仑 uk gal"],
      ["264.1721", "美制加仑 us gal"],
      ["35198.8736", "英制液体盎司 oz"],
      ["33818.0588", "美制液体盎司 oz"],
      ["6.2898", "桶 bbl"],
      ["1759.754", "品脱 pt"],
    ]),
  },
  温度转换: {
    inputUnit: "开氏度 K",
    baseInput: "1",
    cards: sourceUnitCards([
      ["-272.15", "摄氏度 ℃"],
      ["-457.87", "华氏度 ℉"],
      ["1", "开氏度 K", true],
      ["1.8", "兰氏度 °R"],
      ["-217.72", "列氏度 °Re"],
    ]),
  },
  速度转换: {
    inputUnit: "米/秒 m/s",
    baseInput: "1",
    cards: sourceUnitCards([
      ["1", "米/秒 m/s", true],
      ["0.001", "千米/秒 km/s"],
      ["3.6", "千米/时 km/h"],
      ["3.3356e-9", "光速 c"],
      ["1000", "毫米/秒 mm/s"],
      ["1000000", "微米/秒 um/s"],
      ["0.0029412", "音速 AU"],
      ["3.6", "公里/时 km/h"],
      ["0.0029386", "马赫 mach"],
      ["2.236936", "英里/时 mile/h"],
      ["39.370079", "英寸/秒 in/s"],
      ["0.0006214", "英里/秒 mi/s"],
      ["3.2808", "英尺/秒 ft/s"],
      ["196.8504", "英尺/分 ft/m"],
      ["1.9438", "海里/时 Nm/h"],
      ["1.9438", "节 kt"],
      ["0.00054", "海里/秒 Nm/s"],
    ]),
  },
  热能转换: {
    inputUnit: "焦耳 J",
    baseInput: "1",
    cards: sourceUnitCards([
      ["2.7778e-7", "度 kW·h"],
      ["2.7778e-7", "千瓦·时 kW·h"],
      ["1", "焦耳 J", true],
      ["0.001", "千焦 kJ"],
      ["0.2389", "卡 cal"],
      ["0.0002389", "千卡 kcal"],
      ["3.7767e-7", "米制马力·时 ps·h"],
      ["0.102", "公斤·米 kg·m"],
      ["1", "瓦·秒 W·s"],
      ["3600", "瓦·时 W·h"],
      ["4.1859", "卡路里 cal"],
      ["", "兆卡 th"],
      ["1000000", "尔格 erg"],
      ["6.2415e+18", "电子伏特 eV"],
      ["0.0009478", "英热单位 btu"],
      ["3.7251e-7", "英制马力·时 hp·h"],
      ["0.7376", "英尺·磅 ft·lb"],
    ]),
  },
  功率转换: {
    inputUnit: "瓦 w",
    baseInput: "1",
    cards: sourceUnitCards([
      ["1", "瓦 w", true],
      ["0.001", "千瓦 kw"],
      ["0.0013596", "米制马力 ps"],
      ["0.000239", "千卡/秒 kcal/s"],
      ["0.0009478", "英热单位/秒 Btu/s"],
      ["0.7375621", "英尺·磅/秒 ft·lb/s"],
      ["0.1019716", "公斤·米/秒 kg·m/s"],
      ["1", "焦耳/秒 J/s"],
      ["1", "牛顿·米/秒 N·m/s"],
      ["10", "分瓦 dW"],
      ["100", "厘瓦 cW"],
      ["1000", "毫瓦 mW"],
      ["1000000", "微瓦 uW"],
      ["1000000000", "纳瓦 nW"],
      ["1e+12", "皮瓦 pW"],
      ["1e+15", "飞瓦 fW"],
      ["1e+18", "阿瓦 aW"],
      ["1e+21", "仄瓦 zW"],
      ["1e+24", "幺瓦 yW"],
      ["0.1", "十瓦 daW"],
      ["0.01", "百瓦 hW"],
      ["1e-6", "兆瓦 MW"],
      ["1e-9", "吉瓦 GW"],
      ["1e-12", "太瓦 TW"],
      ["1e-15", "帕瓦 PW"],
      ["1e-18", "艾瓦 EW"],
      ["1e-21", "泽瓦 ZW"],
      ["1e-24", "尧瓦 YW"],
      ["0.001341", "英制马力 hp"],
    ]),
  },
  压强转换: {
    inputUnit: "帕斯卡 Pa",
    baseInput: "1",
    cards: sourceUnitCards([
      ["1", "帕斯卡 Pa", true],
      ["1e-6", "兆帕 MPa"],
      ["0.001", "千帕 kpa"],
      ["0.01", "百帕 hpa"],
      ["9.8692e-6", "标准大气压 atm"],
      ["0.0075006", "毫米汞柱 mmHg"],
      ["0.0002953", "英寸汞柱 in Hg"],
      ["0.00001", "巴 bar"],
      ["0.01", "毫巴 mbar"],
      ["0.0208854", "磅力/平方英尺 psf"],
      ["0.000145", "磅力/平方英寸 psi"],
      ["0.101972", "毫米水柱"],
      ["0.0000102", "公斤力/平方厘米 kgf/cm²"],
      ["0.1019716", "公斤力/平方米 kgf/㎡"],
    ]),
  },
  力转换: {
    inputUnit: "牛 N",
    baseInput: "1",
    cards: sourceUnitCards([
      ["1", "牛 N", true],
      ["0.001", "千牛 kN"],
      ["0.1019716", "千克力 kgf"],
      ["101.971621", "克力 gf"],
      ["0.000102", "公吨力 tf"],
      ["1000", "毫牛 mN"],
      ["1000000", "纳牛 nN"],
      ["1000000000", "微牛 uN"],
      ["1e-6", "百万牛顿 MN"],
      ["1e-9", "吉牛顿 GN"],
      ["0.1019716", "公斤力 kgf"],
      ["0.1019716", "毫克力 mgf"],
      ["0.000102", "米制吨力"],
      ["0.2248089", "磅力"],
      ["0.0002248", "千磅力 kip"],
      ["100000", "达因 dyn"],
      ["1", "美制吨力"],
      ["0.0001004", "英制吨力"],
      ["7.233", "磅达 pdl"],
    ]),
  },
};

const converterToolConfigs: Record<string, ConverterToolConfig> = {
  住房贷款: {
    label: "住房贷款",
    mode: "mortgage",
    inputLabel: "贷款金额（万元）",
    secondaryLabel: "年利率（%）",
    fromLabel: "还款方式",
    toLabel: "结果",
    options: [
      { label: "等额本息", value: "equal-payment" },
      { label: "等额本金首月", value: "equal-principal" },
    ],
    defaultInput: "100",
    defaultSecondary: "4.2",
    defaultFrom: "equal-payment",
    defaultTo: "monthly",
  },
  个人所得税: {
    label: "个人所得税",
    mode: "tax",
    inputLabel: "月收入",
    secondaryLabel: "专项扣除",
    fromLabel: "计税方式",
    toLabel: "结果",
    options: [{ label: "工资薪金", value: "salary" }],
    defaultInput: "12000",
    defaultSecondary: "0",
    defaultFrom: "salary",
    defaultTo: "tax",
  },
  长度单位: {
    label: "长度单位",
    mode: "unit",
    inputLabel: "输入数值",
    fromLabel: "源单位",
    toLabel: "目标单位",
    options: converterLengthUnits,
    defaultInput: "1",
    defaultFrom: "m",
    defaultTo: "cm",
  },
  亲戚称呼: {
    label: "亲戚称呼",
    mode: "relationship",
    inputLabel: "称呼链",
    inputType: "text",
    fromLabel: "输入方式",
    toLabel: "结果",
    options: [{ label: "爸爸的妈妈", value: "chain" }],
    defaultInput: "爸爸的妈妈",
    defaultFrom: "chain",
    defaultTo: "common",
  },
  货币汇率: {
    label: "货币汇率",
    mode: "unit",
    inputLabel: "金额",
    fromLabel: "源币种",
    toLabel: "目标币种",
    options: converterCurrencyUnits,
    defaultInput: "100",
    defaultFrom: "usd",
    defaultTo: "cny",
  },
  大写金额: {
    label: "大写金额",
    mode: "uppercase",
    inputLabel: "金额",
    fromLabel: "格式",
    toLabel: "结果",
    options: [{ label: "人民币大写", value: "rmb" }],
    defaultInput: "123.45",
    defaultFrom: "rmb",
    defaultTo: "upper",
  },
  BMI计算: {
    label: "BMI计算",
    mode: "bmi",
    inputLabel: "体重（kg）",
    secondaryLabel: "身高（cm）",
    fromLabel: "输入",
    toLabel: "结果",
    options: [{ label: "BMI", value: "bmi" }],
    defaultInput: "72",
    defaultSecondary: "180",
    defaultFrom: "bmi",
    defaultTo: "result",
  },
  日期计算: {
    label: "日期计算",
    mode: "date",
    inputLabel: "开始日期",
    inputType: "text",
    secondaryLabel: "相隔天数",
    fromLabel: "方向",
    toLabel: "结果",
    options: [
      { label: "向后计算", value: "add" },
      { label: "向前计算", value: "subtract" },
    ],
    defaultInput: "2026-05-23",
    defaultSecondary: "10",
    defaultFrom: "add",
    defaultTo: "date",
  },
  时间转换: {
    label: "时间转换",
    mode: "unit",
    inputLabel: "输入数值",
    fromLabel: "源单位",
    toLabel: "目标单位",
    options: converterTimeUnits,
    defaultInput: "1",
    defaultFrom: "min",
    defaultTo: "s",
  },
  质量单位: {
    label: "质量单位",
    mode: "unit",
    inputLabel: "输入数值",
    fromLabel: "源单位",
    toLabel: "目标单位",
    options: converterMassUnits,
    defaultInput: "1",
    defaultFrom: "kg",
    defaultTo: "g",
  },
  角度转换: {
    label: "角度转换",
    mode: "unit",
    inputLabel: "输入数值",
    fromLabel: "源单位",
    toLabel: "目标单位",
    options: converterAngleUnits,
    defaultInput: "1",
    defaultFrom: "deg",
    defaultTo: "rad",
  },
  进制转换: {
    label: "进制转换",
    mode: "base",
    inputLabel: "输入数值",
    inputType: "text",
    fromLabel: "源进制",
    toLabel: "目标进制",
    options: converterBaseUnits,
    defaultInput: "255",
    defaultFrom: "10",
    defaultTo: "16",
  },
  面积转换: {
    label: "面积转换",
    mode: "unit",
    inputLabel: "输入数值",
    fromLabel: "源单位",
    toLabel: "目标单位",
    options: converterAreaUnits,
    defaultInput: "1",
    defaultFrom: "m2",
    defaultTo: "mu",
  },
  体积转换: {
    label: "体积转换",
    mode: "unit",
    inputLabel: "输入数值",
    fromLabel: "源单位",
    toLabel: "目标单位",
    options: converterVolumeUnits,
    defaultInput: "1",
    defaultFrom: "m3",
    defaultTo: "l",
  },
  温度转换: {
    label: "温度转换",
    mode: "temperature",
    inputLabel: "输入温度",
    fromLabel: "源单位",
    toLabel: "目标单位",
    options: converterTemperatureUnits,
    defaultInput: "1",
    defaultFrom: "k",
    defaultTo: "c",
  },
  速度转换: {
    label: "速度转换",
    mode: "unit",
    inputLabel: "输入数值",
    fromLabel: "源单位",
    toLabel: "目标单位",
    options: converterSpeedUnits,
    defaultInput: "1",
    defaultFrom: "mps",
    defaultTo: "kph",
  },
  热能转换: {
    label: "热能转换",
    mode: "unit",
    inputLabel: "输入数值",
    fromLabel: "源单位",
    toLabel: "目标单位",
    options: converterEnergyUnits,
    defaultInput: "1",
    defaultFrom: "kcal",
    defaultTo: "kj",
  },
  功率转换: {
    label: "功率转换",
    mode: "unit",
    inputLabel: "输入数值",
    fromLabel: "源单位",
    toLabel: "目标单位",
    options: converterPowerUnits,
    defaultInput: "1",
    defaultFrom: "w",
    defaultTo: "kw",
  },
  压强转换: {
    label: "压强转换",
    mode: "unit",
    inputLabel: "输入数值",
    fromLabel: "源单位",
    toLabel: "目标单位",
    options: converterPressureUnits,
    defaultInput: "1",
    defaultFrom: "pa",
    defaultTo: "kpa",
  },
  力转换: {
    label: "力转换",
    mode: "unit",
    inputLabel: "输入数值",
    fromLabel: "源单位",
    toLabel: "目标单位",
    options: converterForceUnits,
    defaultInput: "1",
    defaultFrom: "n",
    defaultTo: "kn",
  },
};

const dailyEnglishApiUrl = "https://api.timelessq.com/english-sentence";
const dailyEnglishProviderReferenceUrl = "https://api.timelessq.com";
const dailyQuoteApiUrl = "https://base.itab.link/yiyan/info";
const dailyQuoteLikeApiUrl = "https://base.itab.link/yiyan/like";
const dailyQuoteShareApiUrl = "https://base.itab.link/yiyan/share";
const dailyQuoteMinimumDate = "20220706";
const dailyQuoteSourceIconUrl = "https://files.codelife.cc/icons/yiyan.svg";
const dailyQuoteIconUrl = "/itab-live-assets/yiyan.svg";
const dailyQuoteTideLogoUrl = "https://go.itab.link/tide.png";
const movieCalendarApiPath = "/api/itab/movie-calendar";
const movieCalendarSourceApiUrl =
  "https://api.codelife.cc/itab/todayMovie?version=v2";
const props = defineProps<{
  openedShellOverride?: ItabReplicaOpenedShellOverride;
}>();
const dailyEnglishFallback: DailyEnglishEntry = {
  mode: "跟读",
  sentence: "Light stretches longer, painting walls gold.",
  translation: "日光拉得更长，把墙壁染成金色。",
  progressLabel: "00:00",
  imageUrl: sourceAssets.english,
  audioUrl: "",
  dateline: "2026-05-20",
};
const dailyQuoteFallback: DailyQuoteEntry = {
  id: "source-fallback",
  date: "20260520",
  dateLabel: "2026.05.20 星期三",
  timeLabel: "23:40",
  quote: "当一个人不能拥有的时候，他唯一能做的便是不要忘记。",
  author: "维克多·弗兰克尔",
  source: "作家",
  like: 84,
  share: 113,
  picUrl:
    "https://pics.tide.moreless.io/dailypics/Fgr5WYBfdHIlr4uYZbpWKA8_1q4K?imageView2/1/w/1366/h/768/format/webp",
  thumbUrl:
    "https://pics.tide.moreless.io/dailypics/Fgr5WYBfdHIlr4uYZbpWKA8_1q4K?imageView2/1/w/1366/h/768/format/webp?imageView2/1/w/300/h/300/format/webp",
  sourceStatus: "fallback",
};
const movieCalendarFallback: MovieCalendarEntry = {
  date: "2026-05-21",
  day: "21",
  monthLabel: "5月",
  weekday: "周四",
  movieTitle: "红气球之旅",
  rating: "7.4",
  quote: "知道吗？成年人总会有点复杂。",
  posterUrl:
    "https://files.codelife.cc/itab/movieCalendar/p-202303231856436.webp?x-oss-process=image/resize,limit_0,m_fill,w_273,h_405/quality,q_80/format,webp",
  coverUrl: sourceAssets.movie,
  sourceUrl: "https://movie.douban.com/subject/1856436/",
  year: "2007",
  area: "法国 中国台湾",
  director: "侯孝贤",
  intro:
    "一个异乡家庭在城市中彼此牵连，红气球穿过生活的缝隙，也穿过成年人的复杂心事。",
  genres: ["剧情"],
  bgColor: "4c4038",
  textColor: "f9f9f4",
  sourceStatus: "fallback",
};
const movieCalendarLoading: MovieCalendarEntry = {
  date: "",
  day: "--",
  monthLabel: "",
  weekday: "",
  movieTitle: "电影日历",
  rating: "--",
  quote: "正在加载今日电影",
  posterUrl: "",
  coverUrl: "",
  sourceUrl: "",
  year: "",
  area: "",
  director: "",
  intro: "",
  genres: [],
  bgColor: movieCalendarFallback.bgColor,
  textColor: movieCalendarFallback.textColor,
  sourceStatus: "loading",
};
const movieCalendarErrorEntry: MovieCalendarEntry = {
  ...movieCalendarLoading,
  movieTitle: "电影日历加载失败",
  quote: "请检查电影日历接口连接",
  sourceStatus: "error",
};
const dailyEnglish = ref<DailyEnglishEntry>(dailyEnglishFallback);
const dailyQuote = ref<DailyQuoteEntry>({
  ...dailyQuoteFallback,
  sourceStatus: "loading",
});
const dailyQuoteLiked = ref(false);
const dailyQuoteFullscreen = ref(false);
const dailyQuotePanelRef = ref<HTMLElement | null>(null);
const dailyQuoteActionAnimating = reactive<Record<DailyQuoteAction, boolean>>({
  share: false,
  fullscreen: false,
  like: false,
});
const dailyQuoteActionAnimationTimers: Partial<
  Record<DailyQuoteAction, number>
> = {};
const movieCalendar = ref<MovieCalendarEntry>(movieCalendarLoading);
const movieCalendarError = ref("");
const dailyEnglishStyle = computed<Record<string, string>>(() => ({
  "--daily-english-image": `url("${dailyEnglish.value.imageUrl}")`,
}));
const dailyQuoteOuterStyle = computed<Record<string, string>>(() => ({
  "--daily-quote-bg-image": `url("${
    dailyQuote.value.thumbUrl || dailyQuote.value.picUrl
  }")`,
}));
const dailyQuoteOpenedStyle = computed<Record<string, string>>(() => ({
  "--daily-quote-opened-bg-image": `url("${
    dailyQuote.value.picUrl || dailyQuote.value.thumbUrl
  }")`,
}));
const dailyQuoteAttributionText = computed(() =>
  [dailyQuote.value.source, dailyQuote.value.author].filter(Boolean).join("，"),
);
const movieCalendarOuterStyle = computed<Record<string, string>>(() => ({
  "--movie-cover-image": movieCalendar.value.coverUrl
    ? `url("${movieCalendar.value.coverUrl}")`
    : "none",
  "--movie-poster-image": movieCalendar.value.posterUrl
    ? `url("${movieCalendar.value.posterUrl}")`
    : "none",
  "--movie-bg-color": `#${movieCalendar.value.bgColor || movieCalendarFallback.bgColor}`,
  "--movie-text-color": `#${movieCalendar.value.textColor || movieCalendarFallback.textColor}`,
}));
const wallpaperRuntimeWidget = ref<WidgetConfig | null>(null);
const wallpaperRuntime = useItabWallpaperRuntime(wallpaperRuntimeWidget);
const wallpaperPanelElement = ref<HTMLElement | null>(null);
const wallpaperLoadMoreSentinelElement = ref<HTMLElement | null>(null);
const wallpaperSettingsOpen = ref(false);
const wallpaperSettings = reactive({
  dailyAutoUpdate: true,
  dimWallpaper: false,
  blurLevel: 0,
});
const activeWallpaper = computed(() => wallpaperRuntime.activeWallpaper.value);
const featuredWallpaper = computed(
  () => wallpaperRuntime.featuredWallpaper.value,
);
const visibleBingWallpapers = computed(
  () => wallpaperRuntime.visibleBingWallpapers.value,
);
const hasMoreWallpapers = computed(
  () => wallpaperRuntime.hasMoreWallpapers.value,
);
const wallpaperCardStyle = computed<Record<string, string>>(() => ({
  "--wallpaper-image": activeWallpaper.value
    ? `url("${activeWallpaper.value.thumbnailUrl}")`
    : "none",
}));
const wallpaperDescription = (entry: ItabWallpaperEntry | null) =>
  entry
    ? [entry.title, entry.location, `© ${entry.credit}`]
        .filter(Boolean)
        .join(" ")
    : "";
const wallpaperCopyrightVisibleSizes = new Set<WidgetSize>([
  "1x2",
  "2x2",
  "2x4",
]);
const dailyEnglishAudioElement = ref<HTMLAudioElement | null>(null);
const dailyEnglishPlaying = ref(false);

const tomatoAudioBasePath = "/itab-live-assets/tomato-audio";
const tomatoThemes = [
  {
    name: "海浪",
    key: "hailang",
    path: "hailang.jpg",
    audio: `${tomatoAudioBasePath}/hailang_128.m4a`,
  },
  {
    name: "篝火",
    key: "bonfire",
    path: "bonfire.jpg",
    audio: `${tomatoAudioBasePath}/bonfire_128.m4a`,
  },
  {
    name: "冥想",
    key: "meditation",
    path: "meditation.jpg",
    audio: `${tomatoAudioBasePath}/meditation_128.m4a`,
  },
  {
    name: "森林",
    key: "senlin",
    path: "senlin.jpg",
    audio: `${tomatoAudioBasePath}/senlin_128.m4a`,
  },
  {
    name: "寺庙",
    key: "simiao",
    path: "simiao.jpg",
    audio: `${tomatoAudioBasePath}/simiao_128.m4a`,
  },
  {
    name: "夜晚",
    key: "night",
    path: "night.jpg",
    audio: `${tomatoAudioBasePath}/night_128.m4a`,
  },
  {
    name: "农场",
    key: "farm",
    path: "farm.jpg",
    audio: `${tomatoAudioBasePath}/farm_128.m4a`,
  },
  {
    name: "时钟",
    key: "clock",
    path: "clock.jpg",
    audio: `${tomatoAudioBasePath}/clock_128.m4a`,
  },
  {
    name: "雨声",
    key: "rain",
    path: "rain.jpg",
    audio: `${tomatoAudioBasePath}/rain_128.m4a`,
  },
  {
    name: "雷雨",
    key: "thunder",
    path: "thunder.jpg",
    audio: `${tomatoAudioBasePath}/thunder_128.m4a`,
  },
  {
    name: "风铃",
    key: "chime",
    path: "chime.jpg",
    audio: `${tomatoAudioBasePath}/chime_128.m4a`,
  },
  {
    name: "键盘",
    key: "keyboard",
    path: "keyboard.jpg",
    audio: `${tomatoAudioBasePath}/keyboard_128.m4a`,
  },
  {
    name: "猫咪",
    key: "cat",
    path: "cat.jpg",
    audio: `${tomatoAudioBasePath}/cat_128.m4a`,
  },
];
const tomatoTimerStorageKey = "itab-live:tomato-timer-state";
const tomatoDefaultDurationSeconds = 25 * 60;

const now = ref(new Date());
const viewportWidth = ref(
  typeof window === "undefined" ? 1733 : window.innerWidth,
);
const searchText = ref("");
const activeGroup = ref("主页");
const activeSearch = ref("百度");
const showSearchMenu = ref(false);
const showAddModal = ref(false);
const addTab = ref<"widget" | "site" | "custom">("widget");
const showGroupMenu = ref(false);
const openedWidgetId = ref("");
const eatTodayMenuItems = [
  "牛肉粉",
  "砂锅粥",
  "肠粉",
  "咖喱饭",
  "云吞面",
  "麻辣烫",
  "寿司",
  "沙拉",
];
const eatTodaySelectedItem = ref("");
const eatTodayAnimatedItem = ref("");
const eatTodayRunning = ref(false);
const ipLookupStatus = ref<IpLookupStatus>("idle");
const ipLookupError = ref("");
const ipLookupResult = ref<IpLookupResult>({
  ip: "163.125.214.27",
  location: "中国 广东 深圳 中国联通",
  country: "中国",
  region: "广东",
  city: "深圳",
  isp: "中国联通",
  queryIp: "163.125.214.27",
  clientIp: "",
  clientIpSource: "",
  latitude: "22.696667",
  longitude: "114.045422",
  updatedAt: "",
});
const activeConverterToolLabel = ref("计算器");
const converterDisplay = ref("0");
const converterExpression = ref("");
const converterDisplayMode = ref<"input" | "result">("input");
const converterToolStates = reactive(
  Object.fromEntries(
    Object.values(converterToolConfigs).map((config) => [
      config.label,
      {
        input: config.defaultInput,
        secondary: config.defaultSecondary || "",
        fromUnit: config.defaultFrom,
        toUnit: config.defaultTo,
      },
    ]),
  ) as Record<string, ConverterToolState>,
);
const activeTomatoThemeIndex = ref(0);
const tomatoDurationSeconds = ref(tomatoDefaultDurationSeconds);
const tomatoElapsedBaseSeconds = ref(0);
const tomatoStartedAtMs = ref<number | null>(null);
const tomatoTickNowMs = ref(Date.now());
const tomatoPhase = ref<TomatoPhase>("idle");
const tomatoRunning = ref(false);
const tomatoSessions = ref(0);
const tomatoAudioEnabled = ref(true);
const tomatoAudioBlocked = ref(false);
const clockSecondsEnabled = ref(true);
const calendarActiveTab = ref<"calendar" | "tools">("calendar");
const displayedCalendarYear = ref(2026);
const displayedCalendarMonth = ref(5);
const selectedCalendarKey = ref("2026-05-21");
const calendarWeekStartsMonday = ref(true);
const toastMessage = ref("");
const blankMenu = reactive({ show: false, x: 0, y: 0 });
const widgetMenu = reactive({ show: false, x: 0, y: 0, widgetId: "" });
let clockTimer: number | null = null;
let toastTimer: number | null = null;
let tomatoTimer: number | null = null;
let tomatoAudioElement: HTMLAudioElement | null = null;
let tomatoAudioPlayToken = 0;
let updateViewportHandler: (() => void) | null = null;
let visibilityChangeHandler: (() => void) | null = null;
let movieCalendarAbortController: AbortController | null = null;
let ipLookupAbortController: AbortController | null = null;
let ipLookupRefreshTimer: number | null = null;
let dailyQuoteClockTimer: number | null = null;
let eatTodayPickTimer: number | null = null;
let eatTodayAnimationTimer: number | null = null;

const groups = [
  { name: "主页", icon: "⌂" },
  { name: "编程", icon: "</>" },
  { name: "设计", icon: "✐" },
  { name: "产品", icon: "Ⓟ" },
  { name: "AI", icon: "✣" },
  { name: "摸鱼", icon: "▣" },
];

const searchEngines = ["百度", "谷歌", "Bing", "添加"];
const sizeOptions = ITAB_REPLICA_WIDGET_SIZE_OPTIONS;
const anniversaryEditorSizes: Array<Extract<WidgetSize, "2x2" | "2x4">> = [
  "2x2",
  "2x4",
];
const anniversaryPreviewSizes: WidgetSize[] = [
  "1x1",
  "1x2",
  "2x1",
  "2x2",
  "2x4",
];
const anniversaryCommonEvents = [
  "和她❤️相爱已经",
  "Ta的生日🎈还有",
  "宝宝👶出生已经",
  "情人节🧑🏻‍❤️‍🧑🏼还有",
  "周末还有😃",
  "周年纪念日🥂",
  "聚餐🌮",
  "还款日💰",
  "派对🎉",
  "父亲节👨",
  "母亲节👩",
  "考试✍️还有",
  "面试🤝",
  "看医生🧑‍⚕️",
];
const anniversaryRepeatOptions = ["不重复", "每周", "每月", "每年", "节日"];
const anniversaryWeekdays = ["一", "二", "三", "四", "五", "六", "日"];
const anniversaryYearOptions = Array.from(
  { length: 282 },
  (_, index) => 1820 + index,
);
const anniversaryMonthOptions = Array.from(
  { length: 12 },
  (_, index) => index + 1,
);
const anniversaryCalendarDays = [
  27, 28, 29, 30, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
  19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1, 2, 3, 4, 5, 6, 7,
];
const anniversaryTextColors = [
  "#ffffff",
  "#333333",
  "#1890ff",
  "#eb8197",
  "#9de5fe",
  "#b8ceff",
  "#efabc4",
  "#daccfd",
  "#fceaba",
  "#f4f7ca",
  "#d0eabb",
];
const anniversaryBackgroundColors = [
  "#ffffff",
  "#fbbe23",
  "#fc4548",
  "#4b3c36",
  "#7dae68",
  "#023373",
  "#c8ac70",
  "#f4eee6",
  "#372128",
  "#c82c34",
  "#054092",
  "#a3ddb9",
  "#245877",
];
const currentAnniversaryToday = new Date();
const anniversaryToday = new Date(
  currentAnniversaryToday.getFullYear(),
  currentAnniversaryToday.getMonth(),
  currentAnniversaryToday.getDate(),
);
const anniversaryTemplates = reactive<AnniversaryTemplate[]>([
  {
    id: "life",
    title: "纪念日",
    label: "你在世界已经",
    eventName: "你在世界已经",
    date: "1997-10-1",
    mode: "elapsed",
    repeat: "不重复",
    size: "2x2",
    textColor: "#ffffff",
    backgroundColor: "#8e726f",
    backgroundImage: defaultAnniversaryBackgroundImage,
    backgroundMode: "image",
    mask: "0",
  },
  {
    id: "payday",
    title: "倒数日",
    label: "发工资还有",
    eventName: "发工资还有",
    date: "2023-12-01",
    mode: "remaining",
    repeat: "每月",
    size: "2x2",
    textColor: "#1890ff",
    backgroundColor: "#ffffff",
    backgroundImage: defaultAnniversaryBackgroundImage,
    backgroundMode: "color",
    mask: "0",
  },
  {
    id: "plain-life",
    title: "纪念日",
    label: "你在世界已经",
    eventName: "你在世界已经",
    date: "1997-10-1",
    mode: "elapsed",
    repeat: "不重复",
    size: "2x2",
    textColor: "#8e726f",
    backgroundColor: "#eee1d9",
    backgroundMode: "color",
    mask: "0",
  },
  {
    id: "love",
    title: "恋爱日期",
    label: "和她❤️恋爱已经",
    eventName: "和她❤️恋爱已经",
    date: "2021-02-28",
    mode: "elapsed",
    repeat: "不重复",
    size: "2x2",
    textColor: "#eb8197",
    backgroundColor: "#ffffff",
    backgroundImage: defaultAnniversaryBackgroundImage,
    backgroundMode: "color",
    mask: "0",
  },
]);

const activeAnniversaryTemplateId = ref("life");
const activeAnniversaryPreviewSize = ref<WidgetSize>("2x2");
const anniversaryAsideCollapsed = ref(false);
const anniversaryRepeatDropdownOpen = ref(false);
const anniversaryDatePickerOpen = ref(false);
const anniversaryDateTriggerRef = ref<HTMLElement | null>(null);
const anniversaryDatePickerPosition = reactive({ top: 0, left: 0 });
const anniversaryEditor = reactive({
  title: "纪念日",
  label: "你在世界已经",
  eventName: "纪念日",
  date: "1997-10-1",
  mode: "elapsed" as AnniversaryMode,
  repeat: "不重复",
  size: "2x2" as WidgetSize,
  textColor: "#ffffff",
  backgroundColor: "#8e726f",
  backgroundImage: defaultAnniversaryBackgroundImage,
  backgroundMode: "image" as AnniversaryBackgroundMode,
  mask: "0",
  showCommonEvents: false,
});

let dailyEnglishAbortController: AbortController | null = null;
let dailyQuoteAbortController: AbortController | null = null;

const widgets = reactive<WidgetItem[]>([
  {
    id: "weather-00",
    kind: "weather",
    title: "天气",
    size: "2x2",
    col: 1,
    row: 1,
  },
  {
    id: "calendar-01",
    kind: "calendar",
    title: "日历",
    size: "2x2",
    col: 3,
    row: 1,
  },
  {
    id: "hotsearch-02",
    kind: "hotsearch",
    title: "热搜榜",
    size: "2x4",
    col: 5,
    row: 1,
  },
  {
    id: "anniversary-03",
    kind: "anniversary",
    title: "纪念日",
    size: "2x2",
    col: 9,
    row: 1,
  },
  {
    id: "memo-04",
    kind: "memo",
    title: "备忘录",
    size: "2x2",
    col: 11,
    row: 1,
  },
  {
    id: "movie-05",
    kind: "movie",
    title: "电影日历",
    size: "2x2",
    col: 13,
    row: 1,
  },
  {
    id: "countdown-06",
    kind: "countdown",
    title: "下班倒计时",
    size: "2x4",
    col: 1,
    row: 3,
  },
  {
    id: "holiday-07",
    kind: "next-holiday",
    title: "下一个假期",
    size: "2x2",
    col: 5,
    row: 3,
  },
  {
    id: "daily-quote-09",
    kind: "daily-quote",
    title: "每日一言",
    size: "2x2",
    col: 9,
    row: 3,
  },
  {
    id: "poem-10",
    kind: "poem",
    title: "今日诗词",
    size: "2x2",
    col: 11,
    row: 3,
  },
  {
    id: "wooden-fish-11",
    kind: "wooden-fish",
    title: "电子木鱼",
    size: "2x2",
    col: 13,
    row: 3,
  },
  { id: "clock-12", kind: "clock", title: "时钟", size: "2x2", col: 1, row: 5 },
  {
    id: "speedtest-13",
    kind: "speed-test",
    title: "网速测试",
    size: "2x2",
    col: 3,
    row: 5,
  },
  {
    id: "english-14",
    kind: "today-english",
    title: "今日英语",
    size: "2x2",
    col: 5,
    row: 5,
  },
  {
    id: "food-15",
    kind: "eat-today",
    title: "今天吃什么",
    size: "2x2",
    col: 7,
    row: 5,
  },
  {
    id: "wallpaper-16",
    kind: "wallpaper",
    title: "壁纸",
    size: "2x2",
    col: 9,
    row: 5,
  },
  {
    id: "todo-17",
    kind: "todo",
    title: "待办事项",
    size: "2x2",
    col: 11,
    row: 5,
  },
  {
    id: "stock-18",
    kind: "stock",
    title: "股市",
    size: "2x2",
    col: 13,
    row: 5,
  },
  {
    id: "game-2048-20",
    kind: "tool-icon",
    title: "2048",
    size: "2x2",
    col: 3,
    row: 7,
    icon: sourceAssets.game2048,
  },
  {
    id: "qwerty-21",
    kind: "tool-icon",
    title: "Qwerty Learner",
    size: "2x2",
    col: 5,
    row: 7,
    icon: sourceAssets.qwerty,
  },
  {
    id: "exchange-24",
    kind: "exchange-rate",
    title: "汇率",
    size: "2x2",
    col: 11,
    row: 7,
  },
  {
    id: "gradient-25",
    kind: "gradient",
    title: "渐变色",
    size: "2x2",
    col: 13,
    row: 7,
  },
  {
    id: "habit-26",
    kind: "habit",
    title: "习惯养成",
    size: "2x2",
    col: 1,
    row: 9,
  },
  {
    id: "timestamp-27",
    kind: "tool-icon",
    title: "时间戳转换",
    size: "2x2",
    col: 3,
    row: 9,
    icon: sourceAssets.timestamp,
  },
  {
    id: "tomato-29",
    kind: "tomato",
    title: "番茄时钟",
    size: "2x2",
    col: 7,
    row: 9,
  },
  {
    id: "ip-30",
    kind: "tool-icon",
    title: "本机IP",
    size: "2x2",
    col: 9,
    row: 9,
    icon: sourceAssets.ip,
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 42,
      maxHeightInset: 64,
    },
  },
  {
    id: "world-clock-31",
    kind: "world-clock",
    title: "世界时钟",
    size: "2x2",
    col: 11,
    row: 9,
  },
  {
    id: "avatar-32",
    kind: "tool-icon",
    title: "头像生成器",
    size: "2x2",
    col: 13,
    row: 9,
    icon: sourceAssets.avatar,
  },
  {
    id: "relative-33",
    kind: "tool-icon",
    title: "亲戚计算器",
    size: "2x2",
    col: 1,
    row: 11,
    icon: sourceAssets.relative,
  },
  {
    id: "converter-34",
    kind: "converter",
    title: "换算器",
    size: "2x2",
    col: 3,
    row: 11,
  },
  {
    id: "uppercase-35",
    kind: "tool-icon",
    title: "数字大写转换",
    size: "2x2",
    col: 5,
    row: 11,
    icon: sourceAssets.uppercase,
  },
]);

const programmingWidgets: WidgetItem[] = [
  {
    id: "github",
    kind: "tool-icon",
    title: "GitHub",
    size: "1x1",
    col: 1,
    row: 1,
    icon: "https://files.codelife.cc/icons/github.com.svg",
    url: "https://github.com/",
  },
  {
    id: "vscode",
    kind: "tool-icon",
    title: "VS Code",
    size: "1x1",
    col: 2,
    row: 1,
    icon: "https://files.codelife.cc/icons/code.visualstudio.com.svg",
  },
  {
    id: "stackoverflow",
    kind: "tool-icon",
    title: "Stack Overflow",
    size: "1x1",
    col: 3,
    row: 1,
    icon: "https://files.codelife.cc/icons/stackoverflow.com.svg",
  },
  {
    id: "npm",
    kind: "tool-icon",
    title: "npm",
    size: "1x1",
    col: 4,
    row: 1,
    icon: "https://files.codelife.cc/icons/npmjs.com.svg",
  },
  {
    id: "vercel",
    kind: "tool-icon",
    title: "Vercel",
    size: "1x1",
    col: 5,
    row: 1,
    icon: "https://files.codelife.cc/icons/vercel.com.svg",
  },
];

const itabLiveWeatherWidget = reactive<WidgetConfig>(
  createDefaultItabWeatherWidget(),
);
const itabLiveMemoWidget = reactive<WidgetConfig>(
  createDefaultItabMemoWidget(),
);
const itabLivePoemWidget = reactive<WidgetConfig>(
  createDefaultItabPoemWidget(),
);

const syncItabLiveWeatherWidgetSize = (size: WidgetSize) => {
  applyItabWeatherSizeToWidget(
    itabLiveWeatherWidget,
    size as ItabWidgetSizeKey,
  );
};
const syncItabLiveMemoWidgetSize = (size: WidgetSize) => {
  applyItabMemoSizeToWidget(itabLiveMemoWidget, size as ItabWidgetSizeKey);
};
const syncItabLivePoemWidgetSize = (size: WidgetSize) => {
  applyItabPoemSizeToWidget(itabLivePoemWidget, size as ItabWidgetSizeKey);
};

const updateItabLiveWeatherData = (data: ItabWeatherWidgetData) => {
  itabLiveWeatherWidget.data = normalizeItabWeatherWidgetData(data);
};
const updateItabLiveMemoData = (data: ItabMemoWidgetData) => {
  itabLiveMemoWidget.data = normalizeItabMemoWidgetData(data);
};
const updateItabLivePoemData = (data: ItabPoemWidgetData) => {
  itabLivePoemWidget.data = normalizeItabPoemWidgetData(data);
};

watch(
  () => widgets.find((widget) => widget.kind === "weather")?.size,
  (size) => {
    if (size) syncItabLiveWeatherWidgetSize(size);
  },
  { immediate: true },
);
watch(
  () => widgets.find((widget) => widget.kind === "memo")?.size,
  (size) => {
    if (size) syncItabLiveMemoWidgetSize(size);
  },
  { immediate: true },
);
watch(
  () => widgets.find((widget) => widget.kind === "poem")?.size,
  (size) => {
    if (size) syncItabLivePoemWidgetSize(size);
  },
  { immediate: true },
);

const hotSearchItems = [
  "中国拿下90%超大型油轮新订单",
  "南太行失窃网红松树被偷偷还回来了",
  "今日小满 万物小得盈满",
  "泡药杨梅事件后卖惨无法挽回信任",
  "男子身体不适坐路边摇椅平静去世",
  "特朗普回应中俄元首会晤",
  "买家收到2万多元货2天后仅退款",
  "北京市级机关搬迁将于2026年底完成",
  "一群人里蚊子为什么总叮你",
  "“你们都是旅游 她是探亲”",
];

const hotPanelItems = [
  "中国拿下90%超大型油轮新订单",
  "南太行失窃网红松树被偷偷还回来了",
  "今日小满 万物小得盈满",
  "泡药杨梅事件后卖惨无法挽回信任",
  "男子身体不适坐路边摇椅安详去世",
  "特朗普回应中俄元首会晤",
  "同样米粉“本地人7元游客13元”",
  "北京市级机关搬迁将于2026年底完成",
  "中国的这个“菜园子”实力藏不住了",
  "被判赔3家车企共226万 汽车博主回应",
  "这些涉及柳州地震的信息是谣言",
  "小学退回全损雨伞 家委会致歉补款",
  "杨梅滞留树上 70岁奶奶崩溃哭了",
  "《我的女孩》主演李多海宣布怀孕",
  "“桂妈”太好看被网友带火到全世界",
  "一群人里蚊子为什么总叮你",
  "买家收到2万多元货2天后仅退款",
  "“你们都是旅游 她是探亲”",
  "歼10CE凭什么吊打欧洲双雄",
  "普京与“中国男孩”互赠精美瓷器",
];

const hotPanelTabs = [
  "我的订阅",
  "全部",
  "综合",
  "科技",
  "娱乐",
  "社区",
  "购物",
  "财经",
  "大学",
  "日报",
  "地方门户",
  "影视",
  "阅读",
];
const hotPanelSources = [
  { name: "百度", icon: "☸", active: true },
  { name: "微博", icon: "◉", active: false },
  { name: "抖音", icon: "♪", active: false },
];

const exchangeCurrencies = [
  {
    code: "USD",
    name: "美元",
    flag: "🇺🇸",
    value: "14.66",
    asset: sourceAssets.usd,
  },
  {
    code: "HKD",
    name: "港币",
    flag: "🇭🇰",
    value: "114.83",
    asset: sourceAssets.hkd,
  },
  {
    code: "EUR",
    name: "欧元",
    flag: "🇪🇺",
    value: "12.63",
    asset: sourceAssets.eur,
  },
  { code: "JPY", name: "日元", flag: "🇯🇵", value: "2332.69" },
  { code: "AUD", name: "澳大利亚元", flag: "🇦🇺", value: "20.64" },
  { code: "SGD", name: "新加坡元", flag: "🇸🇬", value: "18.78" },
];

const calendarDetails: Record<string, CalendarDetail> = {
  "2026-04-01": {
    dateLabel: "2026-04-01 周三",
    day: "1",
    lunarDate: "二〇二六年二月十四",
    yearLabel: "丙午(马)年",
    weekText: "本年第14周， 第91天",
    distance: "距离愚人节已经过去50天",
    zodiac: "马",
    constellation: "白羊座 ♈",
    festival: "愚人节",
    yi: "纳财，开市，交易，立券，开光，针灸，会亲友，理发，安床，造仓，结网",
    ji: "移徙，入宅，栽种",
    moon: "小望月",
    phenology: "始电",
    directions: [
      "喜神方位：西北",
      "阳贵神方位：西南",
      "阴贵神方位：正北",
      "福神方位：西南",
      "财神方位：东北",
    ],
  },
  "2026-05-01": {
    dateLabel: "2026-05-01 周五",
    day: "1",
    lunarDate: "二〇二六年三月十五",
    yearLabel: "丙午(马)年",
    weekText: "本年第18周， 第121天",
    distance: "距离劳动节已经过去20天",
    zodiac: "马",
    constellation: "金牛座 ♉️",
    festival: "劳动节",
    yi: "沐浴，捕捉，畋猎，结网，取渔",
    ji: "祭祀，嫁娶，入宅，作灶，安葬",
    moon: "望月",
    phenology: "戴胜降于桑",
    directions: [
      "喜神方位：西北",
      "阳贵神方位：西南",
      "阴贵神方位：正北",
      "福神方位：西南",
      "财神方位：东北",
    ],
  },
  "2026-05-21": {
    dateLabel: "2026-05-21 周四",
    day: "21",
    lunarDate: "二〇二六年四月初五",
    yearLabel: "丙午(马)年",
    weekText: "本年第21周， 第141天",
    zodiac: "马",
    constellation: "双子座 ♊",
    festival: "小满",
    yi: "开光，纳采，裁衣，冠笄，安床，作灶，进人口，造仓，塞穴",
    ji: "嫁娶，栽种，修造，动土，出行，伐木，作梁，安葬，谢土",
    moon: "蛾眉月",
    phenology: "苦菜秀",
    directions: [
      "喜神方位：西北",
      "阳贵神方位：西南",
      "阴贵神方位：正北",
      "福神方位：西南",
      "财神方位：东北",
    ],
  },
  "2026-05-22": {
    dateLabel: "2026-05-22 周五",
    day: "22",
    lunarDate: "二〇二六年四月初六",
    yearLabel: "丙午(马)年",
    weekText: "本年第21周， 第142天",
    distance: "距离国际生物多样性日还有1天",
    zodiac: "马",
    constellation: "双子座 ♊",
    festival: "国际生物多样性日",
    yi: "纳采，嫁娶，裁衣，理发，出行，修造，动土，进人口，开市，交易，立券，挂匾，移徙，上梁，栽种，纳畜",
    ji: "伐木，安葬，安床，祭祀，祈福",
    moon: "夕月",
    phenology: "苦菜秀",
    directions: [
      "喜神方位：西南",
      "阳贵神方位：正西",
      "阴贵神方位：西北",
      "福神方位：西北",
      "财神方位：西南",
    ],
  },
  "2026-06-01": {
    dateLabel: "2026-06-01 周一",
    day: "1",
    lunarDate: "二〇二六年四月十六",
    yearLabel: "丙午(马)年",
    weekText: "本年第23周， 第152天",
    zodiac: "马",
    constellation: "双子座 ♊",
    festival: "儿童节",
    yi: "祭祀，出行，解除，裁衣，进人口",
    ji: "动土，破土，安葬，开市",
    moon: "既望月",
    phenology: "麦秋至",
    directions: [
      "喜神方位：东北",
      "阳贵神方位：正北",
      "阴贵神方位：西南",
      "福神方位：正北",
      "财神方位：东北",
    ],
  },
};

const worldClockRows = [
  { city: "北京", time: "12:36", day: "今天" },
  { city: "洛杉矶", time: "21:36", day: "昨天" },
  { city: "纽约", time: "00:36", day: "今天" },
  { city: "巴黎", time: "06:36", day: "今天" },
  { city: "东京", time: "13:36", day: "今天" },
];

const todoTasks = reactive<TodoTask[]>([
  { id: "todo-source-row", title: "wqewqeq", done: false },
]);
const todoDraft = ref("");

const habitTaskRows = [
  { title: "啊哒哒", done: false },
  { title: "wqewqeq", done: false },
  { title: "整理组件截图", done: true },
];

const converterSizeClass = (size: WidgetSize) => size.replace("x", "-");

const converterOuter2x4Tools = [
  converterTools[0]!,
  converterTools[1]!,
  converterTools[2]!,
  converterTools[3]!,
  converterTools[4]!,
  converterTools[5]!,
  converterTools[6]!,
  converterTools[7]!,
  converterTools[8]!,
  converterTools[10]!,
] as const;

const converterOuterTools = (size: WidgetSize) =>
  size === "2x4" ? converterOuter2x4Tools : converterTools.slice(0, 4);

const resetConverterCalculator = () => {
  converterDisplay.value = "0";
  converterExpression.value = "";
  converterDisplayMode.value = "input";
};

const selectConverterTool = (label: string) => {
  activeConverterToolLabel.value = label;
};

const getConverterOption = (
  config: ConverterToolConfig,
  value: string,
): ConverterUnitOption | undefined =>
  config.options?.find((option) => option.value === value);

const parseConverterNumber = (value: string) =>
  Number(String(value).replace(/,/g, "").trim());

const formatConverterResult = (value: number) => {
  if (!Number.isFinite(value)) return "Error";
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(10))).replace(/\.0+$/, "");
};

const formatConverterToolNumber = (value: number) => {
  if (!Number.isFinite(value)) return "无法计算";
  const rounded = Number(value.toFixed(Math.abs(value) >= 1000 ? 4 : 8));
  return String(rounded).replace(/\.0+$/, "");
};

const formatSourceTemperatureUnitValue = (name: string, kelvin: number) => {
  const celsius = kelvin - 273.15;
  if (name.includes("摄氏度")) return formatConverterToolNumber(celsius);
  if (name.includes("华氏度")) {
    return formatConverterToolNumber(celsius * 1.8 + 32);
  }
  if (name.includes("兰氏度")) return formatConverterToolNumber(kelvin * 1.8);
  if (name.includes("列氏度")) {
    return formatConverterToolNumber(celsius * 0.8);
  }
  return formatConverterToolNumber(kelvin);
};

const formatSourceUnitCardValue = (
  panel: ConverterSourceUnitPanel,
  card: ConverterSourceUnitCard,
  input: string,
  label: string,
) => {
  const trimmedInput = String(input).trim();
  if (trimmedInput === panel.baseInput) return card.value;
  const inputNumber = parseConverterNumber(trimmedInput);
  const baseNumber = parseConverterNumber(panel.baseInput);
  if (!Number.isFinite(inputNumber) || !Number.isFinite(baseNumber)) return "";
  if (label === "温度转换") {
    return formatSourceTemperatureUnitValue(card.name, inputNumber);
  }
  const cardNumber = parseConverterNumber(card.value);
  if (!Number.isFinite(cardNumber)) return card.value;
  return formatConverterToolNumber((cardNumber * inputNumber) / baseNumber);
};

const toCelsius = (value: number, unit: string) => {
  if (unit === "f") return (value - 32) / 1.8;
  if (unit === "k") return value - 273.15;
  return value;
};

const fromCelsius = (value: number, unit: string) => {
  if (unit === "f") return value * 1.8 + 32;
  if (unit === "k") return value + 273.15;
  return value;
};

const chineseUpperDigits = [
  "零",
  "壹",
  "贰",
  "叁",
  "肆",
  "伍",
  "陆",
  "柒",
  "捌",
  "玖",
];
const chineseUpperUnits = ["", "拾", "佰", "仟"];
const chineseUpperSections = ["", "万", "亿", "兆"];

const convertIntegerToChineseUpper = (rawValue: number) => {
  if (rawValue === 0) return "零";
  let value = rawValue;
  let sectionIndex = 0;
  let result = "";
  let needZero = false;

  while (value > 0) {
    const section = value % 10000;
    if (needZero && section !== 0 && !result.startsWith("零")) {
      result = `零${result}`;
    }
    let sectionText = "";
    let sectionZero = false;
    let sectionValue = section;

    for (let unitIndex = 0; unitIndex < 4; unitIndex += 1) {
      const digit = sectionValue % 10;
      if (digit === 0) {
        if (sectionText) sectionZero = true;
      } else {
        if (sectionZero) {
          sectionText = `零${sectionText}`;
          sectionZero = false;
        }
        sectionText = `${chineseUpperDigits[digit]}${chineseUpperUnits[unitIndex]}${sectionText}`;
      }
      sectionValue = Math.floor(sectionValue / 10);
    }

    if (sectionText) {
      result = `${sectionText}${chineseUpperSections[sectionIndex]}${result}`;
    }
    needZero = section < 1000 && section > 0;
    value = Math.floor(value / 10000);
    sectionIndex += 1;
  }

  return result;
};

const formatChineseUpperAmount = (input: string) => {
  const amount = parseConverterNumber(input);
  if (!Number.isFinite(amount) || amount < 0) return "无法转换";
  const integerPart = Math.floor(amount);
  const decimal = Math.round((amount - integerPart) * 100);
  const jiao = Math.floor(decimal / 10);
  const fen = decimal % 10;
  const integerText = `${convertIntegerToChineseUpper(integerPart)}元`;
  if (jiao === 0 && fen === 0) return `${integerText}整`;
  const decimalText = [
    jiao > 0 ? `${chineseUpperDigits[jiao]}角` : "",
    fen > 0 ? `${chineseUpperDigits[fen]}分` : "",
  ].join("");
  return `${integerText}${decimalText}`;
};

const formatIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const relationshipResults: Record<string, string> = {
  爸爸的妈妈: "奶奶",
  爸爸的爸爸: "爷爷",
  妈妈的妈妈: "外婆",
  妈妈的爸爸: "外公",
  老公的妈妈: "婆婆",
  老公的爸爸: "公公",
  老婆的妈妈: "岳母",
  老婆的爸爸: "岳父",
  哥哥的老婆: "嫂子",
  弟弟的老婆: "弟妹",
  姐姐的老公: "姐夫",
  妹妹的老公: "妹夫",
};

const calculateMortgageResult = (state: ConverterToolState) => {
  const amount = parseConverterNumber(state.input) * 10000;
  const annualRate = parseConverterNumber(state.secondary) / 100;
  const monthCount = 30 * 12;
  if (!Number.isFinite(amount) || amount <= 0) return "请输入贷款金额";
  if (!Number.isFinite(annualRate) || annualRate <= 0) return "请输入年利率";
  const monthlyRate = annualRate / 12;
  if (state.fromUnit === "equal-principal") {
    const firstMonth = amount / monthCount + amount * monthlyRate;
    return `首月 ${formatConverterToolNumber(firstMonth)} 元`;
  }
  const monthly =
    (amount * monthlyRate * (1 + monthlyRate) ** monthCount) /
    ((1 + monthlyRate) ** monthCount - 1);
  return `月供 ${formatConverterToolNumber(monthly)} 元`;
};

const calculateMonthlyTaxResult = (state: ConverterToolState) => {
  const salary = parseConverterNumber(state.input);
  const deduction = parseConverterNumber(state.secondary) || 0;
  const taxable = Math.max(0, salary - deduction - 5000);
  const brackets = [
    { limit: 3000, rate: 0.03, quick: 0 },
    { limit: 12000, rate: 0.1, quick: 210 },
    { limit: 25000, rate: 0.2, quick: 1410 },
    { limit: 35000, rate: 0.25, quick: 2660 },
    { limit: 55000, rate: 0.3, quick: 4410 },
    { limit: 80000, rate: 0.35, quick: 7160 },
    { limit: Infinity, rate: 0.45, quick: 15160 },
  ];
  const bracket = brackets.find((item) => taxable <= item.limit)!;
  return `应纳税 ${formatConverterToolNumber(taxable * bracket.rate - bracket.quick)} 元`;
};

const calculateBmiResult = (state: ConverterToolState) => {
  const weight = parseConverterNumber(state.input);
  const heightMeters = parseConverterNumber(state.secondary) / 100;
  if (
    !Number.isFinite(weight) ||
    weight <= 0 ||
    !Number.isFinite(heightMeters) ||
    heightMeters <= 0
  ) {
    return "请输入身高体重";
  }
  const bmi = weight / heightMeters ** 2;
  const level =
    bmi < 18.5 ? "偏瘦" : bmi < 24 ? "正常" : bmi < 28 ? "超重" : "肥胖";
  return `BMI ${formatConverterToolNumber(bmi)} ${level}`;
};

const calculateConverterToolResult = (
  config: ConverterToolConfig,
  state: ConverterToolState,
) => {
  const input = String(state.input).trim();
  const inputNumber = parseConverterNumber(input);
  const fromOption = getConverterOption(config, state.fromUnit);
  const toOption = getConverterOption(config, state.toUnit);

  if (config.mode === "unit") {
    if (!Number.isFinite(inputNumber)) return "请输入数值";
    if (!fromOption?.factor || !toOption?.factor) return "单位配置错误";
    const result = (inputNumber * fromOption.factor) / toOption.factor;
    return `${formatConverterToolNumber(result)} ${toOption.label}`;
  }

  if (config.mode === "temperature") {
    if (!Number.isFinite(inputNumber)) return "请输入温度";
    const result = fromCelsius(
      toCelsius(inputNumber, state.fromUnit),
      state.toUnit,
    );
    return `${formatConverterToolNumber(result)} ${toOption?.label || ""}`.trim();
  }

  if (config.mode === "base") {
    const fromBase = Number(state.fromUnit);
    const toBase = Number(state.toUnit);
    const value = Number.parseInt(input, fromBase);
    if (!input || !Number.isFinite(value)) return "请输入有效进制数";
    return value.toString(toBase).toUpperCase();
  }

  if (config.mode === "mortgage") return calculateMortgageResult(state);
  if (config.mode === "tax") return calculateMonthlyTaxResult(state);
  if (config.mode === "bmi") return calculateBmiResult(state);

  if (config.mode === "date") {
    const date = new Date(`${input}T00:00:00`);
    const days = parseConverterNumber(state.secondary);
    if (Number.isNaN(date.getTime()) || !Number.isFinite(days)) {
      return "请输入日期和天数";
    }
    const direction = state.fromUnit === "subtract" ? -1 : 1;
    date.setDate(date.getDate() + direction * days);
    return formatIsoDate(date);
  }

  if (config.mode === "relationship") {
    const key = input.replace(/\s+/g, "");
    return relationshipResults[key] || "暂未匹配";
  }

  if (config.mode === "uppercase") return formatChineseUpperAmount(input);

  return "暂未支持";
};

const evaluateConverterExpression = (rawExpression: string) => {
  const normalizedExpression = rawExpression
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/\s+/g, "");
  if (!normalizedExpression) return 0;

  const tokens = normalizedExpression.match(/\d+(?:\.\d+)?|[+\-*/()]/g);
  if (!tokens?.length || tokens.join("") !== normalizedExpression) {
    return Number.NaN;
  }

  const values: number[] = [];
  const operators: string[] = [];
  const precedence = (operator: string) =>
    operator === "*" || operator === "/" ? 2 : 1;
  const applyTopOperator = (): boolean => {
    const operator = operators.pop();
    const right = values.pop();
    const left = values.pop();
    if (operator === undefined || right === undefined || left === undefined) {
      return false;
    }
    if (operator === "+") values.push(left + right);
    if (operator === "-") values.push(left - right);
    if (operator === "*") values.push(left * right);
    if (operator === "/") values.push(right === 0 ? Number.NaN : left / right);
    return true;
  };

  let expectingValue = true;
  for (const token of tokens) {
    if (/^\d/.test(token)) {
      if (!expectingValue) return Number.NaN;
      values.push(Number(token));
      expectingValue = false;
      continue;
    }

    if (token === "(") {
      if (!expectingValue) return Number.NaN;
      operators.push(token);
      continue;
    }

    if (token === ")") {
      if (expectingValue) return Number.NaN;
      while (operators.length && operators[operators.length - 1] !== "(") {
        if (!applyTopOperator()) return Number.NaN;
      }
      if (operators.pop() !== "(") return Number.NaN;
      expectingValue = false;
      continue;
    }

    if (expectingValue) return Number.NaN;
    while (
      operators.length &&
      operators[operators.length - 1] !== "(" &&
      precedence(operators[operators.length - 1]!) >= precedence(token)
    ) {
      if (!applyTopOperator()) return Number.NaN;
    }
    operators.push(token);
    expectingValue = true;
  }

  if (expectingValue) return Number.NaN;

  while (operators.length) {
    if (operators[operators.length - 1] === "(") return Number.NaN;
    if (!applyTopOperator()) return Number.NaN;
  }

  return values.length === 1 ? values[0]! : Number.NaN;
};

const converterClearButtonText = computed(() =>
  converterDisplay.value === "" ||
  (converterDisplayMode.value === "result" && converterExpression.value)
    ? "AC"
    : "",
);

const clearConverterCalculatorInput = () => {
  converterDisplay.value = "";
  converterExpression.value = "";
  converterDisplayMode.value = "input";
};

const appendConverterInput = (text: string) => {
  if (converterDisplayMode.value === "result") {
    converterDisplay.value = text;
    converterExpression.value = "";
    converterDisplayMode.value = "input";
    return;
  }

  converterDisplay.value =
    converterDisplay.value === "0" && /^\d$/.test(text)
      ? text
      : `${converterDisplay.value}${text}`;
};

const getConverterCurrentNumber = () =>
  converterDisplay.value.split(/[+\-×÷()]/).pop() || "";

const formatCalculatorUppercaseDisplay = (input: string) => {
  const amount = parseConverterNumber(input);
  if (!Number.isFinite(amount) || amount < 0) return "Error";
  return convertIntegerToChineseUpper(Math.floor(amount));
};

const appendConverterParenthesis = () => {
  const expression =
    converterDisplayMode.value === "result" ? "" : converterDisplay.value;
  const openCount = (expression.match(/\(/g) || []).length;
  const closeCount = (expression.match(/\)/g) || []).length;
  const nextParenthesis =
    openCount > closeCount && !/[+\-×÷(]$/.test(expression) ? ")" : "(";

  if (
    converterDisplayMode.value === "result" ||
    converterDisplay.value === "0"
  ) {
    converterDisplay.value = nextParenthesis;
    converterExpression.value = "";
    converterDisplayMode.value = "input";
    return;
  }

  converterDisplay.value = `${converterDisplay.value}${nextParenthesis}`;
};

const handleConverterKey = (label: string) => {
  if (/^\d$/.test(label)) {
    appendConverterInput(label);
    return;
  }

  if (label === ".") {
    if (converterDisplayMode.value === "result") {
      converterDisplay.value = "0.";
      converterExpression.value = "";
      converterDisplayMode.value = "input";
      return;
    }
    const currentNumber = getConverterCurrentNumber();
    if (!currentNumber.includes(".")) {
      converterDisplay.value = converterDisplay.value
        ? `${converterDisplay.value}.`
        : ".";
    }
    return;
  }

  if (label === "⌫") {
    if (converterClearButtonText.value === "AC") {
      clearConverterCalculatorInput();
      return;
    }
    if (converterDisplayMode.value === "result" && converterExpression.value) {
      clearConverterCalculatorInput();
      return;
    }
    converterDisplay.value = converterDisplay.value.slice(0, -1);
    if (!converterDisplay.value) converterDisplayMode.value = "input";
    return;
  }

  if (label === "%") {
    appendConverterInput("%");
    return;
  }

  if (label === "()") {
    appendConverterParenthesis();
    return;
  }

  if (label === "大写") {
    converterDisplay.value = formatCalculatorUppercaseDisplay(
      converterDisplay.value,
    );
    converterExpression.value = "";
    converterDisplayMode.value = "result";
    return;
  }

  if (["+", "-", "×", "÷"].includes(label)) {
    if (converterDisplayMode.value === "result") {
      converterDisplayMode.value = "input";
      converterExpression.value = "";
    }
    if (!converterDisplay.value || /[+\-×÷(]$/.test(converterDisplay.value)) {
      return;
    }
    converterDisplay.value = /[+\-×÷]$/.test(converterDisplay.value)
      ? `${converterDisplay.value.slice(0, -1)}${label}`
      : `${converterDisplay.value}${label}`;
    return;
  }

  if (label === "=") {
    const expression = converterDisplay.value;
    const result = formatConverterResult(
      evaluateConverterExpression(expression),
    );
    converterDisplay.value = result;
    converterExpression.value = expression;
    converterDisplayMode.value = "result";
  }
};

const visibleWidgets = computed(() =>
  activeGroup.value === "主页" ? widgets : programmingWidgets,
);
const allWidgets = computed(() => [...widgets, ...programmingWidgets]);
const hourText = computed(() => String(now.value.getHours()).padStart(2, "0"));
const minuteText = computed(() =>
  String(now.value.getMinutes()).padStart(2, "0"),
);
const secondText = computed(() =>
  String(now.value.getSeconds()).padStart(2, "0"),
);
const dateText = computed(() => "5月21日　星期四　四月初五");
const clockShortDateText = computed(
  () =>
    `${String(now.value.getMonth() + 1).padStart(2, "0")}/${String(now.value.getDate()).padStart(2, "0")}`,
);
const clockShortWeekdayText = computed(
  () =>
    ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][
      now.value.getDay()
    ],
);
const clockOuterDateText = computed(
  () => `${clockShortDateText.value} ${clockShortWeekdayText.value}`,
);
const clockDigitText = computed(() =>
  clockSecondsEnabled.value
    ? `${hourText.value}${minuteText.value}${secondText.value}`
    : `${hourText.value}${minuteText.value}`,
);
const clockFlipDigits = computed(() => clockDigitText.value.split(""));
const offworkDayMs = 24 * 60 * 60 * 1000;
const offworkWorkStartHour = 9;
const offworkWorkEndHour = 18;
const offworkPaydayDayOfMonth = 10;
const offworkDailyIncome = 1000;
const offworkPresetWorkdays = new Set([1, 2, 3, 4, 5]);
const offworkSelectedWorkdayValues = ref<number[]>([8]);
const offworkMoreOptionValues = ref(["payday", "friday", "holiday", "income"]);
const offworkBackgroundMode = ref<"color" | "image">("color");
const offworkPreviewSize = ref<WidgetSize>("2x4");
const offworkTitle = ref("下班倒计时");
const offworkWorkStart = ref("09:00");
const offworkWorkEnd = ref("18:00");
const offworkPaydayDay = ref(offworkPaydayDayOfMonth);
const offworkDailyIncomeInput = ref(offworkDailyIncome);
const offworkWeekdayOptions = [
  { label: "周一", value: 1 },
  { label: "周二", value: 2 },
  { label: "周三", value: 3 },
  { label: "周四", value: 4 },
  { label: "周五", value: 5 },
  { label: "周六", value: 6 },
  { label: "周日", value: 0 },
  { label: "工作日", value: 8 },
];
const offworkMoreOptions = [
  { label: "发薪日", value: "payday" },
  { label: "距离周五", value: "friday" },
  { label: "下一个节日", value: "holiday" },
  { label: "今天收入", value: "income" },
] as const;
const offworkPreviewSizes: WidgetSize[] = ["1x1", "1x2", "2x1", "2x2", "2x4"];

const offworkParseTime = (value: string, fallbackHour: number) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return { hour: fallbackHour, minute: 0 };
  const hour = Math.max(0, Math.min(23, Number(match[1])));
  const minute = Math.max(0, Math.min(59, Number(match[2])));
  return { hour, minute };
};

const offworkStartTime = computed(() =>
  offworkParseTime(offworkWorkStart.value, offworkWorkStartHour),
);
const offworkEndTime = computed(() =>
  offworkParseTime(offworkWorkEnd.value, offworkWorkEndHour),
);
const offworkEffectiveWorkdays = computed(() => {
  if (offworkSelectedWorkdayValues.value.includes(8)) {
    return offworkPresetWorkdays;
  }
  return new Set(
    offworkSelectedWorkdayValues.value.filter(
      (value) => value >= 0 && value < 7,
    ),
  );
});
const offworkToggleWorkday = (value: number) => {
  if (value === 8) {
    offworkSelectedWorkdayValues.value = [8];
    return;
  }
  const next = new Set(
    offworkSelectedWorkdayValues.value.filter((item) => item !== 8),
  );
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  offworkSelectedWorkdayValues.value = [...next];
};
const offworkIsWorkdayOptionActive = (value: number) =>
  offworkSelectedWorkdayValues.value.includes(value);
const offworkToggleMoreOption = (value: string) => {
  const next = new Set(offworkMoreOptionValues.value);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  offworkMoreOptionValues.value = [...next];
};
const offworkIsMoreOptionActive = (value: string) =>
  offworkMoreOptionValues.value.includes(value);
const commitOffworkCountdownEdit = () => {
  closePanels();
};

const offworkStartOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const offworkDayDiff = (from: Date, to: Date) =>
  Math.max(
    0,
    Math.round(
      (offworkStartOfDay(to).getTime() - offworkStartOfDay(from).getTime()) /
        offworkDayMs,
    ),
  );

const offworkDaysUntilMonthlyDay = (date: Date, dayOfMonth: number) => {
  const today = offworkStartOfDay(date);
  let target = new Date(date.getFullYear(), date.getMonth(), dayOfMonth);
  if (target < today) {
    target = new Date(date.getFullYear(), date.getMonth() + 1, dayOfMonth);
  }
  return offworkDayDiff(today, target);
};

const offworkDaysUntilAnnualDay = (
  date: Date,
  monthIndex: number,
  dayOfMonth: number,
) => {
  const today = offworkStartOfDay(date);
  let target = new Date(date.getFullYear(), monthIndex, dayOfMonth);
  if (target < today) {
    target = new Date(date.getFullYear() + 1, monthIndex, dayOfMonth);
  }
  return offworkDayDiff(today, target);
};

const offworkDaysUntilFriday = (date: Date) => {
  const rawDiff = (5 - date.getDay() + 7) % 7 || 7;
  return Math.max(0, rawDiff - 1);
};

const offworkWorkStartDate = computed(
  () =>
    new Date(
      now.value.getFullYear(),
      now.value.getMonth(),
      now.value.getDate(),
      offworkStartTime.value.hour,
      offworkStartTime.value.minute,
      0,
    ),
);
const offworkWorkEndDate = computed(
  () =>
    new Date(
      now.value.getFullYear(),
      now.value.getMonth(),
      now.value.getDate(),
      offworkEndTime.value.hour,
      offworkEndTime.value.minute,
      0,
    ),
);
const offworkIsWorkingNow = computed(() => {
  const current = now.value;
  return (
    offworkEffectiveWorkdays.value.has(current.getDay()) &&
    current >= offworkWorkStartDate.value &&
    current < offworkWorkEndDate.value
  );
});
const offworkRemainingTimeText = computed(() => {
  if (!offworkIsWorkingNow.value) return "";
  const remainingSeconds = Math.max(
    0,
    Math.floor(
      (offworkWorkEndDate.value.getTime() - now.value.getTime()) / 1000,
    ),
  );
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  return [hours, minutes, seconds]
    .map((item) => String(item).padStart(2, "0"))
    .join(":");
});
const offworkStatusText = computed(() =>
  offworkIsWorkingNow.value ? "下班还有" : "休息时间",
);
const offworkPrimaryText = computed(
  () => offworkRemainingTimeText.value || offworkStatusText.value,
);
const offworkEarnedToday = computed(() => {
  const current = now.value;
  if (!offworkEffectiveWorkdays.value.has(current.getDay())) return "0.000";
  const start = offworkWorkStartDate.value.getTime();
  const end = offworkWorkEndDate.value.getTime();
  const progress = Math.min(
    1,
    Math.max(0, (current.getTime() - start) / (end - start)),
  );
  return (offworkDailyIncomeInput.value * progress).toFixed(3);
});
const offworkCountdownMetrics = computed<OffworkCountdownMetric[]>(() =>
  [
    {
      key: "payday",
      label: "发薪",
      value: `${offworkDaysUntilMonthlyDay(now.value, offworkPaydayDay.value)}`,
      suffix: "天",
    },
    {
      key: "friday",
      label: "周五",
      value: `${offworkDaysUntilFriday(now.value)}`,
      suffix: "天",
    },
    {
      key: "holiday",
      label: "儿童节",
      value: `${offworkDaysUntilAnnualDay(now.value, 5, 1)}`,
      suffix: "天",
    },
    {
      key: "income",
      label: "今天赚了",
      value: offworkEarnedToday.value,
      suffix: "¥",
    },
  ].filter((metric) => offworkMoreOptionValues.value.includes(metric.key)),
);
const offworkCountdownCardStyle = computed<Record<string, string>>(() => ({
  "--countdown-bg-color": "#ffffff",
  "--countdown-text-color": "#666666",
  "--countdown-sub-text-color": "#666666cf",
  "--countdown-mask-bg": "rgba(0, 0, 0, 0)",
  "--countdown-font-family":
    '"HarmonyOS_Sans", "HarmonyOS Sans", "PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "--countdown-font-weight": "400",
  "--countdown-status-image": `url("${offworkIsWorkingNow.value ? sourceAssets.countdownOnwork : sourceAssets.countdown}")`,
}));
const selectedWidget = computed(() =>
  allWidgets.value.find((item) => item.id === widgetMenu.widgetId),
);
const widgetSizeMenuOptions = computed(() =>
  selectedWidget.value
    ? createItabReplicaSizeMenuOptions(
        selectedWidget.value.kind,
        selectedWidget.value.size,
      )
    : sizeOptions.map((size) => ({ size, enabled: false, active: false })),
);
const openedWidget = computed(() =>
  allWidgets.value.find((item) => item.id === openedWidgetId.value),
);
const eatTodayDisplayItem = computed(() =>
  eatTodayRunning.value
    ? eatTodayAnimatedItem.value
    : eatTodaySelectedItem.value,
);
const eatTodayOuterButtonText = computed(() => {
  if (eatTodayRunning.value) return eatTodayAnimatedItem.value || "选择中";
  return eatTodaySelectedItem.value || "开始";
});
const eatTodayOpenedTitle = computed(
  () => eatTodayDisplayItem.value || "今天吃什么",
);
const eatTodayOpenedStartText = computed(() => {
  if (eatTodayRunning.value) return "选择中";
  return eatTodaySelectedItem.value ? "换一个" : "开始";
});
const activeConverterTool = computed(
  () =>
    converterTools.find(
      (tool) => tool.label === activeConverterToolLabel.value,
    ) || converterTools[0]!,
);
const activeConverterToolConfig = computed(
  () =>
    converterToolConfigs[
      activeConverterToolLabel.value as keyof typeof converterToolConfigs
    ] || converterToolConfigs["长度单位"],
);
const activeConverterToolState = computed(
  () =>
    converterToolStates[activeConverterToolConfig.value.label] ||
    converterToolStates["长度单位"],
);
const activeConverterSourceUnitPanel = computed(
  () => converterSourceUnitPanels[activeConverterToolConfig.value.label],
);
const activeConverterSourceUnitCards = computed(() => {
  const panel = activeConverterSourceUnitPanel.value;
  if (!panel) return [];
  return panel.cards.map((card) => ({
    ...card,
    displayValue: formatSourceUnitCardValue(
      panel,
      card,
      activeConverterToolState.value.input,
      activeConverterToolConfig.value.label,
    ),
  }));
});
const activeConverterToolResult = computed(() =>
  calculateConverterToolResult(
    activeConverterToolConfig.value,
    activeConverterToolState.value,
  ),
);
const hasPanelOpen = computed(
  () => showAddModal.value || Boolean(openedWidget.value),
);
const poemPreview = ITAB_POEM_FALLBACK_ENTRIES[0]!;
const movieCalendarRatingText = computed(() =>
  movieCalendar.value.rating && movieCalendar.value.rating !== "--"
    ? `豆瓣 ${movieCalendar.value.rating}`
    : "豆瓣 --",
);
const movieCalendarMetaText = computed(() =>
  [
    movieCalendar.value.genres.join("/"),
    movieCalendar.value.year,
    movieCalendar.value.area,
  ]
    .filter(Boolean)
    .join(""),
);
const movieCalendarDirectorText = computed(() =>
  movieCalendar.value.director ? `导演：${movieCalendar.value.director}` : "",
);
const movieCalendarIntroText = computed(
  () => movieCalendar.value.intro || movieCalendar.value.quote,
);
const activeTomatoTheme = computed(
  () => tomatoThemes[activeTomatoThemeIndex.value] || tomatoThemes[0],
);
const activeTomatoAudioUrl = computed(() => activeTomatoTheme.value.audio);

const daysInAnniversaryMonth = (year: number, month: number) =>
  new Date(year, month, 0).getDate();

const parseAnniversaryDateParts = (value: string) => {
  const [rawYear, rawMonth, rawDay] = value
    .split("-")
    .map((item) => Number(item));
  const year = Number.isFinite(rawYear)
    ? Math.min(
        Math.max(rawYear, anniversaryYearOptions[0]!),
        anniversaryYearOptions[anniversaryYearOptions.length - 1]!,
      )
    : anniversaryToday.getFullYear();
  const month = Number.isFinite(rawMonth)
    ? Math.min(Math.max(rawMonth, 1), 12)
    : anniversaryToday.getMonth() + 1;
  const maxDay = daysInAnniversaryMonth(year, month);
  const day = Number.isFinite(rawDay)
    ? Math.min(Math.max(rawDay, 1), maxDay)
    : anniversaryToday.getDate();

  return { year, month, day };
};

const formatAnniversaryDateParts = (year: number, month: number, day: number) =>
  `${year}-${month}-${day}`;

const activeAnniversaryTemplate = computed(
  () =>
    anniversaryTemplates.find(
      (item) => item.id === activeAnniversaryTemplateId.value,
    ) || anniversaryTemplates[0]!,
);
const anniversaryTemplateList = computed(() =>
  anniversaryTemplates.filter((item) =>
    ["life", "payday", "love"].includes(item.id),
  ),
);
const anniversaryCarouselDots = computed(() =>
  anniversaryPreviewSizes.map((_, index) => index),
);
const anniversaryEditorTemplate = computed<AnniversaryTemplate>(() => ({
  id: activeAnniversaryTemplateId.value || "editor",
  title: anniversaryEditor.title,
  label: anniversaryEditor.label,
  eventName: anniversaryEditor.eventName,
  date: anniversaryEditor.date,
  mode: anniversaryEditor.mode,
  repeat: anniversaryEditor.repeat,
  size: anniversaryEditor.size,
  textColor: anniversaryEditor.textColor,
  backgroundColor: anniversaryEditor.backgroundColor,
  backgroundImage: anniversaryEditor.backgroundImage,
  backgroundMode: anniversaryEditor.backgroundMode,
  mask: anniversaryEditor.mask,
}));
const anniversaryPreviewTemplate = computed<AnniversaryTemplate>(() =>
  anniversaryTemplateWithSize(
    anniversaryEditorTemplate.value,
    activeAnniversaryPreviewSize.value,
  ),
);
const anniversaryPreviewItems = computed(() => {
  const template = anniversaryPreviewTemplate.value;
  return [
    {
      key: `current-${template.id}-${template.size}`,
      placement: "current",
      template,
    },
  ];
});
const anniversaryPreviewStyle = computed(() =>
  anniversaryTemplateStyle(anniversaryPreviewTemplate.value),
);
const anniversaryMaskPercent = computed(() =>
  Math.max(0, Math.min(100, Number(anniversaryEditor.mask) || 0)),
);
const anniversaryDateParts = computed(() =>
  parseAnniversaryDateParts(anniversaryEditor.date),
);
const anniversaryDatePickerStyle = computed(() => ({
  top: `${anniversaryDatePickerPosition.top}px`,
  left: `${anniversaryDatePickerPosition.left}px`,
}));
const anniversaryDayOptions = computed(() => {
  const { year, month } = anniversaryDateParts.value;
  return Array.from(
    { length: daysInAnniversaryMonth(year, month) },
    (_, index) => index + 1,
  );
});
const anniversaryWheelWindow = (
  options: number[],
  selected: number,
  keyPrefix: string,
) => {
  const selectedIndex = Math.max(0, options.indexOf(selected));
  return Array.from({ length: 7 }, (_, index) => {
    const option = options[selectedIndex - 3 + index] ?? null;
    return {
      key:
        option === null
          ? `${keyPrefix}-empty-${index}`
          : `${keyPrefix}-${option}`,
      value: option,
    };
  });
};
const visibleAnniversaryYearOptions = computed(() =>
  anniversaryWheelWindow(
    anniversaryYearOptions,
    anniversaryDateParts.value.year,
    "year",
  ),
);
const visibleAnniversaryMonthOptions = computed(() =>
  anniversaryWheelWindow(
    anniversaryMonthOptions,
    anniversaryDateParts.value.month,
    "month",
  ),
);
const visibleAnniversaryDayOptions = computed(() =>
  anniversaryWheelWindow(
    anniversaryDayOptions.value,
    anniversaryDateParts.value.day,
    "day",
  ),
);
const tomatoElapsedSeconds = computed(() => {
  if (!tomatoRunning.value || tomatoStartedAtMs.value === null) {
    return tomatoElapsedBaseSeconds.value;
  }
  const liveElapsed = Math.floor(
    (tomatoTickNowMs.value - tomatoStartedAtMs.value) / 1000,
  );
  return Math.min(
    tomatoDurationSeconds.value,
    tomatoElapsedBaseSeconds.value + Math.max(0, liveElapsed),
  );
});
const tomatoRemainingSeconds = computed(() =>
  Math.max(0, tomatoDurationSeconds.value - tomatoElapsedSeconds.value),
);
const tomatoCountdownSeconds = computed(() => tomatoRemainingSeconds.value);
const tomatoDisplayText = computed(() =>
  formatTomatoTime(tomatoCountdownSeconds.value),
);
const tomatoProgressCenterX = 224.198;
const tomatoProgressCenterY = 224.772;
const tomatoProgressRadius = 213.005;
const tomatoProgressCircumference = 1338;
const tomatoProgressDashArray = `${tomatoProgressCircumference}, ${tomatoProgressCircumference}`;
const tomatoProgressTransform = `rotate(-90 ${tomatoProgressCenterX} ${tomatoProgressCenterY})`;
const tomatoProgressRatio = computed(() =>
  tomatoDurationSeconds.value > 0 && tomatoPhase.value === "focus"
    ? Math.min(1, tomatoElapsedSeconds.value / tomatoDurationSeconds.value)
    : 0,
);
const tomatoProgressDashOffset = computed(() =>
  Number(
    (tomatoProgressCircumference * (1 - tomatoProgressRatio.value)).toFixed(3),
  ),
);
const tomatoProgressValue = computed(() =>
  tomatoProgressRatio.value.toFixed(4),
);
const tomatoPrimaryControlState = computed(() =>
  tomatoRunning.value ? "pause" : "play",
);
const tomatoPrimaryControlLabel = computed(() =>
  tomatoRunning.value
    ? "暂停"
    : tomatoPhase.value === "focus" && tomatoElapsedSeconds.value > 0
      ? "继续"
      : "开始",
);
const tomatoSecondaryControlVisible = computed(
  () => tomatoRunning.value || tomatoPhase.value === "focus",
);
const tomatoAudioIconState = computed(() =>
  tomatoAudioEnabled.value ? "sound" : "muted",
);
const calendarWeekdays = computed(() =>
  calendarWeekStartsMonday.value
    ? ["一", "二", "三", "四", "五", "六", "日"]
    : ["日", "一", "二", "三", "四", "五", "六"],
);
const visibleCalendarCells = computed(() =>
  generateCalendarMonth(
    displayedCalendarYear.value,
    displayedCalendarMonth.value,
    calendarWeekStartsMonday.value,
  ),
);
const calendarOuterMonthCells = computed(() =>
  generateCalendarMonth(2026, 5, true),
);
const calendarYearTitle = computed(() => String(displayedCalendarYear.value));
const calendarMonthTitle = computed(() =>
  String(displayedCalendarMonth.value).padStart(2, "0"),
);
const selectedCalendarDetail = computed<CalendarDetail>(() => {
  const known = calendarDetails[selectedCalendarKey.value];
  if (known) return known;

  const [year, month, day] = selectedCalendarKey.value.split("-").map(Number);
  const cell = visibleCalendarCells.value.find(
    (item) => item.dateKey === selectedCalendarKey.value,
  );
  const date = new Date(year, month - 1, day);
  const lunar = Lunar.fromDate(date);
  const solar = Solar.fromDate(date);
  const festival = getDetailFestival(solar, lunar, cell);
  const weekDay = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][
    date.getDay()
  ];
  const dayOfYear =
    Math.floor((date.getTime() - new Date(year, 0, 1).getTime()) / 86400000) +
    1;

  return {
    dateLabel: `${selectedCalendarKey.value} ${weekDay}`,
    day: String(day),
    lunarDate: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    yearLabel: `${lunar.getYearInGanZhi()}(${lunar.getYearShengXiao()})年`,
    weekText: `本年第${Math.ceil(dayOfYear / 7)}周， 第${dayOfYear}天`,
    zodiac: lunar.getYearShengXiao(),
    constellation: formatConstellation(solar.getXingZuo()),
    festival,
    yi: lunar.getDayYi().join("，"),
    ji: lunar.getDayJi().join("，"),
    moon: `${lunar.getYueXiang()}月`,
    phenology: lunar.getHou().replace(/^[^ ]+ /, ""),
    directions: [
      `喜神方位：${lunar.getPositionXiDesc()}`,
      `阳贵神方位：${lunar.getPositionYangGuiDesc()}`,
      `阴贵神方位：${lunar.getPositionYinGuiDesc()}`,
      `福神方位：${lunar.getPositionFuDesc()}`,
      `财神方位：${lunar.getPositionCaiDesc()}`,
    ],
  };
});
const calendarInfoRows = computed(() => [
  { type: "生肖", value: selectedCalendarDetail.value.zodiac, tone: "red" },
  {
    type: "星座",
    value: selectedCalendarDetail.value.constellation,
    tone: "pink",
  },
  { type: "节日", value: selectedCalendarDetail.value.festival, tone: "blue" },
]);
const unfinishedTodoTasks = computed(() =>
  todoTasks.filter((task) => !task.done),
);
const completedTodoTasks = computed(() =>
  todoTasks.filter((task) => task.done),
);
const todoOuterRows = computed(() => unfinishedTodoTasks.value.slice(0, 4));
const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const formatConstellation = (name: string) => {
  const symbols: Record<string, string> = {
    白羊: "♈",
    金牛: "♉",
    双子: "♊",
    巨蟹: "♋",
    狮子: "♌",
    处女: "♍",
    天秤: "♎",
    天蝎: "♏",
    射手: "♐",
    摩羯: "♑",
    水瓶: "♒",
    双鱼: "♓",
  };
  return `${name}座 ${symbols[name] || ""}`.trim();
};

const getCalendarHoliday = (year: number, month: number, day: number) => {
  try {
    return HolidayUtil.getHoliday(year, month, day);
  } catch {
    return null;
  }
};

const getCalendarCellLabel = (date: Date) => {
  const lunar = Lunar.fromDate(date);
  const solar = Solar.fromDate(date);
  const solarFestival = solar.getFestivals()[0];
  if (solarFestival) return { label: solarFestival, lunar };

  const lunarFestival = lunar.getFestivals()[0];
  if (lunarFestival) return { label: lunarFestival, lunar };

  const jieQi = lunar.getJieQi();
  if (jieQi) return { label: jieQi, lunar };

  const lunarDay = lunar.getDayInChinese();
  return {
    label: lunarDay === "初一" ? `${lunar.getMonthInChinese()}月` : lunarDay,
    lunar,
  };
};

const getDetailFestival = (
  solar: ReturnType<typeof Solar.fromDate>,
  lunar: ReturnType<typeof Lunar.fromDate>,
  cell?: CalendarCell,
) =>
  solar.getFestivals()[0] ||
  lunar.getFestivals()[0] ||
  solar.getOtherFestivals()[0] ||
  lunar.getJieQi() ||
  cell?.label ||
  "无";

const createCalendarCell = (
  date: Date,
  displayedYear: number,
  displayedMonth: number,
): CalendarCell => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const currentMonth = year === displayedYear && month === displayedMonth;
  const holiday = getCalendarHoliday(year, month, day);
  const { label } = getCalendarCellLabel(date);
  const isHoliday = Boolean(holiday && !holiday.isWork());
  const isWorkday = Boolean(holiday && holiday.isWork());

  return {
    dateKey: formatDateKey(date),
    day: String(day).padStart(2, "0"),
    lunar: label,
    muted: !currentMonth,
    weekend: date.getDay() === 0 || date.getDay() === 6,
    holiday: isHoliday,
    workday: isWorkday,
    tag: isHoliday ? "休" : isWorkday ? "班" : undefined,
    label: /节|小满|立夏|芒种|清明|谷雨|全国助残日/.test(label)
      ? label
      : undefined,
    currentMonth,
  };
};

const generateCalendarMonth = (
  year: number,
  month: number,
  weekStartsMonday: boolean,
) => {
  const first = new Date(year, month - 1, 1);
  const leadingOffset = weekStartsMonday
    ? (first.getDay() + 6) % 7
    : first.getDay();
  const start = new Date(year, month - 1, 1 - leadingOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return createCalendarCell(date, year, month);
  });
};

const calendarDateKeyForCell = (cell: CalendarCell) => cell.dateKey;

const isCalendarTodayCell = (cell: CalendarCell) =>
  calendarDateKeyForCell(cell) === "2026-05-21";

const isCalendarCellSelected = (cell: CalendarCell) =>
  calendarDateKeyForCell(cell) === selectedCalendarKey.value;

const selectCalendarCell = (cell: CalendarCell) => {
  selectedCalendarKey.value = calendarDateKeyForCell(cell);
};

const resetCalendarToday = () => {
  displayedCalendarYear.value = 2026;
  displayedCalendarMonth.value = 5;
  selectedCalendarKey.value = "2026-05-21";
};

const toggleCalendarWeekStart = () => {
  calendarWeekStartsMonday.value = !calendarWeekStartsMonday.value;
};

const tomatoImageUrl = (path: string, size: WidgetSize | "opened") => {
  const dimensions =
    size === "opened"
      ? "w_1366,h_768"
      : {
          "1x1": "w_60,h_60",
          "1x2": "w_150,h_60",
          "2x1": "w_60,h_150",
          "2x2": "w_150,h_150",
          "2x4": "w_330,h_150",
        }[size];

  return `/itab/widget/tomato/${path}?x-oss-process=image/resize,limit_0,m_fill,${dimensions}/format,jpg`;
};

const formatTomatoTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
};

const tomatoOuterTime = (size: WidgetSize) =>
  size === "2x1"
    ? tomatoDisplayText.value.replace(":", " ")
    : tomatoDisplayText.value;

const tomatoTickPaths = [
  "M224.180 19.0649V51.1205",
  "M170.976 26.207L174.348 38.8209",
  "M121.418 46.8818L127.944 58.1905",
  "M78.8975 79.6802L88.1282 88.9109",
  "M46.3086 122.367L57.6173 128.893",
  "M25.8838 172.04L38.4977 175.413",
  "M19.0127 225.294H51.0683",
  "M26.1553 278.517L38.7692 275.144",
  "M46.8301 328.075L58.1387 321.548",
  "M79.6289 370.594L88.8596 361.363",
  "M122.315 403.184L128.842 391.875",
  "M171.987 423.608L175.36 410.994",
  "M224.72 434.717V402.661",
  "M278.465 423.337L275.092 410.723",
  "M328.022 402.661L321.496 391.353",
  "M370.541 369.863L361.311 360.632",
  "M403.132 327.176L391.823 320.65",
  "M423.556 277.504L410.942 274.131",
  "M433.328 224.772H401.272",
  "M423.285 171.027L410.671 174.4",
  "M402.609 121.469L391.301 127.995",
  "M369.811 78.9497L360.58 88.1804",
  "M327.124 46.3599L320.598 57.6685",
  "M277.452 25.9355L274.079 38.5495",
  "M201.789 20.3491L203.209 33.3181",
  "M149.663 33.2451L154.393 45.41",
  "M102.653 59.2041L110.37 69.7296",
  "M63.9561 96.4399L74.137 104.606",
  "M36.2207 142.416L48.1663 147.679",
  "M21.3213 194.01L34.2276 195.994",
  "M20.2979 247.702L33.2668 246.282",
  "M33.1934 299.829L45.3583 295.099",
  "M59.1514 346.839L69.6769 339.122",
  "M96.3877 385.536L104.553 375.355",
  "M142.364 413.27L147.627 401.325",
  "M193.958 428.171L195.942 415.265",
  "M247.651 429.195L246.23 416.226",
  "M299.777 416.298L295.047 404.133",
  "M346.787 390.339L339.07 379.814",
  "M385.485 353.104L375.304 344.938",
  "M413.219 307.128L401.273 301.865",
  "M428.119 255.534L415.213 253.55",
  "M429.143 201.841L416.174 203.261",
  "M416.247 149.715L404.082 154.445",
  "M390.288 102.705L379.763 110.422",
  "M353.052 64.0068L344.887 74.1878",
  "M307.076 36.2734L301.813 48.2191",
  "M255.482 21.3726L253.498 34.2788",
];

const parseAnniversaryDate = (value: string) => {
  const { year, month, day } = parseAnniversaryDateParts(value);
  return new Date(year, month - 1, day);
};

const nextMonthlyAnniversary = (date: Date) => {
  const targetDay = date.getDate();
  const candidate = new Date(
    anniversaryToday.getFullYear(),
    anniversaryToday.getMonth(),
    targetDay,
  );
  if (candidate.getTime() < anniversaryToday.getTime()) {
    candidate.setMonth(candidate.getMonth() + 1);
  }
  return candidate;
};

const nextYearlyAnniversary = (date: Date) => {
  const candidate = new Date(
    anniversaryToday.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  if (candidate.getTime() < anniversaryToday.getTime()) {
    candidate.setFullYear(candidate.getFullYear() + 1);
  }
  return candidate;
};

const nextWeeklyAnniversary = (date: Date) => {
  const candidate = new Date(anniversaryToday);
  const offset = (date.getDay() - anniversaryToday.getDay() + 7) % 7;
  candidate.setDate(anniversaryToday.getDate() + offset);
  return candidate;
};

const anniversaryRemainingTarget = (target: Date, repeat: string) => {
  if (repeat === "每月") return nextMonthlyAnniversary(target);
  if (repeat === "每年" || repeat === "节日")
    return nextYearlyAnniversary(target);
  if (repeat === "每周") return nextWeeklyAnniversary(target);
  return target;
};

const anniversaryDays = (
  date: string,
  mode: AnniversaryMode,
  repeat = "不重复",
) => {
  const target = parseAnniversaryDate(date);
  const effectiveTarget =
    mode === "remaining" ? anniversaryRemainingTarget(target, repeat) : target;
  const diff = Math.round(
    (anniversaryToday.getTime() - effectiveTarget.getTime()) / 86400000,
  );
  return Math.max(0, mode === "elapsed" ? diff : -diff);
};

const anniversaryOuterTemplate = (widget: WidgetItem): AnniversaryTemplate => {
  const base = anniversaryTemplates[0]!;
  if (widget.anniversaryTemplateId) {
    return (
      anniversaryTemplates.find(
        (item) => item.id === widget.anniversaryTemplateId,
      ) || base
    );
  }
  if (widget.kind !== "anniversary-day") return base;
  return anniversaryTemplates.find((item) => item.id === "plain-life") || base;
};

function anniversaryTemplateWithSize(
  template: AnniversaryTemplate,
  size: WidgetSize = anniversaryEditor.size,
): AnniversaryTemplate {
  return {
    ...template,
    size,
  };
}

const anniversaryDefaultFontStack =
  '"HarmonyOS Sans", "PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const anniversaryUsesCalendar = (template: AnniversaryTemplate) =>
  template.size === "2x4" &&
  (template.id === "life" || template.id === "plain-life");

const anniversaryOuterTemplateWithSize = (
  widget: WidgetItem,
): AnniversaryTemplate =>
  anniversaryTemplateWithSize(anniversaryOuterTemplate(widget), widget.size);

const anniversaryOuterUsesCalendar = (widget: WidgetItem) =>
  anniversaryUsesCalendar(anniversaryOuterTemplateWithSize(widget));

const anniversaryTemplateStyle = (
  template: AnniversaryTemplate,
): Record<string, string> => {
  const mask = Math.max(0, Math.min(100, Number(template.mask) || 0)) / 100;
  const imageLayer =
    template.backgroundMode === "image"
      ? `url("${template.backgroundImage || sourceAssets.anniversary}")`
      : "none";
  const maskLayer =
    template.backgroundMode === "image" && mask > 0
      ? `linear-gradient(rgba(0, 0, 0, ${mask * 0.32}), rgba(0, 0, 0, ${mask * 0.58}))`
      : "";

  return {
    "--anniversary-text": template.textColor,
    "--anniversary-bg": template.backgroundColor,
    "--anniversary-image": imageLayer,
    "--anniversary-background-image":
      maskLayer && imageLayer !== "none"
        ? `${maskLayer}, ${imageLayer}`
        : imageLayer,
    "--anniversary-font": anniversaryDefaultFontStack,
    "--anniversary-mask": `${mask}`,
  };
};

const anniversaryOuterStyle = (widget: WidgetItem): Record<string, string> =>
  anniversaryTemplateStyle(anniversaryOuterTemplate(widget));

const anniversaryTemplateThumbnail = (template: AnniversaryTemplate) =>
  template.id === "life"
    ? anniversaryTemplates.find((item) => item.id === "plain-life") || template
    : template;

const anniversaryTemplateThumbnailWithSize = (template: AnniversaryTemplate) =>
  anniversaryTemplateWithSize(
    anniversaryTemplateThumbnail(template),
    anniversaryEditor.size,
  );

const anniversaryTemplateThumbnailStyle = (template: AnniversaryTemplate) =>
  anniversaryTemplateStyle(anniversaryTemplateThumbnail(template));

const syncAnniversaryEditor = (
  template: AnniversaryTemplate,
  widgetTitle?: string,
  options: { preserveSize?: boolean } = {},
) => {
  const currentSize = anniversaryEditor.size;
  const templateEditorSize = anniversaryEditorSizes.includes(
    template.size as Extract<WidgetSize, "2x2" | "2x4">,
  )
    ? (template.size as Extract<WidgetSize, "2x2" | "2x4">)
    : "2x2";
  activeAnniversaryTemplateId.value = template.id;
  anniversaryEditor.title = widgetTitle || template.title;
  anniversaryEditor.label = template.label;
  anniversaryEditor.eventName = template.eventName;
  anniversaryEditor.date = template.date;
  anniversaryEditor.mode = template.mode;
  anniversaryEditor.repeat = template.repeat;
  anniversaryEditor.size = options.preserveSize
    ? currentSize
    : templateEditorSize;
  anniversaryEditor.textColor = template.textColor;
  anniversaryEditor.backgroundColor = template.backgroundColor;
  anniversaryEditor.backgroundImage =
    template.backgroundImage || defaultAnniversaryBackgroundImage;
  anniversaryEditor.backgroundMode = template.backgroundMode;
  anniversaryEditor.mask = template.mask;
  anniversaryEditor.showCommonEvents = false;
  anniversaryRepeatDropdownOpen.value = false;
  anniversaryDatePickerOpen.value = false;
  activeAnniversaryPreviewSize.value = anniversaryEditor.size;
};

const selectAnniversaryTemplate = (template: AnniversaryTemplate) => {
  syncAnniversaryEditor(template, undefined, { preserveSize: true });
};

const isAnniversaryTemplateActive = (template: AnniversaryTemplate) => {
  return (
    template.id === activeAnniversaryTemplateId.value ||
    (activeAnniversaryTemplateId.value === "plain-life" &&
      template.id === "life")
  );
};

const selectAnniversaryDot = (index: number) => {
  activeAnniversaryPreviewSize.value =
    anniversaryPreviewSizes[index % anniversaryPreviewSizes.length] || "2x2";
};

const shiftAnniversaryPreview = (direction: -1 | 1) => {
  const currentIndex = Math.max(
    0,
    anniversaryPreviewSizes.indexOf(activeAnniversaryPreviewSize.value),
  );
  const nextIndex =
    (currentIndex + direction + anniversaryPreviewSizes.length) %
    anniversaryPreviewSizes.length;
  activeAnniversaryPreviewSize.value =
    anniversaryPreviewSizes[nextIndex] || "2x2";
};

const isAnniversaryDotActive = (index: number) => {
  return (
    anniversaryPreviewSizes[index % anniversaryPreviewSizes.length] ===
    activeAnniversaryPreviewSize.value
  );
};

const selectAnniversaryEvent = (eventName: string) => {
  anniversaryEditor.eventName = eventName;
  anniversaryEditor.label = eventName;
  anniversaryEditor.showCommonEvents = false;
};

const setAnniversaryEditorSize = (size: Extract<WidgetSize, "2x2" | "2x4">) => {
  anniversaryEditor.size = size;
};

const toggleAnniversaryAside = () => {
  anniversaryAsideCollapsed.value = !anniversaryAsideCollapsed.value;
};

const closeAnniversaryFloatingControls = () => {
  anniversaryEditor.showCommonEvents = false;
  anniversaryRepeatDropdownOpen.value = false;
  anniversaryDatePickerOpen.value = false;
};

const handleAnniversaryOutsidePointerDown = (event: PointerEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    closeAnniversaryFloatingControls();
    return;
  }
  if (
    target.closest(
      ".anniversary-common-trigger,.anniversary-event-popover,.anniversary-date-trigger,.anniversary-date-popper,.anniversary-repeat-select",
    )
  ) {
    return;
  }
  closeAnniversaryFloatingControls();
};

const toggleAnniversaryRepeatDropdown = () => {
  anniversaryRepeatDropdownOpen.value = !anniversaryRepeatDropdownOpen.value;
  anniversaryEditor.showCommonEvents = false;
  anniversaryDatePickerOpen.value = false;
};

const selectAnniversaryRepeat = (option: string) => {
  anniversaryEditor.repeat = option;
  anniversaryRepeatDropdownOpen.value = false;
  anniversaryDatePickerOpen.value = false;
};

const toggleAnniversaryCommonEvents = () => {
  anniversaryEditor.showCommonEvents = !anniversaryEditor.showCommonEvents;
  anniversaryRepeatDropdownOpen.value = false;
  anniversaryDatePickerOpen.value = false;
};

const toggleAnniversaryDatePicker = () => {
  anniversaryEditor.showCommonEvents = false;
  anniversaryRepeatDropdownOpen.value = false;
  anniversaryDatePickerOpen.value = !anniversaryDatePickerOpen.value;
  if (anniversaryDatePickerOpen.value) {
    void nextTick(updateAnniversaryDatePickerPosition);
  }
};

const updateAnniversaryDatePickerPosition = () => {
  const trigger = anniversaryDateTriggerRef.value;
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  const pickerWidth = 324;
  const pickerHeight = 294;
  anniversaryDatePickerPosition.left = Math.min(
    window.innerWidth - pickerWidth - 16,
    Math.max(16, rect.left - 94),
  );
  anniversaryDatePickerPosition.top = Math.min(
    window.innerHeight - pickerHeight - 16,
    Math.max(16, rect.top - 337),
  );
};

const setAnniversaryDatePart = (
  part: "year" | "month" | "day",
  value: number,
) => {
  const current = anniversaryDateParts.value;
  const next = {
    year: part === "year" ? value : current.year,
    month: part === "month" ? value : current.month,
    day: part === "day" ? value : current.day,
  };
  next.day = Math.min(next.day, daysInAnniversaryMonth(next.year, next.month));
  anniversaryEditor.date = formatAnniversaryDateParts(
    next.year,
    next.month,
    next.day,
  );
};

const stepAnniversaryDatePart = (
  part: "year" | "month" | "day",
  direction: -1 | 1,
) => {
  const options =
    part === "year"
      ? anniversaryYearOptions
      : part === "month"
        ? anniversaryMonthOptions
        : anniversaryDayOptions.value;
  const current = anniversaryDateParts.value[part];
  const currentIndex = Math.max(0, options.indexOf(current));
  const next =
    options[
      Math.min(Math.max(currentIndex + direction, 0), options.length - 1)
    ];
  if (next !== undefined) {
    setAnniversaryDatePart(part, next);
  }
};

const handleAnniversaryDateWheel = (
  part: "year" | "month" | "day",
  event: WheelEvent,
) => {
  stepAnniversaryDatePart(part, event.deltaY > 0 ? 1 : -1);
};

const setAnniversaryTextColor = (color: string) => {
  anniversaryEditor.textColor = color;
};

const setAnniversaryBackgroundColor = (color: string) => {
  anniversaryEditor.backgroundColor = color;
  anniversaryEditor.backgroundMode = "color";
};

const setAnniversaryBackgroundMode = (mode: AnniversaryBackgroundMode) => {
  anniversaryEditor.backgroundMode = mode;
  if (mode === "image" && !anniversaryEditor.backgroundImage) {
    anniversaryEditor.backgroundImage = defaultAnniversaryBackgroundImage;
  }
};

const setAnniversaryBackgroundImage = (
  image: (typeof anniversaryBackgroundImages)[number],
) => {
  anniversaryEditor.backgroundImage = image.full;
  anniversaryEditor.backgroundMode = "image";
};

const isAnniversaryBackgroundImageActive = (
  image: (typeof anniversaryBackgroundImages)[number],
) =>
  anniversaryEditor.backgroundMode === "image" &&
  (anniversaryEditor.backgroundImage || defaultAnniversaryBackgroundImage) ===
    image.full;

const createAnniversaryTemplateFromEditor = (
  id: string,
): AnniversaryTemplate => ({
  id,
  title: anniversaryEditor.title.trim() || "纪念日",
  label:
    anniversaryEditor.eventName.trim() ||
    anniversaryEditor.label.trim() ||
    "你在世界已经",
  eventName: anniversaryEditor.eventName.trim() || "纪念日",
  date: anniversaryEditor.date || "1997-10-1",
  mode: anniversaryEditor.mode,
  repeat: anniversaryEditor.repeat,
  size: activeAnniversaryPreviewSize.value,
  textColor: anniversaryEditor.textColor,
  backgroundColor: anniversaryEditor.backgroundColor,
  backgroundImage: anniversaryEditor.backgroundImage,
  backgroundMode: anniversaryEditor.backgroundMode,
  mask: anniversaryEditor.mask,
});

const nextAnniversaryWidgetPosition = () => {
  const maxRow = widgets.reduce(
    (row, widget) => Math.max(row, widget.row + widgetSpan(widget.size).rows),
    1,
  );
  return { col: 1, row: maxRow + 1 };
};

const commitAnniversaryEdit = () => {
  const template = activeAnniversaryTemplate.value;
  template.title = anniversaryEditor.title.trim() || "纪念日";
  template.label =
    anniversaryEditor.eventName.trim() ||
    anniversaryEditor.label.trim() ||
    "你在世界已经";
  template.eventName = anniversaryEditor.eventName.trim() || "纪念日";
  template.date = anniversaryEditor.date || "1997-10-1";
  template.mode = anniversaryEditor.mode;
  template.repeat = anniversaryEditor.repeat;
  template.size = activeAnniversaryPreviewSize.value;
  template.textColor = anniversaryEditor.textColor;
  template.backgroundColor = anniversaryEditor.backgroundColor;
  template.backgroundImage = anniversaryEditor.backgroundImage;
  template.backgroundMode = anniversaryEditor.backgroundMode;
  template.mask = anniversaryEditor.mask;
  const widget = openedWidget.value;
  if (
    widget &&
    (widget.kind === "anniversary" || widget.kind === "anniversary-day")
  ) {
    widget.title = template.title;
    widget.size = activeAnniversaryPreviewSize.value;
    widget.anniversaryTemplateId = template.id;
  }
  closePanels();
  showToast("修改完成");
};

const addAnniversaryTemplate = () => {
  const id = `anniversary-${Date.now()}`;
  const template = createAnniversaryTemplateFromEditor(id);
  const position = nextAnniversaryWidgetPosition();
  anniversaryTemplates.push(template);
  activeAnniversaryTemplateId.value = template.id;
  widgets.push({
    id,
    kind: "anniversary-day",
    title: template.title,
    size: template.size,
    col: position.col,
    row: position.row,
    anniversaryTemplateId: template.id,
  });
  closePanels();
  showToast("添加【倒计时】成功");
};

const clampTomatoSeconds = (seconds: number) =>
  Math.min(
    tomatoDurationSeconds.value,
    Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0)),
  );

const tomatoPersistedState = () => ({
  duration: tomatoDurationSeconds.value,
  remainingSeconds: tomatoCountdownSeconds.value,
  elapsedSeconds: tomatoElapsedSeconds.value,
  phase: tomatoPhase.value,
  isRunning: tomatoRunning.value,
  sessions: tomatoSessions.value,
  themeIndex: activeTomatoThemeIndex.value,
  audioEnabled: tomatoAudioEnabled.value,
  updatedAt: Date.now(),
});

const persistTomatoState = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      tomatoTimerStorageKey,
      JSON.stringify(tomatoPersistedState()),
    );
  } catch {
    // Local storage can be unavailable in strict privacy modes; the timer still runs in memory.
  }
};

const clearTomatoTimer = () => {
  if (tomatoTimer) {
    window.clearInterval(tomatoTimer);
    tomatoTimer = null;
  }
};

const tomatoAudioAbsoluteUrl = (url: string) => {
  if (typeof window === "undefined") return url;
  return new URL(url, window.location.origin).href;
};

const ensureTomatoAudio = () => {
  if (typeof Audio === "undefined") return null;
  if (!tomatoAudioElement) {
    tomatoAudioElement = new Audio();
    tomatoAudioElement.loop = true;
    tomatoAudioElement.preload = "auto";
    tomatoAudioElement.volume = 0.72;
  }
  return tomatoAudioElement;
};

const syncTomatoAudioSource = () => {
  const audio = ensureTomatoAudio();
  if (!audio) return null;
  const nextSrc = activeTomatoAudioUrl.value;
  if (audio.src !== tomatoAudioAbsoluteUrl(nextSrc)) {
    audio.pause();
    audio.src = nextSrc;
    audio.loop = true;
    audio.preload = "auto";
    audio.load();
  }
  return audio;
};

const pauseTomatoAudio = (reset = false) => {
  tomatoAudioPlayToken += 1;
  if (!tomatoAudioElement) return;
  tomatoAudioElement.pause();
  if (reset) {
    try {
      tomatoAudioElement.currentTime = 0;
    } catch {
      // Some browsers prevent seeking before metadata is ready.
    }
  }
};

const playTomatoAudio = async () => {
  if (!tomatoAudioEnabled.value || !tomatoRunning.value) {
    pauseTomatoAudio();
    return;
  }
  const audio = syncTomatoAudioSource();
  if (!audio) return;
  const token = (tomatoAudioPlayToken += 1);
  try {
    await audio.play();
    if (token === tomatoAudioPlayToken) {
      tomatoAudioBlocked.value = false;
    }
  } catch {
    if (token === tomatoAudioPlayToken) {
      tomatoAudioBlocked.value = true;
    }
  }
};

const toggleTomatoAudio = () => {
  tomatoAudioEnabled.value = !tomatoAudioEnabled.value;
  tomatoAudioBlocked.value = false;
  if (tomatoAudioEnabled.value) {
    void playTomatoAudio();
  } else {
    pauseTomatoAudio();
  }
  persistTomatoState();
};

const completeTomatoSession = () => {
  tomatoElapsedBaseSeconds.value = tomatoDurationSeconds.value;
  tomatoStartedAtMs.value = null;
  tomatoRunning.value = false;
  tomatoPhase.value = "completed";
  tomatoSessions.value += 1;
  clearTomatoTimer();
  pauseTomatoAudio(true);
  persistTomatoState();
};

const syncTomatoTimerTick = () => {
  tomatoTickNowMs.value = Date.now();
  if (
    tomatoRunning.value &&
    tomatoElapsedSeconds.value >= tomatoDurationSeconds.value
  ) {
    completeTomatoSession();
    return;
  }
  persistTomatoState();
};

const startTomatoTicker = () => {
  clearTomatoTimer();
  tomatoTimer = window.setInterval(() => {
    syncTomatoTimerTick();
  }, 1000);
};

const startTomatoTimer = () => {
  tomatoElapsedBaseSeconds.value =
    tomatoElapsedSeconds.value >= tomatoDurationSeconds.value
      ? 0
      : tomatoElapsedSeconds.value;
  tomatoTickNowMs.value = Date.now();
  tomatoStartedAtMs.value = tomatoTickNowMs.value;
  tomatoPhase.value = "focus";
  tomatoRunning.value = true;
  startTomatoTicker();
  persistTomatoState();
  void playTomatoAudio();
};

const pauseTomatoTimer = () => {
  tomatoElapsedBaseSeconds.value = tomatoElapsedSeconds.value;
  tomatoStartedAtMs.value = null;
  tomatoRunning.value = false;
  clearTomatoTimer();
  pauseTomatoAudio();
  persistTomatoState();
};

const toggleTomatoTimer = () => {
  if (tomatoRunning.value) {
    pauseTomatoTimer();
    return;
  }
  startTomatoTimer();
};

const stopTomatoTimer = () => {
  tomatoElapsedBaseSeconds.value = 0;
  tomatoStartedAtMs.value = null;
  tomatoTickNowMs.value = Date.now();
  tomatoRunning.value = false;
  tomatoPhase.value = "idle";
  tomatoAudioBlocked.value = false;
  clearTomatoTimer();
  pauseTomatoAudio(true);
  persistTomatoState();
};

const switchTomatoTheme = (direction: -1 | 1) => {
  activeTomatoThemeIndex.value =
    (activeTomatoThemeIndex.value + direction + tomatoThemes.length) %
    tomatoThemes.length;
  if (tomatoRunning.value && tomatoAudioEnabled.value) {
    void playTomatoAudio();
  } else {
    syncTomatoAudioSource();
  }
  persistTomatoState();
};

const restoreTomatoState = () => {
  if (typeof window === "undefined") return;
  try {
    const rawState = window.localStorage.getItem(tomatoTimerStorageKey);
    if (!rawState) return;
    const saved = JSON.parse(rawState) as Partial<
      ReturnType<typeof tomatoPersistedState>
    >;
    const duration = Number(saved.duration);
    if (Number.isFinite(duration) && duration > 0) {
      tomatoDurationSeconds.value = Math.floor(duration);
    }
    const savedElapsed =
      typeof saved.elapsedSeconds === "number"
        ? saved.elapsedSeconds
        : tomatoDurationSeconds.value - Number(saved.remainingSeconds || 0);
    const elapsedSinceSave =
      saved.isRunning && typeof saved.updatedAt === "number"
        ? Math.max(0, Math.floor((Date.now() - saved.updatedAt) / 1000))
        : 0;
    tomatoElapsedBaseSeconds.value = clampTomatoSeconds(
      savedElapsed + elapsedSinceSave,
    );
    tomatoSessions.value = Math.max(0, Math.floor(Number(saved.sessions) || 0));
    if (typeof saved.audioEnabled === "boolean") {
      tomatoAudioEnabled.value = saved.audioEnabled;
    }
    if (
      typeof saved.themeIndex === "number" &&
      tomatoThemes[saved.themeIndex]
    ) {
      activeTomatoThemeIndex.value = saved.themeIndex;
    }
    tomatoPhase.value =
      saved.phase === "completed" || saved.phase === "focus"
        ? saved.phase
        : tomatoElapsedBaseSeconds.value > 0
          ? "focus"
          : "idle";

    if (
      saved.isRunning &&
      tomatoElapsedBaseSeconds.value < tomatoDurationSeconds.value
    ) {
      tomatoTickNowMs.value = Date.now();
      tomatoStartedAtMs.value = tomatoTickNowMs.value;
      tomatoRunning.value = true;
      tomatoPhase.value = "focus";
      startTomatoTicker();
      void playTomatoAudio();
    } else if (
      saved.isRunning &&
      tomatoElapsedBaseSeconds.value >= tomatoDurationSeconds.value
    ) {
      tomatoStartedAtMs.value = null;
      tomatoRunning.value = false;
      tomatoPhase.value = "completed";
      tomatoSessions.value += 1;
      pauseTomatoAudio(true);
    }
    persistTomatoState();
  } catch {
    tomatoElapsedBaseSeconds.value = 0;
    tomatoStartedAtMs.value = null;
    tomatoRunning.value = false;
    tomatoPhase.value = "idle";
  }
};

const shiftCalendarMonth = (direction: -1 | 1) => {
  const nextMonth = new Date(
    displayedCalendarYear.value,
    displayedCalendarMonth.value - 1 + direction,
    1,
  );
  displayedCalendarYear.value = nextMonth.getFullYear();
  displayedCalendarMonth.value = nextMonth.getMonth() + 1;
  selectedCalendarKey.value = formatDateKey(nextMonth);
};

const createTodoTask = () => {
  const title = todoDraft.value.trim();
  if (!title) return;
  todoTasks.unshift({
    id: `todo-${Date.now()}`,
    title,
    done: false,
  });
  todoDraft.value = "";
  scheduleTodoTextareaResize();
};

const toggleTodoTask = (task: TodoTask) => {
  task.done = !task.done;
  scheduleTodoTextareaResize();
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.map((item) => normalizeString(item)).filter(Boolean)
    : [];

const normalizeFiniteNumber = (value: unknown, fallback = 0) => {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;
  return Number.isFinite(number) ? number : fallback;
};

const parseDailyQuoteDateParts = (value: string) => {
  const match = normalizeString(value).match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(
    Number(year),
    Math.max(0, Number(month) - 1),
    Number(day),
  );
  return { year, month, day, parsed };
};

const dailyQuoteWeekdayLabel = (date: Date) => {
  const weekdays = [
    "星期日",
    "星期一",
    "星期二",
    "星期三",
    "星期四",
    "星期五",
    "星期六",
  ];
  return weekdays[date.getDay()] || "";
};

const normalizeDailyQuoteDateLabel = (value: string, historical = false) => {
  const parts = parseDailyQuoteDateParts(value);
  if (!parts) return dailyQuoteFallback.dateLabel;
  const weekday = dailyQuoteWeekdayLabel(parts.parsed);
  return historical
    ? `${parts.year}.${parts.month} ${weekday}`.trim()
    : `${parts.year}.${parts.month}.${parts.day} ${weekday}`.trim();
};

const normalizeDailyQuoteDayLabel = (value: string, historical = false) => {
  const parts = parseDailyQuoteDateParts(value);
  return historical && parts ? parts.day : normalizeDailyQuoteTimeLabel();
};

const normalizeDailyQuoteTimeLabel = (withSeconds = false) =>
  new Date().toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" as const } : {}),
  });

const getDailyQuoteTodayKey = () => {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const shiftDailyQuoteDate = (date: string, days: number): string | null => {
  const parts = parseDailyQuoteDateParts(date);
  if (!parts) return null;
  const shifted = new Date(parts.parsed);
  shifted.setDate(shifted.getDate() + days);
  const year = String(shifted.getFullYear());
  const month = String(shifted.getMonth() + 1).padStart(2, "0");
  const day = String(shifted.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const normalizeDailyQuoteResponse = (
  payload: unknown,
  historical = false,
): DailyQuoteEntry | null => {
  if (!isObjectRecord(payload)) return null;
  if (
    typeof payload.code === "number" &&
    payload.code !== 200 &&
    payload.code !== 0
  ) {
    return null;
  }

  const data = isObjectRecord(payload.data) ? payload.data : payload;
  const quote =
    normalizeString(data.content) ||
    normalizeString(data.quote) ||
    normalizeString(data.hitokoto);
  const picUrl =
    normalizeString(data.pic_url) ||
    normalizeString(data.picUrl) ||
    normalizeString(data.picture);
  const thumbUrl =
    normalizeString(data.thumb) || normalizeString(data.thumbnail) || picUrl;
  const date = normalizeString(data.date) || dailyQuoteFallback.date;

  if (!quote || !picUrl) return null;

  return {
    id:
      normalizeString(data._id) ||
      normalizeString(data.id) ||
      `daily-quote-${date}`,
    date,
    dateLabel: normalizeDailyQuoteDateLabel(date, historical),
    timeLabel: normalizeDailyQuoteDayLabel(date, historical),
    quote,
    author:
      normalizeString(data.author) ||
      normalizeString(data.creator) ||
      dailyQuoteFallback.author,
    source:
      normalizeString(data.from) ||
      normalizeString(data.source) ||
      dailyQuoteFallback.source,
    like: normalizeFiniteNumber(data.like, dailyQuoteFallback.like),
    share: normalizeFiniteNumber(data.share, dailyQuoteFallback.share),
    picUrl,
    thumbUrl,
    sourceStatus: "direct",
  };
};

const normalizeMovieCalendarDateParts = (value: string) => {
  const trimmed = normalizeString(value);
  const match =
    trimmed.match(/^(\d{4})(\d{2})(\d{2})$/) ||
    trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return {
      date: "",
      day: "",
      monthLabel: "",
      weekday: "",
    };
  }
  const [, year, month, day] = match;
  const parsed = new Date(
    Number(year),
    Math.max(0, Number(month) - 1),
    Number(day),
  );
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return {
    date: `${year}-${month}-${day}`,
    day: String(Number(day)),
    monthLabel: `${Number(month)}月`,
    weekday: weekdays[parsed.getDay()] || "",
  };
};

const normalizeIpLookupResponse = (payload: unknown): IpLookupResult | null => {
  if (!isObjectRecord(payload)) return null;
  const data = isObjectRecord(payload.data) ? payload.data : payload;
  const ip =
    normalizeString(data.queryIp) ||
    normalizeString(data.ip) ||
    normalizeString(data.clientIp);
  if (!ip) return null;

  return {
    ip,
    location: normalizeString(data.location),
    country: normalizeString(data.country),
    region: normalizeString(data.region),
    city: normalizeString(data.city),
    isp: normalizeString(data.isp) || normalizeString(data.network),
    queryIp: normalizeString(data.queryIp) || ip,
    clientIp: normalizeString(data.clientIp),
    clientIpSource: normalizeString(data.clientIpSource),
    latitude:
      normalizeString(data.latitude) ||
      normalizeString(data.lat) ||
      normalizeString(data.y),
    longitude:
      normalizeString(data.longitude) ||
      normalizeString(data.lon) ||
      normalizeString(data.lng) ||
      normalizeString(data.x),
    updatedAt: new Date().toLocaleString("zh-CN", {
      hour12: false,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
};

const ipLookupResolvedIp = computed(
  () => ipLookupResult.value.queryIp || ipLookupResult.value.ip || "加载中",
);

const ipLookupOuterAddress = computed(() => {
  const value = ipLookupResolvedIp.value.trim();
  return value || "加载中";
});

const ipLookupArea = computed(() => {
  const { country, region, city, location } = ipLookupResult.value;
  const parts = [country, region, city].filter(Boolean);
  if (parts.length) return parts.join("-");
  const locationParts = location.split(/\s+/).filter(Boolean);
  if (locationParts.length >= 3) return locationParts.slice(0, 3).join("-");
  return location || "未知";
});

const ipLookupOuterLocation = computed(() => {
  const value = ipLookupArea.value.trim();
  return value && value !== "未知" ? value : "定位中";
});

const ipLookupOuterAddressClass = computed(() => ({
  "is-long-address": ipLookupOuterAddress.value.length > 18,
}));

const ipLookupNetwork = computed(() => {
  if (ipLookupResult.value.isp) return ipLookupResult.value.isp;
  const match = ipLookupResult.value.location.match(
    /(中国电信|中国联通|中国移动|电信|联通|移动|铁通|网通|教育网|Cable|Telecom|Unicom|Mobile|ISP)/i,
  );
  return match?.[0] || "未知";
});

const ipLookupCoordinate = computed(() => {
  const { longitude, latitude } = ipLookupResult.value;
  if (!longitude || !latitude) return "暂无";
  return `${longitude},${latitude}`;
});

const ipLookupHeading = computed(() => "本机IP地址信息");

const fetchIpLookup = async (query = "", refresh = false) => {
  if (typeof window === "undefined") return false;
  ipLookupAbortController?.abort();
  const controller = new AbortController();
  ipLookupAbortController = controller;
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);
  ipLookupStatus.value = "loading";
  ipLookupError.value = "";

  try {
    const url = new URL(toApiUrl("/api/ip"), window.location.origin);
    url.searchParams.set("ts", String(Date.now()));
    if (refresh) url.searchParams.set("refresh", "1");
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      url.searchParams.set("query", trimmedQuery);
      url.searchParams.set("ip", trimmedQuery);
    }

    const response = await fetch(url.toString(), {
      cache: "no-store",
      credentials: "omit",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    const normalized = normalizeIpLookupResponse(payload);
    if (!response.ok || !normalized) {
      throw new Error("ip lookup request failed");
    }

    ipLookupResult.value = normalized;
    ipLookupStatus.value =
      isObjectRecord(payload) && payload.success === false
        ? "error"
        : "success";
    if (ipLookupStatus.value === "error") {
      ipLookupError.value = "查询服务暂不可用，已显示可识别的本机地址";
    }
    return ipLookupStatus.value === "success";
  } catch (error) {
    if (!controller.signal.aborted) {
      ipLookupStatus.value = "error";
      ipLookupError.value =
        error instanceof DOMException && error.name === "AbortError"
          ? "查询超时，请稍后重试"
          : "查询失败，请稍后重试";
    }
    return false;
  } finally {
    window.clearTimeout(timeoutId);
    if (ipLookupAbortController === controller) {
      ipLookupAbortController = null;
    }
  }
};

const normalizeMovieCalendarResponse = (
  payload: unknown,
  sourceStatusOverride = "",
): MovieCalendarEntry | null => {
  if (!isObjectRecord(payload)) return null;
  if (payload.success === false) return null;
  const data = isObjectRecord(payload.data) ? payload.data : payload;
  const movieTitle =
    normalizeString(data.movieTitle) || normalizeString(data.mov_title);
  const dateParts = normalizeMovieCalendarDateParts(normalizeString(data.date));
  const day = normalizeString(data.day) || dateParts.day;
  const monthLabel = normalizeString(data.monthLabel) || dateParts.monthLabel;
  const weekday = normalizeString(data.weekday) || dateParts.weekday;
  const quote =
    normalizeString(data.quote) ||
    normalizeString(data.mov_text) ||
    normalizeString(data.mov_intro);
  if (!movieTitle || !day || !monthLabel || !weekday || !quote) return null;

  return {
    date:
      dateParts.date ||
      normalizeString(data.date) ||
      movieCalendarFallback.date,
    day,
    monthLabel,
    weekday,
    movieTitle,
    rating:
      normalizeString(data.rating) || normalizeString(data.mov_rating) || "--",
    quote,
    posterUrl:
      normalizeString(data.posterUrl) || normalizeString(data.poster_url),
    coverUrl: normalizeString(data.coverUrl) || normalizeString(data.mov_pic),
    sourceUrl:
      normalizeString(data.sourceUrl) || normalizeString(data.mov_link),
    year: normalizeString(data.year) || normalizeString(data.mov_year),
    area: normalizeString(data.area) || normalizeString(data.mov_area),
    director:
      normalizeString(data.director) || normalizeString(data.mov_director),
    intro: normalizeString(data.intro) || normalizeString(data.mov_intro),
    genres: normalizeStringArray(data.genres).length
      ? normalizeStringArray(data.genres)
      : normalizeStringArray(data.mov_type),
    bgColor: normalizeString(data.bgColor) || movieCalendarFallback.bgColor,
    textColor:
      normalizeString(data.textColor) ||
      normalizeString(data.color) ||
      movieCalendarFallback.textColor,
    sourceStatus:
      sourceStatusOverride || normalizeString(data.sourceStatus) || "ok",
  };
};

const requestMovieCalendar = async (
  url: string,
  controller: AbortController,
  sourceStatusOverride = "",
) => {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "omit",
    headers: { accept: "application/json" },
    signal: controller.signal,
  });
  if (!response.ok) {
    throw new Error(`movie calendar request failed: ${response.status}`);
  }

  const normalized = normalizeMovieCalendarResponse(
    await response.json(),
    sourceStatusOverride,
  );
  if (!normalized) {
    throw new Error("movie calendar response rejected");
  }
  return normalized;
};

const fetchMovieCalendar = async () => {
  movieCalendarAbortController?.abort();
  const controller = new AbortController();
  movieCalendarAbortController = controller;
  const timeoutId = window.setTimeout(() => controller.abort(), 5500);

  try {
    let normalized: MovieCalendarEntry;
    try {
      normalized = await requestMovieCalendar(
        toApiUrl(movieCalendarApiPath),
        controller,
      );
    } catch (proxyError) {
      normalized = await requestMovieCalendar(
        movieCalendarSourceApiUrl,
        controller,
        "direct",
      );
      movieCalendarError.value =
        proxyError instanceof Error ? proxyError.message : "";
    }

    movieCalendar.value = normalized;
    return true;
  } catch (error) {
    if (!controller.signal.aborted) {
      movieCalendar.value = movieCalendarErrorEntry;
      movieCalendarError.value =
        error instanceof Error
          ? error.message
          : "movie calendar request failed";
    }
    return false;
  } finally {
    window.clearTimeout(timeoutId);
    if (movieCalendarAbortController === controller) {
      movieCalendarAbortController = null;
    }
  }
};

const normalizeDailyEnglishResponse = (
  payload: unknown,
): DailyEnglishEntry | null => {
  if (!isObjectRecord(payload)) return null;

  if (typeof payload.errno === "number" && payload.errno !== 0) {
    return null;
  }

  const data = isObjectRecord(payload.data) ? payload.data : payload;
  const sentence = normalizeString(data.content);
  const translation = normalizeString(data.note);
  const imageUrl =
    normalizeString(data.middlePicture) || dailyEnglishFallback.imageUrl;

  if (!sentence || !translation || !imageUrl) return null;

  return {
    mode: "跟读",
    sentence,
    translation,
    progressLabel: "00:00",
    imageUrl,
    audioUrl: normalizeString(data.tts),
    dateline: normalizeString(data.date),
  };
};

const fetchDailyEnglish = async () => {
  dailyEnglishAbortController?.abort();
  const controller = new AbortController();
  dailyEnglishAbortController = controller;
  const timeoutId = window.setTimeout(() => controller.abort(), 5500);
  const url = new URL(dailyEnglishApiUrl);

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      credentials: "omit",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return false;

    const normalized = normalizeDailyEnglishResponse(await response.json());
    if (!normalized) return false;

    dailyEnglish.value = normalized;
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
    if (dailyEnglishAbortController === controller) {
      dailyEnglishAbortController = null;
    }
  }
};

const buildDailyQuoteUrl = (
  baseUrl: string,
  params: Record<string, string> = {},
) => {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
};

const requestDailyQuoteCounter = async (
  baseUrl: string,
  id: string,
  field: "like" | "share",
) => {
  if (!id) return false;

  try {
    const response = await fetch(buildDailyQuoteUrl(baseUrl, { _id: id }), {
      cache: "no-store",
      credentials: "omit",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return false;
    const payload = await response.json();
    const data =
      isObjectRecord(payload) && isObjectRecord(payload.data)
        ? payload.data
        : payload;
    if (!isObjectRecord(data)) return false;
    const nextValue = normalizeFiniteNumber(data[field], Number.NaN);
    if (!Number.isFinite(nextValue)) return false;
    dailyQuote.value = {
      ...dailyQuote.value,
      [field]: nextValue,
    };
    return true;
  } catch {
    return false;
  }
};

const fetchDailyQuote = async (date?: string) => {
  dailyQuoteAbortController?.abort();
  const controller = new AbortController();
  dailyQuoteAbortController = controller;
  const timeoutId = window.setTimeout(() => controller.abort(), 5500);
  const historical = Boolean(date);

  try {
    const response = await fetch(
      buildDailyQuoteUrl(dailyQuoteApiUrl, date ? { date } : {}),
      {
        cache: "no-store",
        credentials: "omit",
        headers: { accept: "application/json" },
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      dailyQuote.value = { ...dailyQuoteFallback, sourceStatus: "error" };
      return false;
    }

    const normalized = normalizeDailyQuoteResponse(
      await response.json(),
      historical,
    );
    if (!normalized) {
      dailyQuote.value = { ...dailyQuoteFallback, sourceStatus: "error" };
      return false;
    }

    dailyQuote.value = normalized;
    dailyQuoteLiked.value = false;
    return true;
  } catch {
    if (controller.signal.aborted) return false;
    dailyQuote.value = { ...dailyQuoteFallback, sourceStatus: "error" };
    return false;
  } finally {
    window.clearTimeout(timeoutId);
    if (dailyQuoteAbortController === controller) {
      dailyQuoteAbortController = null;
    }
  }
};

const resizeTodoTextarea = (textarea: HTMLTextAreaElement) => {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.max(31, textarea.scrollHeight)}px`;
};

const resizeTodoTextareas = () => {
  document
    .querySelectorAll<HTMLTextAreaElement>(
      "[data-todo-textarea], [data-todo-draft-textarea]",
    )
    .forEach(resizeTodoTextarea);
};

let todoScrollHideTimer: number | null = null;
const todoListScrolling = ref(false);
const todoScrollbar = reactive({
  visible: false,
  top: 0,
  height: 42,
});

const updateTodoScrollbar = (element?: HTMLElement | null) => {
  const scrollElement =
    element || document.querySelector<HTMLElement>(".todo-content-scroll");
  if (!scrollElement) return;

  const { clientHeight, scrollHeight, scrollTop } = scrollElement;
  const canScroll = scrollHeight > clientHeight + 1;
  todoScrollbar.visible = canScroll;
  if (!canScroll) {
    todoScrollbar.top = 0;
    todoScrollbar.height = 42;
    return;
  }

  const thumbHeight = Math.max(
    42,
    (clientHeight / scrollHeight) * clientHeight,
  );
  const scrollRange = scrollHeight - clientHeight;
  const thumbRange = clientHeight - thumbHeight;
  todoScrollbar.height = thumbHeight;
  todoScrollbar.top =
    scrollRange > 0 ? (scrollTop / scrollRange) * thumbRange : 0;
};

const todoScrollbarStyle = computed(() => ({
  height: `${todoScrollbar.height}px`,
  transform: `translateY(${todoScrollbar.top}px)`,
}));

const scheduleTodoTextareaResize = () => {
  void nextTick(() => {
    resizeTodoTextareas();
    updateTodoScrollbar();
  });
};

const resizeTodoTextareaFromEvent = (event: Event) => {
  resizeTodoTextarea(event.target as HTMLTextAreaElement);
  updateTodoScrollbar();
};

const handleTodoListScroll = (event: Event) => {
  updateTodoScrollbar(event.currentTarget as HTMLElement);
  todoListScrolling.value = true;
  if (todoScrollHideTimer) {
    window.clearTimeout(todoScrollHideTimer);
  }
  todoScrollHideTimer = window.setTimeout(() => {
    todoListScrolling.value = false;
    todoScrollHideTimer = null;
  }, 900);
};

const updateTodoTaskTitle = (task: TodoTask, event: Event) => {
  const textarea = event.target as HTMLTextAreaElement;
  task.title = textarea.value;
  resizeTodoTextarea(textarea);
  updateTodoScrollbar();
};

const removeTodoTask = (taskId: string) => {
  const index = todoTasks.findIndex((task) => task.id === taskId);
  if (index >= 0) {
    todoTasks.splice(index, 1);
    scheduleTodoTextareaResize();
  }
};

const closeMenus = () => {
  blankMenu.show = false;
  widgetMenu.show = false;
  showSearchMenu.value = false;
  showGroupMenu.value = false;
};

const exitFullscreenSafely = (element: Element | null) => {
  if (
    typeof document === "undefined" ||
    document.fullscreenElement !== element
  ) {
    return;
  }
  try {
    const exitPromise = document.exitFullscreen?.();
    if (exitPromise) void exitPromise.catch(() => undefined);
  } catch {
    // Ignore browser fullscreen race conditions while closing a widget panel.
  }
};

const closeOpenedWidget = () => {
  blurActiveElementMatching(".itab-native-widget");
  exitFullscreenSafely(dailyQuotePanelRef.value);
  dailyQuoteFullscreen.value = false;
  openedWidgetId.value = "";
  stopDailyEnglishAudio();
  ipLookupAbortController?.abort();
  wallpaperSettingsOpen.value = false;
};

const closePanels = () => {
  showAddModal.value = false;
  closeOpenedWidget();
};

const showToast = (message: string) => {
  toastMessage.value = message;
  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }
  toastTimer = window.setTimeout(() => {
    toastMessage.value = "";
    toastTimer = null;
  }, 2200);
};

const clearEatTodayAnimation = () => {
  if (eatTodayAnimationTimer) {
    window.clearInterval(eatTodayAnimationTimer);
    eatTodayAnimationTimer = null;
  }
  if (eatTodayPickTimer) {
    window.clearTimeout(eatTodayPickTimer);
    eatTodayPickTimer = null;
  }
};

const pickEatToday = () => {
  clearEatTodayAnimation();

  const itemCount = eatTodayMenuItems.length;
  if (itemCount === 0) return;

  const startIndex = Math.floor(Math.random() * itemCount);
  const finalIndex = Math.floor(Math.random() * itemCount);
  const nextItem =
    itemCount > 1 &&
    eatTodayMenuItems[finalIndex] === eatTodaySelectedItem.value
      ? eatTodayMenuItems[(finalIndex + 1) % itemCount]
      : eatTodayMenuItems[finalIndex];
  let animationIndex = startIndex;

  eatTodayRunning.value = true;
  eatTodayAnimatedItem.value = eatTodayMenuItems[animationIndex] || "";

  eatTodayAnimationTimer = window.setInterval(() => {
    animationIndex = (animationIndex + 1) % itemCount;
    eatTodayAnimatedItem.value = eatTodayMenuItems[animationIndex] || "";
  }, 70);

  eatTodayPickTimer = window.setTimeout(() => {
    if (eatTodayAnimationTimer) {
      window.clearInterval(eatTodayAnimationTimer);
      eatTodayAnimationTimer = null;
    }
    eatTodaySelectedItem.value = nextItem || eatTodayMenuItems[0] || "";
    eatTodayAnimatedItem.value = "";
    eatTodayRunning.value = false;
    eatTodayPickTimer = null;
  }, 780);
};

const triggerDailyQuoteActionAnimation = (action: DailyQuoteAction) => {
  dailyQuoteActionAnimating[action] = false;
  if (dailyQuoteActionAnimationTimers[action]) {
    window.clearTimeout(dailyQuoteActionAnimationTimers[action]);
  }
  void nextTick(() => {
    dailyQuoteActionAnimating[action] = true;
    dailyQuoteActionAnimationTimers[action] = window.setTimeout(() => {
      dailyQuoteActionAnimating[action] = false;
      dailyQuoteActionAnimationTimers[action] = undefined;
    }, 360);
  });
};

const copyDailyQuote = async () => {
  triggerDailyQuoteActionAnimation("share");
  try {
    await navigator.clipboard?.writeText(dailyQuote.value.quote);
    void requestDailyQuoteCounter(
      dailyQuoteShareApiUrl,
      dailyQuote.value.id,
      "share",
    );
    showToast("已复制到剪贴板");
  } catch {
    showToast("复制失败");
  }
};

const navigateDailyQuote = (direction: "prev" | "next") => {
  const nextDate = shiftDailyQuoteDate(
    dailyQuote.value.date,
    direction === "next" ? 1 : -1,
  );
  if (!nextDate) return;
  const today = getDailyQuoteTodayKey();
  if (nextDate > today) {
    showToast("明天怎么翻也翻不过去");
    return;
  }
  if (nextDate < dailyQuoteMinimumDate) {
    showToast("不能再往前查看了");
    return;
  }

  dailyQuoteLiked.value = false;
  void fetchDailyQuote(nextDate);
};

const syncDailyQuoteFullscreenState = () => {
  if (typeof document === "undefined") return;
  dailyQuoteFullscreen.value =
    document.fullscreenElement === dailyQuotePanelRef.value;
};

const toggleDailyQuoteFullscreen = () => {
  triggerDailyQuoteActionAnimation("fullscreen");
  const element = dailyQuotePanelRef.value;
  if (typeof document === "undefined" || !element) {
    dailyQuoteFullscreen.value = !dailyQuoteFullscreen.value;
    return;
  }
  if (document.fullscreenElement === element) {
    exitFullscreenSafely(element);
    dailyQuoteFullscreen.value = false;
    return;
  }
  if (element.requestFullscreen) {
    void element.requestFullscreen().catch(() => {
      dailyQuoteFullscreen.value = true;
    });
    return;
  }
  dailyQuoteFullscreen.value = !dailyQuoteFullscreen.value;
};

const updateDailyQuoteClock = () => {
  const today = getDailyQuoteTodayKey();
  if (dailyQuoteFullscreen.value) {
    dailyQuote.value = {
      ...dailyQuote.value,
      dateLabel: normalizeDailyQuoteDateLabel(today),
      timeLabel: normalizeDailyQuoteTimeLabel(true),
    };
    return;
  }
  if (dailyQuote.value.date === today) {
    dailyQuote.value = {
      ...dailyQuote.value,
      dateLabel: normalizeDailyQuoteDateLabel(today),
      timeLabel: normalizeDailyQuoteTimeLabel(),
    };
  }
};

const toggleDailyQuoteLike = () => {
  triggerDailyQuoteActionAnimation("like");
  dailyQuoteLiked.value = !dailyQuoteLiked.value;
  if (dailyQuoteLiked.value) {
    void requestDailyQuoteCounter(
      dailyQuoteLikeApiUrl,
      dailyQuote.value.id,
      "like",
    );
  }
};

const selectWallpaper = (wallpaper: ItabWallpaperEntry) => {
  wallpaperRuntime.selectWallpaper(wallpaper);
  showToast(`已切换为 ${wallpaper.title}`);
};

const loadMoreWallpapers = () => {
  if (!hasMoreWallpapers.value) {
    showToast("必应壁纸已全部加载");
    return;
  }
  void wallpaperRuntime.loadMoreWallpapers();
};

let wallpaperAutoLoadObserver: IntersectionObserver | null = null;
const WALLPAPER_AUTO_LOAD_DISTANCE = 180;

const maybeAutoLoadWallpapers = () => {
  const panel = wallpaperPanelElement.value;
  if (!panel || panel.clientHeight <= 0 || !hasMoreWallpapers.value) {
    return;
  }

  const distanceToBottom =
    panel.scrollHeight - panel.scrollTop - panel.clientHeight;
  if (
    panel.scrollHeight <= panel.clientHeight ||
    distanceToBottom <= WALLPAPER_AUTO_LOAD_DISTANCE
  ) {
    loadMoreWallpapers();
  }
};

const syncWallpaperAutoLoadObserver = () => {
  wallpaperAutoLoadObserver?.disconnect();
  wallpaperAutoLoadObserver = null;
  if (
    openedWidget.value?.kind !== "wallpaper" ||
    !hasMoreWallpapers.value ||
    !wallpaperPanelElement.value ||
    !wallpaperLoadMoreSentinelElement.value ||
    typeof IntersectionObserver === "undefined"
  ) {
    return;
  }

  wallpaperAutoLoadObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadMoreWallpapers();
      }
    },
    {
      root: wallpaperPanelElement.value,
      rootMargin: `${WALLPAPER_AUTO_LOAD_DISTANCE}px 0px`,
      threshold: 0,
    },
  );
  wallpaperAutoLoadObserver.observe(wallpaperLoadMoreSentinelElement.value);
};

const handleWallpaperPanelScroll = () => {
  maybeAutoLoadWallpapers();
};

const toggleWallpaperSettings = () => {
  wallpaperSettingsOpen.value = !wallpaperSettingsOpen.value;
};

const clampPoint = (event: MouseEvent, width = 150, height = 220): Point => {
  const maxX = Math.max(12, window.innerWidth - width - 12);
  const maxY = Math.max(12, window.innerHeight - height - 12);

  return {
    x: Math.max(12, Math.min(event.clientX, maxX)),
    y: Math.max(12, Math.min(event.clientY, maxY)),
  };
};

const openBlankMenu = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null;
  if (
    target?.closest?.(
      ".itab-native-widget,.itab-native-modal,.itab-native-panel,.itab-native-menu,.itab-native-sidebar,.itab-native-search",
    )
  ) {
    return;
  }
  closeMenus();
  const point = clampPoint(event, 156, 190);
  blankMenu.x = point.x;
  blankMenu.y = point.y;
  blankMenu.show = true;
};

const openWidgetMenu = (widget: WidgetItem, event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  closeMenus();
  const point = clampPoint(event, 152, 210);
  widgetMenu.x = point.x;
  widgetMenu.y = point.y;
  widgetMenu.widgetId = widget.id;
  widgetMenu.show = true;
};

const openWidget = (widget: WidgetItem) => {
  closeMenus();
  if (widget.url) {
    window.open(widget.url, "_blank", "noopener,noreferrer");
    return;
  }
  if (widget.kind === "calendar") {
    calendarActiveTab.value = "calendar";
    displayedCalendarYear.value = 2026;
    displayedCalendarMonth.value = 5;
    selectedCalendarKey.value = "2026-05-21";
    calendarWeekStartsMonday.value = true;
  }
  if (widget.kind === "todo") {
    todoDraft.value = "";
    scheduleTodoTextareaResize();
  }
  if (widget.kind === "anniversary" || widget.kind === "anniversary-day") {
    syncAnniversaryEditor(anniversaryOuterTemplate(widget), widget.title);
  }
  if (widget.kind === "today-english") {
    stopDailyEnglishAudio();
  }
  if (widget.kind === "converter") {
    activeConverterToolLabel.value = "计算器";
    resetConverterCalculator();
  }
  if (widget.kind === "wallpaper") {
    wallpaperSettingsOpen.value = false;
  }
  if (widget.id === "ip-30") {
    void fetchIpLookup("", false);
  }
  openedWidgetId.value = widget.id;
};

const stopDailyEnglishAudio = () => {
  const audio = dailyEnglishAudioElement.value;
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  dailyEnglishPlaying.value = false;
};

const handleDailyEnglishAudioEnded = () => {
  stopDailyEnglishAudio();
};

const toggleDailyEnglishPlayback = async () => {
  const audio = dailyEnglishAudioElement.value;
  if (!audio || !dailyEnglish.value.audioUrl) {
    dailyEnglishPlaying.value = false;
    return;
  }

  if (dailyEnglishPlaying.value) {
    audio.pause();
    dailyEnglishPlaying.value = false;
    return;
  }

  try {
    await audio.play();
    dailyEnglishPlaying.value = true;
  } catch {
    dailyEnglishPlaying.value = false;
  }
};

const handleRootClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null;
  if (
    target?.closest?.(".itab-native-menu,.itab-native-modal,.itab-native-panel")
  ) {
    return;
  }
  closeMenus();
};

const submitSearch = () => {
  const query = searchText.value.trim();
  if (!query) {
    showToast("请输入搜索内容");
    return;
  }
  window.open(
    `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`,
    "_blank",
    "noopener,noreferrer",
  );
};

const selectSearchEngine = (engine: string) => {
  if (engine === "添加") {
    showToast("已进入添加搜索引擎");
  } else {
    activeSearch.value = engine;
  }
  showSearchMenu.value = false;
};

const openAddModal = (tab: "widget" | "site" | "custom" = "widget") => {
  closeMenus();
  addTab.value = tab;
  showAddModal.value = true;
};

const onBlankMenuAction = (action: string) => {
  if (action === "add") {
    openAddModal("widget");
    return;
  }
  closeMenus();
  showToast(action);
};

const setWidgetSize = (size: WidgetSize) => {
  const widget = selectedWidget.value;
  closeMenus();
  if (!widget) return;
  if (!isItabReplicaWidgetSizeSupported(widget.kind, size)) {
    showToast(`${widget.title} 不支持 ${size}`);
    return;
  }
  widget.size = size;
  resolveWidgetResizeOverlaps(widget);
  showToast(`已切换为 ${size}`);
};

const setOpenedWidgetSize = (size: WidgetSize) => {
  const widget = openedWidget.value;
  if (!widget) return;
  if (!isItabReplicaWidgetSizeSupported(widget.kind, size)) {
    showToast(`${widget.title} 不支持 ${size}`);
    return;
  }
  widget.size = size;
  resolveWidgetResizeOverlaps(widget);
  showToast(`已切换为 ${size}`);
};

const onWidgetMenuAction = (action: string) => {
  const widget = selectedWidget.value;
  closeMenus();
  if (!widget) return;
  if (action === "delete") {
    showToast(`已删除 ${widget.title}`);
    return;
  }
  if (action === "edit-icon") {
    if (widget.kind === "anniversary" || widget.kind === "anniversary-day") {
      syncAnniversaryEditor(anniversaryOuterTemplate(widget), widget.title);
    }
    openedWidgetId.value = widget.id;
    return;
  }
  showToast(action);
};

const addCatalogItem = (title: string) => {
  showToast(`已添加 ${title}`);
};

const widgetSpan = (size: WidgetSize) => {
  if (size === "1x2") return { cols: 2, rows: 1 };
  if (size === "2x1") return { cols: 1, rows: 2 };
  if (size === "2x2") return { cols: 2, rows: 2 };
  if (size === "2x4") return { cols: 4, rows: 2 };
  return { cols: 1, rows: 1 };
};

const desktopGridColumns = 14;

const clampWidgetGridPosition = (widget: WidgetItem) => {
  const span = widgetSpan(widget.size);
  widget.col = Math.max(
    1,
    Math.min(widget.col, desktopGridColumns - span.cols + 1),
  );
  widget.row = Math.max(1, widget.row);
};

const widgetGridBounds = (
  widget: WidgetItem,
  col = widget.col,
  row = widget.row,
) => {
  const span = widgetSpan(widget.size);
  return {
    left: col,
    right: col + span.cols,
    top: row,
    bottom: row + span.rows,
  };
};

const widgetGridBoundsOverlap = (
  first: ReturnType<typeof widgetGridBounds>,
  second: ReturnType<typeof widgetGridBounds>,
) =>
  first.left < second.right &&
  first.right > second.left &&
  first.top < second.bottom &&
  first.bottom > second.top;

const findAvailableWidgetPosition = (widget: WidgetItem, startCol: number) => {
  const layoutWidgets = visibleWidgets.value;
  const startRow = widget.row;
  const span = widgetSpan(widget.size);
  const maxCol = Math.max(1, desktopGridColumns - span.cols + 1);

  for (let row = startRow; row <= startRow + 24; row += 1) {
    const colStart = row === startRow ? Math.min(startCol, maxCol) : 1;
    for (let col = colStart; col <= maxCol; col += 1) {
      const candidateBounds = widgetGridBounds(widget, col, row);
      const hasCollision = layoutWidgets.some(
        (item) =>
          item.id !== widget.id &&
          widgetGridBoundsOverlap(candidateBounds, widgetGridBounds(item)),
      );
      if (!hasCollision) {
        return { col, row };
      }
    }
  }

  return { col: startCol, row: startRow + 2 };
};

const resolveWidgetResizeOverlaps = (resizedWidget: WidgetItem) => {
  clampWidgetGridPosition(resizedWidget);
  const resizedBounds = widgetGridBounds(resizedWidget);
  for (const widget of visibleWidgets.value) {
    if (widget.id === resizedWidget.id) continue;
    if (!widgetGridBoundsOverlap(resizedBounds, widgetGridBounds(widget))) {
      continue;
    }
    const position = findAvailableWidgetPosition(widget, resizedBounds.right);
    widget.col = position.col;
    widget.row = position.row;
  }
};

const compactPosition = (index: number) => {
  return {
    col: (index % 3) * 2 + 1,
    row: Math.floor(index / 3) * 2 + 1,
  };
};

const widgetStyle = (
  widget: WidgetItem,
  index: number,
): Record<string, string> => {
  const span = widgetSpan(widget.size);
  const position =
    viewportWidth.value >= 900
      ? { col: widget.col, row: widget.row }
      : compactPosition(index);
  return {
    gridColumn: `${position.col} / span ${span.cols}`,
    gridRow: `${position.row} / span ${span.rows}`,
    zIndex: widget.id === widgetMenu.widgetId ? "5" : "auto",
  };
};

const widgetClass = (widget: WidgetItem) => {
  return [
    `is-${widget.kind}`,
    `widget-${widget.id}`,
    `size-${widget.size.replace("x", "-")}`,
  ];
};

const shouldRenderIpOuterInfo = (widget: WidgetItem) =>
  widget.id === "ip-30" && (widget.size === "2x2" || widget.size === "2x4");

const handleKeydown = (event: KeyboardEvent) => {
  if (event.code === "F11" && openedWidget.value?.kind === "daily-quote") {
    event.preventDefault();
    toggleDailyQuoteFullscreen();
    return;
  }
  if (event.key !== "Escape") return;
  closeMenus();
  closePanels();
};

watch(
  () =>
    [
      openedWidget.value?.kind,
      wallpaperRuntime.visibleBingWallpapers.value.length,
      wallpaperRuntime.hasMoreWallpapers.value,
    ] as const,
  async ([kind]) => {
    if (kind !== "wallpaper") {
      wallpaperAutoLoadObserver?.disconnect();
      wallpaperAutoLoadObserver = null;
      return;
    }

    await nextTick();
    syncWallpaperAutoLoadObserver();
    maybeAutoLoadWallpapers();
  },
  { flush: "post" },
);

onMounted(() => {
  document.title = "新标签页";
  restoreTomatoState();
  clockTimer = window.setInterval(() => {
    now.value = new Date();
  }, 1000);
  updateViewportHandler = () => {
    viewportWidth.value = window.innerWidth;
  };
  updateViewportHandler();
  visibilityChangeHandler = () => {
    syncTomatoTimerTick();
  };
  window.addEventListener("resize", updateViewportHandler);
  window.addEventListener("keydown", handleKeydown);
  document.addEventListener(
    "pointerdown",
    handleAnniversaryOutsidePointerDown,
    true,
  );
  document.addEventListener("visibilitychange", visibilityChangeHandler);
  document.addEventListener("fullscreenchange", syncDailyQuoteFullscreenState);
  void fetchMovieCalendar();
  void fetchDailyEnglish();
  void fetchDailyQuote();
  dailyQuoteClockTimer = window.setInterval(updateDailyQuoteClock, 1000);
  void fetchIpLookup("", false);
  ipLookupRefreshTimer = window.setInterval(
    () => {
      void fetchIpLookup("", false);
    },
    60 * 60 * 1000,
  );
});

onBeforeUnmount(() => {
  persistTomatoState();
  if (clockTimer) {
    window.clearInterval(clockTimer);
  }
  if (ipLookupRefreshTimer) {
    window.clearInterval(ipLookupRefreshTimer);
  }
  if (dailyQuoteClockTimer) {
    window.clearInterval(dailyQuoteClockTimer);
  }
  (Object.keys(dailyQuoteActionAnimationTimers) as DailyQuoteAction[]).forEach(
    (action) => {
      const timer = dailyQuoteActionAnimationTimers[action];
      if (timer) {
        window.clearTimeout(timer);
      }
      dailyQuoteActionAnimationTimers[action] = undefined;
      dailyQuoteActionAnimating[action] = false;
    },
  );
  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }
  if (todoScrollHideTimer) {
    window.clearTimeout(todoScrollHideTimer);
  }
  clearEatTodayAnimation();
  dailyEnglishAbortController?.abort();
  dailyQuoteAbortController?.abort();
  movieCalendarAbortController?.abort();
  ipLookupAbortController?.abort();
  stopDailyEnglishAudio();
  clearTomatoTimer();
  pauseTomatoAudio();
  tomatoAudioElement = null;
  wallpaperAutoLoadObserver?.disconnect();
  wallpaperAutoLoadObserver = null;
  if (updateViewportHandler) {
    window.removeEventListener("resize", updateViewportHandler);
  }
  if (visibilityChangeHandler) {
    document.removeEventListener("visibilitychange", visibilityChangeHandler);
  }
  document.removeEventListener(
    "fullscreenchange",
    syncDailyQuoteFullscreenState,
  );
  document.removeEventListener(
    "pointerdown",
    handleAnniversaryOutsidePointerDown,
    true,
  );
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <main
    class="itab-native"
    :class="{ 'is-panel-open': hasPanelOpen }"
    data-itab-native-replica
    @click="handleRootClick"
    @contextmenu.prevent="openBlankMenu"
  >
    <div class="itab-native-bg" aria-hidden="true"></div>
    <aside class="itab-native-sidebar">
      <button class="itab-avatar" type="button" @click.stop="showToast('登录')">
        <img
          alt=""
          src="https://thirdqq.qlogo.cn/ek_qqapp/AQTsibeqGr594XeT8icjo8GKo4QrGteofFynS2Xaw1v9Ilwt8iasibmUuXFXF6qPnpUQdeNg1FAO/100"
        />
      </button>
      <nav class="itab-group-list" aria-label="iTab 分组">
        <button
          v-for="group in groups"
          :key="group.name"
          type="button"
          :class="{ active: activeGroup === group.name }"
          @click.stop="activeGroup = group.name"
        >
          <b>{{ group.icon }}</b>
          <span>{{ group.name }}</span>
        </button>
        <button
          class="itab-sidebar-plus"
          type="button"
          @click.stop="showGroupMenu = !showGroupMenu"
        >
          <b>＋</b>
        </button>
      </nav>
      <div class="itab-sidebar-bottom">
        <button type="button" @click.stop="showToast('回收站')">♨</button>
        <button type="button" @click.stop="showToast('设置')">⚙</button>
      </div>

      <div v-if="showGroupMenu" class="itab-native-menu itab-group-popover">
        <button type="button" @click="showToast('新建分组')">新建分组</button>
        <button type="button" @click="showToast('导入书签')">导入书签</button>
        <button type="button" @click="showToast('管理分组')">管理分组</button>
      </div>
    </aside>

    <section class="itab-native-stage">
      <ItabMemoFixedLayer
        :widget="itabLiveMemoWidget"
        :auth-required="false"
        @update-data="(_, data) => updateItabLiveMemoData(data)"
      />

      <div class="itab-top-actions" aria-hidden="true">
        <span>◒</span>
      </div>

      <header class="itab-clock">
        <div>
          <time>{{ hourText }}</time>
          <span>:</span>
          <time>{{ minuteText }}</time>
        </div>
        <p>{{ dateText }}</p>
      </header>

      <form class="itab-native-search" @submit.prevent="submitSearch">
        <button
          class="search-engine"
          type="button"
          @click.stop="showSearchMenu = !showSearchMenu"
        >
          <img alt="" :src="sourceAssets.search" />
        </button>
        <input
          v-model="searchText"
          aria-label="输入搜索内容"
          placeholder="输入搜索内容"
        />
        <button class="search-submit" type="submit" aria-label="搜索">⌕</button>
        <div v-if="showSearchMenu" class="itab-native-menu search-menu">
          <button
            v-for="engine in searchEngines"
            :key="engine"
            type="button"
            @click="selectSearchEngine(engine)"
          >
            <span>{{ engine }}</span>
            <small v-if="engine === activeSearch">当前</small>
          </button>
        </div>
      </form>

      <div
        class="itab-native-grid"
        :class="{ 'is-secondary-group': activeGroup !== '主页' }"
      >
        <ItabLiveWidgetFrame
          v-for="(widget, index) in visibleWidgets"
          :key="widget.id"
          :class="widgetClass(widget)"
          :style="widgetStyle(widget, index)"
          :contract-id="widget.id"
          :card-style="
            widget.kind === 'movie'
              ? movieCalendarOuterStyle
              : widget.kind === 'countdown'
                ? offworkCountdownCardStyle
                : widget.kind === 'daily-quote'
                  ? dailyQuoteOuterStyle
                  : widget.kind === 'wallpaper'
                    ? wallpaperCardStyle
                    : undefined
          "
          @open="openWidget(widget)"
          @contextmenu="openWidgetMenu(widget, $event)"
        >
          <template v-if="widget.kind === 'weather'">
            <ItabWeatherWidget
              :widget="itabLiveWeatherWidget"
              :size-key="widget.size"
              @update-data="updateItabLiveWeatherData"
            />
          </template>

          <template v-else-if="widget.kind === 'calendar'">
            <span
              v-if="widget.size === '1x1'"
              class="calendar-outer-compact calendar-outer-compact-square"
            >
              <i>周四</i>
              <b>21</b>
            </span>
            <span
              v-else-if="widget.size === '1x2'"
              class="calendar-outer-compact calendar-outer-compact-row"
            >
              <b>5/21</b>
              <i>周四</i>
            </span>
            <span
              v-else-if="widget.size === '2x1'"
              class="calendar-outer-compact calendar-outer-compact-column"
            >
              <span>2026/5</span>
              <b>21</b>
              <i>周四</i>
            </span>
            <span
              v-else
              class="calendar-outer-card"
              :class="{ 'is-wide': widget.size === '2x4' }"
            >
              <span class="calendar-outer-left">
                <span class="calendar-head">2026年5月</span>
                <strong>21</strong>
                <small>第141天 第21周</small>
                <em>四月初五 周四</em>
              </span>
              <span v-if="widget.size === '2x4'" class="calendar-outer-grid">
                <span
                  v-for="day in ['一', '二', '三', '四', '五', '六', '日']"
                  :key="`outer-week-${day}`"
                  class="calendar-outer-weekday"
                >
                  {{ day }}
                </span>
                <span
                  v-for="cell in calendarOuterMonthCells"
                  :key="`outer-day-${cell.dateKey}`"
                  class="calendar-outer-date"
                  :class="{
                    muted: !cell.currentMonth,
                    today: cell.dateKey === '2026-05-21',
                  }"
                >
                  {{ Number(cell.day) }}
                </span>
              </span>
            </span>
          </template>

          <template v-else-if="widget.kind === 'hotsearch'">
            <span class="hot-tabs">百度　微博　抖音</span>
            <ol>
              <li v-for="(item, hotIndex) in hotSearchItems" :key="item">
                <b>{{ hotIndex + 1 }}</b
                ><span>{{ item }}</span
                ><em v-if="widget.size === '2x4'"
                  >{{ (781 - hotIndex * 9.8).toFixed(1) }}万</em
                >
              </li>
            </ol>
          </template>

          <template
            v-else-if="
              widget.kind === 'anniversary' || widget.kind === 'anniversary-day'
            "
          >
            <span
              class="anniversary-icon-content"
              :class="{
                'is-payday':
                  anniversaryOuterTemplate(widget).eventName === '发工资还有',
                'with-calendar': anniversaryOuterUsesCalendar(widget),
              }"
              :style="anniversaryOuterStyle(widget)"
            >
              <span class="anniversary-main">
                <span class="anniversary-label">{{
                  anniversaryOuterTemplate(widget).label
                }}</span>
                <strong class="anniversary-days">
                  {{
                    anniversaryDays(
                      anniversaryOuterTemplate(widget).date,
                      anniversaryOuterTemplate(widget).mode,
                      anniversaryOuterTemplate(widget).repeat,
                    )
                  }}<small
                    v-if="
                      anniversaryOuterTemplate(widget).eventName !==
                      '发工资还有'
                    "
                    >天</small
                  >
                </strong>
                <em
                  v-if="
                    anniversaryOuterTemplate(widget).eventName !== '发工资还有'
                  "
                  class="anniversary-date"
                  >{{ anniversaryOuterTemplate(widget).date }}</em
                >
              </span>
              <span
                v-if="anniversaryOuterUsesCalendar(widget)"
                class="anniversary-card-calendar anniversary-outer-calendar"
              >
                <b
                  v-for="day in anniversaryWeekdays"
                  :key="`outer-week-${widget.id}-${day}`"
                  :class="{ weekend: day === '六' || day === '日' }"
                  >{{ day }}</b
                >
                <i
                  v-for="(day, dayIndex) in anniversaryCalendarDays"
                  :key="`outer-day-${widget.id}-${dayIndex}`"
                  :class="{
                    muted: dayIndex < 4 || dayIndex > 34,
                    weekend: dayIndex % 7 >= 5,
                    today: day === 20 && dayIndex > 8 && dayIndex < 28,
                  }"
                  >{{ day }}</i
                >
              </span>
            </span>
          </template>

          <template v-else-if="widget.kind === 'memo'">
            <ItabMemoWidget
              :widget="itabLiveMemoWidget"
              :size-key="widget.size"
              :auth-required="false"
              :remote-sync="false"
              @update-data="updateItabLiveMemoData"
            />
          </template>

          <template v-else-if="widget.kind === 'movie'">
            <span
              class="movie-widget-content"
              :class="`movie-size-${widget.size.replace('x', '-')}`"
              :data-movie-source-status="movieCalendar.sourceStatus"
            >
              <span v-if="widget.size === '1x1'" class="movie-icon-view">
                <i class="movie-calendar-icon">
                  <span class="movie-logo">{{ movieCalendar.day }}</span>
                  <svg viewBox="0 0 512 512" aria-hidden="true">
                    <rect
                      x="80"
                      y="112"
                      width="352"
                      height="320"
                      rx="64"
                      fill="currentColor"
                    />
                    <path
                      d="M144 80v72M368 80v72M112 200h288"
                      fill="none"
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-width="48"
                    />
                  </svg>
                </i>
              </span>

              <span v-else-if="widget.size === '1x2'" class="movie-inline">
                <span class="movie-inline-stack">
                  <span class="movie-title" :title="movieCalendar.movieTitle"
                    >《{{ movieCalendar.movieTitle }}》</span
                  >
                  <span class="movie-rating"
                    ><i>{{ movieCalendarRatingText }}</i></span
                  >
                </span>
              </span>

              <span v-else-if="widget.size === '2x1'" class="movie-vertical">
                <span class="movie-vertical-stack">
                  <span
                    class="movie-title movie-title-vertical"
                    :title="movieCalendar.movieTitle"
                    >{{ movieCalendar.movieTitle }}</span
                  >
                  <span class="movie-rating movie-rating-vertical"
                    ><i>{{ movieCalendarRatingText }}</i></span
                  >
                </span>
              </span>

              <span v-else class="movie-wide">
                <span class="movie-date">
                  <strong>{{ movieCalendar.day }}</strong>
                  <em
                    >{{ movieCalendar.monthLabel }}/{{
                      movieCalendar.weekday
                    }}</em
                  >
                </span>
                <span class="movie-copy">
                  <span class="movie-heading-line">
                    <span class="movie-title" :title="movieCalendar.movieTitle"
                      >《{{ movieCalendar.movieTitle }}》</span
                    >
                    <span class="movie-rating"
                      ><i>{{ movieCalendarRatingText }}</i></span
                    >
                  </span>
                  <p>{{ movieCalendar.quote }}</p>
                </span>
              </span>
            </span>
          </template>

          <template v-else-if="widget.kind === 'countdown'">
            <span
              class="countdown-wrap"
              :class="[
                `iconsize-${widget.size}`,
                offworkIsWorkingNow ? 'is-onwork' : 'is-offwork',
              ]"
            >
              <template v-if="widget.size === '1x1'">
                <span class="countdown-img w-full" aria-hidden="true"></span>
              </template>
              <template v-else-if="widget.size === '2x4'">
                <p class="icon-2x4-offwork" aria-hidden="true">
                  <span>下班还有</span>
                </p>
                <span class="time mt5">{{ offworkPrimaryText }}</span>
                <ul class="icon-2x4-box">
                  <li
                    v-for="metric in offworkCountdownMetrics"
                    :key="metric.label"
                  >
                    <b>{{ metric.label }}</b>
                    <em>{{ metric.value }}</em>
                    <small>{{ metric.suffix }}</small>
                  </li>
                </ul>
                <span class="countdown-img" aria-hidden="true"></span>
              </template>
              <template v-else>
                <span class="time">{{ offworkPrimaryText }}</span>
                <span class="countdown-img" aria-hidden="true"></span>
              </template>
            </span>
          </template>

          <template v-else-if="widget.kind === 'next-holiday'">
            <dl>
              <div>
                <dt>端午节</dt>
                <dd>6.19-6.21</dd>
                <em>29 天</em>
              </div>
              <div>
                <dt>中秋节</dt>
                <dd>9.25-9.27</dd>
                <em>127 天</em>
              </div>
              <div>
                <dt>国庆节</dt>
                <dd>10.1-10.7</dd>
                <em>133 天</em>
              </div>
            </dl>
          </template>

          <template v-else-if="widget.kind === 'daily-quote'">
            <span
              class="daily-quote-card"
              :class="`daily-quote-size-${widget.size.replace('x', '-')}`"
              :style="dailyQuoteOuterStyle"
              :data-daily-quote-api="dailyQuoteApiUrl"
              :data-daily-quote-source-status="dailyQuote.sourceStatus"
              :data-daily-quote-date="dailyQuote.date"
            >
              <img
                v-if="widget.size === '1x1'"
                class="daily-quote-icon"
                alt="每日一言"
                :src="dailyQuoteIconUrl"
                :data-source-src="dailyQuoteSourceIconUrl"
              />
              <span v-else class="daily-quote-wrap">
                <span class="daily-quote-content-layer">
                  <span
                    v-if="widget.size === '2x2' || widget.size === '2x4'"
                    class="daily-quote-title"
                    >每日一言</span
                  >
                  <span class="daily-quote-text" :title="dailyQuote.quote">
                    {{ dailyQuote.quote }}
                    <em v-if="widget.size === '2x4'">{{
                      dailyQuoteAttributionText
                    }}</em>
                  </span>
                </span>
              </span>
            </span>
          </template>

          <template v-else-if="widget.kind === 'poem'">
            <ItabPoemWidget
              :widget="itabLivePoemWidget"
              :size-key="widget.size"
              @update-data="updateItabLivePoemData"
            />
          </template>

          <template v-else-if="widget.kind === 'wooden-fish'">
            <span>已敲3次</span>
            <small>木鱼一敲 烦恼丢掉</small>
            <img alt="" :src="sourceAssets.muyu" />
          </template>

          <template v-else-if="widget.kind === 'clock'">
            <span
              class="d-watch-resize"
              :class="`clock-size-${widget.size.replace('x', '-')}`"
            >
              <span class="clock-icon-wrap" :class="`iconsize-${widget.size}`">
                <i
                  class="d-icon fullsrceen-btn"
                  title="快捷键F11可切换至全屏"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M18 4h2c1.1 0 2 .9 2 2v2c0 .55-.45 1-1 1s-1-.45-1-1V6h-2c-.55 0-1-.45-1-1s.45-1 1-1zM4 8V6h2c.55 0 1-.45 1-1s-.45-1-1-1H4c-1.1 0-2 .9-2 2v2c0 .55.45 1 1 1s1-.45 1-1zm16 8v2h-2c-.55 0-1 .45-1 1s.45 1 1 1h2c1.1 0 2-.9 2-2v-2c0-.55-.45-1-1-1s-1 .45-1 1zM6 18H4v-2c0-.55-.45-1-1-1s-1 .45-1 1v2c0 1.1.9 2 2 2h2c.55 0 1-.45 1-1s-.45-1-1-1zM16 8H8c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2z"
                    />
                  </svg>
                </i>
                <span
                  class="clock-icon-center"
                  :class="`clock-center-${widget.size.replace('x', '-')}`"
                >
                  <span
                    v-if="widget.size === '2x1'"
                    class="clock-vertical-digits"
                  >
                    <span class="clock-vertical-time">
                      <time :style="{ '--value': Number(hourText) }"></time>
                      <time :style="{ '--value': Number(minuteText) }"></time>
                    </span>
                    <span class="clock-vertical-date">
                      <small>{{ clockShortDateText }}</small>
                      <small>{{ clockShortWeekdayText }}</small>
                    </span>
                  </span>
                  <p
                    v-else-if="widget.size === '1x1' || widget.size === '1x2'"
                    class="b time countdown"
                  >
                    <time :style="{ '--value': Number(hourText) }"></time>
                    <em>:</em>
                    <time :style="{ '--value': Number(minuteText) }"></time>
                    <template v-if="widget.size === '1x2'">
                      <em>:</em>
                      <time :style="{ '--value': Number(secondText) }"></time>
                    </template>
                  </p>
                  <span v-else class="clock-large-stack">
                    <span class="b time countdown">
                      <time :style="{ '--value': Number(hourText) }"></time>
                      <em>:</em>
                      <time :style="{ '--value': Number(minuteText) }"></time>
                      <template v-if="widget.size === '2x4'">
                        <em>:</em>
                        <time :style="{ '--value': Number(secondText) }"></time>
                      </template>
                    </span>
                    <p class="f16">{{ clockOuterDateText }}</p>
                  </span>
                </span>
              </span>
            </span>
          </template>

          <template v-else-if="widget.kind === 'speed-test'">
            <img alt="" :src="sourceAssets.speedtest" />
          </template>

          <template v-else-if="widget.kind === 'today-english'">
            <span
              class="daily-english-card"
              :class="`daily-english-size-${widget.size.replace('x', '-')}`"
              :style="dailyEnglishStyle"
              :data-daily-english-api="dailyEnglishApiUrl"
              :data-daily-english-provider="dailyEnglishProviderReferenceUrl"
              :data-daily-english-dateline="dailyEnglish.dateline"
            >
              <span class="daily-english-bg" aria-hidden="true"></span>
              <span
                v-if="
                  widget.size === '1x1' ||
                  widget.size === '1x2' ||
                  widget.size === '2x1'
                "
                class="daily-english-icon"
                aria-hidden="true"
              >
                <svg viewBox="0 0 48 48">
                  <g fill="none">
                    <path
                      d="M20 8c1.576 0 2.997.663 4 1.725A5.485 5.485 0 0 1 28 8h13a3 3 0 0 1 3 3v18a7 7 0 0 0-3-5.745V11H28a2.5 2.5 0 0 0-2.5 2.5v21c0 .593.206 1.137.551 1.566A9.45 9.45 0 0 0 27.168 40 5.488 5.488 0 0 1 24 38.275 5.485 5.485 0 0 1 20 40H7a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3h13zm2.5 26.5v-21A2.5 2.5 0 0 0 20 11H7v26h13a2.5 2.5 0 0 0 2.5-2.5zM34.5 26a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zm-1.6 4.65a.75.75 0 0 0-1.15.635v7.43c0 .58.63.94 1.15.635l6.315-3.715a.75.75 0 0 0 0-1.27L32.9 30.65z"
                      fill="currentColor"
                    />
                  </g>
                </svg>
              </span>
              <template v-else>
                <span class="daily-english-follow">
                  {{ dailyEnglish.mode }}
                  <svg viewBox="0 0 12 12" aria-hidden="true">
                    <path
                      d="M4.496 1.994A1 1 0 0 0 3 2.862v6.277a1 1 0 0 0 1.496.868l5.492-3.139a1 1 0 0 0 0-1.736L4.496 1.994z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
                <span class="daily-english-copy">
                  <p>{{ dailyEnglish.sentence }}</p>
                  <em>{{ dailyEnglish.translation }}</em>
                </span>
              </template>
              <audio
                class="daily-english-audio"
                :src="dailyEnglish.audioUrl"
                preload="none"
                aria-hidden="true"
              ></audio>
            </span>
          </template>

          <template v-else-if="widget.kind === 'eat-today'">
            <span class="d-watch-resize w-full h-full">
              <span class="app-eat d-flex-center">
                <span class="eat-box ac">
                  <strong class="eat-title">今天吃什么</strong>
                  <span
                    class="start eat-button d-flex-center"
                    :class="{ 'is-running': eatTodayRunning }"
                    :data-eat-today-current="eatTodaySelectedItem"
                    data-eat-today-action="start"
                    @click.stop="pickEatToday"
                  >
                    <span aria-live="polite">{{
                      eatTodayOuterButtonText
                    }}</span>
                  </span>
                </span>
              </span>
            </span>
          </template>

          <template v-else-if="widget.kind === 'wallpaper'">
            <span
              v-if="
                activeWallpaper &&
                wallpaperCopyrightVisibleSizes.has(widget.size)
              "
              class="wallpaper-copyright"
              :title="wallpaperDescription(activeWallpaper)"
            >
              <span class="wallpaper-copyright-text">
                {{ wallpaperDescription(activeWallpaper) }}
              </span>
            </span>
          </template>

          <template v-else-if="widget.kind === 'todo'">
            <span
              v-if="shouldRenderItabReplicaIconOnly(widget.kind, widget.size)"
              class="todo-icon-asset"
            >
              <img alt="ToDo" :src="sourceAssets.todo" />
            </span>
            <span
              v-else
              class="todo-icon-content"
              :class="{ 'is-wide': widget.size === '2x4' }"
            >
              <span class="todo-icon-main">
                <strong>待办事项({{ unfinishedTodoTasks.length }})</strong>
                <span
                  v-for="task in todoOuterRows"
                  :key="task.id"
                  class="todo-icon-row"
                  :class="{ 'has-checkbox': widget.size === '2x4' }"
                >
                  <span
                    v-if="widget.size === '2x4'"
                    class="todo-icon-check"
                    aria-hidden="true"
                    @click.stop="toggleTodoTask(task)"
                  ></span>
                  <i v-else></i>
                  <em>{{ task.title }}</em>
                </span>
              </span>
            </span>
          </template>

          <template v-else-if="widget.kind === 'stock'">
            <dl>
              <div>
                <dt>九安医疗</dt>
                <dd>002432</dd>
                <em class="up">5.66%</em><b>74.68</b>
              </div>
              <div>
                <dt>宁德时代</dt>
                <dd>300750</dd>
                <em class="up">0.75%</em><b>417.84</b>
              </div>
              <div>
                <dt>数字政通</dt>
                <dd>300075</dd>
                <em class="down">-0.95%</em><b>13.6</b>
              </div>
            </dl>
          </template>

          <template v-else-if="widget.kind === 'exchange-rate'">
            <small>5-21更新 <b>100CNY</b></small>
            <dl>
              <div>
                <img alt="" :src="sourceAssets.usd" />
                <dt>美元</dt>
                <dd>USD</dd>
                <em>14.66</em>
              </div>
              <div>
                <img alt="" :src="sourceAssets.hkd" />
                <dt>港币</dt>
                <dd>HKD</dd>
                <em>114.83</em>
              </div>
              <div>
                <img alt="" :src="sourceAssets.eur" />
                <dt>欧元</dt>
                <dd>EUR</dd>
                <em>12.63</em>
              </div>
            </dl>
          </template>

          <template v-else-if="widget.kind === 'gradient'">
            <img alt="" :src="sourceAssets.gradient" />
          </template>

          <template v-else-if="widget.kind === 'habit'">
            <strong>0/8</strong>
            <span>每天8杯水</span>
            <i v-for="n in 8" :key="n"></i>
          </template>

          <template v-else-if="widget.kind === 'tomato'">
            <span class="tomato-icon-wrap" :class="`iconsize-${widget.size}`">
              <span class="tomato-bg-carousel" aria-hidden="true">
                <span
                  v-for="(theme, themeIndex) in tomatoThemes"
                  :key="`tomato-outer-${widget.size}-${theme.path}`"
                  class="tomato-bg-item"
                  :class="{ active: themeIndex === activeTomatoThemeIndex }"
                  :style="{
                    transform: `translateX(${(themeIndex - activeTomatoThemeIndex) * 100}%)`,
                  }"
                >
                  <span class="tomato-bg-dim"></span>
                  <img
                    alt="bg"
                    :src="tomatoImageUrl(theme.path, widget.size)"
                  />
                </span>
              </span>
              <span v-if="widget.size === '2x4'" class="tomato-switch-btn">
                <i
                  class="tomato-switch-action"
                  role="button"
                  tabindex="0"
                  aria-label="上一个番茄背景"
                  @click.stop="switchTomatoTheme(-1)"
                  @keydown.enter.stop.prevent="switchTomatoTheme(-1)"
                  @keydown.space.stop.prevent="switchTomatoTheme(-1)"
                >
                  <svg viewBox="0 0 512 512" aria-hidden="true">
                    <path
                      d="M217.9,256L345,129c9.4-9.4,9.4-24.6,0-33.9c-9.4-9.4-24.6-9.3-34,0L167,239c-9.1,9.1-9.3,23.7-0.7,33.1L310.9,417c4.7,4.7,10.9,7,17,7c6.1,0,12.3-2.3,17-7c9.4-9.4,9.4-24.6,0-33.9L217.9,256z"
                    />
                  </svg>
                </i>
                <span class="tomato-theme-name">{{
                  activeTomatoTheme.name
                }}</span>
                <i
                  class="tomato-switch-action"
                  role="button"
                  tabindex="0"
                  aria-label="下一个番茄背景"
                  @click.stop="switchTomatoTheme(1)"
                  @keydown.enter.stop.prevent="switchTomatoTheme(1)"
                  @keydown.space.stop.prevent="switchTomatoTheme(1)"
                >
                  <svg viewBox="0 0 512 512" aria-hidden="true">
                    <path
                      d="M294.1,256L167,129c-9.4-9.4-9.4-24.6,0-33.9c9.4-9.4,24.6-9.3,34,0L345,239c9.1,9.1,9.3,23.7,0.7,33.1L201.1,417c-4.7,4.7-10.9,7-17,7c-6.1,0-12.3-2.3-17-7c-9.4-9.4-9.4-24.6,0-33.9L294.1,256z"
                    />
                  </svg>
                </i>
              </span>
              <span
                v-if="widget.size === '2x4'"
                class="tomato-text-separator"
                >{{ " " }}</span
              >
              <span class="tomato-progress-box">
                <svg
                  v-if="widget.size === '2x2' || widget.size === '2x4'"
                  class="tomato-progress-ring"
                  viewBox="0 0 450 450"
                  fill="none"
                  aria-hidden="true"
                  :data-tomato-progress="tomatoProgressValue"
                >
                  <circle
                    class="tomato-progress-track"
                    :cx="tomatoProgressCenterX"
                    :cy="tomatoProgressCenterY"
                    :r="tomatoProgressRadius"
                  />
                  <circle
                    class="tomato-progress-fill"
                    :cx="tomatoProgressCenterX"
                    :cy="tomatoProgressCenterY"
                    :r="tomatoProgressRadius"
                    :stroke-dasharray="tomatoProgressDashArray"
                    :stroke-dashoffset="tomatoProgressDashOffset"
                    :transform="tomatoProgressTransform"
                    stroke-linecap="butt"
                  />
                  <path
                    v-for="(tickPath, tickIndex) in tomatoTickPaths"
                    :key="`tomato-ring-${widget.size}-${tickIndex}`"
                    :d="tickPath"
                    stroke="currentColor"
                    stroke-width="4"
                    stroke-miterlimit="10"
                    stroke-linecap="round"
                  />
                </svg>
                <span class="tomato-time-grid">
                  <p class="b time">
                    <template v-if="widget.size === '2x1'">
                      <time>{{ tomatoDisplayText.slice(0, 2) }}</time>
                      <time>{{ tomatoDisplayText.slice(3) }}</time>
                    </template>
                    <time v-else>{{ tomatoOuterTime(widget.size) }}</time>
                  </p>
                </span>
                <span
                  class="tomato-outer-controls"
                  :data-tomato-control-state="tomatoPrimaryControlState"
                >
                  <span
                    class="tomato-outer-control tomato-outer-control-primary"
                    role="button"
                    tabindex="0"
                    :aria-label="tomatoPrimaryControlLabel"
                    @click.stop="toggleTomatoTimer"
                    @keydown.enter.stop.prevent="toggleTomatoTimer"
                    @keydown.space.stop.prevent="toggleTomatoTimer"
                  >
                    <svg
                      v-if="tomatoRunning"
                      class="tomato-control-pause-icon"
                      viewBox="0 0 512 512"
                      aria-hidden="true"
                    >
                      <path
                        d="M208 432h-48a16 16 0 0 1-16-16V96a16 16 0 0 1 16-16h48a16 16 0 0 1 16 16v320a16 16 0 0 1-16 16z"
                      />
                      <path
                        d="M352 432h-48a16 16 0 0 1-16-16V96a16 16 0 0 1 16-16h48a16 16 0 0 1 16 16v320a16 16 0 0 1-16 16z"
                      />
                    </svg>
                    <svg
                      v-else
                      class="tomato-control-play-icon"
                      viewBox="0 0 512 512"
                      aria-hidden="true"
                    >
                      <path
                        d="M133 440a35.37 35.37 0 0 1-17.5-4.67c-12-6.8-19.46-20-19.46-34.33V111c0-14.37 7.46-27.53 19.46-34.33a35.13 35.13 0 0 1 35.77.45l247.85 148.36a36 36 0 0 1 0 61l-247.89 148.4A35.5 35.5 0 0 1 133 440z"
                      />
                    </svg>
                  </span>
                  <span
                    v-if="tomatoSecondaryControlVisible"
                    class="tomato-outer-control tomato-outer-control-stop"
                    role="button"
                    tabindex="0"
                    aria-label="停止"
                    @click.stop="stopTomatoTimer"
                    @keydown.enter.stop.prevent="stopTomatoTimer"
                    @keydown.space.stop.prevent="stopTomatoTimer"
                  >
                    <svg viewBox="0 0 512 512" aria-hidden="true">
                      <path
                        d="M392 432H120a40 40 0 0 1-40-40V120a40 40 0 0 1 40-40h272a40 40 0 0 1 40 40v272a40 40 0 0 1-40 40z"
                      />
                    </svg>
                  </span>
                </span>
              </span>
            </span>
          </template>

          <template v-else-if="widget.kind === 'world-clock'">
            <dl>
              <div>
                <dt>12:36</dt>
                <dd>北京</dd>
              </div>
              <div>
                <dt>21:36</dt>
                <dd>洛杉矶</dd>
              </div>
              <div>
                <dt>00:36</dt>
                <dd>纽约</dd>
              </div>
              <div>
                <dt>06:36</dt>
                <dd>巴黎</dd>
              </div>
            </dl>
          </template>

          <template v-else-if="widget.kind === 'converter'">
            <span
              class="converter-card-content"
              :class="`converter-card-size-${converterSizeClass(widget.size)}`"
            >
              <template v-if="widget.size === '1x1'">
                <img
                  class="converter-icon-img"
                  alt=""
                  :src="converterIconImage"
                />
              </template>

              <template v-else-if="widget.size === '1x2'">
                <span class="converter-compact-copy">
                  <span class="converter-compact-title">换算器</span>
                  <span class="converter-compact-sub">快捷转换</span>
                </span>
                <img
                  class="converter-icon-img"
                  alt=""
                  :src="converterIconImage"
                />
              </template>

              <template v-else-if="widget.size === '2x1'">
                <span class="converter-vertical-title">换算器</span>
                <img
                  class="converter-icon-img"
                  alt=""
                  :src="converterIconImage"
                />
              </template>

              <template v-else>
                <span class="converter-card-header" aria-hidden="true">
                  <svg viewBox="0 0 16 16">
                    <path d="M10.5 3.5 6 8l4.5 4.5" />
                  </svg>
                  <span>换算器</span>
                  <svg viewBox="0 0 16 16">
                    <path d="M5.5 3.5 10 8l-4.5 4.5" />
                  </svg>
                </span>
                <span
                  class="converter-tool-grid"
                  :class="`size-${converterSizeClass(widget.size)}`"
                >
                  <span
                    v-for="tool in converterOuterTools(widget.size)"
                    :key="tool.label"
                    class="converter-tool-tile"
                  >
                    <svg
                      :style="{ color: tool.accent }"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path :d="tool.iconPath" />
                    </svg>
                    <b>{{ tool.label }}</b>
                  </span>
                </span>
              </template>
            </span>
          </template>

          <template v-else-if="shouldRenderIpOuterInfo(widget)">
            <span class="ip-outer-card" :class="ipLookupOuterAddressClass">
              <strong class="ip-outer-title">
                {{ ipLookupOuterAddress }}
              </strong>
              <span class="ip-outer-subtitle">
                {{ ipLookupOuterLocation }}
              </span>
            </span>
          </template>

          <template v-else>
            <img
              class="app-item-img mask-100"
              :alt="widget.title"
              :src="widget.icon"
            />
          </template>
          <template #title>{{ widget.title }}</template>
        </ItabLiveWidgetFrame>
      </div>
    </section>

    <footer class="itab-quote">「 此生谁料，心在天山，身老沧洲。 」</footer>

    <div
      v-if="blankMenu.show"
      class="itab-native-menu blank-menu"
      :style="{ left: `${blankMenu.x}px`, top: `${blankMenu.y}px` }"
      @click.stop
    >
      <button type="button" @click="onBlankMenuAction('add')">
        <span>添加图标</span><b>＋</b>
      </button>
      <button type="button" @click="onBlankMenuAction('换壁纸')">
        <span>换壁纸</span><b>⇩ ♡</b>
      </button>
      <button type="button" @click="onBlankMenuAction('本地搜索')">
        <span>本地搜索</span><b>Ctrl+F</b>
      </button>
      <button type="button" @click="onBlankMenuAction('立即备份')">
        <span>立即备份</span><b>○</b>
      </button>
      <button type="button" @click="onBlankMenuAction('设置')">
        <span>设置</span><b>⚙</b>
      </button>
    </div>

    <div
      v-if="widgetMenu.show"
      class="itab-native-menu widget-menu"
      :style="{ left: `${widgetMenu.x}px`, top: `${widgetMenu.y}px` }"
      @click.stop
    >
      <div class="layout-title">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3.5" y="3.5" width="17" height="17" rx="2.2" />
          <path d="M9 3.5v17M3.5 9h17M15 9v11.5" />
        </svg>
        <span>布局</span>
      </div>
      <div class="layout-buttons">
        <button
          v-for="option in widgetSizeMenuOptions"
          :key="option.size"
          type="button"
          :class="{ active: option.active }"
          :disabled="!option.enabled"
          @click="setWidgetSize(option.size)"
        >
          {{ option.size }}
        </button>
      </div>
      <button
        class="widget-menu-action"
        type="button"
        @click="onWidgetMenuAction('edit-icon')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5.8A1.8 1.8 0 0 1 5.8 4h9.4A1.8 1.8 0 0 1 17 5.8V11" />
          <path d="M7 8h7M7 11h5" />
          <path
            d="M14.4 18.8 19 14.2a1.85 1.85 0 0 1 2.6 2.62L17 21.4l-3.5.7.7-3.3Z"
          />
        </svg>
        <span>编辑图标</span>
      </button>
      <button
        class="widget-menu-action"
        type="button"
        @click="onWidgetMenuAction('编辑主页')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5.8A1.8 1.8 0 0 1 5.8 4h9.4A1.8 1.8 0 0 1 17 5.8V11" />
          <path d="M7 8h7M7 11h5" />
          <path
            d="M14.4 18.8 19 14.2a1.85 1.85 0 0 1 2.6 2.62L17 21.4l-3.5.7.7-3.3Z"
          />
        </svg>
        <span>编辑主页</span>
      </button>
      <button
        class="widget-menu-action"
        type="button"
        @click="onWidgetMenuAction('delete')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16" />
          <path
            d="M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7"
          />
          <path
            d="m6.5 7 .8 12A2.2 2.2 0 0 0 9.5 21h5a2.2 2.2 0 0 0 2.2-2l.8-12"
          />
          <path d="M10 11v6M14 11v6" />
        </svg>
        <span>删除</span>
      </button>
    </div>

    <div
      v-if="showAddModal"
      class="itab-native-modal"
      role="dialog"
      aria-modal="true"
      @click.self="showAddModal = false"
    >
      <section class="add-window">
        <div class="traffic">
          <button class="green" type="button" aria-label="maximize"></button>
          <button
            class="red"
            type="button"
            aria-label="close"
            @click="showAddModal = false"
          ></button>
        </div>
        <aside>
          <button
            :class="{ active: addTab === 'widget' }"
            type="button"
            @click="addTab = 'widget'"
          >
            ▦ 小组件
          </button>
          <button
            :class="{ active: addTab === 'site' }"
            type="button"
            @click="addTab = 'site'"
          >
            ◎ 网址导航
          </button>
          <button
            :class="{ active: addTab === 'custom' }"
            type="button"
            @click="addTab = 'custom'"
          >
            ✐ 自定义图标
          </button>
        </aside>
        <div class="add-main">
          <header>
            <input placeholder="输入并搜索" />
            <label
              >添加到:
              <select>
                <option>主页</option>
                <option>编程</option>
              </select></label
            >
          </header>
          <div class="chips">
            <button type="button" class="active">探索</button>
            <button type="button">全部</button>
            <button type="button">效率</button>
            <button type="button">工具</button>
            <button type="button">开发</button>
            <button type="button">设计</button>
            <button type="button">创意</button>
            <button type="button">娱乐</button>
            <button type="button">其他</button>
          </div>

          <div v-if="addTab === 'widget'" class="add-grid">
            <article>
              <h3>今日诗词</h3>
              <p>每天一句诗词名句，也可以查看名句出处，以及全文释义</p>
              <div class="poem-preview">{{ poemPreview.sentence }}</div>
              <button type="button" @click="addCatalogItem('今日诗词')">
                添加
              </button>
              <small>🔥 7.17万</small>
            </article>
            <article>
              <h3>番茄时钟</h3>
              <p>沉浸式专注计时，搭配白噪声与休息提醒</p>
              <div class="tomato-preview">00:00</div>
              <button type="button" @click="addCatalogItem('番茄时钟')">
                添加
              </button>
              <small>🔥 2.6万</small>
            </article>
            <article>
              <h3>汇率</h3>
              <p>查看常用外币兑人民币实时参考汇率</p>
              <div class="exchange-preview">100CNY<br />USD 14.66</div>
              <button type="button" @click="addCatalogItem('汇率')">
                添加
              </button>
            </article>
            <article>
              <h3>网速测试</h3>
              <p>快速检测当前网络延迟、下载速度和上传速度</p>
              <img alt="" :src="sourceAssets.speedtest" />
              <button type="button" @click="addCatalogItem('网速测试')">
                添加
              </button>
            </article>
          </div>

          <div v-else-if="addTab === 'site'" class="site-grid">
            <button
              v-for="widget in widgets.filter((item) => item.icon).slice(0, 12)"
              :key="widget.id"
              type="button"
              @click="addCatalogItem(widget.title)"
            >
              <img :alt="widget.title" :src="widget.icon" />
              <span>{{ widget.title }}</span>
              <b>添加</b>
            </button>
          </div>

          <form
            v-else
            class="custom-form"
            @submit.prevent="addCatalogItem('自定义图标')"
          >
            <div class="custom-preview">自</div>
            <label>网址<input placeholder="https://" /></label>
            <label>名称<input placeholder="自定义图标" /></label>
            <label>图标文字<input placeholder="A" /></label>
            <button type="submit">保存</button>
          </form>
        </div>
      </section>
    </div>

    <ItabLiveOpenedShell
      v-if="openedWidget"
      :widget="openedWidget"
      :instance-override="openedWidget.openedShell"
      :caller-override="props.openedShellOverride"
      @request-close="closeOpenedWidget"
    >
      <template #default="{ requestClose }">
        <template v-if="openedWidget.kind === 'weather'">
          <ItabWeatherOpenedPanel
            :widget="itabLiveWeatherWidget"
            @update-data="updateItabLiveWeatherData"
          />
        </template>

        <template v-else-if="openedWidget.kind === 'hotsearch'">
          <header class="opened-hot-head">
            <div class="opened-hot-logo" aria-hidden="true">榜</div>
            <nav>
              <button
                v-for="tab in hotPanelTabs"
                :key="tab"
                :class="{ active: tab === '我的订阅' }"
                type="button"
              >
                {{ tab }}
              </button>
            </nav>
          </header>
          <div class="opened-hot-body">
            <aside>
              <label>搜索</label>
              <button
                v-for="source in hotPanelSources"
                :key="source.name"
                :class="{ active: source.active }"
                type="button"
              >
                <span>{{ source.icon }}</span>
                <b>{{ source.name }}</b>
                <em>•••</em>
              </button>
            </aside>
            <section>
              <h3><span>☸</span> 百度 · 实时热点 <i>i</i></h3>
              <ol>
                <li v-for="(item, hotIndex) in hotPanelItems" :key="item">
                  <b>{{ hotIndex + 1 }}</b>
                  <span>{{ item }}</span>
                  <em>{{ (780.9 - hotIndex * 9.7).toFixed(1) }}万</em>
                </li>
              </ol>
            </section>
          </div>
        </template>

        <template v-else-if="openedWidget.kind === 'exchange-rate'">
          <div class="opened-exchange-grid">
            <aside>
              <header>货币汇率<span>更新于:2026-05-20 08:00</span></header>
              <div class="currency-base">
                <strong>🇨🇳 CNY</strong>
                <b>100</b>
                <span>人民币</span>
              </div>
              <p>我的自选 <button type="button">＋</button></p>
              <button
                v-for="currency in exchangeCurrencies"
                :key="currency.code"
                :class="{ active: currency.code === 'USD' }"
                type="button"
              >
                <img v-if="currency.asset" alt="" :src="currency.asset" />
                <span v-else>{{ currency.flag }}</span>
                <b>{{ currency.code }}</b>
                <strong>{{ currency.value }}</strong>
                <em>{{ currency.name }}</em>
              </button>
            </aside>
            <section>
              <div class="exchange-convert">
                <span>🇨🇳<b>人民币</b></span>
                <i>→</i>
                <span>🇺🇸<b>美元</b></span>
                <strong>0.1466<em>1人民币=0.1466美元</em></strong>
              </div>
              <div class="exchange-tabs">
                <button type="button" class="active">48小时</button>
                <button type="button">1周</button>
                <button type="button">1个月</button>
                <button type="button">6个月</button>
                <button type="button">1年</button>
              </div>
              <dl class="exchange-stats">
                <div>
                  <dt>最高</dt>
                  <dd>0.147144</dd>
                </div>
                <div>
                  <dt>最低</dt>
                  <dd>0.146719</dd>
                </div>
                <div>
                  <dt>平均</dt>
                  <dd>0.1469</dd>
                </div>
              </dl>
              <div class="exchange-chart" aria-hidden="true">
                <svg viewBox="0 0 640 290">
                  <defs>
                    <linearGradient
                      id="exchangeArea"
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stop-color="#6f8fe6"
                        stop-opacity="0.38"
                      />
                      <stop
                        offset="100%"
                        stop-color="#6f8fe6"
                        stop-opacity="0.03"
                      />
                    </linearGradient>
                  </defs>
                  <path
                    d="M30 88 L72 56 L111 88 L153 86 L222 87 L268 86 L305 172 L346 196 L392 212 L430 235 L486 238 L558 186 L610 136 L610 262 L30 262 Z"
                    fill="url(#exchangeArea)"
                  />
                  <polyline
                    fill="none"
                    points="30,88 72,56 111,88 153,86 222,87 268,86 305,172 346,196 392,212 430,235 486,238 558,186 610,136"
                    stroke="#5b7fd6"
                    stroke-width="3"
                  />
                  <g fill="#5b7fd6">
                    <circle cx="30" cy="88" r="4" />
                    <circle cx="72" cy="56" r="4" />
                    <circle cx="111" cy="88" r="4" />
                    <circle cx="268" cy="86" r="4" />
                    <circle cx="305" cy="172" r="4" />
                    <circle cx="430" cy="235" r="4" />
                    <circle cx="558" cy="186" r="4" />
                    <circle cx="610" cy="136" r="4" />
                  </g>
                </svg>
              </div>
            </section>
          </div>
        </template>

        <template v-else-if="openedWidget.kind === 'tomato'">
          <div
            class="opened-tomato-body"
            :data-tomato-phase="tomatoPhase"
            :data-tomato-running="String(tomatoRunning)"
            :data-tomato-remaining="String(tomatoCountdownSeconds)"
            :data-tomato-sessions="String(tomatoSessions)"
            :data-tomato-audio-src="activeTomatoAudioUrl"
            :data-tomato-audio-enabled="String(tomatoAudioEnabled)"
            :data-tomato-audio-blocked="String(tomatoAudioBlocked)"
            :data-tomato-progress="tomatoProgressValue"
          >
            <div class="opened-tomato-bg-stack" aria-hidden="true">
              <img
                v-for="(theme, themeIndex) in tomatoThemes"
                :key="`opened-tomato-${theme.path}`"
                alt="bg"
                :class="{ active: themeIndex === activeTomatoThemeIndex }"
                :src="tomatoImageUrl(theme.path, 'opened')"
              />
            </div>
            <div class="opened-tomato-content">
              <div class="opened-tomato-tool" aria-hidden="true">
                <span class="opened-tomato-fullscreen">
                  <svg viewBox="0 0 200 200">
                    <path
                      d="M153.131 37L76.1311 37.3443C70.623 37.3443 69.3607 40.5574 73.2623 44.3443L155.77 126.852C159.672 130.754 162.77 129.377 162.77 123.984L163 46.9836C163 41.4754 158.525 37 153.131 37ZM44.2295 73.2623C40.3279 69.3607 37.2295 70.7377 37.2295 76.1311L37 153.131C37 158.639 41.4754 163 46.8689 163L123.869 162.656C129.377 162.656 130.639 159.443 126.738 155.656L44.2295 73.2623Z"
                    />
                  </svg>
                </span>
                <button
                  type="button"
                  class="opened-tomato-close"
                  tabindex="-1"
                  @click.stop="requestClose()"
                >
                  <svg viewBox="0 0 11 11">
                    <path
                      d="M8.55 10.58L5.5 7.53L2.45 10.58C1.89 11.14 0.98 11.14 0.42 10.58C-0.14 10.02 -0.14 9.11 0.42 8.55L3.47 5.5L0.42 2.45C-0.14 1.89 -0.14 0.98 0.42 0.42C0.98 -0.14 1.89 -0.14 2.45 0.42L5.5 3.47L8.55 0.42C9.11 -0.14 10.02 -0.14 10.58 0.42C11.14 0.98 11.14 1.89 10.58 2.45L7.53 5.5L10.58 8.55C11.14 9.11 11.14 10.02 10.58 10.58C10.02 11.14 9.11 11.14 8.55 10.58Z"
                    />
                  </svg>
                </button>
              </div>
              <div class="opened-tomato-theme">
                <button
                  type="button"
                  aria-label="上一个番茄背景"
                  @click.stop="switchTomatoTheme(-1)"
                >
                  <svg viewBox="0 0 512 512" aria-hidden="true">
                    <path
                      d="M217.9,256L345,129c9.4-9.4,9.4-24.6,0-33.9c-9.4-9.4-24.6-9.3-34,0L167,239c-9.1,9.1-9.3,23.7-0.7,33.1L310.9,417c4.7,4.7,10.9,7,17,7c6.1,0,12.3-2.3,17-7c9.4-9.4,9.4-24.6,0-33.9L217.9,256z"
                    />
                  </svg>
                </button>
                <span>{{ activeTomatoTheme.name }}</span>
                <button
                  type="button"
                  aria-label="下一个番茄背景"
                  @click.stop="switchTomatoTheme(1)"
                >
                  <svg viewBox="0 0 512 512" aria-hidden="true">
                    <path
                      d="M294.1,256L167,129c-9.4-9.4-9.4-24.6,0-33.9c9.4-9.4,24.6-9.3,34,0L345,239c9.1,9.1,9.3,23.7,0.7,33.1L201.1,417c-4.7,4.7-10.9,7-17,7c-6.1,0-12.3-2.3-17-7c-9.4-9.4-9.4-24.6,0-33.9L294.1,256z"
                    />
                  </svg>
                </button>
              </div>
              <div class="tomato-dial">
                <svg
                  class="tomato-dial-ring"
                  viewBox="0 0 450 450"
                  fill="none"
                  aria-hidden="true"
                  :data-tomato-progress="tomatoProgressValue"
                >
                  <circle
                    class="tomato-progress-track"
                    :cx="tomatoProgressCenterX"
                    :cy="tomatoProgressCenterY"
                    :r="tomatoProgressRadius"
                  />
                  <circle
                    class="tomato-progress-fill"
                    :cx="tomatoProgressCenterX"
                    :cy="tomatoProgressCenterY"
                    :r="tomatoProgressRadius"
                    :stroke-dasharray="tomatoProgressDashArray"
                    :stroke-dashoffset="tomatoProgressDashOffset"
                    :transform="tomatoProgressTransform"
                    stroke-linecap="butt"
                  />
                  <path
                    v-for="(tickPath, tickIndex) in tomatoTickPaths"
                    :key="`opened-tomato-ring-${tickIndex}`"
                    :d="tickPath"
                    stroke="currentColor"
                    stroke-width="4"
                    stroke-miterlimit="10"
                    stroke-linecap="round"
                  />
                </svg>
                <strong>{{ tomatoDisplayText }}</strong>
              </div>
              <div
                class="opened-tomato-controls"
                :data-tomato-control-state="tomatoPrimaryControlState"
              >
                <button
                  type="button"
                  class="opened-tomato-control opened-tomato-start"
                  :class="`is-${tomatoPrimaryControlState}`"
                  :aria-label="tomatoPrimaryControlLabel"
                  @click.stop="toggleTomatoTimer"
                >
                  <svg
                    v-if="tomatoRunning"
                    class="tomato-control-pause-icon"
                    viewBox="0 0 512 512"
                    aria-hidden="true"
                  >
                    <path
                      d="M208 432h-48a16 16 0 0 1-16-16V96a16 16 0 0 1 16-16h48a16 16 0 0 1 16 16v320a16 16 0 0 1-16 16z"
                    />
                    <path
                      d="M352 432h-48a16 16 0 0 1-16-16V96a16 16 0 0 1 16-16h48a16 16 0 0 1 16 16v320a16 16 0 0 1-16 16z"
                    />
                  </svg>
                  <svg
                    v-else
                    class="tomato-control-play-icon"
                    viewBox="0 0 512 512"
                    aria-hidden="true"
                  >
                    <path
                      d="M133 440a35.37 35.37 0 0 1-17.5-4.67c-12-6.8-19.46-20-19.46-34.33V111c0-14.37 7.46-27.53 19.46-34.33a35.13 35.13 0 0 1 35.77.45l247.85 148.36a36 36 0 0 1 0 61l-247.89 148.4A35.5 35.5 0 0 1 133 440z"
                    />
                  </svg>
                </button>
                <button
                  v-if="tomatoSecondaryControlVisible"
                  type="button"
                  class="opened-tomato-control opened-tomato-stop"
                  aria-label="停止"
                  @click.stop="stopTomatoTimer"
                >
                  <svg viewBox="0 0 512 512" aria-hidden="true">
                    <path
                      d="M392 432H120a40 40 0 0 1-40-40V120a40 40 0 0 1 40-40h272a40 40 0 0 1 40 40v272a40 40 0 0 1-40 40z"
                    />
                  </svg>
                </button>
              </div>
              <button
                type="button"
                class="opened-tomato-audio"
                :class="{
                  active: tomatoAudioEnabled,
                  muted: !tomatoAudioEnabled,
                  blocked: tomatoAudioBlocked,
                }"
                aria-label="声音"
                :aria-pressed="tomatoAudioEnabled"
                :data-tomato-audio-icon="tomatoAudioIconState"
                :title="
                  tomatoAudioBlocked
                    ? '浏览器阻止自动播放，点击开始后会重试'
                    : activeTomatoTheme.name
                "
                @click.stop="toggleTomatoAudio"
              >
                <svg viewBox="0 0 512 512" aria-hidden="true">
                  <path
                    d="M96 192h86l112-96c20-17 50-3 50 23v274c0 26-30 40-50 23L182 320H96c-18 0-32-14-32-32v-64c0-18 14-32 32-32z"
                  />
                  <path
                    d="M392 180c24 20 40 48 40 76s-16 56-40 76l-23-28c16-13 25-30 25-48s-9-35-25-48l23-28z"
                  />
                  <path
                    d="M432 146c43 29 72 72 72 110s-29 81-72 110l-24-32c31-21 52-51 52-78s-21-57-52-78l24-32z"
                  />
                  <path class="tomato-sound-slash" d="M112 104l296 296" />
                </svg>
              </button>
            </div>
          </div>
        </template>

        <template v-else-if="openedWidget.kind === 'calendar'">
          <div
            class="opened-calendar-panel"
            :class="{ 'is-tools': calendarActiveTab === 'tools' }"
          >
            <section class="calendar-main-pane">
              <div
                class="calendar-segmented"
                :class="{ 'is-tools': calendarActiveTab === 'tools' }"
              >
                <button
                  :class="{ active: calendarActiveTab === 'calendar' }"
                  type="button"
                  @click="calendarActiveTab = 'calendar'"
                >
                  日历
                </button>
                <button
                  :class="{ active: calendarActiveTab === 'tools' }"
                  type="button"
                  @click="calendarActiveTab = 'tools'"
                >
                  工具
                </button>
              </div>
              <template v-if="calendarActiveTab === 'calendar'">
                <header class="calendar-toolbar">
                  <label>
                    <span class="calendar-picker-icon" aria-hidden="true">
                      <svg viewBox="0 0 1024 1024">
                        <path
                          fill="currentColor"
                          d="M128 384v512h768V192H768v32a32 32 0 1 1-64 0v-32H320v32a32 32 0 0 1-64 0v-32H128v128h768v64zm192-256h384V96a32 32 0 1 1 64 0v32h160a32 32 0 0 1 32 32v768a32 32 0 0 1-32 32H96a32 32 0 0 1-32-32V160a32 32 0 0 1 32-32h160V96a32 32 0 0 1 64 0zm-32 384h64a32 32 0 0 1 0 64h-64a32 32 0 0 1 0-64m0 192h64a32 32 0 1 1 0 64h-64a32 32 0 1 1 0-64m192-192h64a32 32 0 0 1 0 64h-64a32 32 0 0 1 0-64m0 192h64a32 32 0 1 1 0 64h-64a32 32 0 1 1 0-64m192-192h64a32 32 0 1 1 0 64h-64a32 32 0 1 1 0-64m0 192h64a32 32 0 1 1 0 64h-64a32 32 0 1 1 0-64"
                        />
                      </svg>
                    </span>
                    <input :value="calendarYearTitle" readonly />
                  </label>
                  <label>
                    <span class="calendar-picker-icon" aria-hidden="true">
                      <svg viewBox="0 0 1024 1024">
                        <path
                          fill="currentColor"
                          d="M128 384v512h768V192H768v32a32 32 0 1 1-64 0v-32H320v32a32 32 0 0 1-64 0v-32H128v128h768v64zm192-256h384V96a32 32 0 1 1 64 0v32h160a32 32 0 0 1 32 32v768a32 32 0 0 1-32 32H96a32 32 0 0 1-32-32V160a32 32 0 0 1 32-32h160V96a32 32 0 0 1 64 0zm-32 384h64a32 32 0 0 1 0 64h-64a32 32 0 0 1 0-64m0 192h64a32 32 0 1 1 0 64h-64a32 32 0 1 1 0-64m192-192h64a32 32 0 0 1 0 64h-64a32 32 0 0 1 0-64m0 192h64a32 32 0 1 1 0 64h-64a32 32 0 1 1 0-64m192-192h64a32 32 0 1 1 0 64h-64a32 32 0 1 1 0-64m0 192h64a32 32 0 1 1 0 64h-64a32 32 0 1 1 0-64"
                        />
                      </svg>
                    </span>
                    <input :value="calendarMonthTitle" readonly />
                  </label>
                  <button
                    type="button"
                    aria-label="上一月"
                    @click="shiftCalendarMonth(-1)"
                  >
                    <svg
                      class="calendar-nav-icon"
                      viewBox="0 0 1024 1024"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M609.408 149.376 277.76 489.6a32 32 0 0 0 0 44.672l331.648 340.352a29.12 29.12 0 0 0 41.728 0 30.592 30.592 0 0 0 0-42.752L339.264 511.936l311.872-319.872a30.592 30.592 0 0 0 0-42.688 29.12 29.12 0 0 0-41.728 0z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="下一月"
                    @click="shiftCalendarMonth(1)"
                  >
                    <svg
                      class="calendar-nav-icon"
                      viewBox="0 0 1024 1024"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M340.864 149.312a30.592 30.592 0 0 0 0 42.752L652.736 512 340.864 831.872a30.592 30.592 0 0 0 0 42.752 29.12 29.12 0 0 0 41.728 0L714.24 534.336a32 32 0 0 0 0-44.672L382.592 149.376a29.12 29.12 0 0 0-41.728 0z"
                      />
                    </svg>
                  </button>
                  <button
                    class="calendar-today-button"
                    type="button"
                    @click="resetCalendarToday"
                  >
                    今
                  </button>
                  <button
                    class="calendar-week-start-switch"
                    :class="{ 'is-checked': calendarWeekStartsMonday }"
                    title="一周开始日"
                    type="button"
                    @click="toggleCalendarWeekStart"
                  >
                    <span>{{ calendarWeekStartsMonday ? "一" : "日" }}</span>
                  </button>
                </header>
                <div
                  class="calendar-month-board"
                  :data-month="displayedCalendarMonth"
                >
                  <b class="calendar-watermark">{{ displayedCalendarMonth }}</b>
                  <div class="calendar-weekdays">
                    <span v-for="day in calendarWeekdays" :key="day">{{
                      day
                    }}</span>
                  </div>
                  <button
                    v-for="(cell, index) in visibleCalendarCells"
                    :key="`${displayedCalendarMonth}-${index}-${cell.day}-${cell.lunar}`"
                    class="calendar-day-cell"
                    :class="{
                      active: isCalendarTodayCell(cell),
                      selected: isCalendarCellSelected(cell),
                      muted: cell.muted,
                      weekend: cell.weekend,
                      holiday: cell.holiday,
                      workday: cell.workday,
                      festival: Boolean(cell.label),
                    }"
                    type="button"
                    @click.stop="selectCalendarCell(cell)"
                  >
                    <em v-if="cell.tag">{{ cell.tag }}</em>
                    <strong>{{ cell.day }}</strong>
                    <small :title="cell.label || cell.lunar">{{
                      cell.label || cell.lunar
                    }}</small>
                  </button>
                </div>
              </template>
              <div v-else class="calendar-tools-pane">
                <section>
                  <div class="calendar-tools-tabs">
                    <button class="active" type="button">日期差计算</button>
                    <button type="button">工作日计算</button>
                    <button type="button">节日大全</button>
                  </div>
                  <h3>自然日间隔计算:</h3>
                  <label>开始时间<input value="2026-05-22" readonly /></label>
                  <label>结束时间<input value="2026-05-22" readonly /></label>
                  <label>相差天数<input value="0 天" readonly /></label>
                  <button type="button">重置</button>
                </section>
                <section>
                  <h3>日期加减计算:</h3>
                  <label>开始时间<input value="2026-05-22" readonly /></label>
                  <label>间隔天数<input value="0" readonly /></label>
                  <label
                    >结果<input value="2026年05月22日 周五" readonly
                  /></label>
                  <button type="button">重置</button>
                </section>
              </div>
            </section>
            <aside
              v-if="calendarActiveTab === 'calendar'"
              class="calendar-info-pane"
            >
              <div class="calendar-info-date">
                <span>{{ selectedCalendarDetail.dateLabel }}</span>
                <div>
                  <b>{{ selectedCalendarDetail.day }}</b>
                </div>
                <p>
                  {{ selectedCalendarDetail.lunarDate }}<br />{{
                    selectedCalendarDetail.yearLabel
                  }}
                </p>
                <strong>{{ selectedCalendarDetail.weekText }}</strong>
                <small v-if="selectedCalendarDetail.distance">{{
                  selectedCalendarDetail.distance
                }}</small>
              </div>
              <dl class="calendar-info-list">
                <div
                  v-for="row in calendarInfoRows.slice(0, 3)"
                  :key="row.type"
                >
                  <dt :class="row.tone">{{ row.type }}</dt>
                  <dd>{{ row.value }}</dd>
                </div>
                <div class="calendar-almanac-row">
                  <dt class="green">宜</dt>
                  <dd>{{ selectedCalendarDetail.yi }}</dd>
                  <dt class="red">忌</dt>
                  <dd>{{ selectedCalendarDetail.ji }}</dd>
                </div>
                <div class="dual">
                  <dt>月相</dt>
                  <dd>{{ selectedCalendarDetail.moon }}</dd>
                  <dt>物候</dt>
                  <dd>{{ selectedCalendarDetail.phenology }}</dd>
                </div>
                <div class="calendar-directions-row">
                  <ul class="calendar-directions">
                    <li
                      v-for="direction in selectedCalendarDetail.directions"
                      :key="direction"
                    >
                      {{ direction }}
                    </li>
                  </ul>
                </div>
              </dl>
            </aside>
          </div>
        </template>

        <template
          v-else-if="
            openedWidget.kind === 'anniversary' ||
            openedWidget.kind === 'anniversary-day'
          "
        >
          <div
            class="opened-anniversary-panel"
            :class="{ 'is-aside-collapsed': anniversaryAsideCollapsed }"
          >
            <section class="anniversary-template-pane">
              <p class="anniversary-editor-tip">
                此列表为模板，选中后可修改文字和日期可以改变成任何类型的倒计时，添加后可以在桌面右键编辑/删除
              </p>
              <div class="anniversary-template-divider"></div>
              <div class="anniversary-editor-heading">
                <strong>组件模板列表</strong>
              </div>
              <div class="anniversary-size-row" aria-label="组件尺寸">
                <button
                  v-for="size in anniversaryEditorSizes"
                  :key="`anniversary-size-${size}`"
                  type="button"
                  :class="{ active: anniversaryEditor.size === size }"
                  @click="setAnniversaryEditorSize(size)"
                >
                  {{ size }}
                </button>
              </div>
              <div
                class="anniversary-template-grid"
                :class="`size-${anniversaryEditor.size.replace('x', '-')}`"
              >
                <div
                  v-for="template in anniversaryTemplateList"
                  :key="template.id"
                  class="anniversary-template-card"
                  role="button"
                  tabindex="0"
                  :class="[
                    `size-${anniversaryEditor.size.replace('x', '-')}`,
                    { active: isAnniversaryTemplateActive(template) },
                  ]"
                  @click="selectAnniversaryTemplate(template)"
                  @keydown.enter.prevent="selectAnniversaryTemplate(template)"
                  @keydown.space.prevent="selectAnniversaryTemplate(template)"
                >
                  <span class="anniversary-template-size">{{
                    anniversaryEditor.size
                  }}</span>
                  <span
                    class="anniversary-mini-card"
                    :class="[
                      `size-${anniversaryEditor.size.replace('x', '-')}`,
                      {
                        'with-calendar': anniversaryUsesCalendar(
                          anniversaryTemplateThumbnailWithSize(template),
                        ),
                        'is-payday': template.id === 'payday',
                        'is-template-love': template.id === 'love',
                        'is-template-life':
                          template.id === 'life' ||
                          template.id === 'plain-life',
                      },
                    ]"
                    :style="anniversaryTemplateThumbnailStyle(template)"
                  >
                    <span class="anniversary-card-copy">
                      <span>{{ template.label }}</span>
                      <strong
                        >{{
                          anniversaryDays(
                            template.date,
                            template.mode,
                            template.repeat,
                          )
                        }}<small v-if="template.eventName !== '发工资还有'"
                          >天</small
                        ></strong
                      >
                      <em v-if="template.eventName !== '发工资还有'">{{
                        template.date
                      }}</em>
                    </span>
                    <span
                      v-if="
                        anniversaryUsesCalendar(
                          anniversaryTemplateThumbnailWithSize(template),
                        )
                      "
                      class="anniversary-card-calendar"
                    >
                      <i
                        v-for="day in anniversaryWeekdays"
                        :key="`mini-week-${template.id}-${day}`"
                        >{{ day }}</i
                      >
                      <b
                        v-for="(day, dayIndex) in anniversaryCalendarDays"
                        :key="`mini-day-${template.id}-${dayIndex}`"
                        :class="{
                          muted: dayIndex < 4,
                          weekend: dayIndex % 7 > 4,
                          today: day === 21 && dayIndex > 20,
                        }"
                      >
                        {{ day }}
                      </b>
                    </span>
                  </span>
                  <b>{{ template.title }}</b>
                </div>
              </div>
            </section>

            <section class="anniversary-preview-pane">
              <button
                type="button"
                class="anniversary-preview-arrow previous"
                aria-label="上一个尺寸"
                @click="shiftAnniversaryPreview(-1)"
              >
                ‹
              </button>
              <div
                class="anniversary-preview-stage"
                :class="`size-${activeAnniversaryPreviewSize.replace('x', '-')}`"
              >
                <div
                  v-for="item in anniversaryPreviewItems"
                  :key="item.key"
                  class="anniversary-live-preview"
                  :class="[
                    `size-${item.template.size.replace('x', '-')}`,
                    `is-${item.placement}`,
                    {
                      'with-calendar': anniversaryUsesCalendar(item.template),
                      'is-payday':
                        item.template.id === 'payday' ||
                        item.template.eventName === '发工资还有',
                    },
                  ]"
                  :style="
                    item.placement === 'current'
                      ? anniversaryPreviewStyle
                      : anniversaryTemplateStyle(item.template)
                  "
                >
                  <span class="anniversary-card-copy">
                    <span>{{ item.template.label }}</span>
                    <strong
                      >{{
                        anniversaryDays(
                          item.template.date,
                          item.template.mode,
                          item.template.repeat,
                        )
                      }}<small v-if="item.template.eventName !== '发工资还有'"
                        >天</small
                      ></strong
                    >
                    <em v-if="item.template.eventName !== '发工资还有'">{{
                      item.template.date
                    }}</em>
                  </span>
                  <span
                    v-if="anniversaryUsesCalendar(item.template)"
                    class="anniversary-card-calendar"
                  >
                    <i
                      v-for="day in anniversaryWeekdays"
                      :key="`preview-week-${item.key}-${day}`"
                      >{{ day }}</i
                    >
                    <b
                      v-for="(day, dayIndex) in anniversaryCalendarDays"
                      :key="`preview-day-${item.key}-${dayIndex}`"
                      :class="{
                        muted: dayIndex < 4,
                        weekend: dayIndex % 7 > 4,
                        today: day === 21 && dayIndex > 20,
                      }"
                    >
                      {{ day }}
                    </b>
                  </span>
                </div>
              </div>
              <button
                type="button"
                class="anniversary-preview-arrow next"
                aria-label="下一个尺寸"
                @click="shiftAnniversaryPreview(1)"
              >
                ›
              </button>
              <div
                class="anniversary-carousel-dots"
                role="tablist"
                aria-label="组件模板列表"
              >
                <span
                  v-for="dot in anniversaryCarouselDots.slice(0, 5)"
                  :key="`anniversary-dot-${dot}`"
                  role="button"
                  tabindex="0"
                  :class="{ active: isAnniversaryDotActive(dot) }"
                  :aria-label="`模板 ${dot + 1}`"
                  @click="selectAnniversaryDot(dot)"
                  @keydown.enter.prevent="selectAnniversaryDot(dot)"
                  @keydown.space.prevent="selectAnniversaryDot(dot)"
                ></span>
              </div>
              <strong class="anniversary-preview-name">{{
                anniversaryEditor.title
              }}</strong>
            </section>

            <button
              type="button"
              class="anniversary-collapse-arrow"
              :class="{ active: anniversaryAsideCollapsed }"
              :aria-label="
                anniversaryAsideCollapsed ? '展开模板列表' : '收起模板列表'
              "
              @click="toggleAnniversaryAside"
            >
              {{ anniversaryAsideCollapsed ? "›" : "‹" }}
            </button>

            <section class="anniversary-settings-pane">
              <div class="anniversary-field-row">
                <span>组件名称</span>
                <input
                  v-model="anniversaryEditor.title"
                  aria-label="组件名称"
                />
              </div>
              <div class="anniversary-field-row">
                <span>事件名称</span>
                <label class="anniversary-inline-input">
                  <input
                    v-model="anniversaryEditor.eventName"
                    aria-label="事件名称"
                  />
                  <button
                    type="button"
                    class="anniversary-common-trigger"
                    :class="{ active: anniversaryEditor.showCommonEvents }"
                    @click="toggleAnniversaryCommonEvents"
                  >
                    常用事件
                  </button>
                </label>
                <div
                  v-if="anniversaryEditor.showCommonEvents"
                  class="anniversary-event-popover"
                >
                  <div
                    v-for="eventName in anniversaryCommonEvents"
                    :key="eventName"
                    role="button"
                    tabindex="0"
                    :class="{
                      active: anniversaryEditor.eventName === eventName,
                    }"
                    @click="selectAnniversaryEvent(eventName)"
                    @keydown.enter.prevent="selectAnniversaryEvent(eventName)"
                    @keydown.space.prevent="selectAnniversaryEvent(eventName)"
                  >
                    {{ eventName }}
                  </div>
                </div>
              </div>
              <div class="anniversary-field-row anniversary-date-row">
                <span>日期</span>
                <div class="anniversary-date-input">
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M4 1.5a.75.75 0 0 1 .75.75V3h6.5v-.75a.75.75 0 0 1 1.5 0V3H14a1.5 1.5 0 0 1 1.5 1.5V13A1.5 1.5 0 0 1 14 14.5H2A1.5 1.5 0 0 1 .5 13V4.5A1.5 1.5 0 0 1 2 3h1.25v-.75A.75.75 0 0 1 4 1.5ZM2 6v7h12V6H2Z"
                    />
                  </svg>
                  <button
                    ref="anniversaryDateTriggerRef"
                    type="button"
                    class="anniversary-date-trigger"
                    :class="{ active: anniversaryDatePickerOpen }"
                    aria-label="日期"
                    @click="toggleAnniversaryDatePicker"
                    @keydown.enter.prevent="toggleAnniversaryDatePicker"
                    @keydown.space.prevent="toggleAnniversaryDatePicker"
                  >
                    {{ anniversaryEditor.date }}
                  </button>
                  <Teleport to="body">
                    <div
                      v-if="anniversaryDatePickerOpen"
                      class="anniversary-date-popper"
                      :style="anniversaryDatePickerStyle"
                      role="dialog"
                      aria-label="日期选择"
                    >
                      <div class="anniversary-date-wheel">
                        <div class="anniversary-picker-select"></div>
                        <div class="anniversary-picker-mask"></div>
                        <div
                          class="anniversary-picker-column"
                          @wheel.prevent="
                            handleAnniversaryDateWheel('year', $event)
                          "
                        >
                          <button
                            v-for="slot in visibleAnniversaryYearOptions"
                            :key="slot.key"
                            type="button"
                            :disabled="slot.value === null"
                            :class="{
                              'is-select':
                                slot.value === anniversaryDateParts.year,
                              'is-empty': slot.value === null,
                            }"
                            @click="
                              slot.value !== null &&
                              setAnniversaryDatePart('year', slot.value)
                            "
                          >
                            {{ slot.value ?? "" }}
                          </button>
                        </div>
                        <div
                          class="anniversary-picker-column"
                          @wheel.prevent="
                            handleAnniversaryDateWheel('month', $event)
                          "
                        >
                          <button
                            v-for="slot in visibleAnniversaryMonthOptions"
                            :key="slot.key"
                            type="button"
                            :disabled="slot.value === null"
                            :class="{
                              'is-select':
                                slot.value === anniversaryDateParts.month,
                              'is-empty': slot.value === null,
                            }"
                            @click="
                              slot.value !== null &&
                              setAnniversaryDatePart('month', slot.value)
                            "
                          >
                            {{
                              slot.value === null
                                ? ""
                                : String(slot.value).padStart(2, "0")
                            }}
                          </button>
                        </div>
                        <div
                          class="anniversary-picker-column"
                          @wheel.prevent="
                            handleAnniversaryDateWheel('day', $event)
                          "
                        >
                          <button
                            v-for="slot in visibleAnniversaryDayOptions"
                            :key="slot.key"
                            type="button"
                            :disabled="slot.value === null"
                            :class="{
                              'is-select':
                                slot.value === anniversaryDateParts.day,
                              'is-empty': slot.value === null,
                            }"
                            @click="
                              slot.value !== null &&
                              setAnniversaryDatePart('day', slot.value)
                            "
                          >
                            {{
                              slot.value === null
                                ? ""
                                : String(slot.value).padStart(2, "0")
                            }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </Teleport>
                </div>
                <div class="anniversary-select-wrap anniversary-repeat-select">
                  <div
                    class="anniversary-select-trigger"
                    role="button"
                    tabindex="0"
                    aria-label="不重复"
                    :class="{ active: anniversaryRepeatDropdownOpen }"
                    @click="toggleAnniversaryRepeatDropdown"
                    @keydown.enter.prevent="toggleAnniversaryRepeatDropdown"
                    @keydown.space.prevent="toggleAnniversaryRepeatDropdown"
                  >
                    <span>{{ anniversaryEditor.repeat }}</span>
                    <i></i>
                  </div>
                  <div
                    v-if="anniversaryRepeatDropdownOpen"
                    class="anniversary-select-popper anniversary-repeat-popper"
                  >
                    <div
                      v-for="option in anniversaryRepeatOptions"
                      :key="option"
                      role="button"
                      tabindex="0"
                      :class="{ selected: anniversaryEditor.repeat === option }"
                      @click="selectAnniversaryRepeat(option)"
                      @keydown.enter.prevent="selectAnniversaryRepeat(option)"
                      @keydown.space.prevent="selectAnniversaryRepeat(option)"
                    >
                      {{ option }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="anniversary-field-row anniversary-swatch-row">
                <span>字体颜色</span>
                <div class="anniversary-color-swatches">
                  <span
                    v-for="color in anniversaryTextColors"
                    :key="`anniversary-text-${color}`"
                    role="button"
                    tabindex="0"
                    :class="{
                      active:
                        anniversaryEditor.textColor.toLowerCase() ===
                        color.toLowerCase(),
                    }"
                    :style="{ '--swatch-color': color }"
                    :aria-label="`字体颜色 ${color}`"
                    @click="setAnniversaryTextColor(color)"
                    @keydown.enter.prevent="setAnniversaryTextColor(color)"
                    @keydown.space.prevent="setAnniversaryTextColor(color)"
                  ></span>
                  <span
                    class="anniversary-gradient-swatch"
                    role="button"
                    tabindex="0"
                    aria-label="更多字体颜色"
                    @click="setAnniversaryTextColor('#ffffff')"
                    @keydown.enter.prevent="setAnniversaryTextColor('#ffffff')"
                    @keydown.space.prevent="setAnniversaryTextColor('#ffffff')"
                  ></span>
                </div>
              </div>
              <div class="anniversary-field-row anniversary-background-row">
                <span>背景</span>
                <div class="anniversary-background-mode" aria-label="背景">
                  <button
                    type="button"
                    :class="{
                      active: anniversaryEditor.backgroundMode === 'color',
                    }"
                    @click="setAnniversaryBackgroundMode('color')"
                  >
                    颜色
                  </button>
                  <button
                    type="button"
                    :class="{
                      active: anniversaryEditor.backgroundMode === 'image',
                    }"
                    @click="setAnniversaryBackgroundMode('image')"
                  >
                    图片
                  </button>
                </div>
              </div>
              <div
                v-if="anniversaryEditor.backgroundMode === 'color'"
                class="anniversary-field-row anniversary-swatch-row anniversary-bg-swatches-row"
              >
                <span></span>
                <div class="anniversary-color-swatches">
                  <span
                    v-for="color in anniversaryBackgroundColors"
                    :key="`anniversary-bg-${color}`"
                    role="button"
                    tabindex="0"
                    :class="{
                      active:
                        anniversaryEditor.backgroundColor.toLowerCase() ===
                          color.toLowerCase() &&
                        anniversaryEditor.backgroundMode === 'color',
                    }"
                    :style="{ '--swatch-color': color }"
                    :aria-label="`背景颜色 ${color}`"
                    @click="setAnniversaryBackgroundColor(color)"
                    @keydown.enter.prevent="
                      setAnniversaryBackgroundColor(color)
                    "
                    @keydown.space.prevent="
                      setAnniversaryBackgroundColor(color)
                    "
                  ></span>
                  <span
                    class="anniversary-gradient-swatch"
                    role="button"
                    tabindex="0"
                    aria-label="更多背景颜色"
                    @click="setAnniversaryBackgroundColor('#8e726f')"
                    @keydown.enter.prevent="
                      setAnniversaryBackgroundColor('#8e726f')
                    "
                    @keydown.space.prevent="
                      setAnniversaryBackgroundColor('#8e726f')
                    "
                  ></span>
                </div>
              </div>
              <div v-else class="anniversary-field-row anniversary-image-row">
                <div class="anniversary-image-panel">
                  <div class="anniversary-image-strip-clip">
                    <div class="anniversary-image-strip" aria-label="背景图片">
                      <button
                        v-for="image in anniversaryBackgroundImages"
                        :key="`anniversary-bg-img-${image.id}`"
                        type="button"
                        :class="{
                          active: isAnniversaryBackgroundImageActive(image),
                        }"
                        :aria-label="`背景图片 ${image.id}`"
                        @click="setAnniversaryBackgroundImage(image)"
                      >
                        <img :src="image.thumb" alt="" />
                      </button>
                    </div>
                  </div>
                  <div class="anniversary-mask-row">
                    <span>蒙版</span>
                    <label
                      class="anniversary-mask-control"
                      :style="{
                        '--anniversary-mask-progress': `${anniversaryMaskPercent}%`,
                      }"
                    >
                      <input
                        v-model="anniversaryEditor.mask"
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        aria-label="蒙版"
                      />
                      <output>{{ anniversaryMaskPercent }} %</output>
                    </label>
                  </div>
                </div>
              </div>
            </section>

            <div class="anniversary-action-row">
              <button type="button" @click="commitAnniversaryEdit">
                修改完成
              </button>
              <button type="button" @click="addAnniversaryTemplate">
                添加
              </button>
            </div>
          </div>
        </template>

        <template v-else-if="openedWidget.kind === 'memo'">
          <ItabMemoOpenedPanel
            :widget="itabLiveMemoWidget"
            :auth-required="false"
            @update-data="updateItabLiveMemoData"
          />
        </template>

        <template v-else-if="openedWidget.kind === 'countdown'">
          <div class="opened-countdown-panel">
            <aside class="offwork-dialog-aside">
              <h3>实时预览</h3>
              <div class="offwork-preview-stage">
                <div class="offwork-preview-card">
                  <span
                    class="offwork-preview-icon"
                    :class="`preview-size-${offworkPreviewSize.replace('x', '-')}`"
                  >
                    <span
                      class="countdown-wrap"
                      :class="[
                        `iconsize-${offworkPreviewSize}`,
                        offworkIsWorkingNow ? 'is-onwork' : 'is-offwork',
                      ]"
                    >
                      <template v-if="offworkPreviewSize === '1x1'">
                        <span
                          class="countdown-img w-full"
                          aria-hidden="true"
                        ></span>
                      </template>
                      <template v-else-if="offworkPreviewSize === '2x4'">
                        <p class="icon-2x4-offwork" aria-hidden="true">
                          <span>下班还有</span>
                        </p>
                        <span class="time mt5">{{ offworkPrimaryText }}</span>
                        <ul class="icon-2x4-box">
                          <li
                            v-for="metric in offworkCountdownMetrics"
                            :key="`preview-${metric.key}`"
                          >
                            <b>{{ metric.label }}</b>
                            <em>{{ metric.value }}</em>
                            <small>{{ metric.suffix }}</small>
                          </li>
                        </ul>
                        <span class="countdown-img" aria-hidden="true"></span>
                      </template>
                      <template v-else>
                        <span class="time">{{ offworkPrimaryText }}</span>
                        <span class="countdown-img" aria-hidden="true"></span>
                      </template>
                    </span>
                  </span>
                </div>
              </div>
              <div class="offwork-preview-dots">
                <button
                  v-for="size in offworkPreviewSizes"
                  :key="`preview-dot-${size}`"
                  :class="{ active: size === offworkPreviewSize }"
                  type="button"
                  :aria-label="`预览 ${size}`"
                  @click="offworkPreviewSize = size"
                ></button>
              </div>
            </aside>
            <section class="offwork-settings-main">
              <ul class="offwork-settings-list">
                <li class="offwork-setting-row">
                  <span>组件名称</span>
                  <input
                    v-model="offworkTitle"
                    aria-label="组件名称"
                    placeholder="自定义图标名称"
                  />
                </li>
                <li class="offwork-setting-row offwork-weekday-row">
                  <span>工作日</span>
                  <div class="offwork-weekday-controls" role="group">
                    <button
                      v-for="day in offworkWeekdayOptions"
                      :key="day.value"
                      :class="{
                        active: offworkIsWorkdayOptionActive(day.value),
                      }"
                      type="button"
                      @click="offworkToggleWorkday(day.value)"
                    >
                      {{ day.label }}
                    </button>
                  </div>
                </li>
                <li class="offwork-setting-row offwork-time-row">
                  <span>工作时间</span>
                  <div>
                    <input
                      v-model="offworkWorkStart"
                      aria-label="开始时间"
                      placeholder="上班"
                    />
                    <b>至</b>
                    <input
                      v-model="offworkWorkEnd"
                      aria-label="结束时间"
                      placeholder="下班"
                    />
                  </div>
                </li>
                <li class="offwork-setting-row">
                  <span>字体颜色</span>
                  <label class="offwork-color-input">
                    <i style="background: #666666"></i>
                    <input value="#666666" aria-label="字体颜色" readonly />
                  </label>
                </li>
                <li class="offwork-setting-row offwork-background-row">
                  <span>背景</span>
                  <div class="offwork-segmented">
                    <button
                      :class="{ active: offworkBackgroundMode === 'color' }"
                      type="button"
                      @click="offworkBackgroundMode = 'color'"
                    >
                      颜色
                    </button>
                    <button
                      :class="{ active: offworkBackgroundMode === 'image' }"
                      type="button"
                      @click="offworkBackgroundMode = 'image'"
                    >
                      图片
                    </button>
                  </div>
                </li>
                <li
                  v-if="offworkBackgroundMode === 'image'"
                  class="offwork-setting-row offwork-mask-row"
                >
                  <span>蒙版</span>
                  <div class="offwork-mask-control">
                    <input
                      value="0"
                      aria-label="蒙版"
                      type="range"
                      min="0"
                      max="100"
                      readonly
                    />
                    <small>%</small>
                  </div>
                </li>
                <li class="offwork-setting-row">
                  <span>字体</span>
                  <select aria-label="字体">
                    <option>HarmonyOS</option>
                  </select>
                </li>
                <li class="offwork-setting-row offwork-more-row">
                  <span>显示更多</span>
                  <button
                    v-for="option in offworkMoreOptions"
                    :key="option.value"
                    :class="{ active: offworkIsMoreOptionActive(option.value) }"
                    type="button"
                    @click="offworkToggleMoreOption(option.value)"
                  >
                    {{ option.label }}
                  </button>
                </li>
                <li
                  v-if="offworkIsMoreOptionActive('payday')"
                  class="offwork-setting-row"
                >
                  <span>发薪日</span>
                  <div class="offwork-payday-control">
                    <small>每月</small>
                    <select
                      v-model.number="offworkPaydayDay"
                      aria-label="发薪日"
                    >
                      <option v-for="day in 31" :key="day" :value="day">
                        {{ day }}
                      </option>
                    </select>
                    <small>日</small>
                  </div>
                </li>
                <li
                  v-if="offworkIsMoreOptionActive('income')"
                  class="offwork-setting-row"
                >
                  <span>每天的收入</span>
                  <input
                    v-model.number="offworkDailyIncomeInput"
                    type="number"
                    aria-label="每天的收入"
                    placeholder="每天的收入"
                  />
                </li>
              </ul>
              <button
                class="offwork-submit-button"
                type="button"
                @click="commitOffworkCountdownEdit"
              >
                完 成
              </button>
            </section>
          </div>
        </template>

        <template v-else-if="openedWidget.kind === 'next-holiday'">
          <div class="opened-generic-panel">
            <header><strong>下一个假期</strong><span>假期提醒</span></header>
            <dl>
              <div>
                <dt>端午节</dt>
                <dd>6.19-6.21</dd>
                <em>29 天</em>
              </div>
              <div>
                <dt>中秋节</dt>
                <dd>9.25-9.27</dd>
                <em>127 天</em>
              </div>
              <div>
                <dt>国庆节</dt>
                <dd>10.1-10.7</dd>
                <em>133 天</em>
              </div>
            </dl>
          </div>
        </template>

        <template v-else-if="openedWidget.kind === 'eat-today'">
          <div class="opened-food-panel">
            <div class="opened-food-decoration" aria-hidden="true">
              <span class="food-decoration-burger"></span>
              <span class="food-decoration-drumstick"></span>
              <span class="food-decoration-skewer"></span>
              <span class="food-decoration-dot dot-one"></span>
              <span class="food-decoration-dot dot-two"></span>
              <span class="food-decoration-dot dot-three"></span>
            </div>
            <div class="opened-food-core">
              <h2 aria-live="polite">{{ eatTodayOpenedTitle }}</h2>
              <button
                class="opened-food-start"
                :class="{ 'is-running': eatTodayRunning }"
                type="button"
                :data-eat-today-current="eatTodaySelectedItem"
                @click.stop="pickEatToday"
              >
                {{ eatTodayOpenedStartText }}
              </button>
            </div>
            <div class="opened-food-actions">
              <button
                class="food-friend-button"
                type="button"
                @click.stop="pickEatToday"
              >
                <svg viewBox="0 0 11 11" aria-hidden="true">
                  <path
                    d="M8.8 1.6 2.4 4.1l2.4 1.1 1.1 2.4 2.9-6Z"
                    fill="currentColor"
                  />
                </svg>
                <span>朋友帮我选</span>
              </button>
              <button
                class="food-menu-button"
                type="button"
                @click.stop="showToast('菜单编辑暂未开放')"
              >
                <svg viewBox="0 0 1024 1024" aria-hidden="true">
                  <path
                    d="M232 704h360v72H232v-72Zm0-232h560v72H232v-72Zm0-224h560v72H232v-72Zm524 392 72 72-188 188h-72v-72l188-188Z"
                    fill="currentColor"
                  />
                </svg>
                <span>菜单自己写</span>
              </button>
            </div>
          </div>
        </template>

        <template
          v-else-if="
            openedWidget.kind === 'tool-icon' && openedWidget.title === '2048'
          "
        >
          <div class="opened-tool opened-2048">
            <header>
              <img :alt="openedWidget.title" :src="openedWidget.icon" />
              <div><strong>2048</strong><span>方向键移动数字方块</span></div>
            </header>
            <div class="game-board">
              <b>2</b><b>4</b><b></b><b>8</b> <b></b><b>16</b><b></b><b></b>
              <b>32</b><b></b><b>64</b><b></b> <b></b><b></b><b></b><b>128</b>
            </div>
            <footer>
              <button type="button">重新开始</button
              ><button type="button" @click="setOpenedWidgetSize('2x2')">
                固定到桌面
              </button>
            </footer>
          </div>
        </template>

        <template
          v-else-if="
            openedWidget.kind === 'tool-icon' &&
            openedWidget.title === 'Qwerty Learner'
          "
        >
          <div class="opened-tool opened-qwerty">
            <header>
              <img :alt="openedWidget.title" :src="openedWidget.icon" />
              <div>
                <strong>Qwerty Learner</strong><span>键盘记忆练习</span>
              </div>
            </header>
            <p class="typing-word">connection</p>
            <div class="typing-input">c o n n e c <span>t</span> i o n</div>
            <div class="keyboard-row">
              <i>Q</i><i>W</i><i>E</i><i>R</i><i>T</i><i>Y</i><i>U</i><i>I</i
              ><i>O</i><i>P</i>
            </div>
          </div>
        </template>

        <template
          v-else-if="
            openedWidget.kind === 'tool-icon' &&
            openedWidget.title === '时间戳转换'
          "
        >
          <div class="opened-tool opened-form-tool">
            <header>
              <img :alt="openedWidget.title" :src="openedWidget.icon" />
              <div>
                <strong>时间戳转换</strong><span>Unix 时间与本地时间互转</span>
              </div>
            </header>
            <label>当前时间<input value="2026-05-21 12:48:32" /></label>
            <label>时间戳<input value="1779348512" /></label>
            <button type="button">转换</button>
          </div>
        </template>

        <template v-else-if="openedWidget.id === 'ip-30'">
          <div class="opened-ip-panel">
            <section class="opened-ip-result" aria-live="polite">
              <h2>{{ ipLookupHeading }}</h2>
              <p v-if="ipLookupError" class="opened-ip-error">
                {{ ipLookupError }}
              </p>
              <dl>
                <div>
                  <dt>解析地址：</dt>
                  <dd>{{ ipLookupResolvedIp }}</dd>
                </div>
                <div>
                  <dt>归属地：</dt>
                  <dd>{{ ipLookupArea }}</dd>
                </div>
                <div>
                  <dt>网络：</dt>
                  <dd>{{ ipLookupNetwork }}</dd>
                </div>
                <div>
                  <dt>经纬度：</dt>
                  <dd>{{ ipLookupCoordinate }}</dd>
                </div>
              </dl>
            </section>
          </div>
        </template>

        <template
          v-else-if="
            openedWidget.kind === 'tool-icon' &&
            openedWidget.title === '头像生成器'
          "
        >
          <div class="opened-tool opened-avatar-tool">
            <header>
              <img :alt="openedWidget.title" :src="openedWidget.icon" />
              <div>
                <strong>头像生成器</strong><span>输入名称生成多风格头像</span>
              </div>
            </header>
            <input value="StartDeck" />
            <div class="avatar-grid">
              <i v-for="n in 9" :key="n">{{ n }}</i>
            </div>
          </div>
        </template>

        <template
          v-else-if="
            openedWidget.kind === 'tool-icon' &&
            openedWidget.title === '亲戚计算器'
          "
        >
          <div class="opened-tool opened-relative">
            <header>
              <img :alt="openedWidget.title" :src="openedWidget.icon" />
              <div>
                <strong>亲戚计算器</strong><span>快速计算称谓关系</span>
              </div>
            </header>
            <div class="relative-display">爸爸的哥哥的女儿</div>
            <div class="relative-buttons">
              <button
                v-for="label in [
                  '爸爸',
                  '妈妈',
                  '哥哥',
                  '姐姐',
                  '儿子',
                  '女儿',
                  '清空',
                  '计算',
                ]"
                :key="label"
                type="button"
              >
                {{ label }}
              </button>
            </div>
          </div>
        </template>

        <template
          v-else-if="
            openedWidget.kind === 'tool-icon' &&
            openedWidget.title === '数字大写转换'
          "
        >
          <div class="opened-tool opened-form-tool">
            <header>
              <img :alt="openedWidget.title" :src="openedWidget.icon" />
              <div>
                <strong>数字大写转换</strong><span>人民币金额大写</span>
              </div>
            </header>
            <label>数字金额<input value="123456.78" /></label>
            <output>壹拾贰万叁仟肆佰伍拾陆元柒角捌分</output>
            <button type="button">复制结果</button>
          </div>
        </template>

        <template v-else-if="openedWidget.kind === 'clock'">
          <div class="opened-clock-panel">
            <div class="d-dialog-header clock-source-header">
              <div class="d-dialog-tool is-mac">
                <span
                  class="toggle-fullscreen"
                  title="放大/缩小"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 200 200">
                    <path
                      d="M153.131 37L76.1311 37.3443C70.623 37.3443 69.3607 40.5574 73.2623 44.3443L155.77 126.852C159.672 130.754 162.77 129.377 162.77 123.984L163 46.9836C163 41.4754 158.525 37 153.131 37ZM44.2295 73.2623C40.3279 69.3607 37.2295 70.7377 37.2295 76.1311L37 153.131C37 158.639 41.4754 163 46.8689 163L123.869 162.656C129.377 162.656 130.639 159.443 126.738 155.656L44.2295 73.2623Z"
                    />
                  </svg>
                </span>
                <button
                  class="close-window"
                  title="关闭"
                  type="button"
                  @click="requestClose()"
                >
                  <svg viewBox="0 0 11 11" aria-hidden="true">
                    <path
                      d="M8.55 10.58L5.5 7.53L2.45 10.58C1.89 11.14 0.98 11.14 0.42 10.58C-0.14 10.02 -0.14 9.11 0.42 8.55L3.47 5.5L0.42 2.45C-0.14 1.89 -0.14 0.98 0.42 0.42C0.98 -0.14 1.89 -0.14 2.45 0.42L5.5 3.47L8.55 0.42C9.11 -0.14 10.02 -0.14 10.58 0.42C11.14 0.98 11.14 1.89 10.58 2.45L7.53 5.5L10.58 8.55C11.14 9.11 11.14 10.02 10.58 10.58C10.02 11.14 9.11 11.14 8.55 10.58Z"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div class="d-dialog-body clock-dialog-body">
              <div class="clock-dialog-root">
                <div class="clock-dialog-center">
                  <div
                    class="clock-flip-row"
                    :class="{ 'is-seconds-hidden': !clockSecondsEnabled }"
                  >
                    <template
                      v-for="(digit, index) in clockFlipDigits"
                      :key="`clock-flip-${index}`"
                    >
                      <span
                        v-if="index === 2 || index === 4"
                        class="clock-flip-separator"
                        aria-hidden="true"
                        >:</span
                      >
                      <div class="clock-flip-slot">
                        <ItabFlipCard
                          class="scoreboard-digit"
                          :digit="digit"
                          :duration="420"
                          aria-hidden="true"
                        />
                        <span class="scoreboard-value">{{ digit }}</span>
                      </div>
                    </template>
                  </div>
                </div>
                <div class="clock-bottom-controls">
                  <button
                    class="clock-control-button clock-sound-toggle"
                    title="静音"
                    type="button"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M4 9v6h4l5 4V5L8 9H4zm12.5.5 2 2 2-2 1 1-2 2 2 2-1 1-2-2-2 2-1-1 2-2-2-2 1-1z"
                      />
                    </svg>
                  </button>
                  <button
                    class="clock-control-button clock-bottom-fullscreen"
                    title="全屏"
                    type="button"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M4 9V4h5v2H6v3H4zm14 0V6h-3V4h5v5h-2zM4 15h2v3h3v2H4v-5zm14 3v-3h2v5h-5v-2h3z"
                      />
                    </svg>
                  </button>
                  <div
                    class="el-switch el-switch--small"
                    :class="{ 'is-checked': clockSecondsEnabled }"
                    role="switch"
                    tabindex="0"
                    title="显示秒"
                    aria-label="显示秒"
                    :aria-checked="clockSecondsEnabled"
                    @click.stop="clockSecondsEnabled = !clockSecondsEnabled"
                    @keydown.enter.prevent="
                      clockSecondsEnabled = !clockSecondsEnabled
                    "
                    @keydown.space.prevent="
                      clockSecondsEnabled = !clockSecondsEnabled
                    "
                  >
                    <input
                      class="el-switch__input"
                      type="checkbox"
                      role="switch"
                      :checked="clockSecondsEnabled"
                      :aria-checked="clockSecondsEnabled"
                      aria-disabled="false"
                      tabindex="-1"
                      readonly
                    />
                    <span class="el-switch__core">
                      <span class="el-switch__action"></span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="openedWidget.kind === 'world-clock'">
          <div class="opened-world-clock-panel">
            <header>
              <strong>{{ hourText }}:{{ minuteText }}</strong
              ><span>{{ dateText }}</span>
            </header>
            <section>
              <article v-for="row in worldClockRows" :key="row.city">
                <b>{{ row.time }}</b
                ><span>{{ row.city }}</span
                ><em>{{ row.day }}</em>
              </article>
            </section>
          </div>
        </template>

        <template v-else-if="openedWidget.kind === 'todo'">
          <div class="opened-todo-panel is-basic">
            <main class="todo-main-pane">
              <h2>待办事项</h2>
              <div class="todo-add">
                <i aria-hidden="true">
                  <svg viewBox="0 0 16 16">
                    <path
                      d="M8.5 2.75a.75.75 0 0 0-1.5 0V7H2.75a.75.75 0 0 0 0 1.5H7v4.25a.75.75 0 0 0 1.5 0V8.5h4.25a.75.75 0 0 0 0-1.5H8.5V2.75z"
                      fill="currentColor"
                    />
                  </svg>
                </i>
                <textarea
                  id="todoAddInput"
                  v-model="todoDraft"
                  data-todo-draft-textarea
                  maxlength="200"
                  placeholder="添加任务"
                  rows="1"
                  @input="resizeTodoTextareaFromEvent"
                  @keydown.enter.prevent="createTodoTask"
                ></textarea>
              </div>
              <section
                class="todo-content-frame"
                :class="{ 'is-scrolling': todoListScrolling }"
              >
                <div class="todo-content-scroll" @scroll="handleTodoListScroll">
                  <div v-if="!todoTasks.length" class="todo-empty">
                    <svg viewBox="0 0 79 86" aria-hidden="true">
                      <ellipse
                        cx="39.5"
                        cy="81.333"
                        rx="39.5"
                        ry="4.667"
                        fill="#e5e7eb"
                      />
                      <path
                        d="M18 8h38a6 6 0 0 1 6 6v45a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6z"
                        fill="#f2f3f5"
                      />
                      <path
                        d="M24 25h26M24 38h31M24 51h20"
                        stroke="#d5d9e0"
                        stroke-width="4"
                        stroke-linecap="round"
                      />
                    </svg>
                    <p>赶快添加您的待办吧</p>
                  </div>
                  <ul v-else class="todo-content-ul">
                    <li
                      v-for="task in unfinishedTodoTasks"
                      :key="task.id"
                      class="todo-content-li"
                    >
                      <span class="todo-check-bg">
                        <button
                          class="todo-check"
                          type="button"
                          @click="toggleTodoTask(task)"
                        ></button>
                      </span>
                      <span class="todo-row-main">
                        <textarea
                          :value="task.title"
                          data-todo-textarea
                          rows="1"
                          @input="updateTodoTaskTitle(task, $event)"
                        ></textarea>
                        <button
                          class="todo-delete"
                          title="删除"
                          type="button"
                          @click="removeTodoTask(task.id)"
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path
                              d="M6.5 7v4a.5.5 0 0 0 1 0V7a.5.5 0 0 0-1 0zM9 6.5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V7a.5.5 0 0 1 .5-.5zM10 4h3a.5.5 0 0 1 0 1h-.553l-.752 6.776A2.5 2.5 0 0 1 9.21 14H6.79a2.5 2.5 0 0 1-2.485-2.224L3.552 5H3a.5.5 0 0 1 0-1h3a2 2 0 1 1 4 0zM8 3a1 1 0 0 0-1 1h2a1 1 0 0 0-1-1zM4.559 5l.74 6.666A1.5 1.5 0 0 0 6.79 13h2.42a1.5 1.5 0 0 0 1.49-1.334L11.442 5H4.56z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                      </span>
                    </li>
                    <li
                      v-if="completedTodoTasks.length"
                      class="todo-done-label"
                    >
                      已完成 {{ completedTodoTasks.length }}
                    </li>
                    <li
                      v-for="task in completedTodoTasks"
                      :key="task.id"
                      class="todo-content-li done"
                    >
                      <span class="todo-check-bg">
                        <button
                          class="todo-check done"
                          type="button"
                          @click="toggleTodoTask(task)"
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path
                              d="M13.485 4.515a.75.75 0 0 1 0 1.06l-6.25 6.25a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l2.47 2.47 5.72-5.72a.75.75 0 0 1 1.06 0z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                      </span>
                      <span class="todo-row-main">
                        <textarea
                          :value="task.title"
                          data-todo-textarea
                          rows="1"
                          @input="updateTodoTaskTitle(task, $event)"
                        ></textarea>
                        <button
                          class="todo-delete"
                          title="删除"
                          type="button"
                          @click="removeTodoTask(task.id)"
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path
                              d="M6.5 7v4a.5.5 0 0 0 1 0V7a.5.5 0 0 0-1 0zM9 6.5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V7a.5.5 0 0 1 .5-.5zM10 4h3a.5.5 0 0 1 0 1h-.553l-.752 6.776A2.5 2.5 0 0 1 9.21 14H6.79a2.5 2.5 0 0 1-2.485-2.224L3.552 5H3a.5.5 0 0 1 0-1h3a2 2 0 1 1 4 0zM8 3a1 1 0 0 0-1 1h2a1 1 0 0 0-1-1zM4.559 5l.74 6.666A1.5 1.5 0 0 0 6.79 13h2.42a1.5 1.5 0 0 0 1.49-1.334L11.442 5H4.56z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                      </span>
                    </li>
                  </ul>
                </div>
                <span
                  v-if="todoScrollbar.visible"
                  class="todo-scrollbar-thumb"
                  aria-hidden="true"
                  :style="todoScrollbarStyle"
                ></span>
              </section>
            </main>
          </div>
        </template>

        <template v-else-if="openedWidget.kind === 'habit'">
          <div class="opened-task-panel">
            <header>
              <strong>{{ openedWidget.title }}</strong
              ><button type="button">＋ 新增</button>
            </header>
            <article class="habit-detail">
              <b>0/8</b><span>每天8杯水</span><i v-for="n in 8" :key="n"></i>
            </article>
            <ul>
              <li
                v-for="row in habitTaskRows"
                :key="row.title"
                :class="{ done: row.done }"
              >
                <span></span>{{ row.title }}
              </li>
            </ul>
          </div>
        </template>

        <template v-else-if="openedWidget.kind === 'stock'">
          <div class="opened-stock-panel">
            <header><strong>股市</strong><span>沪深行情 · 自选</span></header>
            <table>
              <tbody>
                <tr>
                  <th>九安医疗</th>
                  <td>74.68</td>
                  <td class="up">+5.66%</td>
                </tr>
                <tr>
                  <th>宁德时代</th>
                  <td>417.84</td>
                  <td class="up">+0.75%</td>
                </tr>
                <tr>
                  <th>数字政通</th>
                  <td>13.60</td>
                  <td class="down">-0.95%</td>
                </tr>
                <tr>
                  <th>上证指数</th>
                  <td>3420.17</td>
                  <td class="up">+0.33%</td>
                </tr>
              </tbody>
            </table>
            <div class="stock-line"></div>
          </div>
        </template>

        <template v-else-if="openedWidget.kind === 'movie'">
          <div
            class="opened-media-panel opened-movie-panel"
            :style="movieCalendarOuterStyle"
            :data-movie-source-status="movieCalendar.sourceStatus"
          >
            <span class="opened-movie-bg" aria-hidden="true"></span>
            <section class="opened-movie-copy">
              <h2>{{ movieCalendar.movieTitle }}</h2>
              <span class="opened-movie-rating-row">
                <span
                  class="opened-movie-rating-star"
                  aria-hidden="true"
                ></span>
                <em class="opened-movie-rating">{{ movieCalendar.rating }}</em>
              </span>
              <p v-if="movieCalendarMetaText" class="opened-movie-meta">
                {{ movieCalendarMetaText }}
              </p>
              <p v-if="movieCalendarDirectorText" class="opened-movie-director">
                {{ movieCalendarDirectorText }}
              </p>
              <p class="opened-movie-quote">“ {{ movieCalendar.quote }} ”</p>
              <p class="opened-movie-intro">{{ movieCalendarIntroText }}</p>
            </section>
            <aside class="opened-movie-poster" aria-hidden="true">
              <img
                v-if="movieCalendar.posterUrl"
                class="opened-movie-poster-image rounded-md float-left mr10 m-block"
                :alt="movieCalendar.movieTitle"
                width="273"
                height="405"
                :src="movieCalendar.posterUrl"
              />
              <img
                v-if="movieCalendar.posterUrl"
                class="opened-movie-poster-image rounded-md m-hide"
                :alt="movieCalendar.movieTitle"
                width="273"
                height="405"
                :src="movieCalendar.posterUrl"
              />
              <span v-else>{{ movieCalendar.movieTitle }}</span>
            </aside>
            <a
              v-if="movieCalendar.sourceUrl"
              class="opened-movie-source"
              :href="movieCalendar.sourceUrl"
              target="_blank"
              rel="noreferrer noopener"
              >查看电影源→</a
            >
          </div>
        </template>

        <template v-else-if="openedWidget.kind === 'daily-quote'">
          <div
            ref="dailyQuotePanelRef"
            class="opened-daily-quote-panel"
            :class="{ 'is-fullscreen': dailyQuoteFullscreen }"
            :style="dailyQuoteOpenedStyle"
            :data-daily-quote-api="dailyQuoteApiUrl"
            :data-daily-quote-like-api="dailyQuoteLikeApiUrl"
            :data-daily-quote-share-api="dailyQuoteShareApiUrl"
            :data-daily-quote-source-status="dailyQuote.sourceStatus"
            :data-daily-quote-date="dailyQuote.date"
            :data-daily-quote-fullscreen="dailyQuoteFullscreen"
            data-itab-no-iframe="true"
          >
            <span class="opened-daily-quote-bg" aria-hidden="true"></span>
            <button
              class="opened-daily-quote-chevron is-left"
              type="button"
              aria-label="上一句"
              data-itab-inner-control
              data-itab-hotspot-id="daily-quote-prev"
              data-itab-action="previous-quote"
              @click.stop="navigateDailyQuote('prev')"
            ></button>
            <button
              class="opened-daily-quote-chevron is-right"
              type="button"
              aria-label="下一句"
              data-itab-inner-control
              data-itab-hotspot-id="daily-quote-next"
              data-itab-action="next-quote"
              @click.stop="navigateDailyQuote('next')"
            ></button>
            <section class="opened-daily-quote-main">
              <p class="opened-daily-quote-date">{{ dailyQuote.dateLabel }}</p>
              <strong class="opened-daily-quote-time">{{
                dailyQuote.timeLabel
              }}</strong>
              <span class="opened-daily-quote-line" aria-hidden="true"></span>
              <blockquote>{{ dailyQuote.quote }}</blockquote>
              <p class="opened-daily-quote-author">
                {{ dailyQuoteAttributionText }}
              </p>
            </section>
            <footer class="opened-daily-quote-actions">
              <button
                v-if="!dailyQuoteFullscreen"
                type="button"
                title="分享"
                aria-label="分享每日一言"
                :class="{ 'is-clicking': dailyQuoteActionAnimating.share }"
                data-itab-inner-control
                data-itab-hotspot-id="daily-quote-copy"
                data-itab-action="share-quote"
                @click.stop="copyDailyQuote"
              >
                <CopyIcon aria-hidden="true" />
              </button>
              <button
                type="button"
                title="设为屏保"
                aria-label="设为屏保"
                :class="{ 'is-clicking': dailyQuoteActionAnimating.fullscreen }"
                data-itab-inner-control
                data-itab-hotspot-id="daily-quote-fullscreen"
                data-itab-action="toggle-fullscreen"
                @click.stop="toggleDailyQuoteFullscreen"
              >
                <ScanIcon aria-hidden="true" />
              </button>
              <button
                v-if="!dailyQuoteFullscreen"
                type="button"
                title="喜欢"
                aria-label="喜欢每日一言"
                :aria-pressed="dailyQuoteLiked"
                :class="{
                  like: dailyQuoteLiked,
                  'is-clicking': dailyQuoteActionAnimating.like,
                }"
                data-itab-inner-control
                data-itab-hotspot-id="daily-quote-like"
                data-itab-action="toggle-like"
                @click.stop="toggleDailyQuoteLike"
              >
                <HeartIcon aria-hidden="true" />
              </button>
            </footer>
            <a
              class="opened-daily-quote-source"
              href="https://tide.fm/"
              target="_blank"
              rel="noreferrer noopener"
            >
              <span>数据来源于</span>
              <img :src="dailyQuoteTideLogoUrl" alt="" />
            </a>
          </div>
        </template>

        <template v-else-if="openedWidget.kind === 'poem'">
          <ItabPoemOpenedPanel
            :widget="itabLivePoemWidget"
            @update-data="updateItabLivePoemData"
          />
        </template>

        <template v-else-if="openedWidget.kind === 'today-english'">
          <div
            class="opened-english-panel"
            :class="{ playing: dailyEnglishPlaying }"
            :style="dailyEnglishStyle"
            :data-daily-english-state="
              dailyEnglishPlaying ? 'playing' : 'paused'
            "
            :data-daily-english-api="dailyEnglishApiUrl"
            :data-daily-english-provider="dailyEnglishProviderReferenceUrl"
            :data-daily-english-dateline="dailyEnglish.dateline"
          >
            <span class="opened-english-bg" aria-hidden="true"></span>
            <span class="opened-english-shade" aria-hidden="true"></span>
            <section class="opened-english-copy">
              <p>{{ dailyEnglish.sentence }}</p>
              <em>{{ dailyEnglish.translation }}</em>
            </section>
            <button
              class="opened-english-play"
              type="button"
              data-itab-inner-control
              data-itab-hotspot-id="today-english-play"
              data-itab-action="toggle-audio-progress"
              :aria-label="dailyEnglishPlaying ? '暂停跟读' : '播放跟读'"
              :aria-pressed="dailyEnglishPlaying"
              @click.stop="toggleDailyEnglishPlayback"
            >
              <svg
                v-if="dailyEnglishPlaying"
                viewBox="0 0 12 12"
                aria-hidden="true"
              >
                <path d="M3 2.4h2v7.2H3V2.4zm4 0h2v7.2H7V2.4z" />
              </svg>
              <svg v-else viewBox="0 0 12 12" aria-hidden="true">
                <path
                  d="M4.496 1.994A1 1 0 0 0 3 2.862v6.277a1 1 0 0 0 1.496.868l5.492-3.139a1 1 0 0 0 0-1.736L4.496 1.994z"
                />
              </svg>
            </button>
            <span class="opened-english-progress" aria-hidden="true">
              {{ dailyEnglish.progressLabel }}
            </span>
            <audio
              ref="dailyEnglishAudioElement"
              class="opened-english-audio"
              :src="dailyEnglish.audioUrl"
              preload="none"
              aria-hidden="true"
              @ended="handleDailyEnglishAudioEnded"
            ></audio>
          </div>
        </template>

        <template v-else-if="openedWidget.kind === 'wallpaper'">
          <div
            ref="wallpaperPanelElement"
            class="opened-wallpaper-panel"
            :class="{ 'is-settings-open': wallpaperSettingsOpen }"
            @scroll.passive="handleWallpaperPanelScroll"
          >
            <button
              class="wallpaper-settings-trigger"
              type="button"
              aria-label="参数设置"
              :aria-expanded="wallpaperSettingsOpen"
              @click.stop="toggleWallpaperSettings"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.73v.52a2 2 0 0 1-1 1.73l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.73v-.52a2 2 0 0 1 1-1.73l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"
                />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>

            <section
              v-if="wallpaperSettingsOpen"
              class="wallpaper-settings-popover"
              aria-label="参数设置"
              @click.stop
            >
              <label>
                <input
                  v-model="wallpaperSettings.dailyAutoUpdate"
                  type="checkbox"
                />
                <span>选中壁纸每日自动更新</span>
              </label>
              <label>
                <input
                  v-model="wallpaperSettings.dimWallpaper"
                  type="checkbox"
                />
                <span>桌面背景增加暗色遮罩</span>
              </label>
              <label class="wallpaper-range">
                <span>背景模糊</span>
                <input
                  v-model.number="wallpaperSettings.blurLevel"
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                />
                <b>{{ wallpaperSettings.blurLevel }}</b>
              </label>
            </section>

            <header class="wallpaper-panel-head">
              <h2>壁纸库</h2>
              <p>必应每日壁纸 可以使用快捷键 Ctrl+G 打开壁纸应用</p>
            </header>

            <section v-if="featuredWallpaper" class="wallpaper-featured">
              <button
                class="wallpaper-featured-image"
                type="button"
                :aria-label="`选中 ${featuredWallpaper.title}`"
                @click="selectWallpaper(featuredWallpaper)"
              >
                <img
                  :alt="featuredWallpaper.title"
                  :src="featuredWallpaper.thumbnailUrl"
                />
              </button>
              <div class="wallpaper-featured-copy">
                <strong>
                  {{ featuredWallpaper.title }},
                  {{ featuredWallpaper.location }} (©
                  {{ featuredWallpaper.credit }})
                </strong>
                <p>选中此图像每天会自动更新壁纸</p>
                <p>
                  图像来源: <b>必应</b>
                  <a
                    :href="featuredWallpaper.downloadUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    @click.stop
                    >点此下载4k高清壁纸</a
                  >
                </p>
              </div>
            </section>

            <p
              v-else
              class="wallpaper-empty-state"
              data-itab-live-wallpaper-empty-state
            >
              {{
                wallpaperRuntime.loading.value
                  ? "正在从后端加载壁纸"
                  : wallpaperRuntime.error.value || "后端暂未返回可用壁纸"
              }}
            </p>

            <section
              v-if="visibleBingWallpapers.length"
              class="wallpaper-bing-grid"
              aria-label="必应壁纸"
            >
              <article
                v-for="wallpaper in visibleBingWallpapers"
                :key="wallpaper.id"
                :class="{ active: wallpaper.id === activeWallpaper?.id }"
              >
                <button
                  class="wallpaper-thumb"
                  type="button"
                  :aria-pressed="wallpaper.id === activeWallpaper?.id"
                  :aria-label="`选中 ${wallpaper.title}`"
                  @click="selectWallpaper(wallpaper)"
                >
                  <img :alt="wallpaper.title" :src="wallpaper.thumbnailUrl" />
                  <span
                    v-if="wallpaper.id === activeWallpaper?.id"
                    class="wallpaper-check"
                    aria-hidden="true"
                    >✓</span
                  >
                </button>
                <a
                  class="wallpaper-download-icon"
                  :href="wallpaper.downloadUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  :aria-label="`下载 ${wallpaper.title}`"
                  @click.stop
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14" />
                  </svg>
                </a>
              </article>
            </section>

            <footer
              ref="wallpaperLoadMoreSentinelElement"
              class="wallpaper-panel-actions"
            >
              <button
                type="button"
                :disabled="!hasMoreWallpapers"
                @click="loadMoreWallpapers"
              >
                {{ hasMoreWallpapers ? "加载更多" : "已全部加载" }}
              </button>
            </footer>
          </div>
        </template>

        <template v-else-if="openedWidget.kind === 'wooden-fish'">
          <div class="opened-wooden-fish">
            <h2>电子木鱼</h2>
            <button type="button">
              <img alt="" :src="sourceAssets.muyu" />
            </button>
            <strong>功德 +3</strong>
            <span>木鱼一敲 烦恼丢掉</span>
          </div>
        </template>

        <template v-else-if="openedWidget.kind === 'speed-test'">
          <div class="opened-speed-panel">
            <header>
              <img alt="" :src="sourceAssets.speedtest" /><strong
                >网速测试</strong
              >
            </header>
            <div class="speed-meter"><b>86.4</b><span>Mbps</span></div>
            <dl>
              <div>
                <dt>Ping</dt>
                <dd>18ms</dd>
              </div>
              <div>
                <dt>上传</dt>
                <dd>22.8Mbps</dd>
              </div>
              <div>
                <dt>下载</dt>
                <dd>86.4Mbps</dd>
              </div>
            </dl>
            <button type="button">重新测试</button>
          </div>
        </template>

        <template v-else-if="openedWidget.kind === 'gradient'">
          <div class="opened-gradient-panel">
            <h2>渐变色</h2>
            <div class="gradient-current"></div>
            <section><i v-for="n in 12" :key="n"></i></section>
            <button type="button">复制 CSS</button>
          </div>
        </template>

        <template v-else-if="openedWidget.kind === 'converter'">
          <div class="opened-converter-panel">
            <aside class="opened-converter-nav" aria-label="换算器工具列表">
              <div
                v-for="tool in converterTools"
                :key="tool.label"
                :class="[
                  'tab-item flex items-center gap-1.5 justify-between',
                  converterSourceIconClassByLabel[
                    tool.label as keyof typeof converterSourceIconClassByLabel
                  ],
                  { active: activeConverterToolLabel === tool.label },
                ]"
                @click="selectConverterTool(tool.label)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path :d="tool.iconPath" />
                </svg>
                <span>{{ tool.label }}</span>
                <button
                  v-if="activeConverterToolLabel === tool.label"
                  class="el-button el-button--primary el-button--small is-circle is-text more el-tooltip__trigger el-tooltip__trigger"
                  type="button"
                  aria-label="更多"
                  @click.stop
                ></button>
                <i v-else aria-hidden="true"></i>
              </div>
            </aside>
            <section class="opened-converter-content">
              <div
                v-if="activeConverterToolLabel === '计算器'"
                class="converter-calculator calculator-container w-[400px] h-full flex flex-col pb-8 max-w-[100%]"
              >
                <div
                  class="converter-calculator-display-shell input-area h-[133px] flex flex-col justify-end"
                >
                  <div
                    class="converter-calculator-expression-row flex-1 flex justify-end items-end whitespace-nowrap"
                  >
                    {{
                      converterDisplayMode === "result"
                        ? converterExpression
                        : ""
                    }}
                  </div>
                  <div
                    class="converter-calculator-display-row w-full flex justify-end"
                  >
                    <input
                      v-if="converterDisplayMode === 'input'"
                      class="converter-calculator-display w-full h-full text-right"
                      :value="converterDisplay"
                      aria-label="计算器显示"
                      readonly
                    />
                    <div
                      v-else
                      class="converter-calculator-result-text overflow-hidden w-full input-text h-[44px] w-[fit-content] max-w-full"
                    >
                      <div class="d-scroll-x w-full cursor-pointer">
                        {{ converterDisplay }}
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  class="converter-calculator-grid keyboard flex-1 overflow-hidden gap-4 mt-4"
                >
                  <button
                    v-for="key in converterCalculatorKeys"
                    :key="key.label"
                    type="button"
                    :aria-label="
                      key.label === '⌫' && converterClearButtonText
                        ? converterClearButtonText
                        : key.ariaLabel || key.label
                    "
                    :class="[
                      `is-${key.kind}`,
                      'key flex items-center justify-center text-base',
                      key.kind === 'action' || key.kind === 'operator'
                        ? 'special'
                        : '',
                      key.kind === 'equals' ? 'equal' : '',
                    ]"
                    @click="handleConverterKey(key.label)"
                  >
                    <span v-if="key.label === '⌫' && converterClearButtonText">
                      {{ converterClearButtonText }}
                    </span>
                    <svg
                      v-else-if="key.svgPath"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path :d="key.svgPath" />
                    </svg>
                    <span v-else>{{ key.label }}</span>
                  </button>
                </div>
              </div>
              <div
                v-else-if="activeConverterSourceUnitPanel"
                class="converter-source-unit flex flex-col h-full"
              >
                <div
                  class="converter-source-unit-toolbar h-10 flex gap-2 pl-2 items-center"
                ></div>
                <form
                  class="converter-source-unit-form el-form el-form--default el-form--label-right w-full md:w-[350px] pl-4 pr-4 md:pl-0 md:pr-0 m-auto flex flex-col h-full items-center gap-2.5 overflow-hidden"
                >
                  <div
                    class="el-form-item asterisk-left el-form-item--label-right"
                  >
                    <div class="el-form-item__content">
                      <label class="w-full">
                        <div
                          class="el-input el-input--large el-input-group h-[60px] el-input-group--append el-input-group--prepend"
                        >
                          <div class="el-input-group__prepend">基础单位</div>
                          <div class="el-input__wrapper">
                            <input
                              :key="`${activeConverterToolConfig.label}-source-input`"
                              v-model="activeConverterToolState.input"
                              class="el-input__inner"
                              type="number"
                              aria-label="换算器输入值"
                            />
                          </div>
                          <div class="el-input-group__append">
                            {{ activeConverterSourceUnitPanel.inputUnit }}
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                  <div
                    class="converter-source-unit-list w-full flex flex-col overflow-auto d-scrollbar-hide pb-[50px] flex-1 gap-2.5"
                  >
                    <div class="detail-container">
                      <div
                        v-for="card in activeConverterSourceUnitCards"
                        :key="`${card.name}-${card.value}`"
                        class="tax-card"
                        :class="{ active: card.active }"
                      >
                        <div class="value">{{ card.displayValue }}</div>
                        <div class="name">{{ card.name }}</div>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
              <div v-else class="converter-tool-preview">
                <svg
                  :style="{ color: activeConverterTool.accent }"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path :d="activeConverterTool.iconPath" />
                </svg>
                <strong>{{ activeConverterTool.label }}</strong>
                <div class="converter-tool-form">
                  <label>
                    <span>{{ activeConverterToolConfig.inputLabel }}</span>
                    <input
                      :key="`${activeConverterToolConfig.label}-input`"
                      v-model="activeConverterToolState.input"
                      :type="activeConverterToolConfig.inputType || 'number'"
                      aria-label="换算器输入值"
                    />
                  </label>
                  <label v-if="activeConverterToolConfig.secondaryLabel">
                    <span>{{ activeConverterToolConfig.secondaryLabel }}</span>
                    <input
                      :key="`${activeConverterToolConfig.label}-secondary`"
                      v-model="activeConverterToolState.secondary"
                      :type="
                        activeConverterToolConfig.secondaryInputType || 'number'
                      "
                      aria-label="换算器辅助输入"
                    />
                  </label>
                  <div
                    v-if="activeConverterToolConfig.options?.length"
                    class="converter-tool-selects"
                  >
                    <label>
                      <span>{{
                        activeConverterToolConfig.fromLabel || "源单位"
                      }}</span>
                      <select
                        :key="`${activeConverterToolConfig.label}-from`"
                        v-model="activeConverterToolState.fromUnit"
                        aria-label="换算器源单位"
                      >
                        <option
                          v-for="option in activeConverterToolConfig.options"
                          :key="option.value"
                          :value="option.value"
                        >
                          {{ option.label }}
                        </option>
                      </select>
                    </label>
                    <label v-if="activeConverterToolConfig.options.length > 1">
                      <span>{{
                        activeConverterToolConfig.toLabel || "目标单位"
                      }}</span>
                      <select
                        :key="`${activeConverterToolConfig.label}-to`"
                        v-model="activeConverterToolState.toUnit"
                        aria-label="换算器目标单位"
                      >
                        <option
                          v-for="option in activeConverterToolConfig.options"
                          :key="option.value"
                          :value="option.value"
                        >
                          {{ option.label }}
                        </option>
                      </select>
                    </label>
                  </div>
                  <label class="converter-tool-result">
                    <span>转换结果</span>
                    <input
                      class="converter-tool-output"
                      :value="activeConverterToolResult"
                      aria-label="换算器转换结果"
                      readonly
                    />
                  </label>
                </div>
              </div>
            </section>
          </div>
        </template>

        <template v-else>
          <div class="opened-generic-panel">
            <h2>{{ openedWidget.title }}</h2>
            <p>当前组件详情</p>
            <button type="button" @click="setOpenedWidgetSize('2x2')">
              设为 2x2
            </button>
            <button type="button" @click="setOpenedWidgetSize('2x4')">
              设为 2x4
            </button>
          </div>
        </template>
      </template>
    </ItabLiveOpenedShell>

    <Transition name="toast">
      <div v-if="toastMessage" class="itab-toast">{{ toastMessage }}</div>
    </Transition>
  </main>
</template>

<style scoped>
:global(#__vue-devtools-container__),
:global(#__vue-devtools-container__ iframe) {
  display: none !important;
  pointer-events: none !important;
  visibility: hidden !important;
}

.itab-native {
  position: fixed;
  inset: 0;
  z-index: 1000;
  overflow-x: hidden;
  overflow-y: auto;
  color: #fff;
  font-family:
    Inter, "SF Pro Display", "PingFang SC", "Microsoft YaHei", sans-serif;
  background: #080d13;
  user-select: none;
}

.itab-native.is-panel-open {
  overflow: hidden;
}

.itab-native-bg {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(
      ellipse 420px 540px at -4% 82%,
      rgba(245, 181, 37, 0.98) 0%,
      rgba(236, 153, 20, 0.98) 25%,
      rgba(181, 60, 29, 0.58) 43%,
      transparent 68%
    ),
    radial-gradient(
      ellipse 430px 390px at 43% -2%,
      rgba(231, 87, 31, 0.98) 0%,
      rgba(204, 61, 28, 0.86) 39%,
      rgba(52, 25, 24, 0.32) 69%,
      transparent 81%
    ),
    radial-gradient(
      ellipse 510px 690px at 66% 20%,
      rgba(181, 224, 221, 0.94) 0%,
      rgba(111, 166, 172, 0.8) 33%,
      rgba(27, 54, 66, 0.3) 62%,
      transparent 78%
    ),
    radial-gradient(
      ellipse 430px 520px at 106% 64%,
      rgba(2, 142, 214, 0.95) 0%,
      rgba(2, 75, 157, 0.84) 38%,
      rgba(2, 21, 48, 0.54) 68%,
      transparent 82%
    ),
    linear-gradient(115deg, #03050b 0%, #0b111a 32%, #101926 55%, #04070d 100%);
  filter: saturate(1.02) contrast(1.02);
}

.itab-native-bg::after {
  position: absolute;
  inset: 0;
  content: "";
  background:
    linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.2),
      transparent 17%,
      transparent 84%,
      rgba(0, 0, 0, 0.22)
    ),
    rgba(0, 0, 0, 0.03);
}

button,
input,
select {
  font: inherit;
}

button {
  color: inherit;
}

.itab-native-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 20;
  display: flex;
  width: 50px;
  flex-direction: column;
  align-items: center;
  background: rgba(0, 5, 11, 0.44);
  color: rgba(255, 255, 255, 0.64);
  backdrop-filter: blur(5px);
}

.itab-avatar {
  display: grid;
  width: 50px;
  margin-top: 39px;
  padding: 0;
  place-items: center;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.itab-avatar img {
  width: 30px;
  height: 30px;
  border-radius: 50%;
}

.itab-group-list {
  display: grid;
  width: 50px;
  gap: 2px;
  margin-top: 41px;
}

.itab-group-list button,
.itab-sidebar-bottom button {
  display: grid;
  width: 50px;
  min-height: 54px;
  place-items: center;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.62);
  cursor: pointer;
}

.itab-group-list button.active {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.itab-group-list b {
  font-size: 17px;
  line-height: 18px;
}

.itab-group-list span {
  font-size: 12px;
  line-height: 16px;
}

.itab-sidebar-plus b {
  font-size: 25px;
  font-weight: 300;
}

.itab-sidebar-bottom {
  display: grid;
  margin-top: auto;
  margin-bottom: 9px;
}

.itab-native-stage {
  position: relative;
  z-index: 5;
  min-width: 616px;
  min-height: 1390px;
}

.itab-top-actions {
  position: fixed;
  top: 22px;
  right: 35px;
  color: rgba(255, 255, 255, 0.48);
  font-size: 22px;
}

.itab-clock {
  position: absolute;
  top: 30px;
  left: 50%;
  width: 330px;
  margin-left: -165px;
  text-align: center;
  text-shadow: 0 2px 18px rgba(0, 0, 0, 0.32);
}

.itab-clock div {
  display: flex;
  justify-content: center;
  font-size: 72px;
  font-weight: 300;
  line-height: 74px;
  letter-spacing: 0;
}

.itab-clock p {
  margin: 2px 0 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
}

.itab-native-search {
  position: absolute;
  top: 153px;
  left: 50%;
  z-index: 12;
  display: flex;
  width: min(600px, calc(100vw - 88px));
  height: 46px;
  margin-left: -300px;
  align-items: center;
  border-radius: 23px;
  background: rgba(239, 246, 250, 0.72);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.12);
  color: #222;
  backdrop-filter: blur(18px);
}

.search-engine,
.search-submit {
  display: grid;
  width: 50px;
  height: 46px;
  flex: none;
  place-items: center;
  border: 0;
  background: transparent;
  color: rgba(0, 0, 0, 0.58);
  cursor: pointer;
}

.search-engine img {
  width: 20px;
  height: 20px;
}

.itab-native-search input {
  width: 100%;
  height: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: #222;
  font-size: 14px;
}

.itab-native-search input::placeholder {
  color: rgba(0, 0, 0, 0.42);
}

.itab-native-grid {
  position: absolute;
  top: 237px;
  left: 68px;
  display: grid;
  grid-template-columns: repeat(7, 48px);
  grid-auto-rows: 48px;
  gap: 24px;
  width: 480px;
  padding-bottom: 80px;
}

.calendar-outer-compact {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  background: #fff;
}

.calendar-outer-compact i,
.calendar-outer-compact b,
.calendar-outer-compact span {
  display: block;
  font-style: normal;
  letter-spacing: 0;
}

.calendar-outer-compact-square {
  flex-direction: column;
}

.calendar-outer-compact-square i {
  width: 24px;
  color: rgb(216, 48, 48);
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
}

.calendar-outer-compact-square b {
  width: 24px;
  color: rgb(34, 34, 34);
  font-size: 18px;
  font-weight: 700;
  line-height: 27px;
}

.calendar-outer-compact-row {
  flex-direction: row;
  padding: 0 20px;
}

.calendar-outer-compact-row b {
  color: rgb(34, 34, 34);
  font-size: 18px;
  font-weight: 400;
  line-height: 27px;
}

.calendar-outer-compact-row i {
  margin-left: 5px;
  color: rgb(216, 48, 48);
  font-size: 16px;
  font-weight: 400;
  line-height: 24px;
}

.calendar-outer-compact-column {
  flex-direction: column;
}

.calendar-outer-compact-column span {
  color: rgb(153, 153, 153);
  font-size: 12px;
  line-height: 18px;
}

.calendar-outer-compact-column b {
  color: rgb(34, 34, 34);
  font-size: 36px;
  font-weight: 700;
  line-height: 54px;
}

.calendar-outer-compact-column i {
  color: rgb(216, 48, 48);
  font-size: 15px;
  line-height: 22.5px;
}

.calendar-outer-card {
  display: block;
  width: 100%;
  height: 100%;
  color: rgb(34, 34, 34);
}

.calendar-outer-card.is-wide {
  display: flex;
  background: #fff;
}

.calendar-outer-left {
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
  color: rgb(34, 34, 34);
}

.calendar-outer-card.is-wide .calendar-outer-left {
  width: 132px;
  flex: 0 0 132px;
  border-radius: 18%;
  color: rgba(0, 0, 0, 0.8);
}

.calendar-head {
  display: flex;
  height: 37.5px;
  align-items: center;
  justify-content: center;
  background: rgb(255, 90, 93);
  color: #fff;
  font-size: 15.96px;
  line-height: 23.94px;
  text-align: center;
}

.calendar-outer-card.is-wide .calendar-head {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: transparent;
  color: rgba(0, 0, 0, 0.8);
}

.is-calendar .calendar-outer-left strong {
  display: block;
  height: 63px;
  background: #fff;
  color: inherit;
  font-size: 50.4px;
  font-weight: 700;
  line-height: 63px;
  text-align: center;
}

.is-calendar .calendar-outer-left small,
.is-calendar .calendar-outer-left em {
  display: block;
  color: rgb(153, 153, 153);
  font-size: 12.18px;
  font-style: normal;
  line-height: 18.27px;
  text-align: center;
}

.calendar-outer-card.is-wide .calendar-outer-left em {
  color: rgba(0, 0, 0, 0.8);
}

.calendar-outer-grid {
  display: grid;
  height: 150px;
  flex: 1 1 auto;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: 22px repeat(6, 21.333px);
  align-items: center;
  padding: 10px 10px 8px 8px;
  color: rgba(34, 34, 34, 0.88);
  font-size: 12px;
  line-height: 18px;
  text-align: center;
}

.calendar-outer-weekday {
  color: rgb(153, 153, 153);
  font-size: 12px;
  line-height: 18px;
}

.calendar-outer-date {
  color: rgba(34, 34, 34, 0.86);
  font-size: 12px;
  line-height: 18px;
}

.calendar-outer-date.muted {
  color: rgba(34, 34, 34, 0.25);
}

.calendar-outer-date.today {
  color: rgb(255, 90, 93);
  font-weight: 700;
}

.hot-tabs {
  display: block;
  margin-bottom: 7px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
}

.is-hotsearch ol {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.is-hotsearch li {
  display: grid;
  grid-template-columns: 17px 1fr 50px;
  gap: 5px;
  font-size: 12px;
  line-height: 17px;
}

.is-hotsearch.size-2-2 li {
  grid-template-columns: 17px 1fr;
}

.is-hotsearch span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-hotsearch em {
  color: rgba(255, 255, 255, 0.58);
  font-style: normal;
  text-align: right;
}

.anniversary-icon-content {
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
  padding: 12px;
  background-color: var(--anniversary-bg);
  background-image: var(--anniversary-background-image);
  background-position: center;
  background-size: cover;
  color: var(--anniversary-text);
}

.anniversary-icon-content.is-payday {
  justify-content: flex-start;
  padding: 0;
  background: linear-gradient(
    to bottom,
    var(--anniversary-text) 0 44px,
    #fff 44px 100%
  );
  color: var(--anniversary-text);
  text-align: center;
}

.anniversary-icon-content.is-payday .anniversary-main {
  display: grid;
  width: 100%;
  height: 100%;
  align-content: start;
}

.anniversary-icon-content.is-payday .anniversary-label {
  height: 44px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  line-height: 44px;
}

.anniversary-icon-content.is-payday .anniversary-days {
  margin-top: 26px;
  color: var(--anniversary-text);
  font-size: 54px;
  line-height: 60px;
}

.anniversary-icon-content.is-payday .anniversary-days small,
.anniversary-icon-content.is-payday .anniversary-date {
  display: none;
}

.size-1-1 .anniversary-icon-content.is-payday .anniversary-main {
  grid-template-rows: 18px minmax(0, 1fr);
}

.size-1-1 .anniversary-icon-content.is-payday .anniversary-label {
  height: 18px;
  padding: 0 3px;
  font-size: 12px;
  line-height: 18px;
}

.size-1-1 .anniversary-icon-content.is-payday .anniversary-days {
  display: flex;
  height: 42px;
  align-items: center;
  justify-content: center;
  margin: 0;
  font-size: 22.4px;
  line-height: 33.6px;
}

.size-1-2 .anniversary-icon-content.is-payday,
.size-2-1 .anniversary-icon-content.is-payday {
  background: #fff;
}

.size-1-2 .anniversary-icon-content.is-payday .anniversary-main,
.size-2-1 .anniversary-icon-content.is-payday .anniversary-main {
  align-content: center;
  justify-items: center;
}

.size-1-2 .anniversary-icon-content.is-payday .anniversary-label {
  width: 72px;
  height: 18px;
  color: var(--anniversary-text);
  font-size: 12px;
  line-height: 18px;
}

.size-1-2 .anniversary-icon-content.is-payday .anniversary-days {
  margin: 0;
  font-size: 16px;
  line-height: 24px;
}

.size-2-1 .anniversary-icon-content.is-payday .anniversary-label {
  width: 20px;
  height: 60px;
  color: var(--anniversary-text);
  font-size: 12px;
  line-height: 18px;
  white-space: normal;
}

.size-2-1 .anniversary-icon-content.is-payday .anniversary-days {
  margin: 4px 0 0;
  font-size: 16px;
  line-height: 24px;
}

.anniversary-main,
.anniversary-label,
.anniversary-date,
.anniversary-main span {
  display: block;
  min-width: 0;
}

.anniversary-label {
  overflow: hidden;
  font-size: 12px;
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.anniversary-days {
  display: block;
  overflow: hidden;
  margin-top: 18px;
  font-size: 39px;
  font-weight: 700;
  line-height: 43px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.anniversary-days small {
  margin-left: 2px;
  font-size: 13px;
}

.anniversary-date {
  margin-top: 9px;
  overflow: hidden;
  font-size: 12px;
  font-style: normal;
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.size-1-1 .anniversary-icon-content:not(.is-payday),
.size-1-2 .anniversary-icon-content:not(.is-payday),
.size-2-1 .anniversary-icon-content:not(.is-payday) {
  display: block;
  padding: 0;
  text-align: center;
}

.size-1-1 .anniversary-icon-content:not(.is-payday) .anniversary-main,
.size-1-2 .anniversary-icon-content:not(.is-payday) .anniversary-main,
.size-2-1 .anniversary-icon-content:not(.is-payday) .anniversary-main,
.size-2-4
  .anniversary-icon-content.with-calendar:not(.is-payday)
  .anniversary-main {
  position: relative;
  width: 100%;
  height: 100%;
}

.size-1-1 .anniversary-icon-content:not(.is-payday) .anniversary-label {
  position: absolute;
  top: 10px;
  left: -6px;
  width: 72px;
  max-width: none;
  height: 18px;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}

.size-1-1 .anniversary-icon-content:not(.is-payday) .anniversary-days {
  position: absolute;
  top: 28px;
  left: -6px;
  width: 72px;
  height: 23px;
  margin: 0;
  font-size: 15px;
  line-height: 22.5px;
}

.size-1-1 .anniversary-icon-content:not(.is-payday) .anniversary-days small,
.size-1-1 .anniversary-icon-content:not(.is-payday) .anniversary-date {
  display: none;
}

.size-1-2 .anniversary-icon-content:not(.is-payday) .anniversary-label {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 71px;
  height: 18px;
  font-size: 12px;
  line-height: 18px;
  text-align: left;
  white-space: nowrap;
}

.size-1-2 .anniversary-icon-content:not(.is-payday) .anniversary-days {
  position: absolute;
  top: 18px;
  left: 93px;
  width: 45px;
  height: 24px;
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  text-align: left;
}

.size-1-2 .anniversary-icon-content:not(.is-payday) .anniversary-days small {
  display: none;
}

.size-1-2 .anniversary-icon-content:not(.is-payday) .anniversary-date {
  position: absolute;
  top: 30px;
  left: 12px;
  width: 71px;
  height: 18px;
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  text-align: left;
}

.size-2-1 .anniversary-icon-content:not(.is-payday) .anniversary-label {
  position: absolute;
  top: 12px;
  left: 0;
  width: 60px;
  max-width: none;
  height: 39px;
  font-size: 13px;
  line-height: 19.5px;
  white-space: normal;
}

.size-2-1 .anniversary-icon-content:not(.is-payday) .anniversary-days {
  position: absolute;
  top: 63px;
  left: 7px;
  width: 45px;
  height: 24px;
  margin: 0;
  font-size: 16px;
  line-height: 24px;
}

.size-2-1 .anniversary-icon-content:not(.is-payday) .anniversary-days small {
  display: none;
}

.size-2-1 .anniversary-icon-content:not(.is-payday) .anniversary-date {
  position: absolute;
  top: 99px;
  left: 0;
  width: 60px;
  max-width: none;
  height: 39px;
  margin: 0;
  font-size: 13px;
  line-height: 19.5px;
  white-space: normal;
}

.size-2-4 .anniversary-icon-content:not(.with-calendar):not(.is-payday) {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 17px;
  text-align: center;
}

.size-2-4
  .anniversary-icon-content:not(.with-calendar):not(.is-payday)
  .anniversary-main {
  display: grid;
  justify-items: center;
}

.size-2-4
  .anniversary-icon-content:not(.with-calendar):not(.is-payday)
  .anniversary-label {
  max-width: 100%;
  font-size: 11.4px;
  line-height: 13.68px;
}

.size-2-4
  .anniversary-icon-content:not(.with-calendar):not(.is-payday)
  .anniversary-days {
  margin-top: 8px;
  font-size: 32.3px;
  line-height: 48.45px;
}

.size-2-4
  .anniversary-icon-content:not(.with-calendar):not(.is-payday)
  .anniversary-date {
  margin-top: 4px;
  font-size: 11.4px;
  line-height: 17.1px;
}

.size-2-4 .anniversary-icon-content.with-calendar:not(.is-payday) {
  display: block;
  padding: 0;
}

.size-2-4
  .anniversary-icon-content.with-calendar:not(.is-payday)
  .anniversary-label {
  position: absolute;
  top: 11px;
  left: 8px;
  width: 313px;
  max-width: none;
  height: 15px;
  font-size: 12.6px;
  line-height: 15.12px;
  text-align: left;
}

.size-2-4
  .anniversary-icon-content.with-calendar:not(.is-payday)
  .anniversary-days {
  position: absolute;
  top: 42px;
  left: 8px;
  width: 118px;
  height: 57px;
  margin: 0;
  font-size: 37.8px;
  line-height: 56.7px;
  text-align: left;
}

.size-2-4
  .anniversary-icon-content.with-calendar:not(.is-payday)
  .anniversary-days
  small {
  margin-left: 0;
  font-size: 12px;
  line-height: 18px;
}

.size-2-4
  .anniversary-icon-content.with-calendar:not(.is-payday)
  .anniversary-date {
  position: absolute;
  top: 121px;
  left: 8px;
  width: 60px;
  height: 19px;
  margin: 0;
  font-size: 12.6px;
  line-height: 18.9px;
  text-align: left;
}

.anniversary-outer-calendar {
  position: absolute;
  top: 11px;
  left: 140px;
  width: 182px;
  height: 128px;
  align-content: start;
  grid-template-columns: repeat(7, 26px);
  gap: 3px 0;
  color: currentColor;
  font-size: 11.76px;
  line-height: 17.64px;
}

.movie-widget-content {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 10px;
  color: var(--movie-text-color, #f4f7f9);
  font-size: 12px;
  line-height: 18px;
}

.movie-icon-view,
.movie-inline,
.movie-vertical,
.movie-wide {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
}

.movie-icon-view {
  display: flex;
  align-items: center;
  justify-content: center;
}

.movie-calendar-icon {
  position: relative;
  display: block;
  width: 86%;
  height: 86%;
  color: #fff;
  font-style: normal;
  line-height: 12px;
}

.movie-calendar-icon svg {
  display: block;
  width: 100%;
  height: 100%;
}

.movie-calendar-icon svg rect {
  opacity: 0.96;
}

.movie-logo {
  position: absolute;
  top: 58%;
  left: 50%;
  z-index: 1;
  display: flex;
  width: 23px;
  height: 12px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #333;
  font-size: 19.2px;
  font-weight: 700;
  line-height: 12px;
  transform: translate(-50%, -50%);
}

.movie-inline {
  display: flex;
  align-items: flex-start;
}

.movie-inline-stack {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.movie-vertical {
  display: flex;
  justify-content: center;
}

.movie-vertical-stack {
  display: flex;
  height: 100%;
  min-width: 0;
}

.movie-wide {
  display: flex;
  align-items: flex-end;
}

.movie-date {
  display: block;
  width: 66px;
  height: 54px;
  overflow: visible;
  color: currentColor;
  font-size: 12px;
  line-height: 18px;
  text-align: center;
}

.movie-date strong {
  display: block;
  height: 38px;
  font-size: 40px;
  font-weight: 400;
  line-height: 32px;
}

.movie-date em {
  display: block;
  font-size: 12px;
  font-style: normal;
  line-height: 18px;
  transform: scale(0.8);
  transform-origin: center top;
}

.movie-copy {
  display: block;
  min-width: 0;
}

.movie-heading-line {
  display: block;
  min-width: 0;
  margin: 0 0 5px;
  font-size: 12px;
  line-height: 18px;
}

.movie-title {
  display: inline-block;
  overflow: hidden;
  max-width: 100%;
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.movie-rating {
  display: inline-block;
  width: fit-content;
  min-width: 49px;
  height: 12px;
  box-sizing: border-box;
  padding: 0 2px;
  border-radius: 6px;
  background: #ffac2d;
  color: #4f0e03;
  font-size: 12px;
  line-height: 12px;
  white-space: nowrap;
}

.movie-rating i {
  display: block;
  font-style: normal;
  line-height: 12px;
  transform: scale(0.82);
  transform-origin: left center;
}

.movie-copy p {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  opacity: 0.9;
  -webkit-box-orient: vertical;
}

.movie-size-1-1,
.movie-size-1-2,
.movie-size-2-1,
.movie-size-2-4 {
  padding: 10px;
}

.movie-size-1-2 .movie-title {
  max-width: 130px;
}

.movie-size-2-1 .movie-title-vertical {
  width: 14px;
  height: 125px;
  margin: 0 0 5px;
  line-height: 18px;
  white-space: normal;
  writing-mode: vertical-lr;
}

.movie-size-2-1 .movie-rating-vertical {
  display: flex;
  width: 12px;
  min-width: 12px;
  height: 48px;
  align-items: center;
  margin-left: 3px;
  writing-mode: vertical-lr;
}

.movie-size-2-2 .movie-wide {
  width: 130px;
  height: 130px;
}

.movie-size-2-2 .movie-date {
  position: absolute;
  top: 0;
  right: 0;
}

.movie-size-2-2 .movie-copy {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 130px;
  height: 76px;
}

.movie-size-2-2 .movie-heading-line {
  height: 35px;
}

.movie-size-2-2 .movie-heading-line .movie-title {
  width: 130px;
  margin-left: -4px;
}

.movie-size-2-2 .movie-heading-line .movie-rating {
  display: block;
}

.movie-size-2-2 .movie-copy p {
  height: 36px;
  -webkit-line-clamp: 2;
}

.movie-size-2-4 .movie-wide {
  width: 310px;
  height: 130px;
}

.movie-size-2-4 .movie-copy {
  width: 244px;
  height: 41px;
}

.movie-size-2-4 .movie-heading-line {
  display: flex;
  height: 18px;
  align-items: center;
}

.movie-size-2-4 .movie-heading-line .movie-title {
  width: auto;
  max-width: 190px;
  margin-left: -4px;
}

.movie-size-2-4 .movie-copy p {
  height: 18px;
  -webkit-line-clamp: 1;
}

.countdown-wrap {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--countdown-bg-color, #fff);
  color: var(--countdown-text-color, #666);
  font-family: var(
    --countdown-font-family,
    "HarmonyOS_Sans",
    "HarmonyOS Sans",
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif
  );
  font-weight: var(--countdown-font-weight, 400);
  text-align: left;
}

.countdown-wrap::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--countdown-mask-bg, rgba(0, 0, 0, 0));
  content: "";
}

.countdown-wrap .time {
  position: relative;
  z-index: 2;
  display: block;
  color: var(--countdown-text-color, #666);
  font-style: normal;
  font-weight: 400;
  white-space: nowrap;
}

.countdown-wrap .countdown-img {
  position: absolute;
  z-index: 1;
  display: block;
  background: var(
      --countdown-status-image,
      url("https://files.codelife.cc/itab/widget/countdown/offwork.png?x-oss-process=image/resize,limit_0,m_fill,w_300,h_300/quality,q_92/format,webp")
    )
    center/contain no-repeat;
}

.countdown-wrap .w-full {
  inset: 0;
  width: 100%;
  height: 100%;
}

.iconsize-1x1 .countdown-img {
  background-size: cover;
}

.iconsize-1x2 {
  padding: 8px 10px 8px 14px;
}

.iconsize-1x2 .time {
  margin-top: 13px;
  font-size: 15px;
  line-height: 20px;
}

.iconsize-1x2 .countdown-img {
  right: 7px;
  bottom: 5px;
  width: 54px;
  height: 50px;
}

.iconsize-2x1 {
  padding: 10px 6px;
  text-align: center;
}

.iconsize-2x1 .time {
  margin-top: 2px;
  font-size: 15px;
  line-height: 20px;
  text-align: center;
}

.iconsize-2x1 .countdown-img {
  right: 6px;
  bottom: 8px;
  left: 6px;
  height: 56px;
}

.iconsize-2x2 {
  padding-top: 17px;
  text-align: center;
}

.iconsize-2x2 .time {
  font-size: 19px;
  line-height: 25px;
  text-align: center;
}

.iconsize-2x2 .countdown-img {
  right: 0;
  bottom: 0;
  left: 0;
  width: 150px;
  height: 88px;
  margin: auto;
}

.iconsize-2x4 {
  padding: 12px;
}

.iconsize-2x4 .icon-2x4-offwork {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.iconsize-2x4 .time {
  margin-top: 2px;
  font-size: 27px;
  line-height: 32px;
}

.iconsize-2x4 .icon-2x4-box {
  position: absolute;
  right: 12px;
  bottom: 12px;
  left: 12px;
  z-index: 2;
  display: grid;
  height: 63px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.iconsize-2x4 .icon-2x4-box li {
  display: grid;
  align-content: center;
  justify-items: center;
  min-width: 0;
  padding: 6px 2px;
  border-radius: 6px;
  background: rgba(102, 102, 102, 0.12);
  color: var(--countdown-sub-text-color, rgba(102, 102, 102, 0.81));
  font-size: 12px;
  line-height: 14px;
}

.iconsize-2x4 .icon-2x4-box b,
.iconsize-2x4 .icon-2x4-box small {
  overflow: hidden;
  max-width: 100%;
  font-size: 12px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.iconsize-2x4 .icon-2x4-box em {
  overflow: hidden;
  max-width: 100%;
  font-size: 13px;
  font-style: normal;
  font-weight: 400;
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.iconsize-2x4 .countdown-img {
  top: 0;
  right: 0;
  bottom: 0;
  width: 110px;
  height: 150px;
  background-size: contain;
}

.is-next-holiday dl,
.is-stock dl,
.is-exchange-rate dl,
.is-world-clock dl {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
}

.is-next-holiday div,
.is-stock div,
.is-exchange-rate div,
.is-world-clock div {
  position: relative;
  min-height: 34px;
}

.is-next-holiday dt,
.is-stock dt,
.is-exchange-rate dt,
.is-world-clock dt {
  font-size: 12px;
}

.is-next-holiday dd,
.is-stock dd,
.is-exchange-rate dd,
.is-world-clock dd {
  margin: 0;
  color: rgba(255, 255, 255, 0.56);
  font-size: 11px;
}

.is-next-holiday em {
  position: absolute;
  top: 2px;
  right: 0;
  color: rgba(255, 255, 255, 0.86);
  font-size: 16px;
  font-style: normal;
}

.is-wooden-fish span {
  display: block;
  color: #b98658;
  font-size: 14px;
}

.is-wooden-fish small {
  color: #bd8f68;
  font-size: 11px;
}

.is-wooden-fish img {
  position: absolute;
  right: 17px;
  bottom: 12px;
  width: 83px;
}

.is-clock .d-watch-resize,
.is-clock .clock-icon-wrap {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
}

.is-clock .d-watch-resize {
  font-size: 21px;
}

.is-clock.size-1-1 .d-watch-resize,
.is-clock.size-1-2 .d-watch-resize,
.is-clock.size-2-1 .d-watch-resize {
  font-size: 8px;
}

.is-clock .clock-icon-wrap {
  background: #111;
  color: #fff;
  font-family: HarmonyOS_Sans, Arial, "PingFang SC", sans-serif;
}

.is-clock .fullsrceen-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  width: 1em;
  height: 1em;
  opacity: 0.3;
}

.is-clock .fullsrceen-btn svg {
  display: block;
  width: 100%;
  height: 100%;
  fill: currentColor;
}

.is-clock .clock-icon-center {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.is-clock .clock-icon-center > span {
  display: block;
}

.is-clock time {
  counter-reset: clock-value var(--value);
}

.is-clock time::before {
  content: counter(clock-value, decimal-leading-zero);
}

.is-clock .time.countdown {
  display: inline-flex;
  color: #fff;
  font-size: 44.1px;
  font-weight: 700;
  line-height: 44.1px;
  margin: 0;
  padding: 0;
}

.is-clock .time.countdown time {
  position: relative;
  z-index: 1;
  display: inline-block;
  width: 45px;
  height: 44.1px;
  text-align: left;
}

.is-clock .time.countdown em {
  position: relative;
  z-index: 2;
  display: inline-block;
  width: 11px;
  height: 44.1px;
  color: #fff;
  font-style: normal;
  line-height: 44.1px;
  vertical-align: 0.08em;
}

.is-clock .f16 {
  margin: 0;
  color: #fff;
  font-size: 16px;
  line-height: 24px;
}

.is-clock.size-1-1 .time.countdown {
  display: flex;
  width: 85px;
  height: 24px;
  justify-content: center;
  font-size: 24px;
  line-height: 24px;
}

.is-clock.size-1-1 .time.countdown time {
  width: auto;
  height: 24px;
}

.is-clock.size-1-1 .time.countdown em {
  width: 6px;
  height: 24px;
  line-height: 24px;
}

.is-clock.size-1-2 .time.countdown {
  display: flex;
  width: 129px;
  height: 24px;
  justify-content: center;
  font-size: 24px;
  line-height: 24px;
}

.is-clock.size-1-2 .time.countdown time {
  width: auto;
  height: 24px;
}

.is-clock.size-1-2 .time.countdown em {
  width: 6px;
  height: 24px;
  line-height: 24px;
}

.is-clock .clock-center-2-1 {
  align-items: stretch;
}

.clock-vertical-digits {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: flex-start;
  padding-top: 20px;
  color: #fff;
  box-sizing: border-box;
}

.is-clock .clock-icon-center > .clock-vertical-digits {
  display: flex;
}

.clock-vertical-time {
  display: block;
  width: 28px;
  height: 90px;
  color: #fff;
  font-family: cursive;
  font-style: normal;
}

.clock-vertical-digits time {
  display: block;
  width: 28px;
  height: 45px;
  font-size: 30px;
  font-weight: 400;
  line-height: 45px;
}

.clock-vertical-date {
  display: block;
  width: 33px;
  height: 36px;
}

.clock-vertical-digits small {
  display: block;
  width: 33px;
  height: 18px;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.clock-large-stack {
  display: block;
  width: 108px;
  height: 70px;
}

.clock-large-stack .time.countdown {
  width: 101px;
  height: 44.1px;
  margin-left: 3.5px;
}

.clock-large-stack .f16 {
  width: 108px;
  height: 24px;
}

.is-clock.size-2-4 .time.countdown {
  width: 202px;
  height: 54.6px;
  margin-left: 0;
  font-size: 54.6px;
  line-height: 54.6px;
}

.is-clock.size-2-4 .time.countdown time {
  width: 58px;
  height: 54.6px;
}

.is-clock.size-2-4 .time.countdown em {
  width: 14px;
  height: 54.6px;
  line-height: 54.6px;
}

.is-clock.size-2-4 .clock-large-stack {
  width: 202px;
  height: 79px;
}

.is-clock.size-2-4 .f16 {
  width: 202px;
}

.ip-outer-card {
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px 8px;
  background: rgb(60, 102, 255);
  color: #fff;
  font-family: HarmonyOS_Sans, Arial, "PingFang SC", sans-serif;
  text-align: center;
}

.ip-outer-title {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: #fff;
  font-size: 18px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ip-outer-subtitle {
  display: block;
  max-width: 100%;
  margin-top: 8px;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.92);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 19px;
  overflow-wrap: anywhere;
  text-overflow: clip;
  white-space: normal;
  word-break: break-word;
}

.ip-outer-card.is-long-address .ip-outer-title {
  font-size: 15px;
  line-height: 21px;
  overflow-wrap: anywhere;
  text-overflow: clip;
  white-space: normal;
  word-break: break-all;
}

.size-2-4 .ip-outer-card {
  padding: 20px 32px;
}

.size-2-4 .ip-outer-title {
  font-size: 40px;
  line-height: 48px;
}

.size-2-4 .ip-outer-subtitle {
  margin-top: 10px;
  font-size: 17px;
  line-height: 23px;
}

.size-2-4 .ip-outer-card.is-long-address .ip-outer-title {
  font-size: 32px;
  line-height: 40px;
}

.daily-quote-card {
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: #fff;
  font-family:
    "PingFang SC",
    -apple-system,
    "system-ui",
    "Helvetica Neue",
    Helvetica,
    sans-serif;
}

.daily-quote-icon {
  display: block;
  width: 100%;
  height: 100%;
  background: rgb(1, 18, 17);
  object-fit: contain;
}

.daily-quote-wrap {
  display: block;
  width: 100%;
  height: 100%;
  padding: 10px;
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.8), rgba(0, 20, 0, 0.7)),
    var(--daily-quote-bg-image);
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  font-weight: 700;
}

.daily-quote-content-layer {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.daily-quote-title {
  display: block;
  max-width: 100%;
  margin-bottom: 4px;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.daily-quote-text {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  -webkit-box-orient: vertical;
  color: #fff;
  font-size: 12.6px;
  font-weight: 400;
  line-height: 17.64px;
  text-align: center;
}

.daily-quote-text em {
  display: block;
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 16px;
}

.daily-quote-size-1-2 .daily-quote-text,
.daily-quote-size-2-1 .daily-quote-text {
  -webkit-line-clamp: 2;
  font-size: 11.4px;
  line-height: 15.96px;
}

.daily-quote-size-2-1 .daily-quote-content-layer {
  writing-mode: vertical-lr;
}

.daily-quote-size-2-2 .daily-quote-text {
  -webkit-line-clamp: 5;
}

.daily-quote-size-2-4 .daily-quote-text {
  -webkit-line-clamp: 3;
  font-size: 14px;
  line-height: 19.6px;
}

.daily-english-card {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 12px;
  background: #000;
  color: #fff;
  font-family:
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Helvetica Neue",
    sans-serif;
}

.daily-english-bg {
  position: absolute;
  inset: 0;
  display: block;
  background: var(--daily-english-image) center/cover no-repeat;
  opacity: 0.3;
}

.daily-english-icon {
  position: relative;
  z-index: 1;
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  color: #fff;
  font-size: 19px;
}

.daily-english-icon svg {
  width: 1.4em;
  height: 1.4em;
}

.daily-english-follow {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  display: inline-flex;
  height: 18px;
  align-items: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  line-height: 18px;
  transform: scale(0.84);
  transform-origin: top right;
}

.daily-english-follow svg {
  width: 12px;
  height: 12px;
  margin-left: 2px;
}

.daily-english-copy {
  position: relative;
  z-index: 1;
  display: flex;
  height: 100%;
  flex-direction: column;
  justify-content: center;
}

.daily-english-copy p {
  margin: 0;
  color: #fff;
  font-size: 12px;
  line-height: 18px;
}

.daily-english-copy em {
  display: block;
  margin-top: 5px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  font-style: normal;
  line-height: 18px;
}

.daily-english-audio,
.opened-english-audio {
  display: none;
}

.daily-english-size-2-4 .daily-english-copy {
  padding-right: 30px;
}

.daily-english-size-2-4 .daily-english-copy p,
.daily-english-size-2-4 .daily-english-copy em {
  font-size: 14px;
  line-height: 21px;
}

.is-eat-today .d-watch-resize,
.is-eat-today .app-eat {
  display: block;
  width: 100%;
  height: 100%;
  font-family:
    "PingFang SC",
    -apple-system,
    system-ui,
    "Helvetica Neue",
    Helvetica,
    sans-serif;
  font-size: 8px;
  line-height: 12px;
}

.is-eat-today .app-eat {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(255, 255, 255);
  color: rgb(34, 34, 34);
}

.is-eat-today .eat-box {
  display: block;
  width: 40px;
  height: 34px;
  color: rgb(34, 34, 34);
  text-align: center;
}

.is-eat-today .eat-title {
  display: block;
  width: 40px;
  height: 13px;
  margin: 0;
  color: oklch(0.278 0.033 256.848);
  font-size: 8px;
  font-weight: 700;
  line-height: 12px;
  white-space: nowrap;
}

.is-eat-today .eat-button {
  display: inline-block;
  width: 38px;
  height: 13px;
  margin: 8px 0 0;
  border-radius: 8px;
  background: linear-gradient(135deg, rgb(236, 126, 49), rgb(242, 181, 66));
  box-shadow: rgb(242, 178, 65) 0 2px 6px 0;
  color: rgb(255, 255, 255);
  font-size: 8px;
  line-height: 12px;
  cursor: pointer;
  transition:
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.is-eat-today .eat-button > span {
  display: inline;
  font-size: 5.36px;
  line-height: 8.04px;
}

.is-eat-today .eat-button.is-running {
  box-shadow: rgb(242, 178, 65) 0 1px 4px 0;
  transform: scale(0.96);
}

.is-eat-today .eat-button.is-running > span {
  animation: eat-today-random-flip 70ms linear infinite;
}

.is-eat-today.size-2-2 .d-watch-resize,
.is-eat-today.size-2-4 .d-watch-resize,
.is-eat-today.size-2-2 .app-eat,
.is-eat-today.size-2-4 .app-eat {
  font-size: 21px;
  line-height: 31.5px;
}

.is-eat-today.size-2-2 .eat-box,
.is-eat-today.size-2-4 .eat-box {
  width: 105px;
  height: 88px;
}

.is-eat-today.size-2-2 .eat-title,
.is-eat-today.size-2-4 .eat-title {
  width: 105px;
  height: 34px;
  font-size: 21px;
  line-height: 31.5px;
}

.is-eat-today.size-2-2 .eat-button,
.is-eat-today.size-2-4 .eat-button {
  width: 99px;
  height: 34px;
  margin-top: 21px;
  border-radius: 21px;
  font-size: 21px;
  line-height: 31.5px;
}

.is-eat-today.size-2-2 .eat-button > span,
.is-eat-today.size-2-4 .eat-button > span {
  font-size: 14.07px;
  line-height: 21.105px;
}

.wallpaper-copyright {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  box-sizing: border-box;
  display: block;
  height: 40px;
  overflow: hidden;
  padding: 5px 10px 6px;
  color: #fff;
  font-size: 10.5px;
  font-weight: 400;
  line-height: 14px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: normal;
}

.wallpaper-copyright-text {
  display: -webkit-box;
  max-height: 28px;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.todo-icon-asset {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  background: #fff;
}

.todo-icon-asset img {
  display: block;
  width: 100%;
  height: 100%;
  background-color: rgb(32, 102, 204);
  object-fit: contain;
}

.todo-icon-content {
  display: flex;
  width: 100%;
  height: 100%;
  background: #fff;
  color: rgba(0, 0, 0, 0.8);
}

.todo-icon-main {
  display: block;
  width: 100%;
  height: 100%;
  overflow: auto;
}

.todo-icon-content.is-wide .todo-icon-main {
  width: 100%;
}

.todo-icon-main strong {
  display: flex;
  height: 24px;
  align-items: center;
  padding: 0 8.4px;
  color: rgb(52, 110, 253);
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
}

.todo-icon-row {
  display: flex;
  height: 30px;
  align-items: center;
  padding: 0 10.416px;
  color: rgba(0, 0, 0, 0.8);
  font-size: 13.02px;
  line-height: 19.53px;
}

.todo-icon-row.has-checkbox {
  padding: 0 14px;
}

.todo-icon-row i {
  display: block;
  width: 3px;
  height: 12px;
  flex: 0 0 3px;
  margin-right: 7px;
  border-radius: 3px;
  background: rgb(147, 147, 147);
}

.todo-icon-check {
  display: block;
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
  margin-right: 10px;
  border: 2px solid rgb(147, 147, 147);
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}

.todo-icon-check:hover {
  border-color: rgb(24, 144, 255);
}

.todo-icon-row em {
  display: block;
  min-width: 0;
  overflow: hidden;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-stock div {
  display: grid;
  grid-template-columns: 1fr 42px;
}

.is-stock em,
.is-stock b {
  text-align: right;
}

.is-stock em {
  font-style: normal;
}

.is-stock .up {
  color: #e55363;
}

.is-stock .down {
  color: #4cbf7a;
}

.is-exchange-rate div {
  display: grid;
  grid-template-columns: 24px 1fr 46px;
  gap: 6px;
  align-items: center;
}

.is-exchange-rate img {
  width: 20px;
  height: 14px;
  object-fit: cover;
}

.is-exchange-rate dd {
  color: #9099a4;
}

.is-exchange-rate em {
  color: #515c69;
  font-style: normal;
  text-align: right;
}

.is-habit strong {
  display: block;
  color: #6f7c8c;
  font-size: 20px;
}

.is-habit span {
  display: block;
  margin: 4px 0 16px;
  color: #4b5868;
  font-size: 12px;
}

.is-habit i {
  display: inline-block;
  width: 16px;
  height: 16px;
  margin: 0 4px 4px 0;
  border-radius: 50%;
  background: #dfe6ef;
}

.tomato-icon-wrap {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  background: #000;
  color: #fff;
  font-family: Arial, sans-serif;
  text-align: center;
}

.tomato-bg-carousel,
.tomato-bg-item {
  position: absolute;
  inset: 0;
}

.tomato-bg-carousel {
  overflow: visible;
}

.tomato-bg-item {
  transition: transform 0.28s ease;
}

.tomato-bg-dim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(3, 25, 56, 0.6);
}

.tomato-bg-item img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tomato-switch-btn {
  position: absolute;
  top: 50%;
  right: 0;
  left: 46%;
  z-index: 20;
  display: flex;
  height: 24px;
  align-items: center;
  justify-content: center;
  margin-top: -11px;
  color: #fff;
}

.tomato-switch-btn svg {
  width: 22px;
  height: 22px;
  fill: currentColor;
}

.tomato-switch-action {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  color: currentColor;
  cursor: pointer;
  font-style: normal;
}

.tomato-theme-name {
  display: block;
  margin: 0 16px;
  font-size: 16px;
  line-height: 24px;
}

.tomato-text-separator {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  white-space: pre;
}

.tomato-progress-box {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  padding: 12px;
  color: #fff;
}

.size-2-4 .tomato-progress-box {
  right: auto;
  width: 70%;
}

.tomato-progress-ring {
  position: absolute;
  inset: 12px;
  z-index: 0;
  width: calc(100% - 24px);
  height: calc(100% - 24px);
  color: rgba(255, 255, 255, 0.5);
  pointer-events: none;
}

.tomato-progress-ring circle,
.tomato-progress-ring path {
  stroke: currentColor;
  stroke-linecap: round;
}

.tomato-progress-ring .tomato-progress-track,
.tomato-progress-ring .tomato-progress-fill {
  fill: none;
  stroke-width: 18;
}

.tomato-progress-ring .tomato-progress-track {
  stroke: rgba(255, 255, 255, 0.3);
}

.tomato-progress-ring .tomato-progress-fill {
  stroke: rgba(255, 255, 255, 0.4);
  stroke-linecap: butt;
  transition:
    stroke-dashoffset 0.6s ease 0s,
    stroke 0.6s ease 0s,
    opacity 0.6s ease 0s;
}

.tomato-progress-ring path {
  fill: none;
  stroke-width: 4;
}

.tomato-time-grid {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  font-family: Arial, sans-serif;
}

.tomato-time-grid p {
  margin: 0;
  color: #fff;
  font-weight: 700;
}

.tomato-time-grid time {
  color: inherit;
  font-family: inherit;
  font-weight: inherit;
}

.tomato-sound-slash {
  display: none;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 46;
}

.opened-tomato-audio.muted .tomato-sound-slash {
  display: block;
}

.tomato-outer-controls {
  position: absolute;
  bottom: 29px;
  left: 50%;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translateX(-50%);
}

.size-1-1 .tomato-outer-controls,
.size-1-2 .tomato-outer-controls,
.size-2-1 .tomato-outer-controls {
  inset: 0;
  display: none;
  background-color: #000;
  margin-top: 0;
  transform: none;
}

.size-1-1:hover .tomato-outer-controls,
.size-1-2:hover .tomato-outer-controls,
.size-2-1:hover .tomato-outer-controls {
  display: flex;
}

.size-2-1 .tomato-outer-controls {
  flex-direction: column;
}

.tomato-outer-control {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  margin: 0 2px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
}

.size-1-1 .tomato-outer-control {
  width: 22px;
  height: 22px;
}

.size-2-1 .tomato-outer-control {
  margin: 2px;
}

.tomato-outer-control-primary {
  border-color: rgba(255, 255, 255, 0.4);
  background: transparent;
}

.tomato-outer-control:hover {
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.tomato-outer-control svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.tomato-outer-control-primary .tomato-control-play-icon {
  transform: translateX(1px);
}

.size-1-1 .tomato-time-grid p,
.size-1-1 .tomato-time-grid time {
  width: 43px;
  height: 24px;
  font-size: 16px;
  line-height: 24px;
}

.size-1-2 .tomato-time-grid p,
.size-1-2 .tomato-time-grid time {
  width: 86px;
  height: 48px;
  font-size: 32px;
  line-height: 48px;
}

.size-2-1 .tomato-progress-box {
  padding: 20px 0;
}

.size-2-1 .tomato-time-grid {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 0;
}

.size-2-1 .tomato-time-grid p {
  display: grid;
  width: 36px;
  height: 90px;
  font-size: 30px;
  font-weight: 400;
  line-height: 45px;
}

.size-2-1 .tomato-time-grid time {
  display: block;
  width: 36px;
  height: 45px;
  font-size: 30px;
  line-height: 45px;
}

.size-2-2 .tomato-time-grid p,
.size-2-4 .tomato-time-grid p {
  width: 100%;
  height: 50px;
  font-size: 21px;
  line-height: 31.5px;
}

.size-2-2 .tomato-time-grid time,
.size-2-4 .tomato-time-grid time {
  display: inline;
  width: 90px;
  height: 39px;
  font-size: 33.6px;
  line-height: 50.4px;
}

.is-world-clock div {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.is-world-clock dt {
  font-size: 14px;
}

.is-world-clock dd {
  color: rgba(255, 255, 255, 0.64);
  text-align: right;
}

.converter-card-content {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: #fff;
}

.converter-icon-img {
  display: block;
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.converter-card-size-1-1 {
  display: grid;
  place-items: center;
}

.converter-card-size-1-2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  text-align: left;
}

.converter-compact-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.converter-compact-title,
.converter-compact-sub {
  display: block;
  overflow: hidden;
  font-size: 13px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.converter-compact-title {
  color: #fff;
}

.converter-compact-sub {
  color: rgb(147, 147, 147);
}

.converter-card-size-2-1 {
  display: grid;
  align-content: space-between;
  justify-items: center;
  padding: 12px 6px;
}

.converter-vertical-title {
  display: block;
  color: #fff;
  font-size: 13px;
  font-weight: 400;
  line-height: 13px;
  writing-mode: vertical-rl;
}

.converter-card-header {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 24px;
  gap: 6px;
  color: #fff;
  font-size: 12px;
  font-weight: 400;
  line-height: 24px;
}

.converter-card-header svg {
  display: block;
  width: 11px;
  height: 11px;
  color: rgba(255, 255, 255, 0.8);
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.9px;
}

.converter-tool-grid {
  display: grid;
  width: 100%;
  height: calc(100% - 24px);
  padding: 4.2px 10.5px 10.5px;
  gap: 6px;
}

.converter-tool-grid.size-2-2 {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 53px);
}

.converter-tool-grid.size-2-4 {
  grid-template-columns: repeat(5, 1fr);
  grid-template-rows: repeat(2, 53px);
}

.converter-tool-tile {
  display: grid;
  min-width: 0;
  place-items: center;
  align-content: center;
  gap: 4px;
  border-radius: 6px;
  background: rgba(60, 64, 67, 0.5);
}

.converter-tool-tile svg {
  display: block;
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8px;
}

.converter-tool-tile b {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: rgb(147, 147, 147);
  font-size: 10px;
  font-weight: 400;
  line-height: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.itab-quote {
  position: fixed;
  left: 60px;
  right: 16px;
  bottom: 16px;
  z-index: 7;
  color: rgba(255, 255, 255, 0.86);
  font-size: 12px;
  text-align: center;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
}

.itab-native-menu {
  position: absolute;
  z-index: 80;
  min-width: 144px;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 10px;
  background: rgba(18, 22, 29, 0.78);
  box-shadow: 0 18px 52px rgba(0, 0, 0, 0.32);
  color: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(18px);
}

.itab-native-menu button {
  display: flex;
  width: 100%;
  min-height: 34px;
  align-items: center;
  justify-content: space-between;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.itab-native-menu button:hover {
  background: rgba(255, 255, 255, 0.12);
}

.blank-menu,
.widget-menu {
  position: fixed;
}

.widget-menu {
  width: 140px;
  min-width: 140px;
  padding: 4px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  background-image: none;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px) brightness(0.58);
}

.search-menu {
  top: 50px;
  left: 0;
}

.search-menu small {
  color: rgba(255, 255, 255, 0.45);
}

.itab-group-popover {
  left: 54px;
  top: 458px;
}

.layout-title {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0;
  color: rgba(255, 255, 255, 0.96);
  font-size: 15px;
  font-weight: 500;
  line-height: 30px;
}

.layout-title svg,
.widget-menu-action svg {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.layout-buttons {
  display: grid;
  grid-template-columns: repeat(3, 36px);
  gap: 4px;
  margin-top: 0;
  padding-bottom: 4px;
}

.layout-buttons button {
  width: 36px;
  min-height: 20px;
  justify-content: center;
  padding: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
}

.layout-buttons button:hover,
.layout-buttons button.active {
  background: rgba(255, 255, 255, 0.3);
}

.layout-buttons button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.widget-menu .widget-menu-action {
  min-height: 30px;
  gap: 7px;
  justify-content: flex-start;
  padding: 0 4px;
  border-radius: 6px;
  font-size: 15px;
  font-weight: 500;
  line-height: 30px;
}

.widget-menu .widget-menu-action + .widget-menu-action {
  margin-top: 4px;
}

.itab-native-modal,
.itab-native-panel {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
}

.add-window,
.opened-window {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 16px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.38);
}

.add-window {
  display: grid;
  grid-template-columns: 156px 1fr;
  width: min(998px, calc(100vw - 32px));
  height: min(600px, calc(100vh - 36px));
  background: rgba(232, 235, 234, 0.72);
  color: #25262a;
  backdrop-filter: blur(28px);
}

.traffic {
  position: absolute;
  top: 11px;
  right: 18px;
  z-index: 3;
  display: flex;
  gap: 12px;
}

.traffic button {
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 999px;
}

.traffic .yellow {
  background: #ffbf2f;
}

.traffic .green {
  background: #1bd228;
}

.traffic .red {
  background: #ff5c59;
}

.add-window aside {
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 82px 12px 0;
  background: rgba(255, 255, 255, 0.18);
}

.add-window aside button {
  height: 46px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: rgba(0, 0, 0, 0.68);
  text-align: left;
  cursor: pointer;
}

.add-window aside button.active {
  background: rgba(255, 255, 255, 0.42);
  color: #222;
}

.add-main {
  min-width: 0;
  padding: 18px 14px 18px 20px;
  overflow: hidden auto;
}

.add-main header {
  display: flex;
  gap: 18px;
  align-items: center;
  padding-left: 4px;
}

.add-main header input {
  width: 224px;
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.48);
  outline: none;
}

.add-main header label {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}

.add-main select {
  width: 90px;
  height: 28px;
  border: 0;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.5);
}

.chips {
  display: flex;
  gap: 10px;
  margin: 14px 0 12px;
}

.chips button {
  min-width: 42px;
  height: 25px;
  border: 0;
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.5);
  color: #333;
  cursor: pointer;
}

.chips button.active {
  background: #2b8cff;
  color: #fff;
}

.add-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(260px, 1fr));
  gap: 16px;
}

.add-grid article {
  position: relative;
  min-height: 280px;
  overflow: hidden;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.38);
  text-align: center;
}

.add-grid h3 {
  margin: 20px 0 3px;
  font-size: 18px;
}

.add-grid p {
  margin: 0 auto;
  max-width: 78%;
  color: #6a6f77;
  font-size: 13px;
  line-height: 20px;
}

.add-grid img,
.poem-preview,
.tomato-preview,
.exchange-preview {
  display: grid;
  width: 150px;
  height: 150px;
  margin: 34px auto 0;
  place-items: center;
  border-radius: 22px;
  background: #fff;
  color: #60646c;
  font-size: 18px;
  line-height: 24px;
}

.add-grid img {
  padding: 34px;
  background: linear-gradient(135deg, #358aff, #6a4df5);
}

.tomato-preview {
  background:
    linear-gradient(rgba(0, 0, 0, 0.24), rgba(0, 0, 0, 0.34)),
    url("https://files.codelife.cc/itab/widget/tomato/hailang.jpg?x-oss-process=image/resize,limit_0,m_fill,w_200,h_200/format,webp")
      center/cover;
  color: #fff;
  font-size: 34px;
}

.exchange-preview {
  align-content: center;
  background: #fff;
  color: #3f4854;
  font-size: 15px;
}

.add-grid article > button {
  position: absolute;
  right: 14px;
  bottom: 14px;
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 14px;
  background: #1890ff;
  color: #fff;
  cursor: pointer;
}

.add-grid small {
  position: absolute;
  left: 14px;
  bottom: 17px;
  color: #565b63;
  font-size: 13px;
}

.site-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 12px;
}

.site-grid button {
  display: grid;
  gap: 8px;
  min-height: 118px;
  place-items: center;
  border: 0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.4);
  cursor: pointer;
}

.site-grid img {
  width: 46px;
  height: 46px;
  border-radius: 12px;
}

.site-grid b {
  color: #1890ff;
  font-size: 12px;
}

.custom-form {
  display: grid;
  max-width: 460px;
  gap: 14px;
  margin-top: 24px;
}

.custom-preview {
  display: grid;
  width: 86px;
  height: 86px;
  place-items: center;
  border-radius: 20px;
  background: #3478f6;
  color: #fff;
  font-size: 36px;
}

.custom-form label {
  display: grid;
  gap: 6px;
  color: #4c525c;
  font-size: 13px;
}

.custom-form input {
  height: 38px;
  padding: 0 12px;
  border: 0;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.55);
  outline: none;
}

.custom-form button {
  width: 88px;
  height: 34px;
  border: 0;
  border-radius: 17px;
  background: #1890ff;
  color: #fff;
  cursor: pointer;
}

.opened-window {
  width: min(998px, calc(100vw - 42px));
  height: min(600px, calc(100vh - 64px));
  background: rgba(250, 250, 250, 0.96);
  color: #20242c;
  backdrop-filter: blur(26px);
}

.opened-window.opened-eat-today {
  width: min(1000px, calc(100vw - 32px));
  height: min(602px, calc(100vh - 32px));
  border: 0;
  border-radius: 20px;
  background: rgb(255, 255, 255);
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
  color: rgb(34, 34, 34);
  font-family:
    "PingFang SC",
    -apple-system,
    system-ui,
    "Helvetica Neue",
    Helvetica,
    sans-serif;
  font-size: 14px;
  line-height: 21px;
  backdrop-filter: none;
}

.opened-window.opened-eat-today .traffic {
  top: 11px;
  right: 17px;
}

.opened-window.opened-eat-today .traffic .yellow {
  display: none;
}

.opened-window.opened-poem {
  width: min(860px, calc(100vw - 42px));
  height: min(552px, calc(100vh - 64px));
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 20px;
  background: #eee;
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
  color: #333;
  backdrop-filter: none;
  overflow: auto;
}

.opened-window.opened-movie {
  width: min(860px, calc(100vw - 42px));
  height: min(552px, calc(100vh - 64px));
  border: 0;
  border-radius: 20px;
  background: transparent;
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
  color: #fff;
  backdrop-filter: none;
}

.opened-window.opened-poem .traffic {
  top: 11px;
  right: 17px;
}

.opened-window.opened-poem .traffic .yellow {
  display: none;
}

.opened-window button {
  border: 0;
  cursor: pointer;
}

.opened-weather {
  width: min(1000px, calc(100vw - 42px));
  height: min(602px, calc(100vh - 18px));
  border-radius: 20px;
  background: linear-gradient(45deg, rgb(33, 30, 34) 20%, rgb(56, 58, 62));
  color: #fff;
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
  backdrop-filter: none;
}

.opened-weather .traffic {
  top: 11px;
  right: 17px;
}

.opened-weather .traffic .yellow {
  display: none;
}

.opened-hotsearch {
  background: #fff;
}

.opened-hot-head {
  position: relative;
  height: 84px;
  padding-top: 30px;
  border-bottom: 1px solid #eef0f3;
}

.opened-hot-logo {
  position: absolute;
  top: -25px;
  left: 50%;
  display: grid;
  width: 80px;
  height: 80px;
  place-items: center;
  border-radius: 50%;
  color: #ff4b4b;
  font-size: 42px;
  font-weight: 700;
  line-height: 80px;
  text-align: center;
  text-shadow: 0 9px 18px rgba(255, 75, 75, 0.18);
  transform: translateX(-50%) skew(-8deg);
}

.opened-hot-head nav {
  display: flex;
  height: 54px;
  align-items: center;
  gap: 0;
  overflow: hidden;
  padding: 0 20px;
  white-space: nowrap;
}

.opened-hot-head button {
  height: 40px;
  padding: 0 20px;
  background: transparent;
  color: #242933;
  font-size: 14px;
  font-weight: 500;
}

.opened-hot-head button.active {
  border-bottom: 2px solid #5ab8ff;
  color: #1686dd;
}

.opened-hot-body {
  display: grid;
  grid-template-columns: 200px 1fr;
  height: calc(100% - 84px);
}

.opened-hot-body aside {
  padding: 14px 12px;
  border-right: 1px solid #eef0f3;
  background: #fbfcfd;
}

.opened-hot-body aside label {
  display: block;
  height: 26px;
  padding: 0 9px;
  border-radius: 13px;
  background: #f1f3f7;
  color: #c2c7ce;
  font-size: 12px;
  line-height: 26px;
}

.opened-hot-body aside button {
  display: grid;
  width: 100%;
  height: 38px;
  grid-template-columns: 28px 1fr 26px;
  align-items: center;
  margin-top: 10px;
  border-radius: 7px;
  background: transparent;
  color: #343a43;
  font-size: 14px;
  text-align: left;
}

.opened-hot-body aside button.active {
  background: #e9eaec;
  color: #1c74d8;
}

.opened-hot-body aside em {
  color: #728092;
  font-style: normal;
}

.opened-hot-body section {
  position: relative;
  min-height: 0;
  padding: 20px 30px 18px;
  overflow: hidden auto;
  scrollbar-color: rgba(160, 170, 184, 0.72) transparent;
  scrollbar-width: thin;
}

.opened-hot-body section::-webkit-scrollbar {
  width: 6px;
}

.opened-hot-body section::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(160, 170, 184, 0.7);
}

.opened-hot-body h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 13px;
  font-size: 18px;
  font-weight: 500;
}

.opened-hot-body h3 span {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  background: #3179e8;
  color: #fff;
  font-size: 14px;
}

.opened-hot-body h3 i {
  margin-left: auto;
  color: #90969e;
  font-size: 13px;
  font-style: normal;
}

.opened-hot-body ol {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.opened-hot-body li {
  display: grid;
  grid-template-columns: 30px 1fr 70px;
  align-items: center;
  height: 36px;
  border-bottom: 1px solid #f0f1f3;
  color: #343942;
  font-size: 14px;
}

.opened-hot-body li b {
  display: grid;
  width: 18px;
  height: 18px;
  place-items: center;
  border-radius: 5px;
  background: #eef0f3;
  color: #9ba2ab;
  font-size: 12px;
}

.opened-hot-body li:nth-child(1) b,
.opened-hot-body li:nth-child(2) b,
.opened-hot-body li:nth-child(3) b {
  background: #ff4f5c;
  color: #fff;
}

.opened-hot-body li:nth-child(2) b {
  background: #ff922e;
}

.opened-hot-body li:nth-child(3) b {
  background: #ffc531;
}

.opened-hot-body li span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.opened-hot-body li em {
  color: #a1a8b1;
  font-style: normal;
  text-align: right;
}

.opened-exchange-rate {
  background: #f6f6f7;
}

.opened-exchange-grid {
  display: grid;
  height: 100%;
  grid-template-columns: 198px 1fr;
}

.opened-exchange-grid aside {
  padding: 20px 10px 12px;
  background: rgba(255, 255, 255, 0.82);
}

.opened-exchange-grid aside header {
  font-size: 14px;
}

.opened-exchange-grid aside header span {
  margin-left: 2px;
  color: #a4abb5;
  font-size: 12px;
}

.currency-base {
  display: grid;
  height: 72px;
  grid-template-columns: 1fr 60px;
  align-items: center;
  margin: 13px 0;
  padding: 0 12px;
  border-radius: 8px;
  background: #fff;
}

.currency-base strong,
.opened-exchange-grid aside button b {
  font-size: 14px;
  font-weight: 500;
}

.currency-base b {
  text-align: right;
}

.currency-base span {
  grid-column: 2;
  color: #8f98a5;
  font-size: 12px;
  text-align: right;
}

.opened-exchange-grid aside p {
  display: flex;
  justify-content: space-between;
  margin: 0;
  color: #a0a7af;
  font-size: 13px;
}

.opened-exchange-grid aside p button {
  background: transparent;
  color: #727b87;
}

.opened-exchange-grid aside > button {
  display: grid;
  width: 100%;
  height: 54px;
  grid-template-columns: 30px 1fr 64px;
  align-items: center;
  margin-top: 4px;
  padding: 0 10px;
  border-radius: 0;
  background: transparent;
  border-bottom: 1px solid #edf0f3;
  color: #2d333c;
  text-align: left;
}

.opened-exchange-grid aside > button img {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
}

.opened-exchange-grid aside > button.active {
  background: #cbeeff;
}

.opened-exchange-grid aside > button strong {
  text-align: right;
}

.opened-exchange-grid aside > button em {
  grid-column: 3;
  color: #9ba4af;
  font-size: 12px;
  font-style: normal;
  text-align: right;
}

.opened-exchange-grid section {
  padding: 58px 26px 24px;
}

.exchange-convert {
  display: grid;
  height: 64px;
  grid-template-columns: 100px 42px 100px 1fr;
  align-items: center;
  padding: 0 22px;
  border-radius: 9px;
  background: #ececec;
}

.exchange-convert span {
  display: grid;
  place-items: center;
  gap: 4px;
}

.exchange-convert b {
  font-size: 13px;
  font-weight: 400;
}

.exchange-convert i {
  color: #1f242b;
  font-size: 24px;
  font-style: normal;
  text-align: center;
}

.exchange-convert strong {
  font-size: 30px;
  font-weight: 400;
  text-align: right;
}

.exchange-convert em {
  display: block;
  color: #8f97a2;
  font-size: 12px;
  font-style: normal;
}

.exchange-tabs {
  display: flex;
  width: 480px;
  height: 28px;
  margin: 10px auto 26px;
  overflow: hidden;
  border-radius: 14px;
  background: #d4d4d4;
}

.exchange-tabs button {
  flex: 1;
  background: transparent;
  color: #585f69;
}

.exchange-tabs button.active {
  border-radius: 14px;
  background: #a9a9a9;
  color: #fff;
}

.exchange-stats {
  display: flex;
  justify-content: space-between;
  margin: 0 22px 14px;
  color: #59616c;
  font-size: 13px;
}

.exchange-stats div {
  display: flex;
  gap: 6px;
}

.exchange-stats dd {
  margin: 0;
}

.exchange-chart {
  position: relative;
  height: 310px;
  background:
    repeating-linear-gradient(to bottom, transparent 0 62px, #e5e6e9 63px),
    linear-gradient(#f6f6f7, #f6f6f7);
}

.exchange-chart svg {
  width: 100%;
  height: 100%;
}

.opened-window.opened-tomato {
  box-sizing: border-box;
  width: min(1000px, calc(100vw - 42px));
  height: min(602px, calc(100vh - 64px));
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  background: transparent;
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
  color: #fff;
  backdrop-filter: none;
}

.opened-window.opened-tomato .traffic {
  top: 11px;
  right: 17px;
  z-index: 4;
  display: flex;
}

.opened-window.opened-tomato .traffic .yellow {
  display: none;
}

.opened-window.opened-tomato .traffic button {
  display: block;
  width: 16px;
  height: 16px;
}

.opened-tomato-body {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: #e3e3e3;
}

.opened-tomato-bg-stack,
.opened-tomato-bg-stack img {
  position: absolute;
  inset: 0;
}

.opened-tomato-bg-stack img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.28s ease;
}

.opened-tomato-bg-stack img.active {
  opacity: 1;
}

.opened-tomato-body::after {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(3, 25, 56, 0.34);
  content: "";
}

.opened-tomato-content {
  position: relative;
  z-index: 2;
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform: translateY(11px);
}

.opened-tomato-tool {
  position: absolute;
  top: -11px;
  right: 17px;
  display: none;
  height: 32px;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.74);
}

.opened-tomato-tool span,
.opened-tomato-tool button {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  padding: 0;
  background: transparent;
  color: inherit;
}

.opened-tomato-fullscreen svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.opened-tomato-close svg {
  width: 11px;
  height: 11px;
  fill: currentColor;
}

.opened-tomato-theme {
  display: flex;
  height: 24px;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
  color: #fff;
  font-family: Arial, sans-serif;
}

.opened-tomato-theme button {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  padding: 0;
  background: transparent;
  color: inherit;
}

.opened-tomato-theme svg {
  width: 22px;
  height: 22px;
  fill: currentColor;
}

.opened-tomato-theme span {
  display: block;
  margin: 0 16px;
  font-size: 16px;
  line-height: 24px;
}

.tomato-dial {
  position: relative;
  display: grid;
  width: 360px;
  height: 360px;
  place-items: center;
  color: rgba(255, 255, 255, 0.8);
}

.tomato-dial-ring {
  position: absolute;
  inset: 0;
  width: 360px;
  height: 360px;
  color: rgba(255, 255, 255, 0.5);
}

.tomato-dial-ring circle,
.tomato-dial-ring path {
  stroke: currentColor;
  stroke-linecap: round;
}

.tomato-dial-ring .tomato-progress-track,
.tomato-dial-ring .tomato-progress-fill {
  fill: none;
  stroke-width: 18;
}

.tomato-dial-ring .tomato-progress-track {
  stroke: rgba(255, 255, 255, 0.3);
}

.tomato-dial-ring .tomato-progress-fill {
  stroke: rgba(255, 255, 255, 0.4);
  stroke-linecap: butt;
  transition:
    stroke-dashoffset 0.6s ease 0s,
    stroke 0.6s ease 0s,
    opacity 0.6s ease 0s;
}

.tomato-dial-ring path {
  fill: none;
  stroke-width: 4;
}

.tomato-dial strong {
  position: relative;
  z-index: 1;
  color: rgba(255, 255, 255, 0.8);
  font-family: Arial, sans-serif;
  font-size: 70px;
  font-weight: 700;
  line-height: 105px;
}

.opened-tomato-controls {
  display: flex;
  height: 40px;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin: 16px 0 20px;
}

.opened-tomato-control {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  padding: 0;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.14);
  color: #fff;
  backdrop-filter: blur(10px);
}

.opened-tomato-start {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.22);
}

.opened-tomato-stop {
  color: rgba(255, 255, 255, 0.58);
}

.opened-tomato-control svg {
  width: 19px;
  height: 19px;
  fill: currentColor;
}

.opened-tomato-start .tomato-control-play-icon {
  transform: translateX(1px);
}

.opened-tomato-audio {
  position: absolute;
  left: 18px;
  bottom: 14px;
  z-index: 3;
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  padding: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.72);
}

.opened-tomato-audio.active {
  color: #fff;
}

.opened-tomato-audio:not(.active) {
  opacity: 0.48;
}

.opened-tomato-audio.blocked {
  color: rgba(255, 214, 102, 0.95);
}

.opened-tomato-audio svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.opened-tomato-audio .tomato-sound-slash {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 46;
}

.opened-tool,
.opened-world-clock-panel,
.opened-task-panel,
.opened-stock-panel,
.opened-media-panel,
.opened-wooden-fish,
.opened-speed-panel,
.opened-gradient-panel,
.opened-calendar-panel,
.opened-anniversary-panel,
.opened-food-panel,
.opened-generic-panel {
  height: 100%;
  padding: 54px 42px 34px;
}

.opened-tool header,
.opened-world-clock-panel header,
.opened-task-panel header,
.opened-stock-panel header,
.opened-speed-panel header,
.opened-calendar-panel header,
.opened-anniversary-panel header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
}

.opened-tool header img,
.opened-speed-panel header img {
  width: 54px;
  height: 54px;
  object-fit: contain;
}

.opened-tool header strong,
.opened-world-clock-panel header strong,
.opened-task-panel header strong,
.opened-stock-panel header strong,
.opened-speed-panel header strong,
.opened-calendar-panel header strong,
.opened-anniversary-panel header strong {
  display: block;
  font-size: 24px;
}

.opened-tool header span,
.opened-world-clock-panel header span,
.opened-task-panel header span,
.opened-stock-panel header span,
.opened-calendar-panel header span,
.opened-anniversary-panel header span {
  color: #7b8490;
  font-size: 13px;
}

.opened-window.opened-clock {
  width: min(1000px, calc(100vw - 32px));
  height: min(602px, calc(100vh - 32px));
  border: 1px solid rgba(0, 0, 0, 0.13);
  border-radius: 20px;
  background: transparent;
  color: #222;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.48);
  backdrop-filter: none;
  overflow: auto;
  animation: clock-dialog-in 180ms cubic-bezier(0.2, 0, 0, 1);
}

.opened-window.opened-clock > .traffic {
  display: none;
}

.opened-clock-panel {
  position: relative;
  height: 100%;
  padding: 0;
  overflow: hidden;
}

.opened-clock-panel .clock-source-header {
  position: absolute;
  inset: 0 0 auto;
  z-index: 12;
  height: 10px;
  padding: 5px;
}

.opened-clock-panel .d-dialog-tool {
  position: absolute;
  top: 11px;
  right: 13px;
  display: flex;
  align-items: center;
  gap: 11px;
  color: rgba(255, 255, 255, 0.64);
}

.opened-clock-panel .toggle-fullscreen,
.opened-clock-panel .close-window {
  display: grid;
  width: 18px;
  height: 18px;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
}

.opened-clock-panel .toggle-fullscreen svg {
  width: 11px;
  height: 11px;
  fill: currentColor;
}

.opened-clock-panel .close-window svg {
  width: 8px;
  height: 8px;
  fill: currentColor;
}

.clock-dialog-body {
  position: relative;
  z-index: 10;
  height: 100%;
  overflow: hidden;
}

.clock-dialog-root {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
}

.clock-dialog-center {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
}

.clock-flip-row {
  display: flex;
  width: 868.5px;
  height: 196.953px;
  align-items: center;
  justify-content: center;
  margin-top: -53.227px;
  color: #222;
  font-size: 33.2667px;
  line-height: 49.9px;
}

.clock-flip-row.is-seconds-hidden {
  width: 569px;
}

.clock-flip-slot {
  width: 134.75px;
  height: 196.953px;
}

.clock-flip-separator {
  display: flex;
  width: 30px;
  height: 186.953px;
  align-items: center;
  justify-content: center;
  margin: 5px 0;
  color: #bdbdbd;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 58px;
  font-weight: 700;
  line-height: 1;
  transform: translateY(-2px);
}

.opened-clock-panel .scoreboard-digit {
  --flip-card-width: 124.75px;
  --flip-card-height: 186.953px;
  --flip-card-radius: 12.6413px;
  --flip-font-family: Arial, Helvetica, sans-serif;
  --flip-font-size: 166.333px;
  --flip-font-weight: 800;
  --flip-text-color: #ccc;
  --flip-bg-top: linear-gradient(180deg, #1f1f1f 0%, #181818 100%);
  --flip-bg-bottom: linear-gradient(180deg, #171717 0%, #1d1d1d 100%);
  --flip-border-color: rgba(0, 0, 0, 0.62);
  --flip-shadow: 0 1px 10px rgba(0, 0, 0, 0.7);
  --flip-perspective: 480px;
  --flip-timing-down: cubic-bezier(0.45, 0, 0.35, 1);
  --flip-timing-up: cubic-bezier(0.25, 0, 0.15, 1);
  --flip-center-line: rgba(0, 0, 0, 0.76);
  --flip-center-line-shadow: 0 1px 0 rgba(255, 255, 255, 0.03);
  display: block;
  margin: 5px;
}

.opened-clock-panel .scoreboard-value {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.clock-bottom-controls {
  position: absolute;
  right: 17px;
  bottom: 22px;
  z-index: 13;
  display: flex;
  height: 24px;
  width: auto;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  color: rgba(255, 255, 255, 0.28);
}

.clock-control-button {
  display: grid;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
}

.clock-control-button svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.opened-clock-panel .el-switch {
  position: relative;
  display: flex;
  width: 30px;
  height: 24px;
  flex: 0 0 auto;
  align-items: center;
  color: #fff;
  cursor: pointer;
}

.opened-clock-panel .el-switch__input {
  position: absolute;
  width: 0;
  height: 0;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}

.opened-clock-panel .el-switch__core {
  position: relative;
  display: flex;
  width: 30px;
  height: 16px;
  align-items: center;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #dcdfe6;
  line-height: 16px;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease;
}

.opened-clock-panel .el-switch.is-checked .el-switch__core {
  border-color: #1890ff;
  background: #1890ff;
}

.opened-clock-panel .el-switch__action {
  position: absolute;
  top: 1px;
  left: 1px;
  display: flex;
  width: 12px;
  height: 12px;
  border-radius: 100%;
  background: #fff;
  transition: left 0.18s ease;
}

.opened-clock-panel .el-switch.is-checked .el-switch__action {
  left: 15px;
}

@keyframes clock-dialog-in {
  from {
    opacity: 0;
    transform: scale(0.985);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.opened-window.opened-calendar {
  width: min(1000px, calc(100vw - 32px));
  height: min(602px, calc(100vh - 32px));
  border: 1px solid rgba(0, 0, 0, 0.13);
  border-radius: 20px;
  background: #fff;
  color: #22262e;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.48);
  backdrop-filter: none;
  overflow: auto;
}

.opened-window.opened-calendar .traffic .yellow {
  display: none;
}

.opened-window.opened-memo {
  width: min(1000px, calc(100vw - 32px));
  height: min(602px, calc(100vh - 32px));
  border: 1px solid rgba(0, 0, 0, 0.13);
  border-radius: 20px;
  background: #fff;
  color: #222;
  font-size: 14px;
  line-height: 21px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.48);
  backdrop-filter: none;
  overflow: auto;
}

.opened-window.opened-memo .traffic .yellow {
  display: none;
}

.opened-window.opened-todo {
  width: min(1000px, calc(100vw - 32px));
  height: min(602px, calc(100vh - 32px));
  border: 1px solid rgba(0, 0, 0, 0.13);
  border-radius: 20px;
  background: #fff;
  color: #222;
  font-size: 14px;
  line-height: 21px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.48);
  backdrop-filter: none;
  overflow: auto;
}

.opened-window.opened-todo .traffic .yellow {
  display: none;
}

.opened-todo-panel {
  display: block;
  width: 998px;
  height: 600px;
  background: rgb(245, 245, 245);
  color: rgb(34, 34, 34);
  overflow: hidden;
}

.todo-main-pane {
  position: relative;
  display: flex;
  width: 998px;
  height: 600px;
  flex-direction: column;
  padding: 28px 22px;
  background: rgb(245, 245, 245);
  color: rgb(34, 34, 34);
  overflow: hidden;
}

.todo-main-pane h2 {
  display: block;
  width: 954px;
  height: 34px;
  margin: 0 0 12px;
  color: rgb(34, 34, 34);
  font-size: 22px;
  font-weight: 700;
  line-height: 34px;
}

.todo-main-pane h2 small {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  opacity: 0.6;
}

.todo-add {
  position: relative;
  width: 954px;
  height: auto;
  min-height: 42px;
  margin: 0 0 12px;
  border-radius: 8px;
  background: #fff;
}

.todo-add > i {
  position: absolute;
  top: 12px;
  left: 8px;
  display: flex;
  width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  color: rgb(147, 147, 147);
}

.todo-add > i svg {
  width: 16px;
  height: 16px;
}

.todo-add textarea {
  position: relative;
  z-index: 1;
  display: block;
  width: 954px;
  min-height: 42px;
  padding: 10px 16px 10px 32px;
  border: 0;
  outline: 0;
  background: transparent;
  color: rgb(34, 34, 34);
  font: inherit;
  font-size: 14px;
  line-height: 21px;
  resize: none;
  overflow: hidden;
}

.todo-content-frame {
  position: relative;
  width: 954px;
  min-height: 0;
  flex: 1 1 auto;
}

.todo-content-scroll {
  width: 954px;
  height: 100%;
  overflow: hidden auto;
  scrollbar-width: none;
}

.todo-content-scroll::-webkit-scrollbar {
  display: none;
}

.todo-scrollbar-thumb {
  position: absolute;
  top: 0;
  right: 3px;
  z-index: 4;
  width: 7px;
  min-height: 42px;
  border-radius: 999px;
  background: rgba(214, 216, 220, 0.72);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}

.todo-content-frame:hover .todo-scrollbar-thumb,
.todo-content-frame.is-scrolling .todo-scrollbar-thumb {
  opacity: 1;
}

.todo-content-frame:hover .todo-scrollbar-thumb {
  background: rgba(204, 207, 212, 0.78);
}

.todo-content-ul {
  display: block;
  width: 954px;
  margin: 0;
  padding: 0;
  color: rgb(147, 147, 147);
  list-style: none;
}

.todo-content-li {
  position: relative;
  display: flex;
  width: 100%;
  height: auto;
  min-height: 63px;
  align-items: center;
  margin-bottom: 8px;
  padding: 8px 0 8px 12px;
  border-radius: 8px;
  background: #fff;
  color: rgb(147, 147, 147);
  line-height: 21px;
}

.todo-check-bg {
  display: flex;
  width: 56px;
  min-height: 47px;
  flex: 0 0 56px;
  align-self: stretch;
  align-items: center;
  justify-content: center;
  margin-left: -16px;
}

.todo-check {
  position: relative;
  display: block;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 2px solid rgb(147, 147, 147);
  border-radius: 4px;
  background: transparent;
}

.opened-window .todo-check {
  border: 2px solid rgb(147, 147, 147);
}

.opened-window .todo-check.done {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(0, 0, 0, 0.08);
  background: rgb(24, 144, 255);
  color: #fff;
}

.todo-check svg {
  width: 12px;
  height: 12px;
}

.todo-row-main {
  position: relative;
  display: flex;
  width: calc(100% - 36px);
  height: auto;
  min-height: 31px;
  align-items: center;
  margin-left: -16px;
}

.todo-row-main textarea {
  box-sizing: border-box;
  display: block;
  width: 100%;
  min-height: 31px;
  padding: 5px 11px;
  border: 0;
  border-radius: 12px;
  outline: 0;
  background: transparent;
  color: rgb(96, 98, 102);
  font: inherit;
  font-size: 14px;
  line-height: 21px;
  resize: none;
  overflow: hidden;
}

.todo-content-li.done .todo-row-main {
  opacity: 1;
}

.todo-delete {
  position: absolute;
  right: 10px;
  top: 50%;
  display: none;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgb(147, 147, 147);
  transform: translateY(-50%);
}

.todo-content-li:hover .todo-delete,
.todo-content-li.done .todo-delete {
  display: flex;
}

.todo-delete svg {
  width: 16px;
  height: 16px;
}

.todo-done-label {
  height: 28px;
  padding: 0 0 0 40px;
  color: rgb(147, 147, 147);
  font-size: 12px;
  line-height: 28px;
  list-style: none;
}

.todo-empty {
  display: flex;
  width: 954px;
  min-height: 292.84px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: rgb(34, 34, 34);
  font-size: 12px;
  line-height: 16px;
}

.todo-empty svg {
  width: 160px;
  height: 174.17px;
}

.todo-empty p {
  margin: 20px 0 0;
}

.opened-calendar-panel {
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  grid-template-columns: minmax(0, 698px) 300px;
  padding: 0;
  background: #fff;
  overflow: hidden;
}

.opened-calendar-panel.is-tools {
  grid-template-columns: 1fr;
}

.calendar-main-pane {
  position: relative;
  height: 100%;
  padding: 44px 20px 40px 30px;
  overflow: auto;
}

.calendar-segmented {
  position: absolute;
  top: 5px;
  left: 399px;
  display: grid;
  width: 144px;
  height: 32px;
  grid-template-columns: 1fr 1fr;
  overflow: visible;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.1);
}

.calendar-segmented::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 2px;
  z-index: 0;
  width: 68px;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.2);
  content: "";
  transition: left 0.3s;
}

.calendar-segmented.is-tools::before {
  left: 74px;
}

.calendar-segmented button {
  position: relative;
  z-index: 1;
  border-radius: 16px;
  background: transparent;
  color: rgba(0, 0, 0, 0.6);
  font-size: 14px;
  line-height: 32px;
}

.calendar-segmented button.active {
  background: transparent;
  color: #fff;
}

.opened-calendar-panel .calendar-toolbar {
  position: relative;
  z-index: 1;
  display: flex;
  height: 24px;
  align-items: center;
  gap: 5px;
  margin-bottom: 4px;
}

.calendar-toolbar label {
  display: flex;
  width: 100px;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 1px 7px;
  border-radius: 12px;
  background: #f0f1f4;
  color: #222;
}

.calendar-toolbar label:nth-of-type(2) {
  width: 100px;
}

.calendar-toolbar label span {
  display: flex;
  width: 20px;
  height: 22px;
  align-items: center;
  justify-content: center;
  color: rgba(0, 0, 0, 0.3);
  font-size: 12px;
  line-height: 22px;
}

.calendar-picker-icon svg {
  display: block;
  width: 12px;
  height: 12px;
}

.calendar-toolbar input {
  width: 66px;
  height: 22px;
  border: 0;
  background: transparent;
  color: #606266;
  font-size: 12px;
  line-height: 22px;
  outline: none;
}

.calendar-toolbar > button {
  display: flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #f0f1f4;
  color: #222;
  font-size: 14px;
  line-height: 14px;
}

.calendar-nav-icon {
  display: block;
  width: 14px;
  height: 14px;
}

.calendar-toolbar .calendar-today-button {
  width: 0;
  height: 0;
  padding: 0;
  background: #367df1;
  color: #fff;
  font-size: 14px;
  line-height: 21px;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
}

.calendar-toolbar > .calendar-week-start-switch {
  position: absolute;
  top: -4px;
  right: 0;
  display: block;
  width: 40px;
  height: 32px;
  border-radius: 16px;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  font-size: 12px;
  line-height: 20px;
}

.calendar-toolbar > .calendar-week-start-switch::before {
  position: absolute;
  top: 6px;
  right: 0;
  width: 40px;
  height: 20px;
  border-radius: 10px;
  background: #e0e3e9;
  content: "";
}

.calendar-toolbar > .calendar-week-start-switch::after {
  position: absolute;
  top: 8px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  content: "";
  transition: left 0.2s;
}

.calendar-toolbar > .calendar-week-start-switch.is-checked::after {
  left: 22px;
}

.calendar-toolbar > .calendar-week-start-switch span {
  position: absolute;
  top: 6px;
  right: 7px;
  z-index: 1;
  height: 20px;
  line-height: 20px;
}

.calendar-toolbar > .calendar-week-start-switch.is-checked span {
  right: auto;
  left: 8px;
}

.calendar-month-board {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-template-rows: 44px repeat(6, 75px);
  width: 648px;
  height: 484px;
  min-height: 0;
  column-gap: 0;
  row-gap: 0;
}

.calendar-month-board::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: flex;
  width: 648px;
  height: 484px;
  align-items: center;
  justify-content: center;
  color: rgba(0, 0, 0, 0.3);
  content: attr(data-month);
  font-size: 320px;
  font-weight: 400;
  line-height: 480px;
  opacity: 0.1;
  pointer-events: none;
}

.calendar-watermark {
  display: none;
}

.calendar-weekdays {
  position: relative;
  z-index: 1;
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  height: 44px;
}

.calendar-weekdays span {
  display: grid;
  height: 44px;
  place-items: center;
  color: #32363e;
  font-size: 18px;
  line-height: 27px;
}

.calendar-weekdays span:nth-child(6),
.calendar-weekdays span:nth-child(7) {
  color: #ff6268;
}

.calendar-day-cell {
  position: relative;
  z-index: 1;
  display: grid;
  width: calc(100% - 4px);
  min-height: 0;
  height: 71px;
  align-content: center;
  justify-items: center;
  margin: 2px;
  border: 2px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: #252a32;
  cursor: pointer;
  font-size: 18px;
  line-height: 27px;
}

.opened-window .calendar-day-cell {
  border: 2px solid transparent;
}

.calendar-day-cell:hover,
.calendar-day-cell.selected:not(.active) {
  border: 2px solid rgba(0, 0, 0, 0.2);
}

.calendar-day-cell strong {
  font-size: 18px;
  font-weight: 700;
  line-height: 27px;
}

.calendar-day-cell small {
  display: block;
  width: 84.5625px;
  min-height: 18px;
  color: #9c9c9c;
  font-size: 12px;
  line-height: 18px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.calendar-day-cell.weekend strong {
  color: #ff5d62;
}

.calendar-day-cell.muted strong,
.calendar-day-cell.muted small {
  color: #8f8f8f;
}

.calendar-day-cell.muted {
  opacity: 0.5;
}

.calendar-day-cell.holiday {
  background: #fff5f5;
}

.calendar-day-cell.workday {
  background: #f5f5f6;
}

.calendar-day-cell.active {
  z-index: 2;
  justify-self: center;
  background: #367df1;
  border: 2px solid #367df1;
  color: #fff;
}

.calendar-day-cell.active:hover {
  border: 2px solid #367df1;
}

.calendar-day-cell.active strong,
.calendar-day-cell.active small {
  color: #fff;
}

.calendar-day-cell em {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  width: 17px;
  height: 17px;
  place-items: center;
  border-radius: 4px;
  background: #ff5364;
  color: #fff;
  font-size: 12px;
  font-style: normal;
  line-height: 17px;
}

.calendar-day-cell.workday em {
  background: #5f6881;
}

.calendar-day-cell.festival small {
  color: #168bd8;
}

.calendar-day-cell.active.festival small {
  color: #fff;
}

.calendar-info-pane {
  min-width: 0;
  height: 100%;
  padding: 30px 20px 20px;
  overflow: hidden auto;
  background: #f5f5f5;
  color: #383d45;
  font-size: 13px;
  line-height: 20px;
}

.calendar-info-date {
  display: grid;
  height: 183px;
  justify-items: center;
  padding-bottom: 10px;
  border-bottom: 1px solid #e4e4e6;
  text-align: center;
}

.calendar-info-date > span {
  font-size: 15px;
  line-height: 20px;
}

.calendar-info-date div {
  position: relative;
  display: grid;
  width: 80px;
  height: 80px;
  margin: 6px 0;
  place-items: center;
  border-radius: 10px;
  background: #367df1;
  color: #fff;
  font-size: 50px;
  line-height: 90px;
}

.calendar-info-date div::before,
.calendar-info-date div::after {
  position: absolute;
  top: 9px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fff;
  content: "";
}

.calendar-info-date div::before {
  left: 12px;
}

.calendar-info-date div::after {
  right: 12px;
}

.calendar-info-date b {
  font-size: 50px;
  font-weight: 300;
  line-height: 90px;
}

.calendar-info-date p {
  margin: 0;
  font-size: 15px;
  line-height: 20px;
}

.calendar-info-date strong {
  margin-top: 6px;
  font-size: 15px;
  font-weight: 500;
  line-height: 20px;
}

.calendar-info-date small {
  margin-top: 2px;
  color: #9a9a9a;
  font-size: 13px;
  line-height: 20px;
}

.calendar-info-list {
  margin: 5px 0 0;
}

.calendar-info-list > div {
  display: grid;
  grid-template-columns: 32px 1fr;
  gap: 8px;
  align-items: start;
  height: 26px;
  margin-top: 5px;
  padding: 0 0 5px;
  border-bottom: 1px solid #e6e6e8;
}

.calendar-info-list > div:first-child {
  margin-top: 0;
}

.calendar-info-list > div.dual {
  grid-template-columns: 32px 1fr 32px 1fr;
  column-gap: 8px;
  height: 31px;
}

.calendar-info-list > div.calendar-almanac-row {
  grid-template-rows: repeat(2, minmax(0, 1fr));
  height: 97px;
  row-gap: 8px;
  border-bottom: 0;
}

.calendar-info-list > div.calendar-directions-row {
  display: block;
  height: 100px;
  padding: 0;
  border-bottom: 0;
}

.calendar-info-list dt {
  display: inline-grid;
  width: 32px;
  height: 20px;
  place-items: center;
  border-radius: 4px;
  background: #878787;
  color: #fff;
  font-size: 12px;
  line-height: 20px;
}

.calendar-info-list dt.red {
  background: #ef5a5a;
}

.calendar-info-list dt.pink {
  background: #df75bb;
}

.calendar-info-list dt.blue {
  background: #158ddd;
}

.calendar-info-list dt.green {
  background: #25b761;
}

.calendar-info-list dd {
  margin: 0;
  color: #9a9a9a;
  font-size: 13px;
  line-height: 20px;
}

.calendar-directions {
  margin: 0;
  padding: 0;
  color: #9a9a9a;
  font-size: 13px;
  line-height: 20px;
  list-style: none;
}

.calendar-tools-pane {
  display: grid;
  grid-template-columns: repeat(2, 240px);
  justify-content: center;
  gap: 172px;
  min-height: 100%;
  padding-top: 184px;
  color: #4b515a;
}

.calendar-tools-pane section {
  display: grid;
  align-content: start;
  gap: 12px;
  width: 240px;
}

.calendar-tools-pane h3 {
  margin: 0 0 2px;
  color: #333840;
  font-size: 14px;
  font-weight: 500;
}

.calendar-tools-pane label {
  display: grid;
  gap: 5px;
  color: #8b9098;
  font-size: 13px;
  line-height: 18px;
}

.calendar-tools-pane input {
  width: 240px;
  height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: #f0f1f4;
  color: #555c66;
  font-size: 13px;
  outline: none;
}

.calendar-tools-pane > section > button {
  width: 240px;
  height: 32px;
  margin-top: 6px;
  border-radius: 8px;
  background: #f0f1f4;
  color: #555c66;
  font-size: 13px;
}

.calendar-tools-tabs {
  grid-column: 1 / -1;
  display: flex;
  width: 652px;
  height: 32px;
  margin: -88px 0 42px -206px;
  align-items: center;
  justify-content: center;
  gap: 22px;
  color: #777d86;
  font-size: 14px;
}

.calendar-tools-tabs button {
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  background: transparent;
  color: inherit;
}

.calendar-tools-tabs button.active {
  background: #367df1;
  color: #fff;
}

.opened-window.opened-anniversary,
.opened-window.opened-anniversary-day {
  width: min(1000px, calc(100vw - 42px));
  height: min(602px, calc(100vh - 64px));
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 20px;
  background: rgb(255, 255, 255);
  color: rgb(34, 34, 34);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
  backdrop-filter: none;
}

.opened-anniversary-panel {
  position: relative;
  display: grid;
  height: 100%;
  grid-template-areas:
    "templates preview"
    "templates settings"
    "templates actions";
  grid-template-columns: 374px minmax(0, 1fr);
  grid-template-rows: 194px 340px 66px;
  column-gap: 0;
  padding: 0;
  background: linear-gradient(
    90deg,
    rgb(255, 255, 255) 0 374px,
    rgb(245, 245, 245) 374px 100%
  );
  font-family:
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  color: rgb(34, 34, 34);
  overflow: hidden;
}

.opened-anniversary-panel.is-aside-collapsed {
  grid-template-columns: 70px minmax(0, 1fr);
  column-gap: 0;
  background: linear-gradient(
    90deg,
    rgb(255, 255, 255) 0 70px,
    rgb(245, 245, 245) 70px 100%
  );
}

.anniversary-template-pane,
.anniversary-preview-pane,
.anniversary-settings-pane {
  min-width: 0;
}

.anniversary-template-pane {
  grid-area: templates;
  display: grid;
  grid-template-rows: auto 1px auto auto minmax(0, 1fr);
  gap: 12px;
  width: 374px;
  height: 600px;
  padding: 30px 30px 0;
  overflow: hidden auto;
  transition:
    padding 0.18s ease,
    width 0.18s ease;
}

.opened-anniversary-panel.is-aside-collapsed .anniversary-template-pane {
  width: 70px;
  padding-right: 0;
  padding-left: 0;
}

.opened-anniversary-panel.is-aside-collapsed .anniversary-template-pane > * {
  opacity: 0;
  pointer-events: none;
}

.anniversary-editor-tip {
  margin: 0;
  color: rgba(0, 0, 0, 0.42);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.anniversary-template-divider {
  width: 300px;
  height: 1px;
  margin: 0 0 4px;
  background: rgba(0, 0, 0, 0.1);
}

.anniversary-editor-heading {
  display: flex;
  align-items: center;
  min-height: 28px;
}

.anniversary-editor-heading strong {
  color: rgba(0, 0, 0, 0.55);
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
}

.anniversary-size-row {
  position: relative;
  display: grid;
  height: 28px;
  grid-template-columns: 1fr 1fr;
  overflow: hidden;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.1);
}

.anniversary-size-row::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 2px;
  width: calc(50% - 2px);
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.28);
  content: "";
  transition: transform 0.18s ease;
}

.anniversary-size-row:has(button:nth-child(2).active)::before {
  transform: translateX(100%);
}

.anniversary-size-row button {
  position: relative;
  z-index: 1;
  height: 28px;
  border-radius: 14px;
  background: transparent;
  color: rgba(0, 0, 0, 0.6);
  font-size: 14px;
  line-height: 28px;
}

.anniversary-size-row button.active {
  color: #fff;
}

.anniversary-template-grid {
  display: grid;
  grid-template-columns: repeat(2, 125px);
  align-content: start;
  justify-content: start;
  gap: 32px 32px;
  overflow: auto;
  padding: 8px 0 4px 17px;
}

.anniversary-template-grid.size-2-4 {
  grid-template-columns: 275px;
  gap: 0px;
  padding-right: 0;
  padding-left: 17px;
}

.anniversary-template-card {
  position: relative;
  display: grid;
  justify-items: center;
  min-height: 170px;
  align-content: start;
  gap: 9px;
  padding: 0;
  border: 1px solid transparent;
  background: transparent;
  color: rgb(34, 34, 34);
  cursor: pointer;
  text-align: center;
}

.anniversary-template-card.size-2-4 {
  min-height: 170px;
}

.anniversary-template-card.active {
  background: transparent;
}

.anniversary-template-card b {
  overflow: hidden;
  max-width: 125px;
  color: rgb(34, 34, 34);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.anniversary-template-size {
  display: none;
}

.anniversary-mini-card,
.anniversary-live-preview {
  position: relative;
  display: grid;
  align-content: center;
  overflow: hidden;
  border-radius: 18px;
  background-color: var(--anniversary-bg);
  background-image: var(--anniversary-background-image);
  background-position: center;
  background-size: cover;
  color: var(--anniversary-text);
  font-family: var(--anniversary-font);
}

.anniversary-mini-card.size-2-2 {
  width: 123px;
  height: 123px;
  padding: 9.5px 7.6px;
  border-radius: 14px;
  box-shadow: 0 0 10px 3px rgba(0, 0, 0, 0.1);
}

.anniversary-mini-card.size-2-4 {
  width: 275px;
  height: 125px;
  padding: 14px 16px;
  border-radius: 14px;
  box-shadow: 0 0 10px 3px rgba(0, 0, 0, 0.1);
}

.anniversary-mini-card.is-payday,
.anniversary-live-preview.is-payday {
  background: linear-gradient(
    to bottom,
    var(--anniversary-text) 0 44px,
    #fff 44px 100%
  );
  color: var(--anniversary-text);
}

.anniversary-mini-card.is-payday {
  display: block;
}

.anniversary-mini-card.is-payday .anniversary-card-copy,
.anniversary-live-preview.is-payday .anniversary-card-copy {
  width: 100%;
  height: 100%;
  align-content: start;
  align-self: stretch;
  justify-items: center;
  justify-self: stretch;
  text-align: center;
}

.anniversary-mini-card.is-payday .anniversary-card-copy > span,
.anniversary-live-preview.is-payday .anniversary-card-copy > span {
  width: calc(100% + 15.2px);
  margin: -9.5px -7.6px 0;
  color: #fff;
  font-size: 11.9px;
  font-weight: 600;
  line-height: 37.5px;
}

.anniversary-mini-card.is-payday.size-2-4 .anniversary-card-copy > span {
  height: 44px;
  width: calc(100% + 32px);
  margin: -14px -16px 0;
  line-height: 44px;
}

.anniversary-live-preview.is-payday.size-2-4 .anniversary-card-copy > span {
  width: calc(100% + 32px);
  margin: -14px -16px 0;
}

.anniversary-mini-card.is-payday .anniversary-card-copy strong,
.anniversary-live-preview.is-payday .anniversary-card-copy strong {
  width: 100%;
  justify-self: stretch;
  margin-top: 0;
  color: var(--anniversary-text);
  font-size: 47.6px;
  line-height: 71.4px;
  text-align: center;
}

.anniversary-mini-card.is-payday.size-2-2 {
  background: linear-gradient(
    to bottom,
    var(--anniversary-text) 0 37.5px,
    #fff 37.5px 100%
  );
}

.anniversary-mini-card.is-payday.size-2-4 .anniversary-card-copy strong {
  display: flex;
  height: 81px;
  align-items: center;
  justify-content: center;
}

.anniversary-mini-card.is-payday .anniversary-card-copy em,
.anniversary-live-preview.is-payday .anniversary-card-copy em {
  display: none;
}

.anniversary-mini-card.is-payday .anniversary-card-copy small,
.anniversary-live-preview.is-payday .anniversary-card-copy small {
  display: none;
}

.anniversary-mini-card.with-calendar,
.anniversary-live-preview.with-calendar {
  grid-template-columns: minmax(0, 1fr) 118px;
  align-content: stretch;
  align-items: center;
  column-gap: 13px;
}

.anniversary-template-card.active .anniversary-mini-card {
  box-shadow:
    0 0 0 1px rgb(255, 255, 255),
    0 0 0 3px rgb(24, 144, 255),
    0 0 10px 3px rgba(0, 0, 0, 0.1);
}

.anniversary-card-copy {
  display: grid;
  min-width: 0;
  align-content: start;
}

.anniversary-card-copy > span {
  overflow: hidden;
  font-size: 11.4px;
  line-height: 13.68px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.anniversary-card-copy strong {
  overflow: visible;
  margin-top: 8px;
  font-size: 34.2px;
  line-height: 51.3px;
  text-overflow: clip;
  white-space: nowrap;
}

.anniversary-card-copy small {
  margin-left: 2px;
  font-size: 12px;
}

.anniversary-card-copy em {
  overflow: hidden;
  margin-top: 5px;
  font-size: 11.4px;
  font-style: normal;
  line-height: 17.1px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.anniversary-mini-card.size-2-2.is-template-love {
  padding: 17.1px;
  text-align: center;
}

.anniversary-mini-card.size-2-2.is-template-love .anniversary-card-copy {
  justify-items: center;
}

.anniversary-mini-card.size-2-2.is-template-love .anniversary-card-copy strong {
  margin-top: 3px;
  font-size: 32.3px;
  line-height: 48.45px;
}

.anniversary-live-preview.size-1-1 .anniversary-card-copy > span,
.anniversary-live-preview.size-1-1 .anniversary-card-copy em {
  font-size: 7px;
  line-height: 9px;
}

.anniversary-live-preview.size-1-1 .anniversary-card-copy strong {
  margin-top: 4px;
  font-size: 18px;
  line-height: 20px;
}

.anniversary-live-preview.size-1-1 .anniversary-card-copy small {
  font-size: 7px;
}

.anniversary-live-preview.size-1-2 .anniversary-card-copy,
.anniversary-live-preview.size-2-1 .anniversary-card-copy {
  align-content: center;
}

.anniversary-live-preview.size-1-2 .anniversary-card-copy > span,
.anniversary-live-preview.size-2-1 .anniversary-card-copy > span,
.anniversary-live-preview.size-1-2 .anniversary-card-copy em,
.anniversary-live-preview.size-2-1 .anniversary-card-copy em {
  font-size: 10px;
  line-height: 13px;
}

.anniversary-live-preview.size-1-2 .anniversary-card-copy strong,
.anniversary-live-preview.size-2-1 .anniversary-card-copy strong {
  margin-top: 5px;
  font-size: 23px;
  line-height: 26px;
}

.anniversary-live-preview.size-2-1 .anniversary-card-copy strong {
  white-space: normal;
}

.anniversary-card-calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  align-content: center;
  gap: 3px 6px;
  color: color-mix(in srgb, var(--anniversary-text) 74%, transparent);
  font-size: 10px;
  line-height: 12px;
  text-align: center;
}

.anniversary-card-calendar i,
.anniversary-card-calendar b {
  display: block;
  min-width: 0;
  font-style: normal;
  font-weight: 400;
}

.anniversary-card-calendar .weekend,
.anniversary-card-calendar i:nth-child(6),
.anniversary-card-calendar i:nth-child(7) {
  color: #db5c76;
}

.anniversary-card-calendar .muted {
  opacity: 0.42;
}

.anniversary-card-calendar .today {
  display: grid;
  width: 15px;
  height: 15px;
  place-items: center;
  justify-self: center;
  border-radius: 50%;
  background: #db5c76;
  color: #fff;
  line-height: 15px;
}

.anniversary-preview-pane {
  position: relative;
  grid-area: preview;
  display: grid;
  justify-items: center;
  align-content: start;
  padding-top: 17px;
  overflow: visible;
}

.anniversary-preview-stage {
  position: relative;
  width: 330px;
  height: 143px;
  perspective: 900px;
}

.anniversary-preview-stage.size-1-1,
.anniversary-preview-stage.size-1-2,
.anniversary-preview-stage.size-2-1 {
  height: 164px;
}

.anniversary-preview-stage.size-2-4 {
  width: 330px;
  height: 150px;
}

.anniversary-preview-arrow {
  position: absolute;
  top: 81px;
  z-index: 4;
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);
  color: rgb(238, 238, 238);
  font-size: 30px;
  line-height: 26px;
}

.anniversary-preview-arrow.previous {
  left: 33px;
}

.anniversary-preview-arrow.next {
  right: 34px;
}

.opened-anniversary-panel.is-aside-collapsed
  .anniversary-preview-arrow.previous {
  left: 55px;
}

.opened-anniversary-panel.is-aside-collapsed .anniversary-preview-arrow.next {
  right: 56px;
}

.anniversary-carousel-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  margin-top: 12px;
}

.anniversary-carousel-dots span {
  width: 8px;
  height: 8px;
  padding: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.16);
  cursor: pointer;
}

.anniversary-carousel-dots span.active {
  background: rgba(0, 0, 0, 0.45);
  transform: scale(1.4);
}

.anniversary-preview-name {
  margin-top: 3px;
  color: rgb(34, 34, 34);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}

.anniversary-collapse-arrow {
  position: absolute;
  top: 240px;
  left: 359px;
  z-index: 4;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.58);
  color: #fff;
  font-size: 30px;
  line-height: 26px;
  transition: left 0.18s ease;
}

.anniversary-collapse-arrow.active {
  left: 55px;
}

.anniversary-settings-pane {
  grid-area: settings;
  display: flex;
  flex-direction: column;
  max-height: 100%;
  gap: 13px;
  overflow: hidden auto;
  margin: 0 30px;
  padding: 16px;
  border-radius: 6px;
  background: transparent;
  scrollbar-color: rgba(0, 0, 0, 0.18) transparent;
  scrollbar-width: thin;
}

.anniversary-settings-pane::-webkit-scrollbar {
  width: 8px;
}

.anniversary-settings-pane::-webkit-scrollbar-thumb {
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.16);
}

.anniversary-live-preview {
  position: absolute;
  top: 0;
  left: 50%;
  width: 126px;
  height: 126px;
  padding: 13px 12px;
  border-radius: 14px;
  opacity: 0.24;
  pointer-events: auto;
  transform: translateX(-50%) scale(0.78);
  transition:
    transform 0.18s ease,
    opacity 0.18s ease;
}

.anniversary-live-preview.size-1-1 {
  top: 32px;
  width: 60px;
  height: 60px;
  padding: 0;
  border-radius: 18px;
}

.anniversary-live-preview.size-1-2 {
  top: 44px;
  width: 150px;
  height: 60px;
  padding: 0;
  border-radius: 18px;
}

.anniversary-live-preview.size-2-1 {
  width: 60px;
  height: 150px;
  padding: 0;
  border-radius: 18px;
}

.anniversary-live-preview.size-2-4 {
  width: 330px;
  height: 150px;
  padding: 0;
  border-radius: 18px;
}

.anniversary-live-preview:not(.is-payday).size-1-1,
.anniversary-live-preview:not(.is-payday).size-1-2,
.anniversary-live-preview:not(.is-payday).size-2-1,
.anniversary-live-preview:not(.is-payday).size-2-4 {
  display: block;
}

.anniversary-live-preview:not(.is-payday).size-1-1 .anniversary-card-copy,
.anniversary-live-preview:not(.is-payday).size-1-2 .anniversary-card-copy,
.anniversary-live-preview:not(.is-payday).size-2-1 .anniversary-card-copy,
.anniversary-live-preview:not(.is-payday).size-2-4 .anniversary-card-copy {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
}

.anniversary-live-preview:not(.is-payday).size-1-1
  .anniversary-card-copy
  > span {
  position: absolute;
  top: 10px;
  left: -6px;
  width: 72px;
  height: 18px;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}

.anniversary-live-preview:not(.is-payday).size-1-1
  .anniversary-card-copy
  strong {
  position: absolute;
  top: 28px;
  left: -6px;
  width: 72px;
  height: 23px;
  margin: 0;
  font-size: 15px;
  line-height: 22.5px;
}

.anniversary-live-preview:not(.is-payday).size-1-1 .anniversary-card-copy small,
.anniversary-live-preview:not(.is-payday).size-1-1 .anniversary-card-copy em {
  display: none;
}

.anniversary-live-preview:not(.is-payday).size-1-2
  .anniversary-card-copy
  > span {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 71px;
  height: 18px;
  font-size: 12px;
  line-height: 18px;
  text-align: left;
}

.anniversary-live-preview:not(.is-payday).size-1-2
  .anniversary-card-copy
  strong {
  position: absolute;
  top: 18px;
  left: 93px;
  width: 45px;
  height: 24px;
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  text-align: left;
}

.anniversary-live-preview:not(.is-payday).size-1-2
  .anniversary-card-copy
  small {
  display: none;
}

.anniversary-live-preview:not(.is-payday).size-1-2 .anniversary-card-copy em {
  position: absolute;
  top: 30px;
  left: 12px;
  width: 71px;
  height: 18px;
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  text-align: left;
}

.anniversary-live-preview:not(.is-payday).size-2-1
  .anniversary-card-copy
  > span {
  position: absolute;
  top: 12px;
  left: 0;
  width: 60px;
  height: 39px;
  font-size: 13px;
  line-height: 19.5px;
  white-space: normal;
}

.anniversary-live-preview:not(.is-payday).size-2-1
  .anniversary-card-copy
  strong {
  position: absolute;
  top: 63px;
  left: 7px;
  width: 45px;
  height: 24px;
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  text-align: center;
  white-space: nowrap;
}

.anniversary-live-preview:not(.is-payday).size-2-1
  .anniversary-card-copy
  small {
  display: none;
}

.anniversary-live-preview:not(.is-payday).size-2-1 .anniversary-card-copy em {
  position: absolute;
  top: 99px;
  left: 0;
  width: 60px;
  height: 39px;
  margin: 0;
  font-size: 13px;
  line-height: 19.5px;
  white-space: normal;
}

.anniversary-live-preview:not(.is-payday).size-2-4:not(.with-calendar),
.anniversary-mini-card:not(.is-payday).size-2-4:not(.with-calendar) {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 17px;
  text-align: center;
}

.anniversary-live-preview:not(.is-payday).size-2-4:not(.with-calendar)
  .anniversary-card-copy,
.anniversary-mini-card:not(.is-payday).size-2-4:not(.with-calendar)
  .anniversary-card-copy {
  display: grid;
  justify-items: center;
}

.anniversary-live-preview:not(.is-payday).size-2-4:not(.with-calendar)
  .anniversary-card-copy
  > span,
.anniversary-mini-card:not(.is-payday).size-2-4:not(.with-calendar)
  .anniversary-card-copy
  > span {
  max-width: 100%;
  font-size: 11.4px;
  line-height: 13.68px;
}

.anniversary-live-preview:not(.is-payday).size-2-4:not(.with-calendar)
  .anniversary-card-copy
  strong,
.anniversary-mini-card:not(.is-payday).size-2-4:not(.with-calendar)
  .anniversary-card-copy
  strong {
  margin-top: 8px;
  font-size: 32.3px;
  line-height: 48.45px;
}

.anniversary-live-preview:not(.is-payday).size-2-4:not(.with-calendar)
  .anniversary-card-copy
  em,
.anniversary-mini-card:not(.is-payday).size-2-4:not(.with-calendar)
  .anniversary-card-copy
  em {
  margin-top: 4px;
  font-size: 11.4px;
  line-height: 17.1px;
}

.anniversary-live-preview:not(.is-payday).size-2-4.with-calendar {
  display: block;
}

.anniversary-live-preview:not(.is-payday).size-2-4.with-calendar
  .anniversary-card-copy
  > span {
  position: absolute;
  top: 11px;
  left: 8px;
  width: 313px;
  height: 15px;
  font-size: 12.6px;
  line-height: 15.12px;
  text-align: left;
}

.anniversary-live-preview:not(.is-payday).size-2-4.with-calendar
  .anniversary-card-copy
  strong {
  position: absolute;
  top: 42px;
  left: 8px;
  width: 118px;
  height: 57px;
  margin: 0;
  font-size: 37.8px;
  line-height: 56.7px;
  text-align: left;
}

.anniversary-live-preview:not(.is-payday).size-2-4.with-calendar
  .anniversary-card-copy
  small {
  margin-left: 0;
  font-size: 12px;
  line-height: 18px;
}

.anniversary-live-preview:not(.is-payday).size-2-4.with-calendar
  .anniversary-card-copy
  em {
  position: absolute;
  top: 121px;
  left: 8px;
  width: 60px;
  height: 19px;
  margin: 0;
  font-size: 12.6px;
  line-height: 18.9px;
  text-align: left;
}

.anniversary-live-preview.size-2-4 .anniversary-card-calendar {
  position: absolute;
  top: 11px;
  left: 140px;
  width: 182px;
  height: 128px;
  align-content: start;
  grid-template-columns: repeat(7, 26px);
  gap: 3px 0;
  color: currentColor;
  font-size: 11.76px;
  line-height: 17.64px;
}

.anniversary-mini-card:not(.is-payday).size-2-4.with-calendar {
  display: block;
}

.anniversary-mini-card:not(.is-payday).size-2-4.with-calendar
  .anniversary-card-copy
  > span {
  position: absolute;
  top: 9px;
  left: 7px;
  width: 260px;
  height: 13px;
  font-size: 10.5px;
  line-height: 12.6px;
  text-align: left;
}

.anniversary-mini-card:not(.is-payday).size-2-4.with-calendar
  .anniversary-card-copy
  strong {
  position: absolute;
  top: 35px;
  left: 7px;
  width: 98px;
  height: 48px;
  margin: 0;
  font-size: 31.5px;
  line-height: 47.25px;
  text-align: left;
}

.anniversary-mini-card:not(.is-payday).size-2-4.with-calendar
  .anniversary-card-copy
  small {
  margin-left: 0;
  font-size: 10px;
  line-height: 15px;
}

.anniversary-mini-card:not(.is-payday).size-2-4.with-calendar
  .anniversary-card-copy
  em {
  position: absolute;
  top: 101px;
  left: 7px;
  width: 50px;
  height: 16px;
  margin: 0;
  font-size: 10.5px;
  line-height: 15.75px;
  text-align: left;
}

.anniversary-mini-card.size-2-4 .anniversary-card-calendar {
  position: absolute;
  top: 9px;
  left: 117px;
  width: 152px;
  height: 107px;
  align-content: start;
  grid-template-columns: repeat(7, 21.7px);
  gap: 2.5px 0;
  color: currentColor;
  font-size: 9.8px;
  line-height: 14.7px;
}

.anniversary-live-preview.is-current {
  z-index: 3;
  opacity: 1;
  transform: translateX(-50%) rotate(0deg) scale(1);
}

.anniversary-live-preview.is-payday {
  --payday-band: 38px;
  --payday-label-size: 11.9px;
  --payday-label-line: 17.85px;
  --payday-number-size: 47.6px;
  --payday-number-line: 71.4px;
  display: block;
  padding: 0;
  background: linear-gradient(
    to bottom,
    var(--anniversary-text) 0 var(--payday-band),
    #fff var(--payday-band) 100%
  );
}

.anniversary-live-preview.is-payday.size-1-1 {
  --payday-band: 18px;
  --payday-label-size: 12px;
  --payday-label-line: 18px;
  --payday-number-size: 22.4px;
  --payday-number-line: 33.6px;
}

.anniversary-live-preview.is-payday.size-1-2 {
  --payday-band: 20px;
  --payday-label-size: 10px;
  --payday-label-line: 14px;
  --payday-number-size: 22px;
  --payday-number-line: 32px;
}

.anniversary-live-preview.is-payday.size-2-1 {
  --payday-band: 38px;
  --payday-label-size: 11px;
  --payday-label-line: 15px;
  --payday-number-size: 28px;
  --payday-number-line: 42px;
}

.anniversary-live-preview.is-payday .anniversary-card-copy {
  display: grid;
  width: 100%;
  height: 100%;
  grid-template-rows: var(--payday-band) minmax(0, 1fr);
  align-content: stretch;
  justify-items: stretch;
  text-align: center;
}

.anniversary-live-preview.is-payday .anniversary-card-copy > span,
.anniversary-live-preview.is-payday.size-2-4 .anniversary-card-copy > span {
  display: flex;
  width: 100%;
  height: var(--payday-band);
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin: 0;
  padding: 0 6px;
  color: #fff;
  font-size: var(--payday-label-size);
  font-weight: 500;
  line-height: var(--payday-label-line);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.anniversary-live-preview.is-payday.size-1-1 .anniversary-card-copy > span {
  padding: 0 2px;
}

.anniversary-live-preview.is-payday.size-2-1 .anniversary-card-copy > span {
  padding: 0 4px;
}

.anniversary-live-preview.is-payday .anniversary-card-copy strong {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  overflow: visible;
  margin: 0;
  color: var(--anniversary-text);
  font-size: var(--payday-number-size);
  font-weight: 700;
  line-height: var(--payday-number-line);
  text-overflow: clip;
  white-space: nowrap;
}

.anniversary-live-preview.is-payday.size-1-2,
.anniversary-live-preview.is-payday.size-2-1 {
  background: #fff;
}

.anniversary-live-preview.is-payday.size-1-2 .anniversary-card-copy,
.anniversary-live-preview.is-payday.size-2-1 .anniversary-card-copy {
  grid-template-rows: none;
  align-content: center;
  justify-items: center;
}

.anniversary-live-preview.is-payday.size-1-2 .anniversary-card-copy > span {
  width: 72px;
  height: 18px;
  color: var(--anniversary-text);
  font-size: 12px;
  line-height: 18px;
}

.anniversary-live-preview.is-payday.size-1-2 .anniversary-card-copy strong {
  height: auto;
  margin: 0;
  font-size: 16px;
  line-height: 24px;
}

.anniversary-live-preview.is-payday.size-2-1 .anniversary-card-copy > span {
  width: 20px;
  height: 60px;
  color: var(--anniversary-text);
  font-size: 12px;
  line-height: 18px;
  white-space: normal;
}

.anniversary-live-preview.is-payday.size-2-1 .anniversary-card-copy strong {
  height: auto;
  margin: 4px 0 0;
  font-size: 16px;
  line-height: 24px;
}

.anniversary-field-row {
  position: relative;
  display: grid;
  min-height: 30px;
  grid-template-columns: 88px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.anniversary-field-row > span {
  color: rgba(0, 0, 0, 0.8);
  font-size: 14px;
  line-height: 22px;
}

.anniversary-settings-pane input,
.anniversary-date-trigger,
.anniversary-select-trigger {
  width: 100%;
  height: 24px;
  padding: 0 12px;
  border: 0;
  border-radius: 12px;
  background: rgb(255, 255, 255);
  color: rgb(96, 98, 102);
  font-size: 12px;
  outline: none;
}

.anniversary-inline-input,
.anniversary-date-input {
  position: relative;
  display: block;
}

.anniversary-inline-input input {
  padding-right: 72px;
}

.anniversary-common-trigger {
  position: absolute;
  top: 0;
  right: 7px;
  height: 24px;
  padding: 0;
  background: transparent;
  color: rgb(33, 150, 243);
  font-size: 12px;
  line-height: 24px;
}

.anniversary-date-row {
  grid-template-columns: 88px 135px 80px;
}

.anniversary-date-trigger {
  padding-left: 30px;
  text-align: left;
  cursor: pointer;
}

.anniversary-date-trigger.active {
  color: rgba(0, 0, 0, 0.9);
}

.anniversary-date-input svg {
  position: absolute;
  top: 50%;
  left: 10px;
  z-index: 1;
  width: 13px;
  height: 13px;
  fill: rgba(0, 0, 0, 0.55);
  pointer-events: none;
  transform: translateY(-50%);
}

.anniversary-date-popper {
  position: fixed;
  z-index: 10000;
  width: 324px;
  padding: 13px;
  border: 1px solid rgba(0, 0, 0, 0);
  border-radius: 10px;
  background: rgb(29, 30, 31);
  box-shadow:
    0 0 1px rgba(255, 255, 255, 0.15),
    0 8px 24px rgba(0, 0, 0, 0.32);
}

.anniversary-date-popper::before {
  position: absolute;
  top: -5px;
  left: 154px;
  width: 10px;
  height: 10px;
  background: rgb(29, 30, 31);
  content: "";
  transform: rotate(45deg);
}

.anniversary-date-wheel {
  position: relative;
  display: grid;
  width: 298px;
  height: 266px;
  grid-template-columns: repeat(3, 99px);
  overflow: hidden;
}

.anniversary-picker-select {
  position: absolute;
  top: 114px;
  left: 16px;
  z-index: 0;
  width: 266px;
  height: 38px;
  border-radius: 6px;
  background: rgb(44, 44, 44);
}

.anniversary-picker-mask {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgb(29, 30, 31) 0%,
    rgba(29, 30, 31, 0.64) 20%,
    rgba(29, 30, 31, 0) 42%,
    rgba(29, 30, 31, 0) 58%,
    rgba(29, 30, 31, 0.64) 80%,
    rgb(29, 30, 31) 100%
  );
}

.anniversary-picker-column {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
}

.anniversary-picker-column button {
  width: 99px;
  height: 38px;
  padding: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  font-weight: 700;
  line-height: 38px;
  text-align: center;
  transition: transform 0.14s ease;
}

.anniversary-picker-column button.is-empty {
  pointer-events: none;
}

.anniversary-picker-column button.is-select {
  transform: scale(1.2);
}

.anniversary-select-wrap {
  position: relative;
  min-width: 0;
}

.anniversary-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: 14px;
  background: rgb(255, 255, 255);
  color: rgba(0, 0, 0, 0.56);
  cursor: pointer;
}

.anniversary-select-trigger.active {
  border-color: rgba(0, 0, 0, 0.32);
}

.anniversary-select-trigger i {
  width: 8px;
  height: 8px;
  border-right: 1px solid currentColor;
  border-bottom: 1px solid currentColor;
  transform: translateY(-2px) rotate(45deg);
}

.anniversary-select-popper {
  position: absolute;
  top: 30px;
  right: 0;
  z-index: 8;
  min-width: 96px;
  overflow: hidden;
  padding: 6px 0;
  border: 1px solid rgb(228, 231, 237);
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  color: #606266;
  font-size: 14px;
  line-height: 34px;
}

.anniversary-select-popper > div {
  height: 34px;
  padding: 0 20px;
  cursor: pointer;
  white-space: nowrap;
}

.anniversary-select-popper > div:hover,
.anniversary-select-popper > div.selected {
  background: rgb(245, 247, 250);
  color: rgb(33, 150, 243);
}

.anniversary-date-row .anniversary-select-trigger {
  padding-right: 12px;
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: 14px;
}

.anniversary-event-popover {
  position: absolute;
  top: 30px;
  right: 0;
  z-index: 8;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  width: 274px;
  max-height: 246px;
  gap: 8px;
  overflow: hidden;
  padding: 41px 13px 13px;
  border: 1px solid rgba(0, 0, 0, 0);
  border-radius: 10px;
  background: rgb(29, 30, 31);
  box-shadow:
    0 0 1px rgba(255, 255, 255, 0.15),
    0 8px 24px rgba(0, 0, 0, 0.32);
  color: rgb(206, 207, 209);
  font-size: 12px;
  line-height: 24px;
}

.anniversary-event-popover::before {
  position: absolute;
  top: 13px;
  left: 13px;
  color: rgb(206, 207, 209);
  content: "常用事件";
  font-size: 12px;
  line-height: 18px;
}

.anniversary-event-popover::after {
  position: absolute;
  top: -5px;
  right: 26px;
  width: 10px;
  height: 10px;
  background: rgb(29, 30, 31);
  content: "";
  transform: rotate(45deg);
}

.anniversary-event-popover > div {
  height: 24px;
  padding: 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.02);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.66);
  cursor: pointer;
  white-space: nowrap;
}

.anniversary-event-popover > div:hover,
.anniversary-event-popover > div.active {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.9);
}

.anniversary-swatch-row {
  align-items: center;
}

.anniversary-color-swatches {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  overflow: visible;
}

.anniversary-color-swatches span {
  position: relative;
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  padding: 0;
  border-radius: 50%;
  background: var(--swatch-color);
  cursor: pointer;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.anniversary-color-swatches span.active::after {
  position: absolute;
  inset: -2px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.86);
  color: #888;
  content: "✓";
  font-size: 14px;
  font-weight: 700;
}

.anniversary-gradient-swatch {
  background: conic-gradient(
    from 180deg,
    #f04242,
    #ffb322,
    #77d24b,
    #3aa3ff,
    #8d4dff,
    #f04242
  ) !important;
}

.anniversary-background-row {
  grid-template-columns: auto auto 1fr;
  gap: 18px;
  min-height: 21px;
  align-items: start;
}

.anniversary-background-row > span {
  line-height: 21px;
}

.anniversary-background-mode {
  display: flex;
  align-items: center;
  gap: 10px;
}

.anniversary-background-mode button {
  height: 16px;
  padding: 0 4px;
  border-radius: 4px;
  background: transparent;
  color: rgba(0, 0, 0, 0.42);
  font-size: 13px;
  line-height: 16px;
}

.anniversary-background-mode button.active {
  background: rgba(0, 0, 0, 0.16);
  color: rgba(0, 0, 0, 0.86);
}

.anniversary-bg-swatches-row {
  margin-top: -4px;
}

.anniversary-image-row {
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  min-height: 100px;
  margin-top: 0;
}

.anniversary-image-panel {
  width: 100%;
  height: 100px;
  overflow: hidden;
  padding: 8px 16px;
  border-radius: 12px;
  background: rgb(255, 255, 255);
}

.anniversary-image-strip-clip {
  width: 100%;
  height: 65px;
  overflow: hidden;
}

.anniversary-image-strip {
  display: inline-flex;
  width: max-content;
  height: 52px;
  overflow: visible;
  white-space: nowrap;
}

.anniversary-image-strip button {
  position: relative;
  flex: 0 0 auto;
  width: 42px;
  height: 52px;
  overflow: hidden;
  margin: 0 5px 0 0;
  padding: 0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}

.anniversary-image-strip button.active::after {
  position: absolute;
  inset: 0;
  border: 2px solid rgb(33, 150, 243);
  border-radius: inherit;
  content: "";
  pointer-events: none;
}

.anniversary-image-strip img {
  display: block;
  width: 42px;
  height: 52px;
  object-fit: cover;
}

.anniversary-mask-row {
  display: grid;
  height: 24px;
  grid-template-columns: 60px minmax(0, 1fr);
  align-items: center;
  gap: 0;
  color: rgb(34, 34, 34);
  line-height: 24px;
}

.anniversary-mask-row > span {
  color: rgb(34, 34, 34);
  font-size: 14px;
  line-height: 24px;
}

.anniversary-mask-control {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) 54px;
  align-items: center;
  gap: 16px;
}

.anniversary-mask-control input[type="range"] {
  width: 100%;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  appearance: none;
  background: transparent;
  cursor: pointer;
  outline: none;
}

.anniversary-mask-control input[type="range"]::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    rgb(33, 150, 243) 0 var(--anniversary-mask-progress),
    rgba(255, 255, 255, 0.16) var(--anniversary-mask-progress) 100%
  );
}

.anniversary-mask-control input[type="range"]::-webkit-slider-thumb {
  width: 16px;
  height: 16px;
  border: 3px solid rgb(33, 150, 243);
  border-radius: 50%;
  appearance: none;
  background: #fff;
  margin-top: -6px;
}

.anniversary-mask-control input[type="range"]::-moz-range-track {
  height: 4px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
}

.anniversary-mask-control input[type="range"]::-moz-range-progress {
  height: 4px;
  border-radius: 999px;
  background: rgb(33, 150, 243);
}

.anniversary-mask-control input[type="range"]::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border: 3px solid rgb(33, 150, 243);
  border-radius: 50%;
  background: #fff;
}

.anniversary-mask-control output {
  color: rgba(0, 0, 0, 0.56);
  font-size: 12px;
  line-height: 18px;
  text-align: right;
}

.anniversary-settings-pane
  .anniversary-field-row:last-child
  .anniversary-select-trigger {
  height: 24px;
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: 14px;
  background: rgb(255, 255, 255);
  color: rgba(0, 0, 0, 0.42);
}

.anniversary-action-row {
  grid-area: actions;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: end;
  gap: 20px;
  margin: 0 30px 20px;
}

.anniversary-action-row button {
  height: 31px;
  border-radius: 16px;
  background: rgb(33, 150, 243);
  color: #fff;
  font-size: 14px;
  line-height: 31px;
}

.anniversary-action-row button:last-child {
  border: 1px solid rgb(220, 223, 230);
  background: rgb(255, 255, 255);
  color: rgb(96, 98, 102);
}

.opened-countdown-panel {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #fff;
  color: #222;
  font-family:
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  font-size: 14px;
  line-height: 21px;
}

.offwork-dialog-aside {
  width: 420px;
  height: 100%;
  overflow: auto;
  background: #fff;
}

.offwork-dialog-aside h3 {
  margin: 80px 0 0;
  color: #222;
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
  text-align: center;
}

.offwork-preview-stage {
  display: grid;
  height: 236px;
  place-items: center;
}

.offwork-preview-card {
  position: relative;
  display: grid;
  width: 330px;
  height: 150px;
  place-items: center;
  overflow: hidden;
  background: #fff;
  box-shadow: rgba(0, 0, 0, 0.15) 0 4px 32px 0;
}

.offwork-preview-icon {
  position: relative;
  display: block;
  overflow: hidden;
  border-radius: 18px;
  background: #fff;
  box-shadow: rgba(0, 0, 0, 0.1) 0 0 5px 0;
}

.offwork-preview-icon.preview-size-1-1 {
  width: 60px;
  height: 60px;
}

.offwork-preview-icon.preview-size-1-2 {
  width: 150px;
  height: 60px;
}

.offwork-preview-icon.preview-size-2-1 {
  width: 60px;
  height: 150px;
}

.offwork-preview-icon.preview-size-2-2 {
  width: 150px;
  height: 150px;
}

.offwork-preview-icon.preview-size-2-4 {
  width: 330px;
  height: 150px;
}

.offwork-preview-dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: -8px;
}

.offwork-preview-dots button {
  width: 8px;
  height: 8px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.15);
}

.offwork-preview-dots button.active {
  width: 11px;
  height: 11px;
  margin-top: -2px;
  background: rgba(0, 0, 0, 0.6);
}

.offwork-settings-main {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 40px 20px 20px;
  overflow: auto;
  background: rgb(241, 240, 245);
}

.offwork-settings-list {
  display: grid;
  width: 538px;
  max-width: 100%;
  max-height: 486px;
  gap: 8px;
  margin: 0 0 16px;
  padding: 0 10px 0 0;
  overflow: auto;
  list-style: none;
}

.offwork-setting-row {
  display: flex;
  min-height: 46px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 16px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  background: #fff;
  color: rgba(0, 0, 0, 0.8);
  box-shadow: rgba(0, 0, 0, 0.05) 0 1px 5px 0;
}

.offwork-setting-row > span {
  flex: 0 0 auto;
  color: rgba(0, 0, 0, 0.8);
  font-size: 14px;
  line-height: 30px;
  white-space: nowrap;
}

.offwork-setting-row input,
.offwork-setting-row select {
  box-sizing: border-box;
  height: 24px;
  min-width: 178px;
  padding: 0 12px;
  border: 0;
  border-radius: 12px;
  background: rgb(240, 241, 244);
  color: rgb(96, 98, 102);
  font-size: 13px;
  line-height: 24px;
  outline: none;
}

.offwork-weekday-controls {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
}

.offwork-weekday-controls button,
.offwork-more-row button {
  height: 33px;
  padding: 0 8px;
  border: 2px solid rgb(240, 241, 244);
  border-radius: 6px;
  background: rgb(240, 241, 244);
  color: rgb(147, 147, 147);
  font-size: 12px;
  line-height: 29px;
}

.offwork-weekday-controls button.active,
.offwork-more-row button.active {
  border-color: rgb(147, 147, 147);
  color: rgba(0, 0, 0, 0.6);
}

.offwork-segmented button {
  height: 16px;
  padding: 0 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: rgba(0, 0, 0, 0.5);
  font-size: 12px;
  line-height: 16px;
}

.offwork-segmented button.active {
  background: rgba(0, 0, 0, 0.2);
  color: #fff;
}

.offwork-time-row div,
.offwork-payday-control,
.offwork-color-input,
.offwork-segmented {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.offwork-time-row input {
  min-width: 92px;
  width: 92px;
  text-align: center;
}

.offwork-time-row b,
.offwork-payday-control small {
  color: rgba(0, 0, 0, 0.42);
  font-size: 13px;
  font-weight: 400;
}

.offwork-color-input i {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.18);
}

.offwork-color-input input {
  min-width: 128px;
}

.offwork-more-row {
  justify-content: flex-start;
  gap: 8px;
}

.offwork-more-row > span {
  margin-right: 8px;
}

.offwork-payday-control select {
  min-width: 58px;
  width: 58px;
  text-align: center;
}

.offwork-mask-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: rgba(0, 0, 0, 0.42);
}

.offwork-mask-control input[type="range"] {
  min-width: 142px;
  padding: 0;
}

.offwork-submit-button {
  display: block;
  width: 538px;
  max-width: 100%;
  height: 32px;
  border: 0;
  border-radius: 16px;
  background: #1890ff;
  color: #fff;
  font-size: 14px;
  line-height: 32px;
}

.opened-food-panel {
  position: relative;
  width: calc(100% - 2px);
  height: calc(100% - 2px);
  margin: 1px;
  overflow: hidden;
  background: rgb(255, 255, 255);
  color: rgb(34, 34, 34);
}

.opened-food-decoration {
  position: absolute;
  inset: 0;
  color: rgba(237, 133, 51, 0.18);
  pointer-events: none;
}

.food-decoration-burger,
.food-decoration-drumstick,
.food-decoration-skewer,
.food-decoration-dot {
  position: absolute;
  display: block;
  opacity: 0.38;
}

.food-decoration-burger {
  top: 256px;
  left: 282px;
  width: 58px;
  height: 42px;
  border-radius: 28px 28px 16px 16px;
  background:
    linear-gradient(rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.42)) 0
      20px / 100% 5px no-repeat,
    rgb(242, 181, 66);
}

.food-decoration-drumstick {
  top: 96px;
  right: 234px;
  width: 58px;
  height: 36px;
  border-radius: 50% 48% 44% 52%;
  border: 2px solid rgba(237, 133, 51, 0.28);
  transform: rotate(30deg);
}

.food-decoration-skewer {
  right: 220px;
  bottom: 116px;
  width: 50px;
  height: 2px;
  background: rgba(237, 133, 51, 0.32);
  transform: rotate(-44deg);
}

.food-decoration-dot {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: currentColor;
}

.food-decoration-dot.dot-one {
  top: 220px;
  left: 220px;
}

.food-decoration-dot.dot-two {
  top: 340px;
  right: 214px;
  color: rgba(75, 154, 239, 0.16);
}

.food-decoration-dot.dot-three {
  top: 120px;
  left: 420px;
  width: 54px;
  height: 54px;
  color: rgba(242, 181, 66, 0.14);
}

.opened-food-core {
  position: absolute;
  top: calc(50% - 30px);
  left: 50%;
  display: grid;
  justify-items: center;
  transform: translate(-50%, -50%);
}

.opened-food-core h2 {
  margin: 0 0 31px;
  color: rgb(34, 34, 34);
  font-size: 28px;
  font-weight: 700;
  line-height: 42px;
}

.opened-food-start {
  display: flex;
  width: 122px;
  height: 42px;
  align-items: center;
  justify-content: center;
  padding: 0 15px;
  border-radius: 21px;
  background: linear-gradient(135deg, rgb(236, 126, 49), rgb(242, 181, 66));
  box-shadow: rgb(242, 178, 65) 0 2px 6px 0;
  color: rgb(255, 255, 255);
  font-size: 18px;
  font-weight: 400;
  line-height: 21px;
  transition:
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.opened-food-start.is-running {
  box-shadow: rgb(242, 178, 65) 0 1px 4px 0;
  transform: scale(0.97);
}

.opened-food-core:has(.opened-food-start.is-running) h2 {
  animation: eat-today-random-flip 70ms linear infinite;
}

@keyframes eat-today-random-flip {
  0% {
    opacity: 0.55;
    transform: translateY(-1px);
  }

  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.opened-food-actions {
  position: absolute;
  right: 100px;
  bottom: 49px;
  left: 100px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.opened-food-actions button {
  display: flex;
  width: 122px;
  height: 32px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 15px;
  border-radius: 20px;
  color: rgb(255, 255, 255);
  font-size: 14px;
  font-weight: 500;
  line-height: 14px;
}

.opened-food-actions svg {
  width: 1em;
  height: 1em;
  flex: 0 0 auto;
}

.food-friend-button {
  background: rgb(75, 154, 239);
}

.food-menu-button {
  background: rgb(237, 133, 51);
}

.opened-2048 {
  display: grid;
  grid-template-columns: 1fr 314px;
  column-gap: 52px;
  align-items: start;
}

.opened-2048 header,
.opened-2048 footer {
  grid-column: 1;
}

.game-board {
  display: grid;
  grid-column: 2;
  grid-row: 1 / span 2;
  grid-template-columns: repeat(4, 68px);
  gap: 8px;
  padding: 10px;
  border-radius: 14px;
  background: #b8aca0;
}

.game-board b {
  display: grid;
  height: 68px;
  place-items: center;
  border-radius: 8px;
  background: #ede4d9;
  color: #6f6256;
  font-size: 28px;
}

.opened-2048 footer,
.opened-form-tool button,
.opened-gradient-panel button,
.opened-speed-panel button,
.opened-media-panel button {
  display: flex;
  gap: 12px;
}

.opened-2048 footer button,
.opened-form-tool button,
.opened-gradient-panel button,
.opened-speed-panel button,
.opened-media-panel button,
.opened-task-panel header button {
  height: 34px;
  padding: 0 15px;
  border-radius: 17px;
  background: #1890ff;
  color: #fff;
}

.typing-word {
  margin: 28px 0 18px;
  color: #1e2530;
  font-size: 52px;
  font-weight: 600;
  letter-spacing: 0;
}

.typing-input {
  width: 560px;
  padding: 18px 20px;
  border-radius: 14px;
  background: #eef2f8;
  color: #667080;
  font-size: 20px;
}

.typing-input span {
  color: #1890ff;
}

.keyboard-row {
  display: flex;
  gap: 8px;
  margin-top: 30px;
}

.keyboard-row i {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.12);
  color: #414a55;
  font-style: normal;
}

.opened-form-tool {
  max-width: 680px;
}

.opened-form-tool label {
  display: grid;
  gap: 7px;
  margin-bottom: 16px;
  color: #606976;
  font-size: 13px;
}

.opened-form-tool input,
.opened-avatar-tool input {
  height: 42px;
  padding: 0 12px;
  border: 1px solid #e1e5eb;
  border-radius: 10px;
  background: #fff;
  color: #252b34;
  outline: none;
}

.opened-form-tool output {
  display: block;
  margin: 12px 0 18px;
  padding: 16px;
  border-radius: 12px;
  background: #f4f6f9;
  color: #354051;
}

.opened-ip-panel {
  position: absolute;
  inset: 1px;
  overflow: hidden;
  border-radius: 19px;
  background: #fff;
  color: #141414;
  font-family:
    "HarmonyOS Sans",
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.opened-ip-result {
  width: calc(100% - 60px);
  margin: 78px 30px 0;
}

.opened-ip-result h2 {
  margin: 0;
  color: #111;
  font-weight: 600;
  font-size: 16px;
  line-height: 22px;
}

.opened-ip-error {
  margin: 8px 0 0;
  color: #b56b00;
  font-size: 12px;
  line-height: 18px;
}

.opened-ip-result dl {
  display: grid;
  gap: 8px;
  margin: 25px 0 0;
}

.opened-ip-result dl div {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  align-items: baseline;
  gap: 0;
  min-height: 24px;
}

.opened-ip-result dt,
.opened-ip-result dd {
  margin: 0;
  color: #111;
  font-size: 16px;
  font-weight: 400;
  line-height: 24px;
}

.opened-ip-result dt {
  font-weight: 400;
  text-align: start;
}

.opened-ip-result dd {
  overflow-wrap: anywhere;
  font-weight: 400;
}

.avatar-grid {
  display: grid;
  width: 420px;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 20px;
}

.avatar-grid i {
  display: grid;
  height: 86px;
  place-items: center;
  border-radius: 22px;
  background:
    radial-gradient(circle at 35% 32%, #fff 0 8px, transparent 9px),
    linear-gradient(135deg, #6ec1ff, #6f51f0);
  color: transparent;
}

.relative-display {
  width: 480px;
  height: 58px;
  padding: 0 18px;
  border-radius: 13px;
  background: #f4f6f9;
  color: #2c3440;
  font-size: 20px;
  line-height: 58px;
}

.relative-buttons {
  display: grid;
  width: 480px;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 16px;
}

.relative-buttons button {
  height: 42px;
  border-radius: 10px;
  background: #fff;
  color: #394251;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.opened-world-clock-panel header {
  display: grid;
  justify-items: center;
}

.opened-world-clock-panel header strong {
  font-size: 82px;
  font-weight: 300;
}

.opened-world-clock-panel section {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.opened-world-clock-panel article {
  display: grid;
  gap: 8px;
  place-items: center;
  min-height: 124px;
  border-radius: 18px;
  background: #f2f5f8;
}

.opened-world-clock-panel article b {
  font-size: 26px;
  font-weight: 400;
}

.opened-world-clock-panel article em {
  color: #8d96a2;
  font-style: normal;
}

.opened-task-panel header,
.opened-stock-panel header {
  justify-content: space-between;
}

.habit-detail {
  margin-bottom: 16px;
  padding: 20px;
  border-radius: 16px;
  background: #f3f7fb;
}

.habit-detail b {
  margin-right: 12px;
  color: #617187;
  font-size: 32px;
}

.habit-detail i {
  display: inline-block;
  width: 22px;
  height: 22px;
  margin: 14px 6px 0 0;
  border-radius: 50%;
  background: #dce6ef;
}

.opened-task-panel ul {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.opened-task-panel li {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 14px;
  border-radius: 12px;
  background: #fff;
  color: #303946;
}

.opened-task-panel li span {
  width: 18px;
  height: 18px;
  border: 2px solid #aeb8c4;
  border-radius: 50%;
}

.opened-task-panel li.done {
  color: #98a2ad;
  text-decoration: line-through;
}

.opened-task-panel li.done span {
  background: #1890ff;
  border-color: #1890ff;
}

.opened-stock-panel table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
}

.opened-stock-panel th,
.opened-stock-panel td {
  height: 48px;
  padding: 0 18px;
  border-bottom: 1px solid #eef1f4;
  text-align: left;
}

.opened-stock-panel td {
  text-align: right;
}

.opened-stock-panel .up {
  color: #e65363;
}

.opened-stock-panel .down {
  color: #34a66b;
}

.stock-line {
  height: 150px;
  margin-top: 20px;
  border-radius: 14px;
  background:
    linear-gradient(
      170deg,
      transparent 0 32%,
      rgba(229, 83, 99, 0.2) 33% 54%,
      transparent 55%
    ),
    repeating-linear-gradient(to bottom, transparent 0 36px, #e9edf2 37px), #fff;
}

.opened-daily-quote-panel {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 20px;
  background: #000;
  color: #fff;
  font-family:
    "PingFang SC",
    -apple-system,
    "system-ui",
    "Helvetica Neue",
    Helvetica,
    sans-serif;
  font-weight: 700;
  user-select: text;
}

.opened-daily-quote-panel:fullscreen {
  width: 100vw;
  height: 100vh;
  border-radius: 0;
}

.opened-daily-quote-bg {
  position: absolute;
  top: -10px;
  left: -10px;
  display: block;
  width: calc(100% + 20px);
  height: calc(100% + 20px);
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 20, 0, 0.4)),
    var(--daily-quote-opened-bg-image);
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  filter: blur(5px);
  transition: background 0.2s;
}

.opened-daily-quote-panel::after {
  content: none;
}

.opened-daily-quote-main {
  position: relative;
  z-index: 1;
  width: 100%;
  padding-top: 10%;
  line-height: 1.6;
  text-align: center;
}

.opened-daily-quote-date {
  margin: 0;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  line-height: 24px;
}

.opened-daily-quote-time {
  display: block;
  margin: 0 10%;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 66px;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.6;
}

.opened-daily-quote-panel.is-fullscreen .opened-daily-quote-time {
  font-size: 100px;
}

.opened-daily-quote-line {
  display: none;
}

.opened-daily-quote-main blockquote {
  display: block;
  margin: 20px 20% 0;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.9);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.opened-daily-quote-author {
  display: block;
  max-width: 60%;
  margin: 0 auto;
  overflow: hidden;
  color: #fff;
  opacity: 0.4;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.6;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.opened-daily-quote-actions {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  margin-top: 100px;
  opacity: 0.8;
}

.opened-daily-quote-actions button {
  position: relative;
  display: inline-block;
  width: 80px;
  height: 80px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
  opacity: 0.4;
  transform-origin: center;
  transition:
    opacity 0.18s ease,
    color 0.18s ease;
}

.opened-daily-quote-actions button[aria-pressed="true"] {
  color: rgba(255, 98, 118, 0.92);
  opacity: 0.9;
}

.opened-daily-quote-panel.is-fullscreen .opened-daily-quote-actions button {
  opacity: 0.2;
}

.opened-daily-quote-actions svg {
  width: 30px;
  height: 30px;
  margin-top: 24px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
  transition:
    transform 0.18s ease,
    stroke-width 0.18s ease;
}

.opened-daily-quote-actions button[aria-pressed="true"] svg {
  fill: currentColor;
}

.opened-daily-quote-actions button:hover {
  opacity: 0.9;
}

.opened-daily-quote-actions button:active svg {
  transform: scale(0.88);
}

.opened-daily-quote-actions button.is-clicking {
  animation: daily-quote-action-pop 0.36s cubic-bezier(0.22, 1, 0.36, 1);
}

.opened-daily-quote-actions button.is-clicking svg {
  stroke-width: 2.1;
}

@keyframes daily-quote-action-pop {
  0% {
    transform: scale(1);
  }

  38% {
    transform: scale(0.82);
  }

  76% {
    transform: scale(1.12);
  }

  100% {
    transform: scale(1);
  }
}

.opened-daily-quote-source {
  position: absolute;
  right: 0;
  bottom: 8px;
  left: 0;
  z-index: 2;
  display: inline-flex;
  height: 18px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: #fff;
  font-size: 10px;
  line-height: 18px;
  opacity: 0.3;
  text-decoration: none;
  white-space: nowrap;
}

.opened-daily-quote-source:hover {
  opacity: 0.6;
}

.opened-daily-quote-source img {
  display: block;
  height: 18px;
  object-fit: contain;
}

.opened-daily-quote-chevron {
  position: absolute;
  top: calc(50% - 40px);
  z-index: 2;
  display: block;
  width: 20px;
  height: 40px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
  opacity: 0.2;
}

.opened-daily-quote-chevron.is-left {
  left: 20px;
}

.opened-daily-quote-chevron.is-right {
  right: 20px;
}

.opened-daily-quote-chevron::before,
.opened-daily-quote-chevron::after {
  position: absolute;
  width: 20px;
  height: 1px;
  background-color: currentColor;
  content: "";
}

.opened-daily-quote-chevron.is-left::before {
  left: 0;
  transform: translateY(20px) rotate(-45deg);
  transform-origin: left top;
}

.opened-daily-quote-chevron.is-left::after {
  left: 0;
  transform: translateY(20px) rotate(45deg);
  transform-origin: left top;
}

.opened-daily-quote-chevron.is-right::before {
  right: 0;
  transform: translateY(20px) rotate(-45deg);
  transform-origin: right top;
}

.opened-daily-quote-chevron.is-right::after {
  right: 0;
  transform: translateY(20px) rotate(45deg);
  transform-origin: right top;
}

.opened-daily-quote-chevron:hover {
  opacity: 0.8;
}

.opened-window.opened-today-english {
  width: min(860px, calc(100vw - 42px));
  height: min(552px, calc(100vh - 64px));
  border: 0;
  border-radius: 20px;
  background: transparent;
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
  color: #fff;
  backdrop-filter: none;
}

.opened-window.opened-today-english .traffic {
  top: 11px;
  right: 17px;
}

.opened-window.opened-today-english .traffic .yellow {
  display: none;
}

.opened-english-panel {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 20px;
  background: #000;
  color: #fff;
}

.opened-english-bg,
.opened-english-shade {
  position: absolute;
  inset: 0;
  display: block;
}

.opened-english-bg {
  background: var(--daily-english-image) center/cover no-repeat;
  opacity: 0.5;
}

.opened-english-shade {
  background: rgba(0, 0, 0, 0);
}

.opened-english-copy {
  position: absolute;
  top: 214px;
  left: 50%;
  z-index: 1;
  width: min(520px, calc(100% - 120px));
  text-align: center;
  transform: translateX(-50%);
}

.opened-english-copy p {
  margin: 0;
  color: #fff;
  font-family:
    Arial,
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  font-size: 18px;
  line-height: 27px;
}

.opened-english-copy em {
  display: block;
  margin-top: 12px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 13px;
  font-style: normal;
  line-height: 20px;
}

.opened-english-play {
  position: absolute;
  top: 300px;
  left: 50%;
  z-index: 2;
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  padding: 0;
  border-radius: 50%;
  background: rgb(51, 51, 51);
  color: #fff;
  transform: translateX(-50%);
}

.opened-english-play svg {
  width: 12px;
  height: 12px;
  fill: currentColor;
}

.opened-english-play:not([aria-pressed="true"]) svg {
  transform: translateX(1px);
}

.opened-english-progress {
  position: absolute;
  left: 12px;
  bottom: 10px;
  color: transparent;
  font-size: 0;
}

.opened-wallpaper-panel {
  position: relative;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden auto;
  padding: 22px 20px;
  background: rgba(235, 238, 238, 0.62);
  color: #25262a;
  backdrop-filter: blur(22px);
}

.wallpaper-settings-trigger {
  position: absolute;
  top: 11px;
  right: 73px;
  z-index: 5;
  display: grid;
  width: 16px;
  height: 16px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.72);
  color: #168bff;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
}

.wallpaper-settings-trigger svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.wallpaper-settings-trigger:hover,
.wallpaper-settings-trigger[aria-expanded="true"] {
  background: rgba(255, 255, 255, 0.62);
  color: #168bff;
}

.wallpaper-settings-popover {
  position: absolute;
  top: 48px;
  right: 56px;
  z-index: 6;
  display: grid;
  width: 270px;
  box-sizing: border-box;
  gap: 8px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(18px);
}

.wallpaper-settings-popover label {
  display: flex;
  min-height: 32px;
  align-items: center;
  gap: 10px;
  color: #30343a;
  font-size: 13px;
}

.wallpaper-settings-popover input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #1890ff;
}

.wallpaper-range {
  display: grid !important;
  grid-template-columns: auto 1fr auto;
}

.wallpaper-range input {
  width: 100%;
  accent-color: #1890ff;
}

.wallpaper-range b {
  color: #1890ff;
  font-weight: 500;
}

.wallpaper-panel-head {
  display: flex;
  align-items: baseline;
  gap: 28px;
  padding-right: 116px;
}

.wallpaper-panel-head h2 {
  margin: 0;
  color: #25262a;
  font-size: 30px;
  font-weight: 700;
  line-height: 42px;
}

.wallpaper-panel-head p {
  margin: 0;
  color: rgba(68, 73, 80, 0.56);
  font-size: 14px;
  line-height: 22px;
}

.wallpaper-featured {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 28px;
  align-items: start;
  margin-top: 16px;
}

.wallpaper-featured-image,
.wallpaper-thumb {
  position: relative;
  display: block;
  overflow: hidden;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: #d7d9dc;
  cursor: pointer;
}

.wallpaper-featured-image {
  width: 360px;
  height: 202px;
}

.wallpaper-featured-image img,
.wallpaper-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wallpaper-featured-image span {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.18);
  color: #fff;
  font-size: 34px;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.48);
}

.wallpaper-featured-copy {
  padding-top: 2px;
  color: rgba(62, 66, 72, 0.62);
  font-size: 14px;
  line-height: 22px;
}

.wallpaper-featured-copy strong {
  display: block;
  margin-bottom: 10px;
  color: rgba(49, 54, 60, 0.52);
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
}

.wallpaper-featured-copy p {
  margin: 5px 0;
}

.wallpaper-featured-copy b,
.wallpaper-featured-copy a {
  color: #1890ff;
  font-weight: 500;
  text-decoration: none;
}

.wallpaper-empty-state {
  display: grid;
  min-height: 240px;
  place-items: center;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  color: rgba(15, 23, 42, 0.58);
  font-size: 14px;
  line-height: 1.6;
  text-align: center;
}

.wallpaper-bing-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px 16px;
  margin-top: 22px;
  padding-bottom: 14px;
}

.wallpaper-bing-grid article {
  position: relative;
  min-width: 0;
  aspect-ratio: 16 / 9;
}

.wallpaper-thumb {
  width: 100%;
  height: 100%;
}

.wallpaper-bing-grid article.active .wallpaper-thumb::after {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.18);
  content: "";
}

.wallpaper-check {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 34px;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.5);
}

.wallpaper-download-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 3;
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.34);
  color: #fff;
  opacity: 0;
  transition:
    opacity 0.16s ease,
    background-color 0.16s ease;
}

.wallpaper-bing-grid article:hover .wallpaper-download-icon,
.wallpaper-bing-grid article.active .wallpaper-download-icon {
  opacity: 1;
}

.wallpaper-download-icon:hover {
  background: rgba(0, 0, 0, 0.55);
}

.wallpaper-download-icon svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.9;
}

.wallpaper-panel-actions {
  position: relative;
  display: flex;
  justify-content: center;
  margin: 6px 0 0;
  padding: 14px 0 10px;
  background: transparent;
}

.wallpaper-panel-actions button {
  height: 32px;
  padding: 0 16px;
  border: 0;
  border-radius: 6px;
  background: rgb(240, 241, 244);
  color: #222;
  font-size: 14px;
}

.wallpaper-panel-actions button:disabled {
  cursor: default;
  opacity: 0.78;
}

.opened-media-panel {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 34px;
  align-items: center;
}

.opened-media-panel aside {
  display: grid;
  height: 420px;
  place-items: center;
  overflow: hidden;
  border-radius: 18px;
  background:
    linear-gradient(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.36)),
    url("https://pics.tide.moreless.io/dailypics/Fls5AqGm6txkqZcy6-OdEvpkCGtC?imageView2/1/w/600/h/600/format/webp")
      center/cover;
  color: #fff;
  font-size: 62px;
}

.opened-media-panel aside img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.opened-movie-panel {
  position: relative;
  display: grid;
  grid-template-columns: 76% minmax(0, 1fr);
  grid-template-rows: auto auto;
  column-gap: 0;
  row-gap: 0;
  align-content: start;
  align-items: start;
  width: 858px;
  height: 550px;
  box-sizing: border-box;
  margin: 1px;
  overflow: hidden;
  padding: 51px 50px 50px;
  background: #000;
  color: #f9d5ad;
}

.opened-movie-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 20, 0, 0.4)),
    var(--movie-poster-image) center/cover no-repeat;
}

.opened-movie-panel .opened-movie-poster {
  position: relative;
  z-index: 1;
  display: block;
  grid-column: 2;
  grid-row: 1;
  width: 100%;
  height: auto;
  align-self: start;
  margin: 0;
  padding: 0;
  border-radius: 6px;
  background: transparent;
  box-shadow: none;
  font-size: 18px;
}

.opened-movie-poster-image {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 273 / 405;
  border-radius: 6px;
  object-fit: cover;
}

.opened-movie-poster-image.m-block {
  display: none;
}

.opened-movie-poster-image.m-hide {
  display: block;
}

.opened-movie-panel .opened-movie-poster span {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  padding: 18px;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.28);
  color: #fff;
  font-size: 18px;
  text-align: center;
}

.opened-movie-copy {
  position: relative;
  z-index: 1;
  display: block;
  grid-column: 1;
  grid-row: 1;
  min-width: 0;
  padding: 0 20px 0 0;
  color: #f9d5ad;
  line-height: 22.4px;
}

.opened-media-panel h2 {
  margin: 0 0 16px;
  font-size: 34px;
}

.opened-media-panel p {
  max-width: 420px;
  color: #5f6874;
  font-size: 17px;
  line-height: 30px;
}

.opened-media-panel em {
  display: inline-block;
  margin-bottom: 12px;
  padding: 3px 10px;
  border-radius: 10px;
  background: #ffcf54;
  color: #7a5200;
  font-style: normal;
}

.opened-movie-panel h2 {
  margin: 0;
  overflow: hidden;
  color: #f9d5ad;
  font-size: 30px;
  font-weight: 400;
  line-height: 48px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.opened-movie-rating-row {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 22.4px;
  margin: 0;
}

.opened-movie-rating-star {
  display: inline-block;
  width: 55px;
  height: 11px;
  background: url("https://files.codelife.cc/itab/rating_s@2x.png") 0 -33px /
    cover no-repeat;
  line-height: 11px;
}

.opened-movie-rating-star::before {
  content: none;
}

.opened-movie-rating-star::after {
  content: none;
}

.opened-movie-panel .opened-movie-rating {
  margin: 0;
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: #f9d5ad;
  font-size: 14px;
  line-height: 22.4px;
}

.opened-movie-panel p {
  max-width: none;
  margin: 0;
  color: #f9d5ad;
  font-size: 14px;
  line-height: 22.4px;
}

.opened-movie-panel .opened-movie-quote {
  margin: 20px 0 0;
  color: #fff;
  font-size: 18px;
  line-height: 28.8px;
}

.opened-movie-panel .opened-movie-meta,
.opened-movie-panel .opened-movie-director {
  color: #f9d5ad;
}

.opened-movie-panel .opened-movie-intro {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 10px;
  color: #d1d0d0;
  font-size: 12px;
  line-height: 20px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 7;
}

.opened-movie-source {
  display: block;
  position: relative;
  z-index: 1;
  grid-column: 1 / -1;
  grid-row: 2;
  width: 100%;
  margin: 0;
  padding: 10px 0 0;
  background: transparent;
  color: #f2cca4;
  font-size: 12px;
  line-height: 19.2px;
  opacity: 0.8;
  text-decoration: none;
}

.opened-wooden-fish {
  display: grid;
  place-items: center;
  align-content: center;
  background: #f6efe5;
  color: #9f6c47;
}

.opened-wooden-fish h2,
.opened-gradient-panel h2 {
  margin: 0 0 24px;
  font-size: 30px;
}

.opened-wooden-fish button {
  display: grid;
  width: 230px;
  height: 190px;
  place-items: center;
  background: transparent;
}

.opened-wooden-fish img {
  width: 190px;
}

.opened-wooden-fish strong {
  font-size: 34px;
}

.opened-speed-panel {
  display: grid;
  justify-items: center;
  align-content: center;
}

.speed-meter {
  display: grid;
  width: 250px;
  height: 250px;
  place-items: center;
  border-radius: 50%;
  background:
    radial-gradient(circle, #fff 0 55%, transparent 56%),
    conic-gradient(#1d80ff 0 72%, #dfe7f2 72% 100%);
}

.speed-meter b {
  color: #1f2d3d;
  font-size: 52px;
}

.speed-meter span {
  margin-top: -70px;
  color: #7d8794;
}

.opened-speed-panel dl {
  display: flex;
  gap: 20px;
  margin: 24px 0;
}

.opened-speed-panel dl div {
  min-width: 100px;
  padding: 12px;
  border-radius: 12px;
  background: #f3f6fa;
  text-align: center;
}

.opened-speed-panel dd {
  margin: 5px 0 0;
  color: #1e2b3a;
}

.opened-gradient-panel {
  display: grid;
  justify-items: center;
  align-content: center;
}

.gradient-current {
  width: 520px;
  height: 170px;
  border-radius: 20px;
  background: linear-gradient(135deg, #70f4b0 0%, #bff27b 48%, #72f2a8 100%);
}

.opened-gradient-panel section {
  display: grid;
  grid-template-columns: repeat(6, 56px);
  gap: 10px;
  margin: 22px 0;
}

.opened-gradient-panel i {
  height: 38px;
  border-radius: 10px;
  background: linear-gradient(135deg, #6ec7ff, #7367f0);
}

.opened-gradient-panel i:nth-child(3n + 1) {
  background: linear-gradient(135deg, #ffc371, #ff5f6d);
}

.opened-gradient-panel i:nth-child(3n + 2) {
  background: linear-gradient(135deg, #76e2a8, #e7ff74);
}

.opened-converter-panel {
  display: grid;
  grid-template-columns: 176px minmax(0, 1fr);
  height: 100%;
  overflow: hidden;
  background: #fff;
  color: #303133;
  font-family:
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.opened-converter-nav {
  display: block;
  height: 100%;
  padding: 40px 0 18px 16px;
  overflow-x: hidden;
  overflow-y: auto;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  background: #fff;
}

.opened-converter-nav .tab-item {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) 18px;
  align-items: center;
  width: 144px;
  height: 44px;
  margin: 0;
  padding: 0 10px;
  border-radius: 8px;
  background: transparent;
  color: rgb(48, 49, 51);
  cursor: pointer;
  font-size: 14px;
  line-height: 44px;
  text-align: left;
}

.opened-converter-nav .tab-item.active {
  background: rgb(24, 144, 255);
  color: #fff;
}

.opened-converter-nav svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7px;
}

.opened-converter-nav span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.opened-converter-nav i {
  justify-self: end;
  width: 3px;
  height: 3px;
  border-radius: 999px;
  background: currentColor;
  box-shadow:
    0 -5px 0 currentColor,
    0 5px 0 currentColor;
  opacity: 0;
}

.opened-converter-nav .tab-item:hover i,
.opened-converter-nav .tab-item.active i {
  opacity: 0.34;
}

.opened-converter-nav .more {
  justify-self: end;
  width: 18px;
  height: 18px;
  min-height: 18px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: currentColor;
}

.opened-converter-nav .more::before {
  display: block;
  width: 3px;
  height: 3px;
  margin: 7.5px auto;
  border-radius: 999px;
  background: currentColor;
  box-shadow:
    0 -5px 0 currentColor,
    0 5px 0 currentColor;
  content: "";
  opacity: 0.38;
}

.opened-converter-content {
  display: flex;
  justify-content: center;
  min-width: 0;
  height: 100%;
  padding-top: 40px;
  background: #fff;
}

.converter-calculator {
  width: 400px;
}

.converter-calculator-display-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  width: 400px;
  height: 133px;
  margin: 0 auto 16px;
  border-radius: 6px;
  background: rgb(247, 247, 247);
}

.converter-calculator-expression-row {
  width: 368px;
  margin: 0 auto;
  overflow: hidden;
  color: rgb(144, 147, 153);
  font-size: 24px;
  line-height: 69px;
  text-align: right;
}

.converter-calculator-display-row {
  width: 368px;
  height: 44px;
  margin: 0 auto 10px;
}

.converter-calculator-display {
  display: block;
  width: 368px;
  height: 44px;
  padding: 0;
  border: 0;
  border-bottom: 1px solid rgb(232, 235, 238);
  background: transparent;
  color: rgb(48, 49, 51);
  font-size: 28px;
  font-variant-numeric: tabular-nums;
  line-height: 42px;
  outline: none;
  text-align: right;
}

.converter-calculator-result-text {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: fit-content;
  max-width: 368px;
  height: 44px;
  margin-left: auto;
  overflow: hidden;
  border-bottom: 1px solid rgb(232, 235, 238);
  color: rgb(48, 49, 51);
  font-size: 28px;
  font-variant-numeric: tabular-nums;
  line-height: 42px;
  text-align: right;
  white-space: nowrap;
}

.converter-calculator-grid {
  display: grid;
  grid-template-columns: repeat(4, 88px);
  gap: 16px;
  justify-content: center;
}

.converter-calculator-grid button {
  display: grid;
  place-items: center;
  height: 50px;
  padding: 0;
  border: 1px solid rgb(228, 231, 237);
  border-radius: 8px;
  background: #fff;
  color: rgb(48, 49, 51);
  font-size: 17px;
  line-height: 50px;
}

.converter-calculator-grid button.is-action {
  border-color: rgb(188, 225, 243);
  background: rgb(247, 252, 255);
  color: rgb(24, 144, 255);
}

.converter-calculator-grid button.is-operator {
  border-color: rgb(188, 225, 243);
  background: rgb(247, 252, 255);
  color: rgb(24, 144, 255);
}

.converter-calculator-grid button.is-equals {
  background: rgb(24, 144, 255);
  color: #fff;
}

.converter-calculator-grid svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.9px;
}

.converter-tool-preview {
  display: grid;
  align-content: start;
  width: 390px;
  gap: 16px;
  color: #303133;
}

.converter-tool-preview > svg {
  width: 42px;
  height: 42px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8px;
}

.converter-tool-preview strong {
  font-size: 22px;
  font-weight: 500;
  line-height: 30px;
}

.converter-tool-form {
  display: grid;
  gap: 14px;
}

.converter-tool-preview label {
  display: grid;
  gap: 8px;
  color: #606266;
  font-size: 13px;
}

.converter-tool-selects {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.converter-tool-preview input,
.converter-tool-preview select {
  height: 38px;
  padding: 0 12px;
  border: 1px solid rgb(228, 231, 237);
  border-radius: 8px;
  background: rgb(250, 251, 252);
  color: #303133;
  outline: none;
}

.converter-tool-preview select {
  appearance: none;
}

.converter-tool-output {
  font-weight: 600;
}

.converter-source-unit {
  width: 622px;
  height: 536px;
  margin-top: -40px;
  color: rgb(34, 34, 34);
  font-size: 14px;
  line-height: 21px;
}

.converter-source-unit-toolbar {
  height: 37.2px;
  min-height: 37.2px;
}

.converter-source-unit-form {
  width: 350px;
  height: 498.8px;
  margin: 0 auto;
  padding: 0;
}

.converter-source-unit .el-form-item {
  width: 350px;
  height: 60px;
  margin: 0;
}

.converter-source-unit .el-form-item__content,
.converter-source-unit label.w-full {
  display: block;
  width: 350px;
  height: 60px;
}

.converter-source-unit .el-input {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  width: 350px;
  height: 60px;
  overflow: hidden;
  border: 1px solid rgb(220, 223, 230);
  border-radius: 4px;
  background: #fff;
}

.converter-source-unit .el-input-group__prepend,
.converter-source-unit .el-input-group__append {
  display: grid;
  place-items: center;
  height: 58px;
  padding: 0 16px;
  background: rgb(245, 247, 250);
  color: rgb(96, 98, 102);
  white-space: nowrap;
}

.converter-source-unit .el-input-group__prepend {
  border-right: 1px solid rgb(220, 223, 230);
}

.converter-source-unit .el-input-group__append {
  border-left: 1px solid rgb(220, 223, 230);
}

.converter-source-unit .el-input__wrapper {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 58px;
  padding: 0 10px;
}

.converter-source-unit .el-input__inner {
  width: 100%;
  height: 38px;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgb(48, 49, 51);
  font-size: 14px;
  line-height: 38px;
  outline: none;
}

.converter-source-unit-list {
  width: 350px;
  height: 428.8px;
  padding-bottom: 50px;
  overflow: auto;
}

.converter-source-unit .detail-container {
  display: grid;
  grid-template-columns: repeat(2, 170px);
  gap: 10px;
  width: 350px;
}

.converter-source-unit .tax-card {
  display: grid;
  align-content: center;
  justify-items: center;
  width: 170px;
  height: 60px;
  border-radius: 6px;
  background: rgb(247, 248, 250);
  color: rgb(34, 34, 34);
}

.converter-source-unit .tax-card.active {
  background: rgb(230, 244, 255);
  color: rgb(24, 144, 255);
}

.converter-source-unit .value {
  height: 20px;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.converter-source-unit .name {
  height: 18px;
  color: rgb(96, 98, 102);
  font-size: 12px;
  line-height: 18px;
}

.opened-generic-panel {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
}

.opened-generic-panel h2 {
  margin: 0;
  font-size: 28px;
}

.itab-toast {
  position: absolute;
  left: 50%;
  bottom: 58px;
  z-index: 100;
  padding: 9px 16px;
  border-radius: 18px;
  background: rgba(19, 24, 31, 0.78);
  color: rgba(255, 255, 255, 0.92);
  font-size: 13px;
  transform: translateX(-50%);
  backdrop-filter: blur(14px);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

@media (min-width: 900px) {
  .itab-native-stage {
    min-width: 900px;
  }

  .itab-native-grid {
    top: 237px;
    left: 57px;
    grid-template-columns: repeat(14, 60px);
    grid-auto-rows: 60px;
    gap: 30px;
    width: 1230px;
  }

  .itab-quote {
    left: 90px;
  }
}

@media (min-width: 1500px) {
  .itab-native-grid {
    left: 50%;
    width: 1230px;
    margin-left: -614px;
    grid-template-columns: repeat(14, 60px);
    grid-auto-rows: 60px;
    gap: 30px;
  }
}

@media (max-width: 640px) {
  .itab-clock div {
    font-size: 60px;
  }

  .opened-wallpaper-panel {
    padding: 18px 14px;
  }

  .wallpaper-settings-trigger {
    right: 73px;
  }

  .wallpaper-settings-popover {
    right: 14px;
    width: min(270px, calc(100% - 28px));
  }

  .wallpaper-panel-head {
    display: grid;
    gap: 4px;
    padding-right: 110px;
  }

  .wallpaper-panel-head h2 {
    font-size: 24px;
    line-height: 34px;
  }

  .wallpaper-featured {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .wallpaper-featured-image {
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
  }

  .wallpaper-bing-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
}
</style>
