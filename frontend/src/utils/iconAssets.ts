import type { NavGroup, NavItem } from "@/types";
import { sessionFetch } from "@/utils/sessionFetch";
import { queryStartDeckConnector } from "@/utils/startdeckConnector";

const USER_ICON_RE = /^\/api\/icons\/icn_[A-Za-z0-9_-]+$/;
const LEGACY_USER_ICON_RE = /^\/api\/assets\/icons\/(icn_[A-Za-z0-9_-]+)$/;
const META_ICON_RE = /^\/api\/icons\/mta_[A-Za-z0-9_-]+$/;
const SEED_ICON_RE =
  /^\/assets\/seed-icons\/nav\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:svg|png|webp|ico)$/i;
const REMOTE_ICON_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_ICON_BYTES = 5 * 1024 * 1024;
const REMOTE_ICON_READ_ERROR =
  "该图片可预览但浏览器不允许读取，请下载后手动上传图标。";
const REMOTE_ICON_CONNECTOR_READ_ERROR =
  "该图片可预览但页面和本地扩展都无法读取，请确认已安装并允许 StartDeck Connector，或下载后手动上传图标。";

export type ManagedIconCandidate = {
  id: string;
  assetId: string;
  url: string;
  source: string;
  label?: string;
  contentType?: string;
  backgroundColor?: string;
  width?: number | null;
  height?: number | null;
  reused?: boolean;
};

export type ResolvedSiteMetadata = {
  inputUrl: string;
  normalizedUrl: string;
  url: string;
  title: string | null;
  description: string | null;
  backgroundColor: string | null;
  fetchStatus?: "ok" | "no_icon" | "blocked" | "error" | string | null;
  failureKind?: string | null;
  retryAfter?: string | null;
  selectedIcon: ManagedIconCandidate | null;
  iconCandidates: ManagedIconCandidate[];
};

type ResolveResponse = {
  success?: boolean;
  data?: Partial<ResolvedSiteMetadata> | null;
};

type CreateIconResponse = {
  success?: boolean;
  data?: {
    assetId?: string;
    id?: string;
    url?: string;
  } | null;
  error?: string;
};

type ConnectorRemoteIconResponse = {
  url?: string;
  contentType?: string;
  byteSize?: number;
  dataUrl?: string;
};

export const isCanonicalIconUrl = (value: unknown): value is string =>
  typeof value === "string" && sanitizeNavigationIcon(value) !== "";

export const normalizeRemoteNavigationIconUrl = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (!REMOTE_ICON_PROTOCOLS.has(url.protocol) || !url.hostname) return "";
    if (url.username || url.password) return "";
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
};

export const sanitizeNavigationIcon = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw) return "";
  const legacy = raw.match(LEGACY_USER_ICON_RE);
  if (legacy) return `/api/icons/${legacy[1]}`;
  if (USER_ICON_RE.test(raw) || META_ICON_RE.test(raw) || SEED_ICON_RE.test(raw)) {
    return raw;
  }
  return "";
};

export const sanitizeNavItemIcon = <T extends Partial<NavItem>>(item: T): T => ({
  ...item,
  icon: sanitizeNavigationIcon(item.icon),
});

export const sanitizeNavGroups = <T extends Partial<NavGroup>>(groups: T[]): T[] =>
  groups.map((group) => ({
    ...group,
    items: Array.isArray(group.items)
      ? group.items.map((item) => sanitizeNavItemIcon(item as Partial<NavItem>))
      : [],
  }));

export const sanitizeSnapshotIcons = <T extends Record<string, unknown>>(
  data: T,
): T => {
  const groups = Array.isArray(data.groups)
    ? sanitizeNavGroups(data.groups as Partial<NavGroup>[])
    : data.groups;
  return {
    ...data,
    groups,
  };
};

const normalizeCandidate = (
  candidate: Partial<ManagedIconCandidate> | null | undefined,
): ManagedIconCandidate | null => {
  const url = sanitizeNavigationIcon(candidate?.url);
  const id =
    typeof candidate?.assetId === "string"
      ? candidate.assetId
      : typeof candidate?.id === "string"
        ? candidate.id
        : url.split("/").pop() || "";
  if (!url || !id) return null;
  return {
    id,
    assetId: id,
    url,
    source: candidate?.source || "site",
    label: candidate?.label || undefined,
    contentType: candidate?.contentType || undefined,
    backgroundColor: candidate?.backgroundColor || undefined,
    width: typeof candidate?.width === "number" ? candidate.width : null,
    height: typeof candidate?.height === "number" ? candidate.height : null,
    reused: candidate?.reused === true,
  };
};

export const resolveSiteMetadata = async (
  input: string,
): Promise<ResolvedSiteMetadata | null> => {
  const url = input.trim();
  if (!url) return null;
  const res = await sessionFetch(
    `/api/site/resolve?url=${encodeURIComponent(url)}`,
  );
  if (!res.ok) return null;
  const payload = (await res.json().catch(() => null)) as ResolveResponse | null;
  const data = payload?.data;
  if (!payload?.success || !data) return null;
  const candidates = Array.isArray(data.iconCandidates)
    ? data.iconCandidates.map(normalizeCandidate).filter(Boolean)
    : [];
  return {
    inputUrl: data.inputUrl || url,
    normalizedUrl: data.normalizedUrl || data.url || url,
    url: data.url || data.normalizedUrl || url,
    title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : null,
    description:
      typeof data.description === "string" && data.description.trim()
        ? data.description.trim()
        : null,
    backgroundColor:
      typeof data.backgroundColor === "string" && data.backgroundColor.trim()
        ? data.backgroundColor.trim()
        : null,
    fetchStatus:
      typeof data.fetchStatus === "string" && data.fetchStatus.trim()
        ? data.fetchStatus.trim()
        : null,
    failureKind:
      typeof data.failureKind === "string" && data.failureKind.trim()
        ? data.failureKind.trim()
        : null,
    retryAfter:
      typeof data.retryAfter === "string" && data.retryAfter.trim()
        ? data.retryAfter.trim()
        : null,
    selectedIcon: normalizeCandidate(data.selectedIcon),
    iconCandidates: candidates as ManagedIconCandidate[],
  };
};

export const materializeIconSource = async (
  type: "dataUrl" | "remoteUrl" | "legacyRef" | "assetId",
  value: string,
): Promise<string> => {
  const raw = value.trim();
  if (!raw) return "";
  const normalized = sanitizeNavigationIcon(raw);
  if (normalized && type !== "assetId") {
    return normalized;
  }
  const res = await sessionFetch("/api/icons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: { type, value: raw } }),
  });
  const payload = (await res
    .json()
    .catch(() => null)) as CreateIconResponse | null;
  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error || "icon_materialize_failed");
  }
  const url = sanitizeNavigationIcon(payload.data?.url);
  if (!url) throw new Error("icon_materialize_invalid_response");
  return url;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

const blobToDataUrl = async (blob: Blob, contentType: string): Promise<string> => {
  const buffer = await blob.arrayBuffer().catch(() => null);
  if (!buffer) throw new Error(REMOTE_ICON_READ_ERROR);
  return `data:${contentType};base64,${bytesToBase64(new Uint8Array(buffer))}`;
};

const readRemoteIconInPageAsDataUrl = async (url: string): Promise<string> => {
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: "omit",
      cache: "no-store",
    });
  } catch {
    throw new Error(REMOTE_ICON_READ_ERROR);
  }
  if (!res.ok) throw new Error(REMOTE_ICON_READ_ERROR);
  const blob = await res.blob().catch(() => null);
  if (!blob) throw new Error(REMOTE_ICON_READ_ERROR);
  const contentType =
    blob.type || res.headers.get("content-type")?.split(";")[0].trim() || "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error("远程图标不是有效图片，请下载后手动上传图标。");
  }
  if (blob.size <= 0) {
    throw new Error("远程图标为空，请下载后手动上传图标。");
  }
  if (blob.size > MAX_ICON_BYTES) {
    throw new Error("远程图标超过 5MB，请下载压缩后手动上传图标。");
  }
  return blobToDataUrl(blob, contentType);
};

const isPageReadFailure = (error: unknown) =>
  error instanceof Error && error.message === REMOTE_ICON_READ_ERROR;

const readRemoteIconWithConnectorAsDataUrl = async (
  url: string,
): Promise<string> => {
  let payload: ConnectorRemoteIconResponse;
  try {
    payload = await queryStartDeckConnector<ConnectorRemoteIconResponse>(
      "icons.fetchRemoteImage",
      { url, maxBytes: MAX_ICON_BYTES },
      12_000,
    );
  } catch {
    throw new Error(REMOTE_ICON_CONNECTOR_READ_ERROR);
  }

  const contentType = String(payload?.contentType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const byteSize = Number(payload?.byteSize || 0);
  const dataUrl = String(payload?.dataUrl || "").trim();
  if (!contentType.startsWith("image/") || !dataUrl.startsWith("data:image/")) {
    throw new Error("远程图标不是有效图片，请下载后手动上传图标。");
  }
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    throw new Error("远程图标为空，请下载后手动上传图标。");
  }
  if (byteSize > MAX_ICON_BYTES) {
    throw new Error("远程图标超过 5MB，请下载压缩后手动上传图标。");
  }
  return dataUrl;
};

const readRemoteIconAsDataUrl = async (url: string): Promise<string> => {
  try {
    return await readRemoteIconInPageAsDataUrl(url);
  } catch (error) {
    if (!isPageReadFailure(error)) throw error;
    return readRemoteIconWithConnectorAsDataUrl(url);
  }
};

export const materializeIconInput = async (value: string): Promise<string> => {
  const raw = value.trim();
  if (!raw) return "";
  const normalized = sanitizeNavigationIcon(raw);
  const remote = normalizeRemoteNavigationIconUrl(raw);
  if (normalized) return normalized;
  if (String(raw).startsWith("data:"))
    return materializeIconSource("dataUrl", raw);
  if (remote) {
    try {
      return await materializeIconSource("remoteUrl", remote);
    } catch {
      const dataUrl = await readRemoteIconAsDataUrl(remote);
      return materializeIconSource("dataUrl", dataUrl);
    }
  }
  if (/^https?:\/\//i.test(raw)) return "";
  return materializeIconSource("legacyRef", raw);
};
