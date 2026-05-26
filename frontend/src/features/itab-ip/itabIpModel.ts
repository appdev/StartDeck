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
  type ItabIpLookupStatus,
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

const CHINA_COUNTRY_NAMES = new Set(["中国", "中华人民共和国", "CN", "CHN", "China"]);

const isChinaCountry = (value: string) => CHINA_COUNTRY_NAMES.has(value.trim());

const uniqueNonEmpty = (parts: string[]) =>
  parts
    .map((part) => part.trim())
    .filter((part, index, values) => part && values.indexOf(part) === index);

const ensureChineseCitySuffix = (value: string) => {
  if (!value || /[市盟县区]$|地区$|自治州$/.test(value)) return value;
  if (/^[\u4e00-\u9fa5]+$/.test(value)) return `${value}市`;
  return value;
};

const splitLocationParts = (location: string) =>
  location
    .split(/[\s-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

const formatChinaArea = (result: ItabIpLookupResult) => {
  let province = result.region;
  let city = result.adm2;
  let district = result.district || result.city;

  if (!province || !city) {
    const locationParts = splitLocationParts(result.location);
    const withoutCountry = isChinaCountry(locationParts[0] || "")
      ? locationParts.slice(1)
      : locationParts;
    province = province || withoutCountry[0] || "";
    city = city || withoutCountry[1] || "";
    district = district || withoutCountry[2] || "";
  }

  if (!city && result.city && result.city !== district) {
    city = result.city;
  }
  if (city && district === city) {
    district = "";
  }

  const parts = uniqueNonEmpty([
    province,
    ensureChineseCitySuffix(city),
    district,
  ]);
  return parts.length ? parts.join("") : "";
};

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
  adm2: "",
  city: "",
  district: "",
  isp: "",
  queryIp: "",
  clientIp: "",
  clientIpSource: "",
  weatherLocationId: "",
  weatherLocationType: "",
  latitude: "",
  longitude: "",
  coordinateSource: "",
  coordinateAccuracy: "",
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
    region: normalizeString(data.region) || normalizeString(data.province),
    adm2: normalizeString(data.adm2),
    city: normalizeString(data.city),
    district: normalizeString(data.district),
    isp: normalizeString(data.isp) || normalizeString(data.network),
    queryIp: normalizeString(data.queryIp) || ip,
    clientIp: normalizeString(data.clientIp),
    clientIpSource: normalizeString(data.clientIpSource),
    weatherLocationId: normalizeString(data.weatherLocationId),
    weatherLocationType: normalizeString(data.weatherLocationType),
    latitude:
      normalizeString(data.latitude) ||
      normalizeString(data.lat) ||
      normalizeString(data.y),
    longitude:
      normalizeString(data.longitude) ||
      normalizeString(data.lon) ||
      normalizeString(data.lng) ||
      normalizeString(data.x),
    coordinateSource: normalizeString(data.coordinateSource),
    coordinateAccuracy: normalizeString(data.coordinateAccuracy),
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
  if (isChinaCountry(result.country) || result.location.startsWith("中国")) {
    const chinaArea = formatChinaArea(result);
    if (chinaArea) return chinaArea;
  }

  const parts = [
    result.country,
    result.region,
    result.adm2,
    result.city || result.district,
  ].filter((part, index, values) => part && values.indexOf(part) === index);
  if (parts.length) return parts.join("-");
  const locationParts = result.location.split(/\s+/).filter(Boolean);
  if (locationParts.length >= 3) return locationParts.slice(0, 4).join("-");
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

export const parseItabIpCoordinate = (result: ItabIpLookupResult) => {
  const latitude = Number(result.latitude);
  const longitude = Number(result.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return { latitude, longitude };
};

export const formatItabIpCoordinate = (result: ItabIpLookupResult) => {
  if (!parseItabIpCoordinate(result)) return "暂无";
  return `${result.longitude},${result.latitude}`;
};

export const formatItabIpLatency = (
  latencyMs: number | null,
  status: ItabIpLookupStatus,
) => {
  if (status === "loading") return "测试中";
  if (latencyMs === null || !Number.isFinite(latencyMs)) return "待测试";
  return `${Math.max(0, Math.round(latencyMs))} ms`;
};

export const createItabIpMapEmbedUrl = (result: ItabIpLookupResult) => {
  const coordinate = parseItabIpCoordinate(result);
  if (!coordinate) return "";

  const span = 0.45;
  const bbox = [
    coordinate.longitude - span,
    coordinate.latitude - span,
    coordinate.longitude + span,
    coordinate.latitude + span,
  ]
    .map((value) => value.toFixed(6))
    .join(",");
  const url = new URL("https://www.openstreetmap.org/export/embed.html");
  url.searchParams.set("bbox", bbox);
  url.searchParams.set("layer", "mapnik");
  url.searchParams.set(
    "marker",
    `${coordinate.latitude.toFixed(6)},${coordinate.longitude.toFixed(6)}`,
  );
  return url.toString();
};

export const isLongItabIpAddress = (result: ItabIpLookupResult) =>
  formatItabIpAddress(result).length > 18;
