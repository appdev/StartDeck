import type { NetworkLocationAddress } from "@/types";

export type NetworkTargetType = "lan" | "overlay" | "wan";

export function normalizeNetworkLocationAddress(
  input?: unknown,
): NetworkLocationAddress | null;

export function networkLocationMatches(
  current?: unknown,
  target?: NetworkLocationAddress | null,
): boolean;

export const NETWORK_PRESET_RULES: Record<string, string[]>;

export const DEFAULT_NETWORK_RULES: string;

export function classifyNetworkTarget(
  url: unknown,
  networkRules?: string,
  internalDomains?: string,
): NetworkTargetType;

export function detectNetworkByLatency(
  measuredLatencyMs: number,
  thresholdMs?: number,
): "lan" | "wan" | "unknown";

export function isInternalNetwork(
  url: unknown,
  internalDomains?: string,
  networkRules?: string,
): boolean;

export function getNetworkConfig(
  appConfig?: {
    internalDomains?: string;
    internalLocation?: NetworkLocationAddress | null;
    networkRules?: string;
    networkPresets?: Record<string, boolean>;
    whitelistLatencyMode?: boolean;
    latencyThresholdMs?: number;
  },
  localForceNetworkMode?: "auto" | "lan" | "wan" | "latency",
): {
  internalDomains: string;
  internalLocation: NetworkLocationAddress | null;
  networkRules: string;
  forceNetworkMode: "auto" | "lan" | "wan" | "latency";
  whitelistLatencyMode: boolean;
  latencyThresholdMs: number;
};

export function computeEffectiveNetworkMode(
  hostname: string,
  clientIp: string,
  clientIpSource: string,
  measuredLatencyMs: number,
  config?: {
    internalDomains?: string;
    internalLocation?: NetworkLocationAddress | null;
    currentLocation?: unknown;
    networkRules?: string;
    whitelistLatencyMode?: boolean;
    forceNetworkMode?: "auto" | "lan" | "wan" | "latency";
    latencyThresholdMs?: number;
  },
): { isLan: boolean; reason: string; measuredLatencyMs: number };
