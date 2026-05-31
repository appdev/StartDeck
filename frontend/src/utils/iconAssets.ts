import { sessionFetch } from "@/utils/sessionFetch";
import type { NavGroup, NavItem } from "@/types";

const CANONICAL_ICON_RE = /^\/api\/assets\/icons\/icn_[A-Za-z0-9_-]+$/;

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
  typeof value === "string" && CANONICAL_ICON_RE.test(value.trim());

export const sanitizeNavigationIcon = (value: unknown): string =>
  isCanonicalIconUrl(value) ? value.trim() : "";

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
  if (isCanonicalIconUrl(raw) && type !== "assetId") return raw;
  const res = await sessionFetch("/api/assets/icons", {
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
  if (isCanonicalIconUrl(raw)) return raw;
  if (String(raw).startsWith("data:"))
    return materializeIconSource("dataUrl", raw);
  if (/^https?:\/\//i.test(raw)) return materializeIconSource("remoteUrl", raw);
  return materializeIconSource("legacyRef", raw);
};
