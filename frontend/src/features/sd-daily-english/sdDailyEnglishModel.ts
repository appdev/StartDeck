import type { WidgetConfig } from "@/types";
import {
  SD_WIDGET_SIZE_BY_KEY,
  resolveSdWidgetSize,
  toSdWidgetSizeKey,
  type SdWidgetSizeKey,
} from "@/features/sd-widgets/sdSizePresets";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  SD_DAILY_ENGLISH_CATALOG_ID,
  SD_DAILY_ENGLISH_DATA_VERSION,
  SD_DAILY_ENGLISH_DEFAULT_SIZE,
  SD_DAILY_ENGLISH_RUNTIME,
  SD_DAILY_ENGLISH_WIDGET_TYPE,
  type SdDailyEnglishWidgetData,
} from "./sdDailyEnglishTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isSdDailyEnglishSizeKey = (
  value: unknown,
): value is SdWidgetSizeKey =>
  typeof value === "string" &&
  SD_WIDGET_SIZE_BY_KEY.has(value as SdWidgetSizeKey);

export const normalizeSdDailyEnglishWidgetData = (
  raw: unknown,
): SdDailyEnglishWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isSdDailyEnglishSizeKey(input.sizeKey)
    ? input.sizeKey
    : SD_DAILY_ENGLISH_DEFAULT_SIZE;
  return {
    runtime: SD_DAILY_ENGLISH_RUNTIME,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    version: SD_DAILY_ENGLISH_DATA_VERSION,
    sizeKey,
  };
};

export const createDefaultSdDailyEnglishWidget = (): WidgetConfig => {
  const size = resolveSdWidgetSize(SD_DAILY_ENGLISH_DEFAULT_SIZE);
  return {
    id: SD_DAILY_ENGLISH_CATALOG_ID,
    type: SD_DAILY_ENGLISH_WIDGET_TYPE,
    enable: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: {
      runtime: SD_DAILY_ENGLISH_RUNTIME,
      layoutSystem: SD_GRID_SCHEMA_VERSION,
      version: SD_DAILY_ENGLISH_DATA_VERSION,
      sizeKey: SD_DAILY_ENGLISH_DEFAULT_SIZE,
    } satisfies SdDailyEnglishWidgetData,
  };
};

export const applySdDailyEnglishSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: SdWidgetSizeKey,
) => {
  const size = resolveSdWidgetSize(sizeKey);
  const data = normalizeSdDailyEnglishWidgetData(widget.data);
  widget.id = SD_DAILY_ENGLISH_CATALOG_ID;
  widget.type = SD_DAILY_ENGLISH_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies SdDailyEnglishWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncSdDailyEnglishSizeFromWidgetSpans = (
  widget: WidgetConfig,
) => {
  const sizeKey = toSdWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applySdDailyEnglishSizeToWidget(widget, sizeKey);
};
