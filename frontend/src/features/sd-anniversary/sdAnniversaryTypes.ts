import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";

export const SD_ANNIVERSARY_WIDGET_TYPE = "sd-anniversary-03";
export const SD_ANNIVERSARY_CATALOG_ID = "anniversary";
export const SD_ANNIVERSARY_RUNTIME = "sd-anniversary";
export const SD_ANNIVERSARY_DATA_VERSION = 1;
export const SD_ANNIVERSARY_DEFAULT_SIZE: SdWidgetSizeKey = "2x2";

export type SdAnniversaryMode = "elapsed" | "remaining";
export type SdAnniversaryRepeat =
  | "不重复"
  | "每周"
  | "每月"
  | "每年"
  | "节日";
export type SdAnniversaryBackgroundMode = "color" | "image";

export interface SdAnniversaryWidgetData {
  runtime: typeof SD_ANNIVERSARY_RUNTIME;
  layoutSystem?: string;
  version: typeof SD_ANNIVERSARY_DATA_VERSION;
  sizeKey: SdWidgetSizeKey;
  title: string;
  label: string;
  eventName: string;
  date: string;
  mode: SdAnniversaryMode;
  repeat: SdAnniversaryRepeat;
  textColor: string;
  backgroundColor: string;
  backgroundImage: string;
  backgroundMode: SdAnniversaryBackgroundMode;
  mask: number;
}

export interface SdAnniversaryTemplate extends SdAnniversaryWidgetData {
  id: string;
}
