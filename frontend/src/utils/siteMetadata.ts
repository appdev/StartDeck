export type SiteMetadataData = {
  url: string | null;
  title: string | null;
  icon: string | null;
  description: string | null;
  backgroundColor: string | null;
  fetchedAt: string | null;
  fetchStatus?: "ok" | "no_icon" | "blocked" | "error" | string | null;
  failureKind?: string | null;
  retryAfter?: string | null;
};

type SiteMetadataResponse = {
  code?: number;
  data?: Partial<SiteMetadataData> | null;
  msg?: string;
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

const normalizeString = (value: unknown): string | null => {
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

export const normalizeSiteUrl = (input: string): string => {
  const raw = input.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const host = raw.split("/")[0] || "";
  return `${isLocalHost(host) ? "http" : "https"}://${raw}`;
};

export const getSiteIconUrl = (input: string, size = 64): string => {
  const url = normalizeSiteUrl(input);
  if (!url) return "";
  const params = new URLSearchParams({ url, size: size.toString() });
  return `/api/site/icon?${params.toString()}`;
};

export const normalizeSiteMetadataPayload = (
  payload: SiteMetadataResponse,
  requestedUrl: string,
): SiteMetadataData | null => {
  if (!payload || payload.code !== 200 || !payload.data) return null;
  const data = payload.data;
  return {
    url: normalizeString(data.url) || normalizeSiteUrl(requestedUrl) || null,
    title: normalizeString(data.title),
    icon: normalizeString(data.icon),
    description: normalizeString(data.description),
    backgroundColor: normalizeString(data.backgroundColor),
    fetchedAt: normalizeString(data.fetchedAt),
    fetchStatus: normalizeString(data.fetchStatus),
    failureKind: normalizeString(data.failureKind),
    retryAfter: normalizeString(data.retryAfter),
  };
};

export const fetchSiteMetadata = async (
  input: string,
): Promise<SiteMetadataData | null> => {
  const url = normalizeSiteUrl(input);
  if (!url) return null;
  const res = await fetch(`/api/site/metadata?url=${encodeURIComponent(url)}`);
  if (!res.ok) return null;
  const payload = (await res
    .json()
    .catch(() => null)) as SiteMetadataResponse | null;
  return payload ? normalizeSiteMetadataPayload(payload, url) : null;
};
