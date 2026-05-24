import { computed, onBeforeUnmount, ref, type ComputedRef } from "vue";
import { SolarDay } from "tyme4ts";
import type { WidgetConfig } from "@/types";
import { normalizeItabCalendarWidgetData } from "./itabCalendarModel";
import type {
  ItabCalendarDay,
  ItabCalendarDetail,
  ItabCalendarSnapshot,
  ItabCalendarWidgetData,
} from "./itabCalendarTypes";

const WEEK_START_MONDAY = 1;
const DAY_REFRESH_INTERVAL_MS = 60_000;
const MONTH_CELL_COUNT = 42;
const WEEKEND_INDEXES = new Set([0, 6]);
const CONSTELLATION_SYMBOLS = new Map([
  ["白羊", "♈"],
  ["金牛", "♉"],
  ["双子", "♊"],
  ["巨蟹", "♋"],
  ["狮子", "♌"],
  ["处女", "♍"],
  ["天秤", "♎"],
  ["天蝎", "♏"],
  ["射手", "♐"],
  ["摩羯", "♑"],
  ["水瓶", "♒"],
  ["双鱼", "♓"],
]);
const EXTRA_SOLAR_FESTIVALS = new Map([["05-20", "网络情人节"]]);
const CHINESE_DIGITS = [
  "零",
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
  "七",
  "八",
  "九",
];

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatDateKey = (year: number, month: number, day: number) =>
  `${year}-${pad2(month)}-${pad2(day)}`;

const datePartsFromDate = (date: Date) => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
  day: date.getDate(),
});

const dateKeyFromDate = (date: Date) => {
  const parts = datePartsFromDate(date);
  return formatDateKey(parts.year, parts.month, parts.day);
};

export type ItabCalendarWeekStart = "monday" | "sunday";

const parseDateKey = (key: string) => {
  const [year, month, day] = key.split("-").map((part) => Number(part));
  return { year, month, day };
};

const toChineseYear = (year: number) =>
  String(year)
    .split("")
    .map((value) => CHINESE_DIGITS[Number(value)] || value)
    .join("")
    .replaceAll("零", "〇");

const festivalForDay = (solarDay: SolarDay) => {
  const monthDayKey = `${pad2(solarDay.getMonth())}-${pad2(solarDay.getDay())}`;
  return (
    solarDay.getFestival()?.getName() ||
    solarDay.getLunarDay().getFestival()?.getName() ||
    EXTRA_SOLAR_FESTIVALS.get(monthDayKey) ||
    ""
  );
};

const exactSolarTermName = (solarDay: SolarDay) => {
  const termDay = solarDay.getTermDay();
  return termDay.getDayIndex() === 0 ? termDay.getSolarTerm().getName() : "";
};

const lunarDisplayNameForDay = (solarDay: SolarDay) =>
  festivalForDay(solarDay) ||
  exactSolarTermName(solarDay) ||
  solarDay.getLunarDay().getName();

export const solarDayFromDate = (date: Date) => {
  const parts = datePartsFromDate(date);
  return SolarDay.fromYmd(parts.year, parts.month, parts.day);
};

export const solarDayFromKey = (key: string) => {
  const { year, month, day } = parseDateKey(key);
  return SolarDay.fromYmd(year, month, day);
};

export const buildItabCalendarDay = (
  solarDay: SolarDay,
  todayKey: string,
  currentMonth: number,
): ItabCalendarDay => {
  const lunarDay = solarDay.getLunarDay();
  const legalHoliday = solarDay.getLegalHoliday();
  const key = formatDateKey(
    solarDay.getYear(),
    solarDay.getMonth(),
    solarDay.getDay(),
  );
  const week = solarDay.getWeek();

  return {
    key,
    year: solarDay.getYear(),
    month: solarDay.getMonth(),
    day: solarDay.getDay(),
    dayLabel: String(solarDay.getDay()),
    dayLabelPadded: pad2(solarDay.getDay()),
    weekName: `周${week.getName()}`,
    lunarDayName: lunarDay.getName(),
    lunarMonthName: lunarDay.getLunarMonth().getName(),
    lunarDisplayName: lunarDisplayNameForDay(solarDay),
    festivalName: festivalForDay(solarDay),
    legalHolidayName: legalHoliday?.getName() || "",
    legalHolidayType: legalHoliday
      ? legalHoliday.isWork()
        ? "work"
        : "rest"
      : "",
    solarTermName: exactSolarTermName(solarDay),
    isToday: key === todayKey,
    isCurrentMonth: solarDay.getMonth() === currentMonth,
    isWeekend: WEEKEND_INDEXES.has(week.getIndex()),
  };
};

export const buildItabCalendarMonthGrid = (
  year: number,
  month: number,
  today = new Date(),
  weekStart: ItabCalendarWeekStart = "monday",
) => {
  const firstDay = SolarDay.fromYmd(year, month, 1);
  const firstWeekIndex = firstDay.getWeek().getIndex();
  const startOffset =
    weekStart === "sunday"
      ? firstWeekIndex
      : firstWeekIndex === 0
        ? 6
        : firstWeekIndex - 1;
  const startDay = firstDay.next(-startOffset);
  const todayKey = dateKeyFromDate(today);

  return Array.from({ length: MONTH_CELL_COUNT }, (_, index) =>
    buildItabCalendarDay(startDay.next(index), todayKey, month),
  );
};

export const buildItabCalendarDetail = (
  solarDay: SolarDay,
): ItabCalendarDetail => {
  const lunarDay = solarDay.getLunarDay();
  const cycleDay = lunarDay.getSixtyCycleDay();
  const yearCycle = lunarDay.getYearSixtyCycle();
  const constellationName = solarDay.getConstellation().getName();
  const symbol = CONSTELLATION_SYMBOLS.get(constellationName) || "";
  const festivalText =
    festivalForDay(solarDay) ||
    solarDay.getLegalHoliday()?.getName() ||
    exactSolarTermName(solarDay) ||
    "无";

  return {
    key: formatDateKey(
      solarDay.getYear(),
      solarDay.getMonth(),
      solarDay.getDay(),
    ),
    year: solarDay.getYear(),
    month: solarDay.getMonth(),
    day: solarDay.getDay(),
    dayPadded: pad2(solarDay.getDay()),
    dateText: `${formatDateKey(
      solarDay.getYear(),
      solarDay.getMonth(),
      solarDay.getDay(),
    )} 周${solarDay.getWeek().getName()}`,
    monthTitle: `${solarDay.getYear()}年${solarDay.getMonth()}月`,
    shortDateText: `${solarDay.getMonth()}/${solarDay.getDay()}`,
    weekdayText: `周${solarDay.getWeek().getName()}`,
    lunarText: `${lunarDay.getLunarMonth().getName()}${lunarDay.getName()}`,
    lunarFullText: `${toChineseYear(lunarDay.getYear())}年${lunarDay
      .getLunarMonth()
      .getName()}${lunarDay.getName()}`,
    ganzhiYearText: `${yearCycle.getName()}(${yearCycle
      .getEarthBranch()
      .getZodiac()
      .getName()})年`,
    dayOfYear: solarDay.getIndexInYear() + 1,
    weekOfYear: solarDay.getSolarWeek(WEEK_START_MONDAY).getIndexInYear() + 1,
    zodiacText: yearCycle.getEarthBranch().getZodiac().getName(),
    constellationText: `${constellationName}座${symbol ? ` ${symbol}` : ""}`,
    festivalText,
    recommendText: lunarDay
      .getRecommends()
      .map((item) => item.getName())
      .join("，"),
    avoidText: lunarDay
      .getAvoids()
      .map((item) => item.getName())
      .join("，"),
    phaseText: solarDay.getPhase().getName(),
    phenologyText: solarDay.getPhenology().getName(),
    joyDirectionText: cycleDay
      .getSixtyCycle()
      .getHeavenStem()
      .getJoyDirection()
      .getName(),
    yangDirectionText: cycleDay
      .getSixtyCycle()
      .getHeavenStem()
      .getYangDirection()
      .getName(),
    yinDirectionText: cycleDay
      .getSixtyCycle()
      .getHeavenStem()
      .getYinDirection()
      .getName(),
    mascotDirectionText: cycleDay
      .getSixtyCycle()
      .getHeavenStem()
      .getMascotDirection()
      .getName(),
    wealthDirectionText: cycleDay
      .getSixtyCycle()
      .getHeavenStem()
      .getWealthDirection()
      .getName(),
  };
};

export const buildItabCalendarSnapshot = (
  today = new Date(),
): ItabCalendarSnapshot => {
  const solarToday = solarDayFromDate(today);
  const todayKey = dateKeyFromDate(today);
  return {
    today: buildItabCalendarDay(solarToday, todayKey, solarToday.getMonth()),
    todayDetail: buildItabCalendarDetail(solarToday),
    monthTitle: `${solarToday.getYear()}年${solarToday.getMonth()}月`,
    grid: buildItabCalendarMonthGrid(
      solarToday.getYear(),
      solarToday.getMonth(),
      today,
    ),
  };
};

export const useItabCalendarRuntime = (
  widgetRef: ComputedRef<WidgetConfig>,
  onUpdateData?: (data: ItabCalendarWidgetData) => void,
) => {
  const now = ref(new Date());
  const data = computed(() =>
    normalizeItabCalendarWidgetData(widgetRef.value.data),
  );
  const snapshot = computed(() => buildItabCalendarSnapshot(now.value));

  const updateNow = () => {
    now.value = new Date();
    onUpdateData?.(data.value);
  };

  const timer = window.setInterval(updateNow, DAY_REFRESH_INTERVAL_MS);
  onBeforeUnmount(() => window.clearInterval(timer));

  return {
    data,
    snapshot,
    updateNow,
  };
};
