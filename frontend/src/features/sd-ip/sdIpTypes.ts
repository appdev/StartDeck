import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";

export const SD_IP_WIDGET_TYPE = "sd-ip-30";
export const SD_IP_CATALOG_ID = "ip";
export const SD_IP_RUNTIME = "sd-ip";
export const SD_IP_DATA_VERSION = 1;
export const SD_IP_DEFAULT_SIZE: SdWidgetSizeKey = "2x2";
export const SD_IP_PROXY_PATH = "/api/ip";
export const SD_IP_LATENCY_PATH = "/api/rtt";

export type SdIpLookupStatus = "idle" | "loading" | "success" | "error";
export type SdIpSourceStatus = "loading" | "ok" | "error";

export interface SdIpWidgetData {
  runtime: typeof SD_IP_RUNTIME;
  layoutSystem?: string;
  version: typeof SD_IP_DATA_VERSION;
  sizeKey: SdWidgetSizeKey;
}

export interface SdIpLookupResult {
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
  sourceStatus: SdIpSourceStatus;
}

export interface SdIpLatencyResult {
  latencyMs: number;
  checkedAt: string;
  serverTs: number;
}

export interface SdIpHistoryEntry extends SdIpLookupResult {
  firstSeenAt: number;
  lastSeenAt: number;
  seenCount: number;
}
