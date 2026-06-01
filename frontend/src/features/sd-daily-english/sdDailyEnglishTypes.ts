import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";

export const SD_DAILY_ENGLISH_WIDGET_TYPE = "sd-daily-english-14";
export const SD_DAILY_ENGLISH_CATALOG_ID = "daily-english";
export const SD_DAILY_ENGLISH_RUNTIME = "sd-daily-english";
export const SD_DAILY_ENGLISH_DATA_VERSION = 1;
export const SD_DAILY_ENGLISH_DEFAULT_SIZE: SdWidgetSizeKey = "2x2";

export interface SdDailyEnglishWidgetData {
  runtime: typeof SD_DAILY_ENGLISH_RUNTIME;
  layoutSystem?: string;
  version: typeof SD_DAILY_ENGLISH_DATA_VERSION;
  sizeKey: SdWidgetSizeKey;
}

export interface SdDailyEnglishEntry {
  mode: string;
  sentence: string;
  translation: string;
  progressLabel: string;
  imageUrl: string;
  audioUrl: string;
  dateline: string;
  sourceStatus?: "ok" | "stale" | "error" | "loading" | string;
}
