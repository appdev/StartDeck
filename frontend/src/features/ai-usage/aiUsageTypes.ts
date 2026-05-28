import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";

export const AI_USAGE_WIDGET_TYPE = "ai-usage";
export const AI_USAGE_CATALOG_ID = "ai-usage";
export const AI_USAGE_RUNTIME = "ai-usage";
export const AI_USAGE_DATA_VERSION = 1;
export const AI_USAGE_DEFAULT_SIZE: ItabWidgetSizeKey = "2x2";

export type AiUsageProviderId = "openai" | "claude" | "deepseek" | string;
export type AiUsageCredentialType = "access_token" | "session_cookie";
export type AiUsageCredentialStorage = "once" | "browser" | "server";
export type AiUsageQuerySupport = "available" | "planned";
export type AiUsageStatus = "connected" | "needs-config" | "error" | "syncing";

export interface AiUsageProviderDefinition {
  id: AiUsageProviderId;
  name: string;
  iconKey: string;
  iconUrl: string;
  querySupport: AiUsageQuerySupport;
  defaultDisplayName: string;
}

export interface AiUsageProviderSummary {
  providerId: string;
  status: AiUsageStatus;
  primaryRemainingPercent: number | null;
  weeklyRemainingPercent: number | null;
  primaryResetLabel?: string;
  weeklyResetLabel?: string;
  lastSyncedAt?: string;
  errorCode?: string;
}

export interface AiUsageWidgetData {
  runtime: typeof AI_USAGE_RUNTIME;
  layoutSystem?: string;
  version: typeof AI_USAGE_DATA_VERSION;
  sizeKey: ItabWidgetSizeKey;
  providerId: AiUsageProviderId;
  displayName: string;
  accountLabel?: string;
  iconKey: string;
  defaultWindow: "primary" | "weekly";
  refreshIntervalMinutes: number;
  credentialStorage: AiUsageCredentialStorage;
  credentialType?: AiUsageCredentialType;
  hasServerCredential?: boolean;
  accountIdHint?: string;
  lastSummary?: AiUsageProviderSummary;
}

export interface AiUsageQueryRequest {
  widgetId: string;
  providerId: string;
  credentialStorage: AiUsageCredentialStorage;
  credentialType?: AiUsageCredentialType;
  credential?: string;
  accountId?: string;
}

export interface AiUsageCredentialPayload {
  credentialType: AiUsageCredentialType;
  credential: string;
  accountId?: string;
  serverStorageAcknowledged: boolean;
}

export interface AiUsageCredentialStatus {
  hasServerCredential: boolean;
  providerId: string;
  widgetId: string;
  credentialType?: AiUsageCredentialType;
  accountIdHint?: string;
  updatedAt?: number;
}
