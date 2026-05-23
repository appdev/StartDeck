import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";

export const ITAB_ANNIVERSARY_WIDGET_TYPE = "itab-anniversary-03";
export const ITAB_ANNIVERSARY_CATALOG_ID = "anniversary";
export const ITAB_ANNIVERSARY_RUNTIME = "itab-anniversary";
export const ITAB_ANNIVERSARY_DATA_VERSION = 1;
export const ITAB_ANNIVERSARY_DEFAULT_SIZE: ItabWidgetSizeKey = "2x2";

export type ItabAnniversaryMode = "elapsed" | "remaining";
export type ItabAnniversaryRepeat =
  | "不重复"
  | "每周"
  | "每月"
  | "每年"
  | "节日";
export type ItabAnniversaryBackgroundMode = "color" | "image";

export interface ItabAnniversaryWidgetData {
  runtime: typeof ITAB_ANNIVERSARY_RUNTIME;
  layoutSystem?: string;
  version: typeof ITAB_ANNIVERSARY_DATA_VERSION;
  sizeKey: ItabWidgetSizeKey;
  title: string;
  label: string;
  eventName: string;
  date: string;
  mode: ItabAnniversaryMode;
  repeat: ItabAnniversaryRepeat;
  textColor: string;
  backgroundColor: string;
  backgroundImage: string;
  backgroundMode: ItabAnniversaryBackgroundMode;
  mask: number;
}

export interface ItabAnniversaryTemplate extends ItabAnniversaryWidgetData {
  id: string;
}
