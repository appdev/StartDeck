import type { WidgetConfig } from "@/types";
import type { SdIpLookupResult } from "@/features/sd-ip/sdIpTypes";
import {
  SD_WIDGET_SIZE_BY_KEY,
  resolveSdWidgetSize,
  toSdWidgetSizeKey,
  type SdWidgetSizeKey,
} from "@/features/sd-widgets/sdSizePresets";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  SD_WEATHER_CATALOG_ID,
  SD_WEATHER_DATA_VERSION,
  SD_WEATHER_DEFAULT_SIZE,
  SD_WEATHER_RUNTIME,
  SD_WEATHER_WIDGET_TYPE,
  type SdWeatherLocation,
  type SdWeatherLocationResponse,
  type SdWeatherWidgetData,
} from "./sdWeatherTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cleanText = (value: string | undefined) => (value || "").trim();

const firstText = (values: Array<string | undefined>) =>
  values.map(cleanText).find(Boolean) || "";

export const isSdWeatherSizeKey = (
  value: unknown,
): value is SdWidgetSizeKey =>
  typeof value === "string" &&
  SD_WIDGET_SIZE_BY_KEY.has(value as SdWidgetSizeKey);

const normalizeLocation = (raw: unknown): SdWeatherLocation | undefined => {
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

export const toSdWeatherLocation = (
  location: SdWeatherLocationResponse,
): SdWeatherLocation => ({
  id: location.id,
  city: location.name,
  province: location.adm1,
  adm2: location.adm2,
  type: location.type || "city",
  country: location.country,
  location: location.location,
});

export const toSdWeatherLocationFromIpLookup = (
  result: SdIpLookupResult,
): SdWeatherLocation | undefined => {
  if (result.sourceStatus !== "ok") return undefined;
  const id = cleanText(result.weatherLocationId);
  if (!id) return undefined;
  const city = firstText([
    result.city,
    result.district,
    result.adm2,
    result.region,
    result.location,
  ]);
  if (!city) return undefined;
  const latitude = cleanText(result.latitude);
  const longitude = cleanText(result.longitude);
  const location =
    latitude && longitude ? `${longitude},${latitude}` : undefined;
  return {
    id,
    city,
    province: cleanText(result.region) || undefined,
    adm2: cleanText(result.adm2) || undefined,
    type: cleanText(result.weatherLocationType) || "city",
    country: cleanText(result.country) || undefined,
    location,
  };
};

export const normalizeSdWeatherWidgetData = (
  raw: unknown,
): SdWeatherWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isSdWeatherSizeKey(input.sizeKey)
    ? input.sizeKey
    : SD_WEATHER_DEFAULT_SIZE;
  return {
    runtime: SD_WEATHER_RUNTIME,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    version: SD_WEATHER_DATA_VERSION,
    sizeKey,
    location: normalizeLocation(input.location),
  };
};

export const createDefaultSdWeatherWidget = (): WidgetConfig => {
  const size = resolveSdWidgetSize(SD_WEATHER_DEFAULT_SIZE);
  return {
    id: SD_WEATHER_CATALOG_ID,
    type: SD_WEATHER_WIDGET_TYPE,
    enable: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: {
      runtime: SD_WEATHER_RUNTIME,
      layoutSystem: SD_GRID_SCHEMA_VERSION,
      version: SD_WEATHER_DATA_VERSION,
      sizeKey: SD_WEATHER_DEFAULT_SIZE,
    } satisfies SdWeatherWidgetData,
  };
};

export const applySdWeatherSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: SdWidgetSizeKey,
) => {
  const size = resolveSdWidgetSize(sizeKey);
  const data = normalizeSdWeatherWidgetData(widget.data);
  widget.id = SD_WEATHER_CATALOG_ID;
  widget.type = SD_WEATHER_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies SdWeatherWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncSdWeatherSizeFromWidgetSpans = (widget: WidgetConfig) => {
  const sizeKey = toSdWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applySdWeatherSizeToWidget(widget, sizeKey);
};
