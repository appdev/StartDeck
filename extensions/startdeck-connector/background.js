const DEFAULT_ALLOWED_ORIGINS = [
  "https://start.zsl.one",
  "https://start.put.run",
  "http://127.0.0.1:9003",
  "http://localhost:9003"
];
const CHATGPT_BASE_URL = "https://chatgpt.com";
const TAPD_API_BASE_URL = "https://api.tapd.cn";
const ACTIONABLE_STATUS = "new|assigned|in_progress|reopened";
const MAX_REMOTE_ICON_BYTES = 5 * 1024 * 1024;
const SUPPORTED_ICON_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/x-icon"
]);
const DEFAULT_FIELDS = [
  "id",
  "title",
  "severity",
  "priority_label",
  "status",
  "current_owner",
  "modified",
  "workspace_id",
  "label"
];

const ok = (data) => ({ ok: true, data });
const fail = (code, message) => ({ ok: false, error: { code, message } });

const getAllowedOrigins = async () => {
  const result = await chrome.storage.sync.get({
    allowedOrigins: DEFAULT_ALLOWED_ORIGINS
  });
  return Array.isArray(result.allowedOrigins)
    ? result.allowedOrigins
    : DEFAULT_ALLOWED_ORIGINS;
};

chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.sync.get({ allowedOrigins: undefined });
  if (!Array.isArray(result.allowedOrigins)) {
    await chrome.storage.sync.set({ allowedOrigins: DEFAULT_ALLOWED_ORIGINS });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "startdeck-connector-action") return false;
  handleAction(message)
    .then((response) => sendResponse(response))
    .catch((error) =>
      sendResponse(
        fail(error?.code || "connector_error", error?.message || undefined)
      )
    );
  return true;
});

const handleAction = async ({ origin, action, payload }) => {
  const allowedOrigins = await getAllowedOrigins();
  if (!allowedOrigins.includes(origin)) return fail("origin_not_allowed");
  if (action === "ping") return ok({ status: "ok", version: 1 });
  if (action === "aiUsage.query") return ok(await queryAiUsage(payload || {}));
  if (action === "tapdDefects.query") {
    return ok(await queryTapdDefects(payload || {}));
  }
  if (action === "tapdDefects.workspace") {
    return ok(await resolveTapdWorkspace(payload || {}));
  }
  if (action === "icons.fetchRemoteImage") {
    return ok(await fetchRemoteIconImage(payload || {}));
  }
  return fail("action_not_allowed");
};

const nowIso = () => new Date().toISOString();

const fetchRemoteIconImage = async (payload) => {
  const url = normalizeRemoteIconUrl(payload.url);
  const maxBytes = normalizeMaxBytes(payload.maxBytes);
  let response;
  try {
    response = await fetch(url, {
      credentials: "omit",
      cache: "no-store",
      redirect: "follow"
    });
  } catch {
    throw { code: "upstream_unreachable" };
  }
  if (!response.ok) throw { code: "upstream_error" };
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw { code: "icon_too_large" };
  }
  const buffer = await response.arrayBuffer().catch(() => null);
  if (!buffer) throw { code: "remote_icon_read_failed" };
  const bytes = new Uint8Array(buffer);
  if (bytes.length <= 0) throw { code: "empty_icon" };
  if (bytes.length > maxBytes) throw { code: "icon_too_large" };

  const declaredType = normalizeIconContentType(
    response.headers.get("content-type")
  );
  const contentType = sniffIconContentType(bytes) || declaredType;
  if (!contentType || !SUPPORTED_ICON_CONTENT_TYPES.has(contentType)) {
    throw { code: "unsupported_icon_type" };
  }

  return {
    url,
    contentType,
    byteSize: bytes.length,
    dataUrl: `data:${contentType};base64,${bytesToBase64(bytes)}`
  };
};

const normalizeMaxBytes = (value) => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return MAX_REMOTE_ICON_BYTES;
  return Math.min(MAX_REMOTE_ICON_BYTES, parsed);
};

const normalizeRemoteIconUrl = (raw) => {
  const text = String(raw || "").trim();
  if (!text) throw { code: "invalid_url" };
  let url;
  try {
    url = new URL(text);
  } catch {
    throw { code: "invalid_url" };
  }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
    throw { code: "unsupported_protocol" };
  }
  if (url.username || url.password) throw { code: "credential_url_rejected" };
  if (isBlockedRemoteIconHost(url.hostname)) throw { code: "blocked_host" };
  url.hash = "";
  return url.href;
};

const isBlockedRemoteIconHost = (hostname) => {
  const host = String(hostname || "")
    .trim()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\.$/, "")
    .toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return true;
  }
  if (isBlockedIpv4Host(host)) return true;
  if (isBlockedIpv6Host(host)) return true;
  return false;
};

const isBlockedIpv4Host = (host) => {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => {
    if (!/^\d+$/.test(part)) return Number.NaN;
    const value = Number(part);
    return value >= 0 && value <= 255 ? value : Number.NaN;
  });
  if (octets.some((value) => !Number.isFinite(value))) return false;
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
};

const isBlockedIpv6Host = (host) => {
  if (!host.includes(":")) return false;
  if (host === "::1" || host === "::" || host.startsWith("fe80:")) return true;
  const first = host.split(":")[0];
  if (!first) return false;
  const value = Number.parseInt(first, 16);
  if (!Number.isFinite(value)) return false;
  return (value & 0xfe00) === 0xfc00 || (value & 0xff00) === 0xff00;
};

const normalizeIconContentType = (value) => {
  const contentType = String(value || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType === "image/vnd.microsoft.icon") return "image/x-icon";
  return contentType;
};

const sniffIconContentType = (bytes) => {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x00 &&
    bytes[1] === 0x00 &&
    bytes[2] === 0x01 &&
    bytes[3] === 0x00
  ) {
    return "image/x-icon";
  }
  const textPrefix = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.slice(0, 256))
    .trimStart()
    .toLowerCase();
  if (textPrefix.startsWith("<svg") || textPrefix.startsWith("<?xml")) {
    return "image/svg+xml";
  }
  return undefined;
};

const bytesToBase64 = (bytes) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

const errorAiUsage = (providerId, code) => ({
  providerId,
  status: "error",
  primaryRemainingPercent: null,
  weeklyRemainingPercent: null,
  lastSyncedAt: nowIso(),
  errorCode: code
});

const queryAiUsage = async (payload) => {
  const providerId = String(payload.providerId || "openai").trim();
  if (providerId !== "openai") return errorAiUsage(providerId, "provider_query_planned");
  if (payload.credentialStorage === "server") {
    return errorAiUsage(providerId, "connector_credential_missing");
  }
  const credentialType = payload.credentialType || "access_token";
  const credential = String(payload.credential || "").trim();
  if (!credential) return errorAiUsage(providerId, "credential_required");

  try {
    const accessToken =
      credentialType === "session_cookie"
        ? await exchangeChatGptSessionCookie(credential)
        : credential;
    const headers = { Authorization: `Bearer ${accessToken}` };
    if (payload.accountId) {
      headers["ChatGPT-Account-Id"] = String(payload.accountId).trim();
    }
    const response = await fetch(`${CHATGPT_BASE_URL}/backend-api/wham/usage`, {
      headers
    });
    const mapped = mapUpstreamStatus(response.status);
    if (mapped) return errorAiUsage(providerId, mapped);
    const data = await response.json();
    const summary = parseOpenAiUsage(data);
    return {
      providerId,
      status: "connected",
      primaryRemainingPercent: summary.primaryRemainingPercent,
      weeklyRemainingPercent: summary.weeklyRemainingPercent,
      primaryResetLabel: summary.primaryResetLabel,
      weeklyResetLabel: summary.weeklyResetLabel,
      lastSyncedAt: nowIso()
    };
  } catch (error) {
    return errorAiUsage(providerId, error?.code || "upstream_unreachable");
  }
};

const exchangeChatGptSessionCookie = async (cookie) => {
  const response = await fetch(`${CHATGPT_BASE_URL}/api/auth/session`, {
    headers: { Cookie: normalizeChatGptCookieHeader(cookie) }
  });
  const mapped = mapUpstreamStatus(response.status);
  if (mapped) throw { code: mapped };
  const data = await response.json();
  const token = String(data.accessToken || data.access_token || "").trim();
  if (!token) throw { code: "reauth_required" };
  return token;
};

const normalizeChatGptCookieHeader = (raw) => {
  const trimmed = String(raw || "").trim().replace(/^Cookie:\s*/i, "");
  return trimmed.includes("=")
    ? trimmed
    : `__Secure-next-auth.session-token=${trimmed}`;
};

const mapUpstreamStatus = (status) => {
  if (status === 401) return "reauth_required";
  if (status === 403) return "upstream_forbidden";
  if (status === 429) return "upstream_rate_limited";
  if (status < 200 || status >= 300) return "upstream_error";
  return null;
};

const parseOpenAiUsage = (payload) => {
  const rateLimit = payload?.usage?.rate_limit || payload?.rate_limit;
  const primary = rateLimit?.primary_window;
  const weekly = rateLimit?.secondary_window;
  if (!primary && !weekly) throw { code: "source_shape_changed" };
  return {
    primaryRemainingPercent: remainingPercent(primary),
    weeklyRemainingPercent: remainingPercent(weekly),
    primaryResetLabel: resetLabel(primary),
    weeklyResetLabel: resetLabel(weekly)
  };
};

const numberField = (value, key) => {
  const raw = value?.[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const clampPercent = (value) => Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;

const remainingPercent = (windowValue) => {
  if (!windowValue) return null;
  const remaining = numberField(windowValue, "remaining_percent");
  if (remaining !== undefined) return clampPercent(remaining);
  const used = numberField(windowValue, "used_percent");
  if (used !== undefined) return clampPercent(100 - used);
  if (windowValue.limit_reached === true) return 0;
  return null;
};

const resetLabel = (windowValue) => {
  if (!windowValue) return undefined;
  const resetAt = numberField(windowValue, "reset_at");
  if (resetAt !== undefined) {
    const millis = resetAt > 10000000000 ? resetAt : resetAt * 1000;
    return new Date(millis).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  }
  const seconds = numberField(windowValue, "reset_after_seconds");
  if (seconds === undefined) return undefined;
  const totalMinutes = Math.max(0, Math.ceil(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `约${hours}小时${minutes}分后` : `约${minutes}分钟后`;
};

const queryTapdDefects = async (payload) => {
  const workspaceId = sanitizeWorkspaceId(payload.workspaceId);
  const credential = normalizeTapdCredential(payload.credential);
  if (!credential) return errorTapd(payload, "connector_credential_missing");
  const currentUser = await resolveCurrentTapdUser(credential, payload.currentUser);
  if (!currentUser) return errorTapd(payload, "current_user_required");
  const query = normalizeTapdQuery(payload, workspaceId, currentUser);

  try {
    const params = tapdQueryParams(query);
    const bugsParams = new URLSearchParams(params);
    bugsParams.set("limit", String(query.limit));
    bugsParams.set("page", String(query.page));
    bugsParams.set("order", query.order);
    bugsParams.set("fields", query.fields.join(","));
    const bugsPayload = await sendTapdJson(
      `${TAPD_API_BASE_URL}/bugs?${bugsParams.toString()}`,
      credential
    );
    const countPayload = await sendTapdJson(
      `${TAPD_API_BASE_URL}/bugs/count?${new URLSearchParams(params).toString()}`,
      credential
    );
    const total = parseTapdCount(countPayload);
    const allItems = parseTapdBugs(bugsPayload, query.workspaceId);
    const visibleItems = allItems
      .filter((item) => isActionableStatus(item.status))
      .filter((item) => !query.blockedBugIds.has(item.id));
    const projectName = await fetchTapdWorkspaceName(query.workspaceId, credential).catch(
      () => undefined
    );
    return {
      status: "connected",
      workspaceId: query.workspaceId,
      projectName,
      total,
      visibleTotal: Math.max(0, total - query.blockedBugIds.size),
      blockedTotal: query.blockedBugIds.size,
      verificationTotal: visibleItems.filter(isVerificationPending).length,
      critical: visibleItems.filter(isCritical).length,
      assignedToCurrentUser: visibleItems.filter((item) =>
        String(item.currentOwner || "")
          .split(";")
          .some((part) => part.trim() === currentUser)
      ).length,
      visibleScope: "owned-by-current-user",
      page: query.page,
      limit: query.limit,
      lastSyncedAt: nowIso(),
      items: visibleItems
    };
  } catch (error) {
    return errorTapd(payload, error?.code || "upstream_unreachable");
  }
};

const resolveTapdWorkspace = async (payload) => {
  const workspaceId = sanitizeWorkspaceId(payload.workspaceId);
  const credential = normalizeTapdCredential(payload.credential);
  const fallbackName = `TAPD 缺陷 · ${workspaceId}`;
  if (!credential) {
    return {
      status: "error",
      workspaceId,
      fallbackName,
      errorCode: "connector_credential_missing"
    };
  }
  try {
    const projectName = await fetchTapdWorkspaceName(workspaceId, credential);
    return {
      status: "connected",
      workspaceId,
      projectName,
      fallbackName
    };
  } catch (error) {
    return {
      status: "error",
      workspaceId,
      fallbackName,
      errorCode: error?.code || "upstream_unreachable"
    };
  }
};

const sanitizeWorkspaceId = (value) => {
  const workspaceId = String(value || "").trim();
  if (!/^\d{3,18}$/.test(workspaceId)) throw { code: "invalid_workspace_id" };
  return workspaceId;
};

const normalizeTapdCredential = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  if (raw.credentialType === "basic") {
    const apiUser = String(raw.apiUser || "").trim();
    const apiPassword = String(raw.apiPassword || "");
    return apiUser && apiPassword
      ? { credentialType: "basic", apiUser, apiPassword }
      : null;
  }
  if (raw.credentialType === "bearer") {
    const accessToken = String(raw.accessToken || "").trim();
    return accessToken ? { credentialType: "bearer", accessToken } : null;
  }
  return null;
};

const tapdAuthHeaders = (credential) => {
  if (credential.credentialType === "basic") {
    return {
      Authorization: `Basic ${btoa(`${credential.apiUser}:${credential.apiPassword}`)}`
    };
  }
  return { Authorization: `Bearer ${credential.accessToken}` };
};

const sendTapdJson = async (url, credential) => {
  const response = await fetch(url, { headers: tapdAuthHeaders(credential) });
  const mapped = mapUpstreamStatus(response.status);
  const payload = await response.json().catch(() => null);
  if (mapped) throw { code: mapped };
  const status = Number(payload?.status ?? 0);
  if (status !== 1) throw classifyTapdPayloadError(payload);
  return payload;
};

const classifyTapdPayloadError = (payload) => {
  const info = String(payload?.info || "").toLowerCase();
  if (
    info.includes("token") &&
    (info.includes("invalid") || info.includes("expired") || info.includes("unauthorized"))
  ) {
    return { code: "reauth_required" };
  }
  return { code: "upstream_error" };
};

const resolveCurrentTapdUser = async (credential, raw) => {
  const configured = normalizeParamText(raw);
  if (configured) return configured;
  if (credential.credentialType === "basic") return credential.apiUser;
  const payload = await sendTapdJson(`${TAPD_API_BASE_URL}/users/info`, credential);
  return normalizeParamText(payload?.data?.nick) || normalizeParamText(payload?.data?.id);
};

const normalizeTapdQuery = (payload, workspaceId, currentUser) => ({
  workspaceId,
  page: Math.max(1, Math.round(Number(payload.page) || 1)),
  limit: Math.min(200, Math.max(1, Math.round(Number(payload.limit) || 100))),
  order: normalizeOrder(payload.order) || "modified desc",
  fields: normalizeFields(payload.fields),
  currentUser,
  filters: payload.filters && typeof payload.filters === "object" ? payload.filters : {},
  blockedBugIds: new Set(
    Array.isArray(payload.blockedBugIds)
      ? payload.blockedBugIds.map((value) => String(value).trim()).filter(Boolean)
      : []
  )
});

const normalizeOrder = (raw) => {
  const text = String(raw || "").trim();
  return /^[A-Za-z0-9_]+(?:\s+(?:asc|desc))?$/i.test(text) ? text : undefined;
};

const normalizeFields = (raw) => {
  const source = Array.isArray(raw) ? raw : DEFAULT_FIELDS;
  const fields = source
    .map((field) => String(field).trim())
    .filter((field) => /^[A-Za-z0-9_]+$/.test(field))
    .slice(0, 40);
  return fields.length > 0 ? fields : DEFAULT_FIELDS;
};

const normalizeParamText = (value) => {
  const text = String(value || "").trim();
  return text || undefined;
};

const tapdQueryParams = (query) => {
  const params = new URLSearchParams({ workspace_id: query.workspaceId });
  const filters = [
    ["status", ACTIONABLE_STATUS],
    ["severity", query.filters.severity],
    ["priority_label", query.filters.priorityLabel],
    ["iteration_id", query.filters.iterationId],
    ["current_owner", query.filters.currentOwner || query.currentUser],
    ["reporter", query.filters.reporter],
    ["participator", query.filters.participator],
    ["cc", query.filters.cc],
    ["label", query.filters.label],
    ["module", query.filters.module],
    ["version_report", query.filters.versionReport],
    ["source", query.filters.source],
    ["bugtype", query.filters.bugtype]
  ];
  for (const [name, value] of filters) {
    const text = normalizeParamText(value);
    if (text) params.set(name, text);
  }
  const customFields = query.filters.customFields;
  if (customFields && typeof customFields === "object") {
    for (const [name, value] of Object.entries(customFields)) {
      if (!/^custom_(plan_)?field_[A-Za-z0-9_]+$/.test(name)) continue;
      const text = normalizeParamText(value);
      if (text) params.set(name, text);
    }
  }
  return params;
};

const parseTapdCount = (payload) => {
  const value = payload?.data?.count;
  const count = Number(value);
  if (!Number.isFinite(count)) throw { code: "source_shape_changed" };
  return Math.max(0, Math.round(count));
};

const parseTapdBugs = (payload, workspaceId) => {
  if (!Array.isArray(payload?.data)) throw { code: "source_shape_changed" };
  return payload.data
    .map((row) => row?.Bug || row)
    .map((bug) => normalizeTapdBug(bug, workspaceId))
    .filter(Boolean);
};

const textField = (value, name) => {
  const raw = value?.[name];
  if (raw === undefined || raw === null) return undefined;
  const text = String(raw).trim();
  return text || undefined;
};

const normalizeTapdBug = (bug, workspaceId) => {
  const id = textField(bug, "id");
  if (!id) return undefined;
  return {
    id,
    severity: textField(bug, "severity") || "--",
    priorityLabel: textField(bug, "priority_label") || textField(bug, "priority"),
    title: textField(bug, "title") || `缺陷 ${id}`,
    status: textField(bug, "status") || textField(bug, "v_status") || "--",
    currentOwner: textField(bug, "current_owner"),
    modified: textField(bug, "modified") || textField(bug, "lastmodify"),
    url: `https://www.tapd.cn/${workspaceId}/bugtrace/bugs/view/${id}`
  };
};

const fetchTapdWorkspaceName = async (workspaceId, credential) => {
  const params = new URLSearchParams({ workspace_id: workspaceId });
  const payload = await sendTapdJson(
    `${TAPD_API_BASE_URL}/workspaces/get_workspace_info?${params.toString()}`,
    credential
  );
  const name = normalizeParamText(payload?.data?.Workspace?.name);
  if (!name) throw { code: "source_shape_changed" };
  return name;
};

const isActionableStatus = (status) => {
  const value = String(status || "").trim().toLowerCase();
  return [
    "new",
    "open",
    "opened",
    "assigned",
    "accepted",
    "in_progress",
    "reopened",
    "新",
    "已打开",
    "打开",
    "已分配",
    "接受",
    "已接受",
    "接受/处理",
    "接受/处理中",
    "重新打开"
  ].includes(value);
};

const isClosedStatus = (status) =>
  ["closed", "done", "rejected", "verified", "已关闭", "已拒绝", "无需处理"].includes(
    String(status || "").trim().toLowerCase()
  );

const isVerificationPending = (item) => {
  if (isClosedStatus(item.status)) return false;
  const value = String(item.status || "").trim().toLowerCase();
  return (
    value === "resolved" ||
    value === "wait_verify" ||
    value.includes("待验证") ||
    value.includes("待验") ||
    value.includes("已解决")
  );
};

const isCritical = (item) => {
  const severity = String(item.severity || "").trim().toLowerCase();
  const priority = String(item.priorityLabel || "").trim().toLowerCase();
  return (
    ["p0", "p1", "critical", "fatal", "serious"].includes(severity) ||
    ["p0", "p1", "high", "紧急", "高"].includes(priority)
  );
};

const errorTapd = (payload, code) => ({
  status: "error",
  workspaceId: String(payload.workspaceId || ""),
  total: 0,
  visibleTotal: 0,
  blockedTotal: Array.isArray(payload.blockedBugIds)
    ? payload.blockedBugIds.length
    : 0,
  verificationTotal: 0,
  critical: 0,
  assignedToCurrentUser: 0,
  visibleScope: "owned-by-current-user",
  page: Math.max(1, Math.round(Number(payload.page) || 1)),
  limit: Math.min(200, Math.max(1, Math.round(Number(payload.limit) || 100))),
  lastSyncedAt: nowIso(),
  items: [],
  errorCode: code
});
