import type { WidgetConfig } from "@/types";
import {
  ITAB_WIDGET_SIZE_BY_KEY,
  resolveItabWidgetSize,
  toItabWidgetSizeKey,
  type ItabWidgetSizeKey,
} from "@/features/itab-widgets/itabSizePresets";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  ITAB_DAILY_ENGLISH_CATALOG_ID,
  ITAB_DAILY_ENGLISH_DATA_VERSION,
  ITAB_DAILY_ENGLISH_DEFAULT_SIZE,
  ITAB_DAILY_ENGLISH_RUNTIME,
  ITAB_DAILY_ENGLISH_WIDGET_TYPE,
  type ItabDailyEnglishWidgetData,
} from "./itabDailyEnglishTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isItabDailyEnglishSizeKey = (
  value: unknown,
): value is ItabWidgetSizeKey =>
  typeof value === "string" &&
  ITAB_WIDGET_SIZE_BY_KEY.has(value as ItabWidgetSizeKey);

export const normalizeItabDailyEnglishWidgetData = (
  raw: unknown,
): ItabDailyEnglishWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isItabDailyEnglishSizeKey(input.sizeKey)
    ? input.sizeKey
    : ITAB_DAILY_ENGLISH_DEFAULT_SIZE;
  return {
    runtime: ITAB_DAILY_ENGLISH_RUNTIME,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    version: ITAB_DAILY_ENGLISH_DATA_VERSION,
    sizeKey,
  };
};

export const createDefaultItabDailyEnglishWidget = (): WidgetConfig => {
  const size = resolveItabWidgetSize(ITAB_DAILY_ENGLISH_DEFAULT_SIZE);
  return {
    id: ITAB_DAILY_ENGLISH_CATALOG_ID,
    type: ITAB_DAILY_ENGLISH_WIDGET_TYPE,
    enable: true,
    isPublic: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: {
      runtime: ITAB_DAILY_ENGLISH_RUNTIME,
      layoutSystem: ITAB_GRID_SCHEMA_VERSION,
      version: ITAB_DAILY_ENGLISH_DATA_VERSION,
      sizeKey: ITAB_DAILY_ENGLISH_DEFAULT_SIZE,
    } satisfies ItabDailyEnglishWidgetData,
  };
};

export const applyItabDailyEnglishSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: ItabWidgetSizeKey,
) => {
  const size = resolveItabWidgetSize(sizeKey);
  const data = normalizeItabDailyEnglishWidgetData(widget.data);
  widget.id = ITAB_DAILY_ENGLISH_CATALOG_ID;
  widget.type = ITAB_DAILY_ENGLISH_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies ItabDailyEnglishWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncItabDailyEnglishSizeFromWidgetSpans = (
  widget: WidgetConfig,
) => {
  const sizeKey = toItabWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applyItabDailyEnglishSizeToWidget(widget, sizeKey);
};
