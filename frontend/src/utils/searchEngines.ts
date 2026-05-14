import type { SearchEngine } from "@/types";
import { normalizeIconBackgroundColor } from "@/utils/iconAppearance";
import { fetchSiteMetadata, getSiteIconUrl, normalizeSiteUrl } from "@/utils/siteMetadata";

export const createDefaultSearchEngines = (): SearchEngine[] => [
  {
    id: "google",
    key: "google",
    label: "Google",
    urlTemplate: "https://www.google.com/search?q={q}",
    iconSourceUrl: "https://www.google.com",
  },
  {
    id: "bing",
    key: "bing",
    label: "Bing",
    urlTemplate: "https://cn.bing.com/search?q={q}",
    iconSourceUrl: "https://cn.bing.com",
  },
  {
    id: "baidu",
    key: "baidu",
    label: "百度",
    urlTemplate: "https://www.baidu.com/s?wd={q}",
    iconSourceUrl: "https://www.baidu.com",
  },
];

const metadataRequests = new Map<string, ReturnType<typeof fetchSiteMetadata>>();

const normalizeUrlCandidate = (value: string) => {
  const raw = value.trim();
  if (!raw) return "";

  try {
    const normalized = normalizeSiteUrl(raw);
    const parsed = new URL(normalized);
    return parsed.origin;
  } catch {
    return "";
  }
};

export const normalizeSearchEngines = (engines?: SearchEngine[] | null): SearchEngine[] => {
  if (Array.isArray(engines) && engines.length > 0) return engines;
  return createDefaultSearchEngines();
};

export const getSearchEngineSourceUrl = (engine?: SearchEngine | null) => {
  if (!engine) return "";
  const explicitSource = normalizeUrlCandidate(engine.iconSourceUrl || "");
  if (explicitSource) return explicitSource;

  const template = String(engine.urlTemplate || "").replaceAll("{q}", "startdeck");
  return normalizeUrlCandidate(template);
};

export const getSearchEngineIcon = (engine?: SearchEngine | null) => {
  if (!engine) return "";
  const savedIcon = engine.icon?.trim();
  if (savedIcon) return savedIcon;

  const sourceUrl = getSearchEngineSourceUrl(engine);
  return sourceUrl ? getSiteIconUrl(sourceUrl) : "";
};

export const buildSearchEngineUrl = (engine: SearchEngine | undefined, query: string) => {
  const encodedQuery = encodeURIComponent(query);
  const template = engine?.urlTemplate || createDefaultSearchEngines()[0].urlTemplate;

  if (template.includes("{q}")) {
    return normalizeSiteUrl(template.replaceAll("{q}", encodedQuery));
  }

  try {
    const parsed = new URL(normalizeSiteUrl(template));
    parsed.searchParams.set("q", query);
    return parsed.toString();
  } catch {
    return `${createDefaultSearchEngines()[0].urlTemplate.replace("{q}", encodedQuery)}`;
  }
};

export const hydrateSearchEngineIcon = async (engine: SearchEngine, force = false) => {
  const sourceUrl = getSearchEngineSourceUrl(engine);
  if (!sourceUrl) return false;
  if (!force && engine.icon?.trim() && engine.iconSourceUrl === sourceUrl) return false;

  let request = metadataRequests.get(sourceUrl);
  if (!request || force) {
    request = fetchSiteMetadata(sourceUrl);
    metadataRequests.set(sourceUrl, request);
  }

  const metadata = await request.catch(() => null);
  const nextIcon = metadata?.icon?.trim();
  if (!nextIcon) return false;
  const nextBackground = normalizeIconBackgroundColor(metadata?.backgroundColor) || undefined;

  let changed = false;
  if (engine.icon !== nextIcon) {
    engine.icon = nextIcon;
    changed = true;
  }
  if (engine.iconSourceUrl !== sourceUrl) {
    engine.iconSourceUrl = sourceUrl;
    changed = true;
  }
  if (metadata?.fetchedAt && engine.iconFetchedAt !== metadata.fetchedAt) {
    engine.iconFetchedAt = metadata.fetchedAt;
    changed = true;
  }
  if (engine.iconBackgroundMode !== "custom") {
    if (engine.iconBackgroundMode !== "auto") {
      engine.iconBackgroundMode = "auto";
      changed = true;
    }
    if (engine.iconAutoBackgroundColor !== nextBackground) {
      engine.iconAutoBackgroundColor = nextBackground;
      changed = true;
    }
  }

  return changed;
};

export const hydrateSearchEngineIcons = async (
  engines: SearchEngine[],
  options: { force?: boolean; onChanged?: () => void } = {},
) => {
  const results = await Promise.all(
    engines.map((engine) => hydrateSearchEngineIcon(engine, options.force)),
  );
  if (results.some(Boolean)) {
    options.onChanged?.();
    return true;
  }
  return false;
};

export const resetSearchEngineMetadataCacheForTests = () => {
  metadataRequests.clear();
};
