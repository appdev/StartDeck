import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";

export const ITAB_DAILY_ENGLISH_WIDGET_TYPE = "itab-daily-english-14";
export const ITAB_DAILY_ENGLISH_CATALOG_ID = "daily-english";
export const ITAB_DAILY_ENGLISH_RUNTIME = "itab-daily-english";
export const ITAB_DAILY_ENGLISH_DATA_VERSION = 1;
export const ITAB_DAILY_ENGLISH_DEFAULT_SIZE: ItabWidgetSizeKey = "2x2";

export interface ItabDailyEnglishWidgetData {
  runtime: typeof ITAB_DAILY_ENGLISH_RUNTIME;
  layoutSystem?: string;
  version: typeof ITAB_DAILY_ENGLISH_DATA_VERSION;
  sizeKey: ItabWidgetSizeKey;
}

export interface ItabDailyEnglishEntry {
  mode: string;
  sentence: string;
  translation: string;
  progressLabel: string;
  imageUrl: string;
  audioUrl: string;
  dateline: string;
  sourceStatus?: "ok" | "stale" | "error" | "loading" | string;
}
