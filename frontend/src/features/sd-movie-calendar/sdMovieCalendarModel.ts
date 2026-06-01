import type { WidgetConfig } from "@/types";
import {
  SD_WIDGET_SIZE_BY_KEY,
  resolveSdWidgetSize,
  toSdWidgetSizeKey,
  type SdWidgetSizeKey,
} from "@/features/sd-widgets/sdSizePresets";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  SD_MOVIE_CALENDAR_CATALOG_ID,
  SD_MOVIE_CALENDAR_DATA_VERSION,
  SD_MOVIE_CALENDAR_DEFAULT_SIZE,
  SD_MOVIE_CALENDAR_RUNTIME,
  SD_MOVIE_CALENDAR_WIDGET_TYPE,
  type SdMovieCalendarWidgetData,
} from "./sdMovieCalendarTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isSdMovieCalendarSizeKey = (
  value: unknown,
): value is SdWidgetSizeKey =>
  typeof value === "string" &&
  SD_WIDGET_SIZE_BY_KEY.has(value as SdWidgetSizeKey);

export const normalizeSdMovieCalendarWidgetData = (
  raw: unknown,
): SdMovieCalendarWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isSdMovieCalendarSizeKey(input.sizeKey)
    ? input.sizeKey
    : SD_MOVIE_CALENDAR_DEFAULT_SIZE;
  return {
    runtime: SD_MOVIE_CALENDAR_RUNTIME,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    version: SD_MOVIE_CALENDAR_DATA_VERSION,
    sizeKey,
  };
};

export const createDefaultSdMovieCalendarWidget = (): WidgetConfig => {
  const size = resolveSdWidgetSize(SD_MOVIE_CALENDAR_DEFAULT_SIZE);
  return {
    id: SD_MOVIE_CALENDAR_CATALOG_ID,
    type: SD_MOVIE_CALENDAR_WIDGET_TYPE,
    enable: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: {
      runtime: SD_MOVIE_CALENDAR_RUNTIME,
      layoutSystem: SD_GRID_SCHEMA_VERSION,
      version: SD_MOVIE_CALENDAR_DATA_VERSION,
      sizeKey: SD_MOVIE_CALENDAR_DEFAULT_SIZE,
    } satisfies SdMovieCalendarWidgetData,
  };
};

export const applySdMovieCalendarSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: SdWidgetSizeKey,
) => {
  const size = resolveSdWidgetSize(sizeKey);
  const data = normalizeSdMovieCalendarWidgetData(widget.data);
  widget.id = SD_MOVIE_CALENDAR_CATALOG_ID;
  widget.type = SD_MOVIE_CALENDAR_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies SdMovieCalendarWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncSdMovieCalendarSizeFromWidgetSpans = (
  widget: WidgetConfig,
) => {
  const sizeKey = toSdWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applySdMovieCalendarSizeToWidget(widget, sizeKey);
};
