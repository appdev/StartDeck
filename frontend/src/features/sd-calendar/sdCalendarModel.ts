import type { WidgetConfig } from "@/types";
import {
  SD_WIDGET_SIZE_BY_KEY,
  resolveSdWidgetSize,
  toSdWidgetSizeKey,
  type SdWidgetSizeKey,
} from "@/features/sd-widgets/sdSizePresets";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  SD_CALENDAR_CATALOG_ID,
  SD_CALENDAR_DATA_VERSION,
  SD_CALENDAR_DEFAULT_SIZE,
  SD_CALENDAR_RUNTIME,
  SD_CALENDAR_WIDGET_TYPE,
  type SdCalendarWidgetData,
} from "./sdCalendarTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isSdCalendarSizeKey = (
  value: unknown,
): value is SdWidgetSizeKey =>
  typeof value === "string" &&
  SD_WIDGET_SIZE_BY_KEY.has(value as SdWidgetSizeKey);

export const normalizeSdCalendarWidgetData = (
  raw: unknown,
): SdCalendarWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isSdCalendarSizeKey(input.sizeKey)
    ? input.sizeKey
    : SD_CALENDAR_DEFAULT_SIZE;

  return {
    runtime: SD_CALENDAR_RUNTIME,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    version: SD_CALENDAR_DATA_VERSION,
    sizeKey,
  };
};

export const createDefaultSdCalendarWidget = (): WidgetConfig => {
  const size = resolveSdWidgetSize(SD_CALENDAR_DEFAULT_SIZE);
  return {
    id: SD_CALENDAR_CATALOG_ID,
    type: SD_CALENDAR_WIDGET_TYPE,
    enable: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: normalizeSdCalendarWidgetData({}),
  };
};

export const applySdCalendarSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: SdWidgetSizeKey,
) => {
  const size = resolveSdWidgetSize(sizeKey);
  const data = normalizeSdCalendarWidgetData(widget.data);
  widget.id = SD_CALENDAR_CATALOG_ID;
  widget.type = SD_CALENDAR_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies SdCalendarWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncSdCalendarSizeFromWidgetSpans = (widget: WidgetConfig) => {
  const sizeKey = toSdWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applySdCalendarSizeToWidget(widget, sizeKey);
};
