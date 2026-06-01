import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";

export const SD_CALENDAR_CATALOG_ID = "calendar";
export const SD_CALENDAR_WIDGET_TYPE = "sd-calendar-01";
export const SD_CALENDAR_RUNTIME = "sd-calendar";
export const SD_CALENDAR_DEFAULT_SIZE: SdWidgetSizeKey = "2x2";
export const SD_CALENDAR_DATA_VERSION = 1;

export interface SdCalendarWidgetData {
  runtime: typeof SD_CALENDAR_RUNTIME;
  layoutSystem: string;
  version: typeof SD_CALENDAR_DATA_VERSION;
  sizeKey: SdWidgetSizeKey;
}

export interface SdCalendarDay {
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

export interface SdCalendarDetail {
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

export interface SdCalendarSnapshot {
  today: SdCalendarDay;
  todayDetail: SdCalendarDetail;
  monthTitle: string;
  grid: SdCalendarDay[];
}
