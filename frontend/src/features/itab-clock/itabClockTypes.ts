import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";

export const ITAB_CLOCK_WIDGET_TYPE = "itab-clock-12";
export const ITAB_CLOCK_CATALOG_ID = "clock";
export const ITAB_CLOCK_RUNTIME = "itab-clock";
export const ITAB_CLOCK_DATA_VERSION = 1;
export const ITAB_CLOCK_DEFAULT_SIZE: ItabWidgetSizeKey = "2x2";

export interface ItabClockWidgetData {
  runtime: typeof ITAB_CLOCK_RUNTIME;
  layoutSystem?: string;
  version: typeof ITAB_CLOCK_DATA_VERSION;
  sizeKey: ItabWidgetSizeKey;
  showSeconds: boolean;
}
