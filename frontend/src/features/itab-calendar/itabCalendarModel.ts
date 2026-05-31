import type { WidgetConfig } from "@/types";
import {
  ITAB_WIDGET_SIZE_BY_KEY,
  resolveItabWidgetSize,
  toItabWidgetSizeKey,
  type ItabWidgetSizeKey,
} from "@/features/itab-widgets/itabSizePresets";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  ITAB_CALENDAR_CATALOG_ID,
  ITAB_CALENDAR_DATA_VERSION,
  ITAB_CALENDAR_DEFAULT_SIZE,
  ITAB_CALENDAR_RUNTIME,
  ITAB_CALENDAR_WIDGET_TYPE,
  type ItabCalendarWidgetData,
} from "./itabCalendarTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isItabCalendarSizeKey = (
  value: unknown,
): value is ItabWidgetSizeKey =>
  typeof value === "string" &&
  ITAB_WIDGET_SIZE_BY_KEY.has(value as ItabWidgetSizeKey);

export const normalizeItabCalendarWidgetData = (
  raw: unknown,
): ItabCalendarWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isItabCalendarSizeKey(input.sizeKey)
    ? input.sizeKey
    : ITAB_CALENDAR_DEFAULT_SIZE;

  return {
    runtime: ITAB_CALENDAR_RUNTIME,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    version: ITAB_CALENDAR_DATA_VERSION,
    sizeKey,
  };
};

export const createDefaultItabCalendarWidget = (): WidgetConfig => {
  const size = resolveItabWidgetSize(ITAB_CALENDAR_DEFAULT_SIZE);
  return {
    id: ITAB_CALENDAR_CATALOG_ID,
    type: ITAB_CALENDAR_WIDGET_TYPE,
    enable: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: normalizeItabCalendarWidgetData({}),
  };
};

export const applyItabCalendarSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: ItabWidgetSizeKey,
) => {
  const size = resolveItabWidgetSize(sizeKey);
  const data = normalizeItabCalendarWidgetData(widget.data);
  widget.id = ITAB_CALENDAR_CATALOG_ID;
  widget.type = ITAB_CALENDAR_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies ItabCalendarWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncItabCalendarSizeFromWidgetSpans = (widget: WidgetConfig) => {
  const sizeKey = toItabWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applyItabCalendarSizeToWidget(widget, sizeKey);
};
