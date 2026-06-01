import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";

export const SD_NUMBER_UPPERCASE_CATALOG_ID = "sd-number-uppercase-35";
export const SD_NUMBER_UPPERCASE_WIDGET_TYPE = "sd-number-uppercase-35";
export const SD_NUMBER_UPPERCASE_RUNTIME = "sd-number-uppercase";
export const SD_NUMBER_UPPERCASE_DATA_VERSION = 1;
export const SD_NUMBER_UPPERCASE_DEFAULT_SIZE: SdWidgetSizeKey = "2x2";

export type SdNumberUppercaseFormatMode = "currency";

export interface SdNumberUppercaseWidgetData {
  runtime: typeof SD_NUMBER_UPPERCASE_RUNTIME;
  layoutSystem?: string;
  version: typeof SD_NUMBER_UPPERCASE_DATA_VERSION;
  sizeKey: SdWidgetSizeKey;
  inputNumber: string;
  uppercaseResult: string;
  formatMode: SdNumberUppercaseFormatMode;
}
