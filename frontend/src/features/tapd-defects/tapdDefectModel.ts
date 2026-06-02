import type { WidgetConfig } from "@/types";
import {
  SD_WIDGET_SIZE_BY_KEY,
  resolveSdWidgetSize,
  toSdWidgetSizeKey,
  type SdWidgetSizeKey,
} from "@/features/sd-widgets/sdSizePresets";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  TAPD_ACTIONABLE_DEFECT_STATUS,
  TAPD_DEFECTS_CATALOG_ID,
  TAPD_DEFECTS_DATA_VERSION,
  TAPD_DEFECTS_DEFAULT_SIZE,
  TAPD_DEFECTS_RUNTIME,
  TAPD_DEFECTS_WIDGET_TYPE,
  TAPD_DEFECT_DEFAULT_FIELDS,
  type TapdBlockedBugSnapshot,
  type TapdCredentialType,
  type TapdDefectListItem,
  type TapdDefectQueryConfig,
  type TapdDefectSummary,
  type TapdDefectVisibilityScope,
  type TapdDefectWidgetData,
} from "./tapdDefectTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isTapdDefectSizeKey = (
  value: unknown,
): value is SdWidgetSizeKey =>
  typeof value === "string" &&
  SD_WIDGET_SIZE_BY_KEY.has(value as SdWidgetSizeKey);

const normalizeText = (value: unknown, fallback = "") => {
  if (typeof value !== "string") return fallback;
  const next = value.trim();
  return next || fallback;
};

const normalizeOptionalText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const normalizeNumber = (value: unknown, fallback: number, min = 0) => {
  const next = Math.round(Number(value));
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, next);
};

const normalizeLimit = (value: unknown): 30 | 50 | 100 | 200 =>
  value === 30 || value === 50 || value === 200 ? value : 100;

const normalizeRefreshInterval = (value: unknown) =>
  Math.min(1440, Math.max(1, normalizeNumber(value, 10, 1)));

const normalizeVisibilityScope = (
  value: unknown,
): TapdDefectVisibilityScope => {
  void value;
  return "owned-by-current-user";
};

const normalizeCredentialType = (
  value: unknown,
): TapdCredentialType | undefined =>
  value === "bearer" || value === "basic" ? value : undefined;

const normalizeFields = (value: unknown) => {
  const source = Array.isArray(value) ? value : TAPD_DEFECT_DEFAULT_FIELDS;
  const fields = source
    .filter((field): field is string => typeof field === "string")
    .map((field) => field.trim())
    .filter((field) => /^[A-Za-z0-9_]+$/.test(field))
    .slice(0, 40);
  return fields.length > 0 ? fields : [...TAPD_DEFECT_DEFAULT_FIELDS];
};

const normalizeCustomFields = (
  value: unknown,
): Record<string, string | number | boolean> | undefined => {
  if (!isObject(value)) return undefined;
  const entries = Object.entries(value)
    .filter(([key]) => /^custom_(plan_)?field_[A-Za-z0-9_]+$/.test(key))
    .filter(
      (entry): entry is [string, string | number | boolean] =>
        typeof entry[1] === "string" ||
        typeof entry[1] === "number" ||
        typeof entry[1] === "boolean",
    );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

export const normalizeTapdDefectQuery = (
  raw: unknown,
): TapdDefectQueryConfig => {
  const input = isObject(raw) ? raw : {};
  return {
    limit: normalizeLimit(input.limit),
    order: normalizeText(input.order, "modified desc"),
    fields: normalizeFields(input.fields),
    currentUser: normalizeOptionalText(input.currentUser),
    status: TAPD_ACTIONABLE_DEFECT_STATUS,
    vStatus: undefined,
    severity: normalizeOptionalText(input.severity),
    priorityLabel: normalizeOptionalText(input.priorityLabel),
    iterationId: normalizeOptionalText(input.iterationId),
    currentOwner:
      input.currentOwner === "current-user"
        ? "current-user"
        : normalizeOptionalText(input.currentOwner),
    reporter:
      input.reporter === "current-user"
        ? "current-user"
        : normalizeOptionalText(input.reporter),
    participator:
      input.participator === "current-user"
        ? "current-user"
        : normalizeOptionalText(input.participator),
    cc:
      input.cc === "current-user"
        ? "current-user"
        : normalizeOptionalText(input.cc),
    label: normalizeOptionalText(input.label),
    module: normalizeOptionalText(input.module),
    versionReport: normalizeOptionalText(input.versionReport),
    source: normalizeOptionalText(input.source),
    bugtype: normalizeOptionalText(input.bugtype),
    customFields: normalizeCustomFields(input.customFields),
  };
};

const normalizeListItem = (raw: unknown): TapdDefectListItem | undefined => {
  const input = isObject(raw) ? raw : {};
  const id = normalizeOptionalText(input.id);
  if (!id) return undefined;
  return {
    id,
    severity: normalizeText(input.severity, "--"),
    priorityLabel: normalizeOptionalText(input.priorityLabel),
    title: normalizeText(input.title, `缺陷 ${id}`),
    status: normalizeText(input.status, "--"),
    currentOwner: normalizeOptionalText(input.currentOwner),
    modified: normalizeOptionalText(input.modified),
    url: normalizeText(input.url, ""),
  };
};

export const normalizeTapdDefectSummary = (
  raw: unknown,
  workspaceId: string,
  scope: TapdDefectVisibilityScope,
  limit: 30 | 50 | 100 | 200,
): TapdDefectSummary => {
  const input = isObject(raw) ? raw : {};
  const hasLegacyProjectVisibleSummary =
    input.visibleScope === "project-visible";
  const status = hasLegacyProjectVisibleSummary
    ? "needs-config"
    : input.status === "connected" ||
        input.status === "syncing" ||
        input.status === "error"
      ? input.status
      : "needs-config";
  const items =
    !hasLegacyProjectVisibleSummary && Array.isArray(input.items)
      ? input.items.map(normalizeListItem).filter((item) => !!item)
      : [];
  return {
    status,
    workspaceId: normalizeText(input.workspaceId, workspaceId),
    projectName: normalizeOptionalText(input.projectName),
    total: hasLegacyProjectVisibleSummary ? 0 : normalizeNumber(input.total, 0),
    visibleTotal: hasLegacyProjectVisibleSummary
      ? 0
      : normalizeNumber(input.visibleTotal, 0),
    blockedTotal: normalizeNumber(input.blockedTotal, 0),
    verificationTotal: hasLegacyProjectVisibleSummary
      ? 0
      : normalizeNumber(input.verificationTotal, 0),
    critical: hasLegacyProjectVisibleSummary
      ? 0
      : normalizeNumber(input.critical, 0),
    assignedToCurrentUser: hasLegacyProjectVisibleSummary
      ? 0
      : normalizeNumber(input.assignedToCurrentUser, 0),
    visibleScope: normalizeVisibilityScope(input.visibleScope || scope),
    page: normalizeNumber(input.page, 1, 1),
    limit: normalizeLimit(input.limit || limit),
    lastSyncedAt: hasLegacyProjectVisibleSummary
      ? undefined
      : normalizeOptionalText(input.lastSyncedAt),
    errorCode: hasLegacyProjectVisibleSummary
      ? "legacy_project_scope_removed"
      : normalizeOptionalText(input.errorCode),
    items,
  };
};

const normalizeBlockedSnapshots = (raw: unknown): TapdBlockedBugSnapshot[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): TapdBlockedBugSnapshot | undefined => {
      const input = isObject(item) ? item : {};
      const id = normalizeOptionalText(input.id);
      if (!id) return undefined;
      return {
        id,
        title: normalizeText(input.title, `缺陷 ${id}`),
        blockedAt: normalizeOptionalText(input.blockedAt),
      } satisfies TapdBlockedBugSnapshot;
    })
    .filter((item): item is TapdBlockedBugSnapshot => !!item);
};

const normalizeBlockedIds = (raw: unknown) =>
  (Array.isArray(raw) ? raw : [])
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

export const resolveTapdDisplayName = (data: TapdDefectWidgetData) => {
  if (data.displayName) return data.displayName;
  if (data.projectName) return `${data.projectName}缺陷`;
  if (data.workspaceId) return `TAPD 缺陷 · ${data.workspaceId}`;
  return "TAPD 缺陷";
};

export const hasTapdDefectConnection = (data: TapdDefectWidgetData) =>
  Boolean(data.workspaceId.trim()) && data.hasServerCredential === true;

export const normalizeTapdDefectWidgetData = (
  raw: unknown,
): TapdDefectWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isTapdDefectSizeKey(input.sizeKey)
    ? input.sizeKey
    : TAPD_DEFECTS_DEFAULT_SIZE;
  const query = normalizeTapdDefectQuery(input.query);
  const workspaceId = normalizeText(input.workspaceId);
  const projectName = normalizeText(input.projectName);
  const visibilityScope = normalizeVisibilityScope(input.visibilityScope);
  return {
    runtime: TAPD_DEFECTS_RUNTIME,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    version: TAPD_DEFECTS_DATA_VERSION,
    sizeKey,
    workspaceId,
    projectName,
    displayName: normalizeOptionalText(input.displayName),
    visibilityScope,
    query,
    blockedBugIds: normalizeBlockedIds(input.blockedBugIds),
    blockedBugSnapshots: normalizeBlockedSnapshots(input.blockedBugSnapshots),
    refreshIntervalMinutes: normalizeRefreshInterval(
      input.refreshIntervalMinutes,
    ),
    hasServerCredential: input.hasServerCredential === true,
    credentialType: normalizeCredentialType(input.credentialType),
    credentialAccountHint: normalizeOptionalText(input.credentialAccountHint),
    tapdBaseUrl: normalizeText(input.tapdBaseUrl, "https://www.tapd.cn"),
    catalogPreview: input.catalogPreview === true,
    lastSummary: normalizeTapdDefectSummary(
      input.lastSummary,
      workspaceId,
      visibilityScope,
      query.limit,
    ),
  };
};

export const createDefaultTapdDefectWidget = (): WidgetConfig => {
  const size = resolveSdWidgetSize(TAPD_DEFECTS_DEFAULT_SIZE);
  return {
    id: TAPD_DEFECTS_CATALOG_ID,
    type: TAPD_DEFECTS_WIDGET_TYPE,
    enable: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: normalizeTapdDefectWidgetData({}),
  };
};

export const applyTapdDefectSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: SdWidgetSizeKey,
) => {
  const size = resolveSdWidgetSize(sizeKey);
  const data = normalizeTapdDefectWidgetData(widget.data);
  widget.type = TAPD_DEFECTS_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies TapdDefectWidgetData;
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncTapdDefectSizeFromWidgetSpans = (widget: WidgetConfig) => {
  const sizeKey = toSdWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applyTapdDefectSizeToWidget(widget, sizeKey);
};

export const scopeLabel = (scope: TapdDefectVisibilityScope) => {
  void scope;
  return "处理中的";
};

export const buildTapdFilters = (query: TapdDefectQueryConfig) => ({
  status: TAPD_ACTIONABLE_DEFECT_STATUS,
  vStatus: undefined,
  severity: query.severity,
  priorityLabel: query.priorityLabel,
  iterationId: query.iterationId,
  currentOwner:
    query.currentOwner === "current-user"
      ? query.currentUser
      : query.currentOwner,
  reporter:
    query.reporter === "current-user" ? query.currentUser : query.reporter,
  participator:
    query.participator === "current-user"
      ? query.currentUser
      : query.participator,
  cc: query.cc === "current-user" ? query.currentUser : query.cc,
  label: query.label,
  module: query.module,
  versionReport: query.versionReport,
  source: query.source,
  bugtype: query.bugtype,
  customFields: query.customFields,
});

export const isTapdReopenedStatus = (status: string) => {
  const value = status.trim().toLowerCase();
  return value === "reopened" || value === "重新打开";
};

export const tapdDefectStatusLabel = (status: string) => {
  const value = status.trim().toLowerCase();
  if (
    value === "new" ||
    value === "open" ||
    value === "opened" ||
    value === "新" ||
    value === "新建" ||
    value === "已打开" ||
    value === "打开"
  ) {
    return "新建";
  }
  if (value === "assigned" || value === "已分配") {
    return "已分配";
  }
  if (value === "accepted" || value === "接受" || value === "已接受") {
    return "已接受";
  }
  if (
    value === "in_progress" ||
    value === "in progress" ||
    value === "processing" ||
    value === "处理中" ||
    value === "接受处理" ||
    value === "接受/处理" ||
    value === "接受/处理中"
  ) {
    return "处理中";
  }
  if (value === "reopened" || value === "重新打开") {
    return "重新打开";
  }
  return status || "--";
};

export const tapdErrorMessage = (code?: string) => {
  switch (code) {
    case "current_user_required":
      return "请在配置参数里填写 TAPD 用户名";
    case "server_credential_missing":
      return "请先保存 TAPD 服务端凭据";
    case "reauth_required":
      return "TAPD 凭据已失效，请重新保存";
    case "upstream_forbidden":
      return "TAPD 凭据权限不足";
    case "upstream_rate_limited":
      return "TAPD 接口限流，请稍后重试";
    case "upstream_unreachable":
      return "无法连接 TAPD 服务";
    case "upstream_error":
      return "TAPD 服务返回异常";
    case "source_shape_changed":
      return "TAPD 返回格式已变化";
    default:
      return code || "同步失败";
  }
};

const tapdErrorSummaryKey = (summary: TapdDefectSummary) =>
  JSON.stringify({
    status: summary.status,
    workspaceId: summary.workspaceId,
    projectName: summary.projectName,
    total: summary.total,
    visibleTotal: summary.visibleTotal,
    blockedTotal: summary.blockedTotal,
    verificationTotal: summary.verificationTotal,
    critical: summary.critical,
    assignedToCurrentUser: summary.assignedToCurrentUser,
    visibleScope: summary.visibleScope,
    page: summary.page,
    limit: summary.limit,
    errorCode: summary.errorCode,
    items: summary.items,
  });

export const isDuplicateTapdErrorSummary = (
  current: TapdDefectSummary | undefined,
  next: TapdDefectSummary,
) =>
  current?.status === "error" &&
  next.status === "error" &&
  tapdErrorSummaryKey(current) === tapdErrorSummaryKey(next);
