import type { WidgetConfig } from "@/types";
import {
  SD_WIDGET_SIZE_BY_KEY,
  resolveSdWidgetSize,
  toSdWidgetSizeKey,
  type SdWidgetSizeKey,
} from "@/features/sd-widgets/sdSizePresets";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  SD_IP_CATALOG_ID,
  SD_IP_DATA_VERSION,
  SD_IP_DEFAULT_SIZE,
  SD_IP_RUNTIME,
  SD_IP_WIDGET_TYPE,
  type SdIpLookupResult,
  type SdIpSourceStatus,
  type SdIpLookupStatus,
  type SdIpWidgetData,
} from "./sdIpTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isSdIpSizeKey = (value: unknown): value is SdWidgetSizeKey =>
  typeof value === "string" &&
  SD_WIDGET_SIZE_BY_KEY.has(value as SdWidgetSizeKey);

const normalizeString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeBoolean = (value: unknown) =>
  typeof value === "boolean" ? value : false;

const CHINA_COUNTRY_NAMES = new Set([
  "中国",
  "中华人民共和国",
  "CN",
  "CHN",
  "China",
]);

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

const formatChinaArea = (result: SdIpLookupResult) => {
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

export const normalizeSdIpWidgetData = (raw: unknown): SdIpWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isSdIpSizeKey(input.sizeKey)
    ? input.sizeKey
    : SD_IP_DEFAULT_SIZE;
  return {
    runtime: SD_IP_RUNTIME,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    version: SD_IP_DATA_VERSION,
    sizeKey,
  };
};

export const createDefaultSdIpWidget = (): WidgetConfig => {
  const size = resolveSdWidgetSize(SD_IP_DEFAULT_SIZE);
  return {
    id: SD_IP_CATALOG_ID,
    type: SD_IP_WIDGET_TYPE,
    enable: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: {
      runtime: SD_IP_RUNTIME,
      layoutSystem: SD_GRID_SCHEMA_VERSION,
      version: SD_IP_DATA_VERSION,
      sizeKey: SD_IP_DEFAULT_SIZE,
    } satisfies SdIpWidgetData,
  };
};

export const applySdIpSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: SdWidgetSizeKey,
) => {
  const size = resolveSdWidgetSize(sizeKey);
  const data = normalizeSdIpWidgetData(widget.data);
  widget.id = SD_IP_CATALOG_ID;
  widget.type = SD_IP_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies SdIpWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncSdIpSizeFromWidgetSpans = (widget: WidgetConfig) => {
  const sizeKey = toSdWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applySdIpSizeToWidget(widget, sizeKey);
};

export const createLoadingSdIpResult = (): SdIpLookupResult => ({
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

export const createErrorSdIpResult = (
  previous?: SdIpLookupResult,
): SdIpLookupResult => ({
  ...(previous || createLoadingSdIpResult()),
  sourceStatus: "error",
});

export const normalizeSdIpLookupResponse = (
  payload: unknown,
): SdIpLookupResult | null => {
  if (!isObject(payload)) return null;
  const data = isObject(payload.data) ? payload.data : payload;
  const ip =
    normalizeString(data.queryIp) ||
    normalizeString(data.ip) ||
    normalizeString(data.clientIp);
  if (!ip) return null;
  const success = data.success;
  const sourceStatus: SdIpSourceStatus = success === false ? "error" : "ok";

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

export const formatSdIpAddress = (result: SdIpLookupResult) =>
  (result.queryIp || result.ip || result.clientIp || "").trim() || "加载中";

export const formatSdIpArea = (result: SdIpLookupResult) => {
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

export const formatSdIpOuterLocation = (result: SdIpLookupResult) => {
  const value = formatSdIpArea(result).trim();
  return value && value !== "未知" ? value : "定位中";
};

export const formatSdIpNetwork = (result: SdIpLookupResult) => {
  if (result.isp) return result.isp;
  const match = result.location.match(
    /(中国电信|中国联通|中国移动|电信|联通|移动|铁通|网通|教育网|Cable|Telecom|Unicom|Mobile|ISP)/i,
  );
  return match?.[0] || "未知";
};

export const parseSdIpCoordinate = (result: SdIpLookupResult) => {
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

export const formatSdIpCoordinate = (result: SdIpLookupResult) => {
  if (!parseSdIpCoordinate(result)) return "暂无";
  return `${result.longitude},${result.latitude}`;
};

export const formatSdIpLatency = (
  latencyMs: number | null,
  status: SdIpLookupStatus,
) => {
  if (status === "loading") return "测试中";
  if (latencyMs === null || !Number.isFinite(latencyMs)) return "待测试";
  return `${Math.max(0, Math.round(latencyMs))} ms`;
};

export const createSdIpMapEmbedUrl = (result: SdIpLookupResult) => {
  const coordinate = parseSdIpCoordinate(result);
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

export const isLongSdIpAddress = (result: SdIpLookupResult) =>
  formatSdIpAddress(result).length > 18;
