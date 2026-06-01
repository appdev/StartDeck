import type { WidgetConfig } from "@/types";
import {
  SD_WIDGET_SIZE_BY_KEY,
  resolveSdWidgetSize,
  toSdWidgetSizeKey,
  type SdWidgetSizeKey,
} from "@/features/sd-widgets/sdSizePresets";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  SD_FOOD_PICKER_CATALOG_ID,
  SD_FOOD_PICKER_DATA_VERSION,
  SD_FOOD_PICKER_DEFAULT_SIZE,
  SD_FOOD_PICKER_RUNTIME,
  SD_FOOD_PICKER_WIDGET_TYPE,
  type SdFoodPickerWidgetData,
} from "./sdFoodPickerTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const SD_FOOD_PICKER_DEFAULT_MENU_ITEMS: string[] = [];

export const isSdFoodPickerSizeKey = (
  value: unknown,
): value is SdWidgetSizeKey =>
  typeof value === "string" &&
  SD_WIDGET_SIZE_BY_KEY.has(value as SdWidgetSizeKey);

const normalizeFoodName = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
};

export const normalizeSdFoodPickerMenuItems = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  const items = raw
    .map(normalizeFoodName)
    .filter((item, index, list) => item && list.indexOf(item) === index)
    .slice(0, 48);
  return items;
};

export const normalizeSdFoodPickerWidgetData = (
  raw: unknown,
): SdFoodPickerWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isSdFoodPickerSizeKey(input.sizeKey)
    ? input.sizeKey
    : SD_FOOD_PICKER_DEFAULT_SIZE;
  const menuItems = normalizeSdFoodPickerMenuItems(input.menuItems);
  const currentItem = normalizeFoodName(input.currentItem);
  const pickedAt = Number(input.pickedAt);

  return {
    runtime: SD_FOOD_PICKER_RUNTIME,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    version: SD_FOOD_PICKER_DATA_VERSION,
    sizeKey,
    menuItems,
    currentItem: menuItems.includes(currentItem) ? currentItem : "",
    ...(Number.isFinite(pickedAt) && pickedAt > 0
      ? { pickedAt: Math.floor(pickedAt) }
      : {}),
  };
};

export const createDefaultSdFoodPickerWidget = (): WidgetConfig => {
  const size = resolveSdWidgetSize(SD_FOOD_PICKER_DEFAULT_SIZE);
  return {
    id: SD_FOOD_PICKER_CATALOG_ID,
    type: SD_FOOD_PICKER_WIDGET_TYPE,
    enable: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: normalizeSdFoodPickerWidgetData({}),
  };
};

export const applySdFoodPickerSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: SdWidgetSizeKey,
) => {
  const size = resolveSdWidgetSize(sizeKey);
  const data = normalizeSdFoodPickerWidgetData(widget.data);
  widget.type = SD_FOOD_PICKER_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies SdFoodPickerWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncSdFoodPickerSizeFromWidgetSpans = (widget: WidgetConfig) => {
  const sizeKey = toSdWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applySdFoodPickerSizeToWidget(widget, sizeKey);
};
