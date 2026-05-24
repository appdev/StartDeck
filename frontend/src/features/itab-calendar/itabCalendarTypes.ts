import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";

export const ITAB_CALENDAR_CATALOG_ID = "calendar";
export const ITAB_CALENDAR_WIDGET_TYPE = "itab-calendar-01";
export const ITAB_CALENDAR_RUNTIME = "itab-calendar";
export const ITAB_CALENDAR_DEFAULT_SIZE: ItabWidgetSizeKey = "2x2";
export const ITAB_CALENDAR_DATA_VERSION = 1;

export interface ItabCalendarWidgetData {
  runtime: typeof ITAB_CALENDAR_RUNTIME;
  layoutSystem: string;
  version: typeof ITAB_CALENDAR_DATA_VERSION;
  sizeKey: ItabWidgetSizeKey;
}

export interface ItabCalendarDay {
  key: string;
  year: number;
  month: number;
  day: number;
  dayLabel: string;
  dayLabelPadded: string;
  weekName: string;
  lunarDayName: string;
  lunarMonthName: string;
  lunarDisplayName: string;
  festivalName: string;
  legalHolidayName: string;
  legalHolidayType: "rest" | "work" | "";
  solarTermName: string;
  isToday: boolean;
  isCurrentMonth: boolean;
  isWeekend: boolean;
}

export interface ItabCalendarDetail {
  key: string;
  year: number;
  month: number;
  day: number;
  dayPadded: string;
  dateText: string;
  monthTitle: string;
  shortDateText: string;
  weekdayText: string;
  lunarText: string;
  lunarFullText: string;
  ganzhiYearText: string;
  dayOfYear: number;
  weekOfYear: number;
  zodiacText: string;
  constellationText: string;
  festivalText: string;
  recommendText: string;
  avoidText: string;
  phaseText: string;
  phenologyText: string;
  joyDirectionText: string;
  yangDirectionText: string;
  yinDirectionText: string;
  mascotDirectionText: string;
  wealthDirectionText: string;
}

export interface ItabCalendarSnapshot {
  today: ItabCalendarDay;
  todayDetail: ItabCalendarDetail;
  monthTitle: string;
  grid: ItabCalendarDay[];
}
