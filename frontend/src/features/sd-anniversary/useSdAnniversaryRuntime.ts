import { computed, type ComputedRef } from "vue";
import type { WidgetConfig } from "@/types";
import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";
import {
  SD_ANNIVERSARY_DEFAULT_BACKGROUND_IMAGE,
  SD_ANNIVERSARY_IMAGE_COUNT,
  normalizeSdAnniversaryWidgetData,
} from "./sdAnniversaryModel";
import type {
  SdAnniversaryMode,
  SdAnniversaryTemplate,
  SdAnniversaryWidgetData,
} from "./sdAnniversaryTypes";

export const anniversaryBackgroundImages = Array.from(
  { length: SD_ANNIVERSARY_IMAGE_COUNT },
  (_, index) => {
    const imageIndex = index + 1;
    return {
      id: `yiyan-${imageIndex}`,
      full: `/sd-live-assets/anniversary/yiyan-${imageIndex}.webp`,
      thumb: `/sd-live-assets/anniversary/yiyan-${imageIndex}-thumb.webp`,
    };
  },
);

export const anniversaryTextColors = [
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

export const anniversaryBackgroundColors = [
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

export const anniversaryCommonEvents = [
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

export const anniversaryRepeatOptions = [
  "不重复",
  "每周",
  "每月",
  "每年",
  "节日",
] as const;
export const anniversaryEditorSizes: Array<
  Extract<SdWidgetSizeKey, "2x2" | "2x4">
> = ["2x2", "2x4"];
export const anniversaryPreviewSizes: SdWidgetSizeKey[] = [
  "1x1",
  "1x2",
  "2x1",
  "2x2",
  "2x4",
];
export const anniversaryWeekdays = ["一", "二", "三", "四", "五", "六", "日"];
export const anniversaryCalendarDays = [
  27, 28, 29, 30, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
  19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1, 2, 3, 4, 5, 6, 7,
];

export const anniversaryDefaultFontStack =
  '"HarmonyOS Sans", "PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const anniversaryTemplates: SdAnniversaryTemplate[] = [
  {
    ...normalizeSdAnniversaryWidgetData({}),
    id: "life",
  },
  {
    ...normalizeSdAnniversaryWidgetData({
      title: "倒数日",
      label: "发工资还有",
      eventName: "发工资还有",
      date: "2023-12-01",
      mode: "remaining",
      repeat: "每月",
      textColor: "#1890ff",
      backgroundColor: "#ffffff",
      backgroundMode: "color",
      backgroundImage: SD_ANNIVERSARY_DEFAULT_BACKGROUND_IMAGE,
    }),
    id: "payday",
  },
  {
    ...normalizeSdAnniversaryWidgetData({
      title: "纪念日",
      label: "你在世界已经",
      eventName: "你在世界已经",
      date: "1997-10-1",
      mode: "elapsed",
      repeat: "不重复",
      textColor: "#8e726f",
      backgroundColor: "#eee1d9",
      backgroundMode: "color",
      backgroundImage: SD_ANNIVERSARY_DEFAULT_BACKGROUND_IMAGE,
    }),
    id: "plain-life",
  },
  {
    ...normalizeSdAnniversaryWidgetData({
      title: "恋爱日期",
      label: "和她❤️恋爱已经",
      eventName: "和她❤️恋爱已经",
      date: "2021-02-28",
      mode: "elapsed",
      repeat: "不重复",
      textColor: "#eb8197",
      backgroundColor: "#ffffff",
      backgroundMode: "color",
      backgroundImage: SD_ANNIVERSARY_DEFAULT_BACKGROUND_IMAGE,
    }),
    id: "love",
  },
];

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const daysInAnniversaryMonth = (year: number, month: number) =>
  new Date(year, month, 0).getDate();

export const parseAnniversaryDateParts = (
  value: string,
  today = new Date(),
) => {
  const [rawYear, rawMonth, rawDay] = value.split("-").map((item) => {
    const trimmed = item.trim();
    return trimmed ? Number(trimmed) : Number.NaN;
  });
  const year = Number.isFinite(rawYear)
    ? Math.min(Math.max(rawYear, 1820), 2101)
    : today.getFullYear();
  const month = Number.isFinite(rawMonth)
    ? Math.min(Math.max(rawMonth, 1), 12)
    : today.getMonth() + 1;
  const maxDay = daysInAnniversaryMonth(year, month);
  const day = Number.isFinite(rawDay)
    ? Math.min(Math.max(rawDay, 1), maxDay)
    : today.getDate();

  return { year, month, day };
};

export const formatAnniversaryDateParts = (
  year: number,
  month: number,
  day: number,
) => `${year}-${month}-${day}`;

const parseAnniversaryDate = (value: string) => {
  const { year, month, day } = parseAnniversaryDateParts(value);
  return new Date(year, month - 1, day);
};

const clampedAnniversaryDate = (
  year: number,
  zeroBasedMonth: number,
  day: number,
) => {
  const monthStart = new Date(year, zeroBasedMonth, 1);
  const normalizedYear = monthStart.getFullYear();
  const normalizedMonth = monthStart.getMonth();
  return new Date(
    normalizedYear,
    normalizedMonth,
    Math.min(day, daysInAnniversaryMonth(normalizedYear, normalizedMonth + 1)),
  );
};

const nextMonthlyAnniversary = (date: Date, today: Date) => {
  const candidate = clampedAnniversaryDate(
    today.getFullYear(),
    today.getMonth(),
    date.getDate(),
  );
  if (candidate.getTime() < today.getTime()) {
    return clampedAnniversaryDate(
      today.getFullYear(),
      today.getMonth() + 1,
      date.getDate(),
    );
  }
  return candidate;
};

const nextYearlyAnniversary = (date: Date, today: Date) => {
  const candidate = clampedAnniversaryDate(
    today.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  if (candidate.getTime() < today.getTime()) {
    return clampedAnniversaryDate(
      today.getFullYear() + 1,
      date.getMonth(),
      date.getDate(),
    );
  }
  return candidate;
};

const nextWeeklyAnniversary = (date: Date, today: Date) => {
  const candidate = new Date(today);
  const offset = (date.getDay() - today.getDay() + 7) % 7;
  candidate.setDate(today.getDate() + offset);
  return candidate;
};

const previousMonthlyAnniversary = (date: Date, today: Date) => {
  const candidate = clampedAnniversaryDate(
    today.getFullYear(),
    today.getMonth(),
    date.getDate(),
  );
  if (candidate.getTime() > today.getTime()) {
    return clampedAnniversaryDate(
      today.getFullYear(),
      today.getMonth() - 1,
      date.getDate(),
    );
  }
  return candidate;
};

const previousYearlyAnniversary = (date: Date, today: Date) => {
  const candidate = clampedAnniversaryDate(
    today.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  if (candidate.getTime() > today.getTime()) {
    return clampedAnniversaryDate(
      today.getFullYear() - 1,
      date.getMonth(),
      date.getDate(),
    );
  }
  return candidate;
};

const previousWeeklyAnniversary = (date: Date, today: Date) => {
  const candidate = new Date(today);
  const offset = (today.getDay() - date.getDay() + 7) % 7;
  candidate.setDate(today.getDate() - offset);
  return candidate;
};

const anniversaryRemainingTarget = (
  target: Date,
  repeat: SdAnniversaryWidgetData["repeat"],
  today: Date,
) => {
  if (repeat === "每月") return nextMonthlyAnniversary(target, today);
  if (repeat === "每年" || repeat === "节日")
    return nextYearlyAnniversary(target, today);
  if (repeat === "每周") return nextWeeklyAnniversary(target, today);
  return target;
};

const anniversaryElapsedTarget = (
  target: Date,
  repeat: SdAnniversaryWidgetData["repeat"],
  today: Date,
) => {
  if (repeat === "每月") return previousMonthlyAnniversary(target, today);
  if (repeat === "每年" || repeat === "节日")
    return previousYearlyAnniversary(target, today);
  if (repeat === "每周") return previousWeeklyAnniversary(target, today);
  return target;
};

export const anniversaryDays = (
  date: string,
  mode: SdAnniversaryMode,
  repeat: SdAnniversaryWidgetData["repeat"] = "不重复",
  now = new Date(),
) => {
  const today = startOfDay(now);
  const target = parseAnniversaryDate(date);
  const effectiveTarget =
    mode === "remaining"
      ? anniversaryRemainingTarget(target, repeat, today)
      : anniversaryElapsedTarget(target, repeat, today);
  const diff = Math.round(
    (today.getTime() - effectiveTarget.getTime()) / 86400000,
  );
  return Math.max(0, mode === "elapsed" ? diff : -diff);
};

export const anniversaryTemplateStyle = (
  template: Pick<
    SdAnniversaryWidgetData,
    | "textColor"
    | "backgroundColor"
    | "backgroundImage"
    | "backgroundMode"
    | "mask"
  >,
) => {
  const mask = Math.max(0, Math.min(100, Number(template.mask) || 0)) / 100;
  const imageLayer =
    template.backgroundMode === "image"
      ? `url("${template.backgroundImage || SD_ANNIVERSARY_DEFAULT_BACKGROUND_IMAGE}")`
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

export const anniversaryUsesCalendar = (
  template: Pick<SdAnniversaryWidgetData, "sizeKey" | "eventName"> & {
    id?: string;
  },
) =>
  template.sizeKey === "2x4" &&
  template.eventName !== "发工资还有" &&
  (template.id === "life" ||
    template.id === "plain-life" ||
    template.eventName === "你在世界已经");

export const anniversaryTemplateWithSize = (
  template: SdAnniversaryTemplate,
  sizeKey: SdWidgetSizeKey,
): SdAnniversaryTemplate => ({
  ...template,
  sizeKey,
});

export const useSdAnniversaryRuntime = (
  widget: ComputedRef<WidgetConfig>,
  emitUpdate?: (data: SdAnniversaryWidgetData) => void,
) => {
  const data = computed(() =>
    normalizeSdAnniversaryWidgetData(widget.value.data),
  );
  const cardTemplate = computed<SdAnniversaryTemplate>(() => ({
    ...data.value,
    id: "current",
  }));
  const cardStyle = computed(() => anniversaryTemplateStyle(data.value));
  const dayCount = computed(() =>
    anniversaryDays(data.value.date, data.value.mode, data.value.repeat),
  );
  const usesCalendar = computed(() =>
    anniversaryUsesCalendar(cardTemplate.value),
  );

  const updateData = (patch: Partial<SdAnniversaryWidgetData>) => {
    emitUpdate?.(
      normalizeSdAnniversaryWidgetData({
        ...data.value,
        ...patch,
      }),
    );
  };

  return {
    data,
    cardTemplate,
    cardStyle,
    dayCount,
    usesCalendar,
    updateData,
  };
};
