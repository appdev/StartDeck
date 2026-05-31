import {
  resolveSiteMetadata,
  type ManagedIconCandidate,
} from "@/utils/iconAssets";

export type SiteMetadataData = {
  url: string | null;
  title: string | null;
  icon: string | null;
  description: string | null;
  backgroundColor: string | null;
  fetchedAt: string | null;
  iconCandidates: ManagedIconCandidate[];
  fetchStatus?: "ok" | "no_icon" | "blocked" | "error" | string | null;
  failureKind?: string | null;
  retryAfter?: string | null;
};

const isLocalHost = (host: string) => {
  const normalized = host.trim().toLowerCase();
  if (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized.endsWith(".local")
  )
    return true;
  const match = normalized.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
  );
  if (!match) return false;
  const parts = match.slice(1).map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255))
    return false;
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 169 && parts[1] === 254)
  );
};

export const normalizeSiteUrl = (input: string): string => {
  const raw = input.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const host = raw.split("/")[0] || "";
  return `${isLocalHost(host) ? "http" : "https"}://${raw}`;
};

export const fetchSiteMetadata = async (
  input: string,
): Promise<SiteMetadataData | null> => {
  const url = normalizeSiteUrl(input);
  if (!url) return null;
  const data = await resolveSiteMetadata(url);
  if (!data) return null;
  return {
    url: data.url || data.normalizedUrl || url,
    title: data.title,
    icon: data.selectedIcon?.url || null,
    description: data.description,
    backgroundColor: data.backgroundColor,
    fetchedAt: null,
    iconCandidates: data.iconCandidates,
    fetchStatus: data.selectedIcon || data.iconCandidates.length > 0 ? "ok" : "no_icon",
    failureKind: null,
    retryAfter: null,
  };
};
