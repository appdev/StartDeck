import type { WidgetConfig } from "@/types";
import {
  ITAB_WIDGET_SIZE_BY_KEY,
  resolveItabWidgetSize,
  toItabWidgetSizeKey,
  type ItabWidgetSizeKey,
} from "@/features/itab-widgets/itabSizePresets";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  ITAB_IP_CATALOG_ID,
  ITAB_IP_DATA_VERSION,
  ITAB_IP_DEFAULT_SIZE,
  ITAB_IP_RUNTIME,
  ITAB_IP_WIDGET_TYPE,
  type ItabIpLookupResult,
  type ItabIpSourceStatus,
  type ItabIpWidgetData,
} from "./itabIpTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isItabIpSizeKey = (value: unknown): value is ItabWidgetSizeKey =>
  typeof value === "string" &&
  ITAB_WIDGET_SIZE_BY_KEY.has(value as ItabWidgetSizeKey);

const normalizeString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeBoolean = (value: unknown) =>
  typeof value === "boolean" ? value : false;

export const normalizeItabIpWidgetData = (raw: unknown): ItabIpWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isItabIpSizeKey(input.sizeKey)
    ? input.sizeKey
    : ITAB_IP_DEFAULT_SIZE;
  return {
    runtime: ITAB_IP_RUNTIME,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    version: ITAB_IP_DATA_VERSION,
    sizeKey,
  };
};

export const createDefaultItabIpWidget = (): WidgetConfig => {
  const size = resolveItabWidgetSize(ITAB_IP_DEFAULT_SIZE);
  return {
    id: ITAB_IP_CATALOG_ID,
    type: ITAB_IP_WIDGET_TYPE,
    enable: true,
    isPublic: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: {
      runtime: ITAB_IP_RUNTIME,
      layoutSystem: ITAB_GRID_SCHEMA_VERSION,
      version: ITAB_IP_DATA_VERSION,
      sizeKey: ITAB_IP_DEFAULT_SIZE,
    } satisfies ItabIpWidgetData,
  };
};

export const applyItabIpSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: ItabWidgetSizeKey,
) => {
  const size = resolveItabWidgetSize(sizeKey);
  const data = normalizeItabIpWidgetData(widget.data);
  widget.id = ITAB_IP_CATALOG_ID;
  widget.type = ITAB_IP_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies ItabIpWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncItabIpSizeFromWidgetSpans = (widget: WidgetConfig) => {
  const sizeKey = toItabWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applyItabIpSizeToWidget(widget, sizeKey);
};

export const createLoadingItabIpResult = (): ItabIpLookupResult => ({
  ip: "",
  location: "",
  country: "",
  region: "",
  city: "",
  isp: "",
  queryIp: "",
  clientIp: "",
  clientIpSource: "",
  latitude: "",
  longitude: "",
  updatedAt: "",
  cached: false,
  sourceStatus: "loading",
});

export const createErrorItabIpResult = (
  previous?: ItabIpLookupResult,
): ItabIpLookupResult => ({
  ...(previous || createLoadingItabIpResult()),
  sourceStatus: "error",
});

export const normalizeItabIpLookupResponse = (
  payload: unknown,
): ItabIpLookupResult | null => {
  if (!isObject(payload)) return null;
  const data = isObject(payload.data) ? payload.data : payload;
  const ip =
    normalizeString(data.queryIp) ||
    normalizeString(data.ip) ||
    normalizeString(data.clientIp);
  if (!ip) return null;
  const success = data.success;
  const sourceStatus: ItabIpSourceStatus = success === false ? "error" : "ok";

  return {
    ip,
    location: normalizeString(data.location),
    country: normalizeString(data.country),
    region: normalizeString(data.region),
    city: normalizeString(data.city),
    isp: normalizeString(data.isp) || normalizeString(data.network),
    queryIp: normalizeString(data.queryIp) || ip,
    clientIp: normalizeString(data.clientIp),
    clientIpSource: normalizeString(data.clientIpSource),
    latitude:
      normalizeString(data.latitude) ||
      normalizeString(data.lat) ||
      normalizeString(data.y),
    longitude:
      normalizeString(data.longitude) ||
      normalizeString(data.lon) ||
      normalizeString(data.lng) ||
      normalizeString(data.x),
    updatedAt: new Date().toLocaleString("zh-CN", {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    cached: normalizeBoolean(data.cached),
    sourceStatus,
  };
};

export const formatItabIpAddress = (result: ItabIpLookupResult) =>
  (result.queryIp || result.ip || result.clientIp || "").trim() || "加载中";

export const formatItabIpArea = (result: ItabIpLookupResult) => {
  const parts = [result.country, result.region, result.city].filter(Boolean);
  if (parts.length) return parts.join("-");
  const locationParts = result.location.split(/\s+/).filter(Boolean);
  if (locationParts.length >= 3) return locationParts.slice(0, 3).join("-");
  return result.location || "未知";
};

export const formatItabIpOuterLocation = (result: ItabIpLookupResult) => {
  const value = formatItabIpArea(result).trim();
  return value && value !== "未知" ? value : "定位中";
};

export const formatItabIpNetwork = (result: ItabIpLookupResult) => {
  if (result.isp) return result.isp;
  const match = result.location.match(
    /(中国电信|中国联通|中国移动|电信|联通|移动|铁通|网通|教育网|Cable|Telecom|Unicom|Mobile|ISP)/i,
  );
  return match?.[0] || "未知";
};

export const formatItabIpCoordinate = (result: ItabIpLookupResult) => {
  if (!result.longitude || !result.latitude) return "暂无";
  return `${result.longitude},${result.latitude}`;
};

export const isLongItabIpAddress = (result: ItabIpLookupResult) =>
  formatItabIpAddress(result).length > 18;
