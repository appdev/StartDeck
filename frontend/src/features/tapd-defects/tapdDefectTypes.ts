import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";

export const TAPD_DEFECTS_WIDGET_TYPE = "tapd-defects";
export const TAPD_DEFECTS_CATALOG_ID = "tapd-defects";
export const TAPD_DEFECTS_RUNTIME = "tapd-defects";
export const TAPD_DEFECTS_DATA_VERSION = 1;
export const TAPD_DEFECTS_DEFAULT_SIZE: SdWidgetSizeKey = "2x2";
export const TAPD_ACTIONABLE_DEFECT_STATUS_VALUES = [
  "new",
  "assigned",
  "in_progress",
  "reopened",
] as const;
export const TAPD_ACTIONABLE_DEFECT_STATUS =
  TAPD_ACTIONABLE_DEFECT_STATUS_VALUES.join("|");
export const TAPD_ACTIONABLE_DEFECT_STATUS_LABEL =
  "新建 / 已分配 / 处理中 / 重新打开";

export type TapdCredentialType = "basic" | "bearer";
export type TapdDefectVisibilityScope =
  | "owned-by-current-user"
  | "created-by-current-user"
  | "participated-by-current-user"
  | "cc-to-current-user";
export type TapdDefectSyncStatus =
  | "connected"
  | "needs-config"
  | "syncing"
  | "error";

export const TAPD_DEFECT_DEFAULT_FIELDS = [
  "id",
  "title",
  "severity",
  "priority_label",
  "status",
  "current_owner",
  "modified",
  "workspace_id",
  "label",
] as const;

export interface TapdDefectQueryConfig {
  limit: 30 | 50 | 100 | 200;
  order: string;
  fields: string[];
  currentUser?: string;
  status?: string;
  vStatus?: string;
  severity?: string;
  priorityLabel?: string;
  iterationId?: string;
  currentOwner?: "current-user" | string;
  reporter?: "current-user" | string;
  participator?: "current-user" | string;
  cc?: "current-user" | string;
  label?: string;
  module?: string;
  versionReport?: string;
  source?: string;
  bugtype?: string;
  customFields?: Record<string, string | number | boolean>;
}

export interface TapdBlockedBugSnapshot {
  id: string;
  title: string;
  blockedAt?: string;
}

export interface TapdDefectListItem {
  id: string;
  severity: string;
  priorityLabel?: string;
  title: string;
  status: string;
  currentOwner?: string;
  modified?: string;
  url: string;
}

export interface TapdDefectSummary {
  status: TapdDefectSyncStatus;
  workspaceId: string;
  projectName?: string;
  total: number;
  visibleTotal: number;
  blockedTotal: number;
  verificationTotal: number;
  critical: number;
  assignedToCurrentUser: number;
  visibleScope: TapdDefectVisibilityScope;
  page: number;
  limit: number;
  lastSyncedAt?: string;
  errorCode?: string;
  items: TapdDefectListItem[];
}

export interface TapdDefectWidgetData {
  runtime: typeof TAPD_DEFECTS_RUNTIME;
  layoutSystem?: string;
  version: typeof TAPD_DEFECTS_DATA_VERSION;
  sizeKey: SdWidgetSizeKey;
  workspaceId: string;
  projectName: string;
  displayName?: string;
  visibilityScope: TapdDefectVisibilityScope;
  query: TapdDefectQueryConfig;
  blockedBugIds: string[];
  blockedBugSnapshots: TapdBlockedBugSnapshot[];
  refreshIntervalMinutes: number;
  hasServerCredential?: boolean;
  credentialType?: TapdCredentialType;
  credentialAccountHint?: string;
  tapdBaseUrl: string;
  catalogPreview?: boolean;
  lastSummary?: TapdDefectSummary;
}

export interface TapdConfigSaveOptions {
  close?: boolean;
}

export interface TapdCredentialStatus {
  hasServerCredential: boolean;
  widgetId: string;
  credentialType?: TapdCredentialType;
  accountHint?: string;
  updatedAt?: number;
}

export interface TapdCredentialPayload {
  credentialType: TapdCredentialType;
  apiUser?: string;
  apiPassword?: string;
  accessToken?: string;
  serverStorageAcknowledged: boolean;
}

export interface TapdWorkspaceResponse {
  status: "connected" | "error";
  workspaceId: string;
  projectName?: string;
  fallbackName: string;
  errorCode?: string;
}

export interface TapdDefectsQueryRequest {
  widgetId: string;
  workspaceId: string;
  page: number;
  limit: 30 | 50 | 100 | 200;
  order: string;
  fields: string[];
  visibilityScope: TapdDefectVisibilityScope;
  currentUser?: string;
  filters: {
    status?: string;
    vStatus?: string;
    severity?: string;
    priorityLabel?: string;
    iterationId?: string;
    currentOwner?: string;
    reporter?: string;
    participator?: string;
    cc?: string;
    label?: string;
    module?: string;
    versionReport?: string;
    source?: string;
    bugtype?: string;
    customFields?: Record<string, string | number | boolean>;
  };
  blockedBugIds: string[];
}
