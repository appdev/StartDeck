import type { WidgetConfig } from "@/types";
import {
  ITAB_WIDGET_SIZE_BY_KEY,
  resolveItabWidgetSize,
  toItabWidgetSizeKey,
  type ItabWidgetSizeKey,
} from "@/features/itab-widgets/itabSizePresets";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  ITAB_MOVIE_CALENDAR_CATALOG_ID,
  ITAB_MOVIE_CALENDAR_DATA_VERSION,
  ITAB_MOVIE_CALENDAR_DEFAULT_SIZE,
  ITAB_MOVIE_CALENDAR_RUNTIME,
  ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
  type ItabMovieCalendarWidgetData,
} from "./itabMovieCalendarTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isItabMovieCalendarSizeKey = (
  value: unknown,
): value is ItabWidgetSizeKey =>
  typeof value === "string" &&
  ITAB_WIDGET_SIZE_BY_KEY.has(value as ItabWidgetSizeKey);

export const normalizeItabMovieCalendarWidgetData = (
  raw: unknown,
): ItabMovieCalendarWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isItabMovieCalendarSizeKey(input.sizeKey)
    ? input.sizeKey
    : ITAB_MOVIE_CALENDAR_DEFAULT_SIZE;
  return {
    runtime: ITAB_MOVIE_CALENDAR_RUNTIME,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    version: ITAB_MOVIE_CALENDAR_DATA_VERSION,
    sizeKey,
  };
};

export const createDefaultItabMovieCalendarWidget = (): WidgetConfig => {
  const size = resolveItabWidgetSize(ITAB_MOVIE_CALENDAR_DEFAULT_SIZE);
  return {
    id: ITAB_MOVIE_CALENDAR_CATALOG_ID,
    type: ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
    enable: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: {
      runtime: ITAB_MOVIE_CALENDAR_RUNTIME,
      layoutSystem: ITAB_GRID_SCHEMA_VERSION,
      version: ITAB_MOVIE_CALENDAR_DATA_VERSION,
      sizeKey: ITAB_MOVIE_CALENDAR_DEFAULT_SIZE,
    } satisfies ItabMovieCalendarWidgetData,
  };
};

export const applyItabMovieCalendarSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: ItabWidgetSizeKey,
) => {
  const size = resolveItabWidgetSize(sizeKey);
  const data = normalizeItabMovieCalendarWidgetData(widget.data);
  widget.id = ITAB_MOVIE_CALENDAR_CATALOG_ID;
  widget.type = ITAB_MOVIE_CALENDAR_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies ItabMovieCalendarWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncItabMovieCalendarSizeFromWidgetSpans = (
  widget: WidgetConfig,
) => {
  const sizeKey = toItabWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applyItabMovieCalendarSizeToWidget(widget, sizeKey);
};
