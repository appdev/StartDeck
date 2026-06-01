import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";

export const SD_CLOCK_WIDGET_TYPE = "sd-clock-12";
export const SD_CLOCK_CATALOG_ID = "clock";
export const SD_CLOCK_RUNTIME = "sd-clock";
export const SD_CLOCK_DATA_VERSION = 1;
export const SD_CLOCK_DEFAULT_SIZE: SdWidgetSizeKey = "2x2";

export interface SdClockWidgetData {
  runtime: typeof SD_CLOCK_RUNTIME;
  layoutSystem?: string;
  version: typeof SD_CLOCK_DATA_VERSION;
  sizeKey: SdWidgetSizeKey;
  showSeconds: boolean;
}
