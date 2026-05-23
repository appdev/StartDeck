import type { WidgetConfig } from "@/types";
import {
  ITAB_WIDGET_SIZE_BY_KEY,
  resolveItabWidgetSize,
  toItabWidgetSizeKey,
  type ItabWidgetSizeKey,
} from "@/features/itab-widgets/itabSizePresets";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  ITAB_WEATHER_CATALOG_ID,
  ITAB_WEATHER_DATA_VERSION,
  ITAB_WEATHER_DEFAULT_SIZE,
  ITAB_WEATHER_RUNTIME,
  ITAB_WEATHER_WIDGET_TYPE,
  type ItabWeatherLocation,
  type ItabWeatherLocationResponse,
  type ItabWeatherWidgetData,
} from "./itabWeatherTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isItabWeatherSizeKey = (
  value: unknown,
): value is ItabWidgetSizeKey =>
  typeof value === "string" &&
  ITAB_WIDGET_SIZE_BY_KEY.has(value as ItabWidgetSizeKey);

const normalizeLocation = (raw: unknown): ItabWeatherLocation | undefined => {
  if (!isObject(raw)) return undefined;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const city = typeof raw.city === "string" ? raw.city.trim() : "";
  if (!id || !city) return undefined;
  return {
    id,
    city,
    province:
      typeof raw.province === "string" ? raw.province.trim() : undefined,
    adm2: typeof raw.adm2 === "string" ? raw.adm2.trim() : undefined,
    type:
      typeof raw.type === "string" && raw.type.trim()
        ? raw.type.trim()
        : "city",
    country: typeof raw.country === "string" ? raw.country.trim() : undefined,
    location:
      typeof raw.location === "string" ? raw.location.trim() : undefined,
  };
};

export const toItabWeatherLocation = (
  location: ItabWeatherLocationResponse,
): ItabWeatherLocation => ({
  id: location.id,
  city: location.name,
  province: location.adm1,
  adm2: location.adm2,
  type: location.type || "city",
  country: location.country,
  location: location.location,
});

export const normalizeItabWeatherWidgetData = (
  raw: unknown,
): ItabWeatherWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isItabWeatherSizeKey(input.sizeKey)
    ? input.sizeKey
    : ITAB_WEATHER_DEFAULT_SIZE;
  return {
    runtime: ITAB_WEATHER_RUNTIME,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    version: ITAB_WEATHER_DATA_VERSION,
    sizeKey,
    location: normalizeLocation(input.location),
  };
};

export const createDefaultItabWeatherWidget = (): WidgetConfig => {
  const size = resolveItabWidgetSize(ITAB_WEATHER_DEFAULT_SIZE);
  return {
    id: ITAB_WEATHER_CATALOG_ID,
    type: ITAB_WEATHER_WIDGET_TYPE,
    enable: true,
    isPublic: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: {
      runtime: ITAB_WEATHER_RUNTIME,
      layoutSystem: ITAB_GRID_SCHEMA_VERSION,
      version: ITAB_WEATHER_DATA_VERSION,
      sizeKey: ITAB_WEATHER_DEFAULT_SIZE,
    } satisfies ItabWeatherWidgetData,
  };
};

export const applyItabWeatherSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: ItabWidgetSizeKey,
) => {
  const size = resolveItabWidgetSize(sizeKey);
  const data = normalizeItabWeatherWidgetData(widget.data);
  widget.id = ITAB_WEATHER_CATALOG_ID;
  widget.type = ITAB_WEATHER_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies ItabWeatherWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncItabWeatherSizeFromWidgetSpans = (widget: WidgetConfig) => {
  const sizeKey = toItabWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applyItabWeatherSizeToWidget(widget, sizeKey);
};
