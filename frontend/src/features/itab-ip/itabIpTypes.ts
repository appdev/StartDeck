import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";

export const ITAB_IP_WIDGET_TYPE = "itab-ip-30";
export const ITAB_IP_CATALOG_ID = "ip";
export const ITAB_IP_RUNTIME = "itab-ip";
export const ITAB_IP_DATA_VERSION = 1;
export const ITAB_IP_DEFAULT_SIZE: ItabWidgetSizeKey = "2x2";
export const ITAB_IP_PROXY_PATH = "/api/ip";
export const ITAB_IP_LATENCY_PATH = "/api/rtt";

export type ItabIpLookupStatus = "idle" | "loading" | "success" | "error";
export type ItabIpSourceStatus = "loading" | "ok" | "error";

export interface ItabIpWidgetData {
  runtime: typeof ITAB_IP_RUNTIME;
  layoutSystem?: string;
  version: typeof ITAB_IP_DATA_VERSION;
  sizeKey: ItabWidgetSizeKey;
}

export interface ItabIpLookupResult {
  ip: string;
  location: string;
  country: string;
  region: string;
  adm2: string;
  city: string;
  district: string;
  isp: string;
  queryIp: string;
  clientIp: string;
  clientIpSource: string;
  weatherLocationId: string;
  weatherLocationType: string;
  latitude: string;
  longitude: string;
  coordinateSource: string;
  coordinateAccuracy: string;
  updatedAt: string;
  cached: boolean;
  sourceStatus: ItabIpSourceStatus;
}

export interface ItabIpLatencyResult {
  latencyMs: number;
  checkedAt: string;
  serverTs: number;
}
