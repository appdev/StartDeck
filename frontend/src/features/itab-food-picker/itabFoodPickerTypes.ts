import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";

export const ITAB_FOOD_PICKER_WIDGET_TYPE = "itab-food-picker-15";
export const ITAB_FOOD_PICKER_CATALOG_ID = "food-picker";
export const ITAB_FOOD_PICKER_RUNTIME = "itab-food-picker";
export const ITAB_FOOD_PICKER_DATA_VERSION = 1;
export const ITAB_FOOD_PICKER_DEFAULT_SIZE: ItabWidgetSizeKey = "2x2";

export interface ItabFoodPickerWidgetData {
  runtime: typeof ITAB_FOOD_PICKER_RUNTIME;
  layoutSystem?: string;
  version: typeof ITAB_FOOD_PICKER_DATA_VERSION;
  sizeKey: ItabWidgetSizeKey;
  menuItems: string[];
  currentItem: string;
  pickedAt?: number;
}
