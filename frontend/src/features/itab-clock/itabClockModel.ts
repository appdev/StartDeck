import type { WidgetConfig } from "@/types";
import {
  ITAB_WIDGET_SIZE_BY_KEY,
  resolveItabWidgetSize,
  toItabWidgetSizeKey,
  type ItabWidgetSizeKey,
} from "@/features/itab-widgets/itabSizePresets";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  ITAB_CLOCK_CATALOG_ID,
  ITAB_CLOCK_DATA_VERSION,
  ITAB_CLOCK_DEFAULT_SIZE,
  ITAB_CLOCK_RUNTIME,
  ITAB_CLOCK_WIDGET_TYPE,
  type ItabClockWidgetData,
} from "./itabClockTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isItabClockSizeKey = (
  value: unknown,
): value is ItabWidgetSizeKey =>
  typeof value === "string" &&
  ITAB_WIDGET_SIZE_BY_KEY.has(value as ItabWidgetSizeKey);

export const normalizeItabClockWidgetData = (
  raw: unknown,
): ItabClockWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isItabClockSizeKey(input.sizeKey)
    ? input.sizeKey
    : ITAB_CLOCK_DEFAULT_SIZE;
  return {
    runtime: ITAB_CLOCK_RUNTIME,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    version: ITAB_CLOCK_DATA_VERSION,
    sizeKey,
    showSeconds:
      typeof input.showSeconds === "boolean" ? input.showSeconds : true,
  };
};

export const createDefaultItabClockWidget = (): WidgetConfig => {
  const size = resolveItabWidgetSize(ITAB_CLOCK_DEFAULT_SIZE);
  return {
    id: ITAB_CLOCK_CATALOG_ID,
    type: ITAB_CLOCK_WIDGET_TYPE,
    enable: true,
    isPublic: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: {
      runtime: ITAB_CLOCK_RUNTIME,
      layoutSystem: ITAB_GRID_SCHEMA_VERSION,
      version: ITAB_CLOCK_DATA_VERSION,
      sizeKey: ITAB_CLOCK_DEFAULT_SIZE,
      showSeconds: true,
    } satisfies ItabClockWidgetData,
  };
};

export const applyItabClockSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: ItabWidgetSizeKey,
) => {
  const size = resolveItabWidgetSize(sizeKey);
  const data = normalizeItabClockWidgetData(widget.data);
  widget.id = ITAB_CLOCK_CATALOG_ID;
  widget.type = ITAB_CLOCK_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies ItabClockWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncItabClockSizeFromWidgetSpans = (widget: WidgetConfig) => {
  const sizeKey = toItabWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applyItabClockSizeToWidget(widget, sizeKey);
};
