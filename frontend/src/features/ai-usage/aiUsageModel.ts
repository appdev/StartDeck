import type { WidgetConfig } from "@/types";
import {
  ITAB_WIDGET_SIZE_BY_KEY,
  resolveItabWidgetSize,
  toItabWidgetSizeKey,
  type ItabWidgetSizeKey,
} from "@/features/itab-widgets/itabSizePresets";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  AI_USAGE_CATALOG_ID,
  AI_USAGE_DATA_VERSION,
  AI_USAGE_DEFAULT_SIZE,
  AI_USAGE_RUNTIME,
  AI_USAGE_WIDGET_TYPE,
  type AiUsageCredentialStorage,
  type AiUsageCredentialType,
  type AiUsageProviderSummary,
  type AiUsageWidgetData,
} from "./aiUsageTypes";
import { getAiUsageProvider } from "./aiUsageProviders";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isAiUsageSizeKey = (value: unknown): value is ItabWidgetSizeKey =>
  typeof value === "string" &&
  ITAB_WIDGET_SIZE_BY_KEY.has(value as ItabWidgetSizeKey);

const normalizeText = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;
  const next = value.trim();
  return next || fallback;
};

const normalizeOptionalText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const normalizeRefreshInterval = (value: unknown) => {
  const minutes = Math.round(Number(value));
  if (!Number.isFinite(minutes)) return 5;
  return Math.min(1440, Math.max(1, minutes));
};

const normalizeCredentialStorage = (
  value: unknown,
): AiUsageCredentialStorage =>
  value === "once" || value === "server" ? value : "browser";

const normalizeCredentialType = (
  value: unknown,
): AiUsageCredentialType | undefined =>
  value === "session_cookie" ? "session_cookie" : "access_token";

const normalizePercent = (value: unknown): number | null => {
  if (value === null) return null;
  const next = Number(value);
  if (!Number.isFinite(next)) return null;
  return Math.min(100, Math.max(0, Math.round(next * 10) / 10));
};

export const normalizeAiUsageSummary = (
  raw: unknown,
  providerId: string,
): AiUsageProviderSummary => {
  const input = isObject(raw) ? raw : {};
  const status =
    input.status === "connected" ||
    input.status === "syncing" ||
    input.status === "error"
      ? input.status
      : "needs-config";
  return {
    providerId,
    status,
    primaryRemainingPercent: normalizePercent(input.primaryRemainingPercent),
    weeklyRemainingPercent: normalizePercent(input.weeklyRemainingPercent),
    primaryResetLabel: normalizeOptionalText(input.primaryResetLabel),
    weeklyResetLabel: normalizeOptionalText(input.weeklyResetLabel),
    lastSyncedAt: normalizeOptionalText(input.lastSyncedAt),
    errorCode: normalizeOptionalText(input.errorCode),
  };
};

export const normalizeAiUsageWidgetData = (raw: unknown): AiUsageWidgetData => {
  const input = isObject(raw) ? raw : {};
  const providerId = normalizeText(input.providerId, "openai");
  const provider = getAiUsageProvider(providerId);
  const sizeKey = isAiUsageSizeKey(input.sizeKey)
    ? input.sizeKey
    : AI_USAGE_DEFAULT_SIZE;
  const credentialStorage = normalizeCredentialStorage(input.credentialStorage);
  const summary = normalizeAiUsageSummary(input.lastSummary, provider.id);

  return {
    runtime: AI_USAGE_RUNTIME,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    version: AI_USAGE_DATA_VERSION,
    sizeKey,
    providerId: provider.id,
    displayName: normalizeText(input.displayName, provider.defaultDisplayName),
    accountLabel: normalizeOptionalText(input.accountLabel),
    iconKey: provider.iconKey,
    defaultWindow: input.defaultWindow === "weekly" ? "weekly" : "primary",
    refreshIntervalMinutes: normalizeRefreshInterval(
      input.refreshIntervalMinutes,
    ),
    credentialStorage,
    credentialType: normalizeCredentialType(input.credentialType),
    hasServerCredential: input.hasServerCredential === true,
    accountIdHint: normalizeOptionalText(input.accountIdHint),
    lastSummary: summary,
  };
};

export const createDefaultAiUsageWidget = (
  providerId = "openai",
): WidgetConfig => {
  const size = resolveItabWidgetSize(AI_USAGE_DEFAULT_SIZE);
  return {
    id: AI_USAGE_CATALOG_ID,
    type: AI_USAGE_WIDGET_TYPE,
    enable: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: normalizeAiUsageWidgetData({ providerId }),
  };
};

export const applyAiUsageSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: ItabWidgetSizeKey,
) => {
  const size = resolveItabWidgetSize(sizeKey);
  const data = normalizeAiUsageWidgetData(widget.data);
  widget.type = AI_USAGE_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies AiUsageWidgetData;
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncAiUsageSizeFromWidgetSpans = (widget: WidgetConfig) => {
  const sizeKey = toItabWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applyAiUsageSizeToWidget(widget, sizeKey);
};
