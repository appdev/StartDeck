import type { WidgetConfig } from "@/types";
import {
  ITAB_WIDGET_SIZE_BY_KEY,
  resolveItabWidgetSize,
  toItabWidgetSizeKey,
  type ItabWidgetSizeKey,
} from "@/features/itab-widgets/itabSizePresets";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  ITAB_FOOD_PICKER_CATALOG_ID,
  ITAB_FOOD_PICKER_DATA_VERSION,
  ITAB_FOOD_PICKER_DEFAULT_SIZE,
  ITAB_FOOD_PICKER_RUNTIME,
  ITAB_FOOD_PICKER_WIDGET_TYPE,
  type ItabFoodPickerWidgetData,
} from "./itabFoodPickerTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const ITAB_FOOD_PICKER_DEFAULT_MENU_ITEMS: string[] = [];

export const isItabFoodPickerSizeKey = (
  value: unknown,
): value is ItabWidgetSizeKey =>
  typeof value === "string" &&
  ITAB_WIDGET_SIZE_BY_KEY.has(value as ItabWidgetSizeKey);

const normalizeFoodName = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
};

export const normalizeItabFoodPickerMenuItems = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  const items = raw
    .map(normalizeFoodName)
    .filter((item, index, list) => item && list.indexOf(item) === index)
    .slice(0, 48);
  return items;
};

export const normalizeItabFoodPickerWidgetData = (
  raw: unknown,
): ItabFoodPickerWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isItabFoodPickerSizeKey(input.sizeKey)
    ? input.sizeKey
    : ITAB_FOOD_PICKER_DEFAULT_SIZE;
  const menuItems = normalizeItabFoodPickerMenuItems(input.menuItems);
  const currentItem = normalizeFoodName(input.currentItem);
  const pickedAt = Number(input.pickedAt);

  return {
    runtime: ITAB_FOOD_PICKER_RUNTIME,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    version: ITAB_FOOD_PICKER_DATA_VERSION,
    sizeKey,
    menuItems,
    currentItem: menuItems.includes(currentItem) ? currentItem : "",
    ...(Number.isFinite(pickedAt) && pickedAt > 0
      ? { pickedAt: Math.floor(pickedAt) }
      : {}),
  };
};

export const createDefaultItabFoodPickerWidget = (): WidgetConfig => {
  const size = resolveItabWidgetSize(ITAB_FOOD_PICKER_DEFAULT_SIZE);
  return {
    id: ITAB_FOOD_PICKER_CATALOG_ID,
    type: ITAB_FOOD_PICKER_WIDGET_TYPE,
    enable: true,
    isPublic: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: normalizeItabFoodPickerWidgetData({}),
  };
};

export const applyItabFoodPickerSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: ItabWidgetSizeKey,
) => {
  const size = resolveItabWidgetSize(sizeKey);
  const data = normalizeItabFoodPickerWidgetData(widget.data);
  widget.type = ITAB_FOOD_PICKER_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies ItabFoodPickerWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncItabFoodPickerSizeFromWidgetSpans = (widget: WidgetConfig) => {
  const sizeKey = toItabWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applyItabFoodPickerSizeToWidget(widget, sizeKey);
};
