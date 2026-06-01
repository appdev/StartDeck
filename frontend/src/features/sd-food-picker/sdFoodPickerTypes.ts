import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";

export const SD_FOOD_PICKER_WIDGET_TYPE = "sd-food-picker-15";
export const SD_FOOD_PICKER_CATALOG_ID = "food-picker";
export const SD_FOOD_PICKER_RUNTIME = "sd-food-picker";
export const SD_FOOD_PICKER_DATA_VERSION = 1;
export const SD_FOOD_PICKER_DEFAULT_SIZE: SdWidgetSizeKey = "2x2";

export interface SdFoodPickerWidgetData {
  runtime: typeof SD_FOOD_PICKER_RUNTIME;
  layoutSystem?: string;
  version: typeof SD_FOOD_PICKER_DATA_VERSION;
  sizeKey: SdWidgetSizeKey;
  menuItems: string[];
  currentItem: string;
  pickedAt?: number;
}
