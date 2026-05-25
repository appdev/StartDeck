import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";

export const ITAB_NUMBER_UPPERCASE_CATALOG_ID = "itab-number-uppercase-35";
export const ITAB_NUMBER_UPPERCASE_WIDGET_TYPE = "itab-number-uppercase-35";
export const ITAB_NUMBER_UPPERCASE_RUNTIME = "itab-number-uppercase";
export const ITAB_NUMBER_UPPERCASE_DATA_VERSION = 1;
export const ITAB_NUMBER_UPPERCASE_DEFAULT_SIZE: ItabWidgetSizeKey = "2x2";

export type ItabNumberUppercaseFormatMode = "currency";

export interface ItabNumberUppercaseWidgetData {
  runtime: typeof ITAB_NUMBER_UPPERCASE_RUNTIME;
  layoutSystem?: string;
  version: typeof ITAB_NUMBER_UPPERCASE_DATA_VERSION;
  sizeKey: ItabWidgetSizeKey;
  inputNumber: string;
  uppercaseResult: string;
  formatMode: ItabNumberUppercaseFormatMode;
}
