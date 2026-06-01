import type { WidgetConfig } from "@/types";
import {
  SD_WIDGET_SIZE_BY_KEY,
  resolveSdWidgetSize,
  toSdWidgetSizeKey,
  type SdWidgetSizeKey,
} from "@/features/sd-widgets/sdSizePresets";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  SD_CLOCK_CATALOG_ID,
  SD_CLOCK_DATA_VERSION,
  SD_CLOCK_DEFAULT_SIZE,
  SD_CLOCK_RUNTIME,
  SD_CLOCK_WIDGET_TYPE,
  type SdClockWidgetData,
} from "./sdClockTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isSdClockSizeKey = (
  value: unknown,
): value is SdWidgetSizeKey =>
  typeof value === "string" &&
  SD_WIDGET_SIZE_BY_KEY.has(value as SdWidgetSizeKey);

export const normalizeSdClockWidgetData = (
  raw: unknown,
): SdClockWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isSdClockSizeKey(input.sizeKey)
    ? input.sizeKey
    : SD_CLOCK_DEFAULT_SIZE;
  return {
    runtime: SD_CLOCK_RUNTIME,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    version: SD_CLOCK_DATA_VERSION,
    sizeKey,
    showSeconds:
      typeof input.showSeconds === "boolean" ? input.showSeconds : true,
  };
};

export const createDefaultSdClockWidget = (): WidgetConfig => {
  const size = resolveSdWidgetSize(SD_CLOCK_DEFAULT_SIZE);
  return {
    id: SD_CLOCK_CATALOG_ID,
    type: SD_CLOCK_WIDGET_TYPE,
    enable: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: {
      runtime: SD_CLOCK_RUNTIME,
      layoutSystem: SD_GRID_SCHEMA_VERSION,
      version: SD_CLOCK_DATA_VERSION,
      sizeKey: SD_CLOCK_DEFAULT_SIZE,
      showSeconds: true,
    } satisfies SdClockWidgetData,
  };
};

export const applySdClockSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: SdWidgetSizeKey,
) => {
  const size = resolveSdWidgetSize(sizeKey);
  const data = normalizeSdClockWidgetData(widget.data);
  widget.id = SD_CLOCK_CATALOG_ID;
  widget.type = SD_CLOCK_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies SdClockWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncSdClockSizeFromWidgetSpans = (widget: WidgetConfig) => {
  const sizeKey = toSdWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applySdClockSizeToWidget(widget, sizeKey);
};
