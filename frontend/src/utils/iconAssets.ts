import type { NavGroup, NavItem } from "@/types";
import { sessionFetch } from "@/utils/sessionFetch";

const USER_ICON_RE = /^\/api\/icons\/icn_[A-Za-z0-9_-]+$/;
const LEGACY_USER_ICON_RE = /^\/api\/assets\/icons\/(icn_[A-Za-z0-9_-]+)$/;
const META_ICON_RE = /^\/api\/icons\/mta_[A-Za-z0-9_-]+$/;
const SEED_ICON_RE =
  /^\/assets\/seed-icons\/nav\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:svg|png|webp|ico)$/i;

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

export const isCanonicalIconUrl = (value: unknown): value is string =>
  typeof value === "string" && sanitizeNavigationIcon(value) !== "";

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
  if (normalized && type !== "assetId") return normalized;
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

export const materializeIconInput = async (value: string): Promise<string> => {
  const raw = value.trim();
  if (!raw) return "";
  const normalized = sanitizeNavigationIcon(raw);
  if (normalized) return normalized;
  if (String(raw).startsWith("data:"))
    return materializeIconSource("dataUrl", raw);
  if (/^https?:\/\//i.test(raw)) return materializeIconSource("remoteUrl", raw);
  return materializeIconSource("legacyRef", raw);
};
