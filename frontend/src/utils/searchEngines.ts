import type { SearchEngine } from "@/types";
import { normalizeSiteUrl } from "@/utils/siteMetadata";

const SEARCH_PLACEHOLDER = "{q}";

const defaultSearchEngines: SearchEngine[] = [
  {
    id: "baidu",
    key: "baidu",
    label: "百度",
    urlTemplate: "https://www.baidu.com/s?wd={q}",
    iconSourceUrl: "https://www.baidu.com",
  },
  {
    id: "google",
    key: "google",
    label: "谷歌",
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
];

export const DEFAULT_SEARCH_ENGINE_KEYS = new Set(
  defaultSearchEngines.map((engine) => engine.key),
);

const DEPRECATED_SEARCH_ENGINE_KEYS = new Set(["so", "metaso"]);

const cloneEngine = (engine: SearchEngine): SearchEngine => ({
  ...engine,
});

export const createDefaultSearchEngines = (): SearchEngine[] =>
  defaultSearchEngines.map(cloneEngine);

const defaultSearchEngineByKey = new Map(
  defaultSearchEngines.map((engine) => [engine.key, engine] as const),
);

const normalizeKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const createSearchEngineKey = (label: string) => {
  const base = normalizeKey(label) || `custom-${Date.now().toString(36)}`;
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
};

const normalizeSearchEngine = (
  engine: SearchEngine,
  fallbackIndex: number,
): SearchEngine | null => {
  const label = String(engine.label || "").trim();
  const urlTemplate = String(engine.urlTemplate || "").trim();
  if (!label || !urlTemplate) return null;
  const key = normalizeKey(String(engine.key || engine.id || label));
  if (DEPRECATED_SEARCH_ENGINE_KEYS.has(key)) return null;
  const builtInDefault = defaultSearchEngineByKey.get(key);
  const builtInLegacyLabel =
    (key === "google" && label === "Google") ||
    (key === "bing" && label === "必应");
  return {
    ...engine,
    id: String(
      engine.id || builtInDefault?.id || key || `search-${fallbackIndex}`,
    ),
    key: key || `search-${fallbackIndex}`,
    label: builtInLegacyLabel ? builtInDefault?.label || label : label,
    urlTemplate,
    iconSourceUrl: engine.iconSourceUrl || builtInDefault?.iconSourceUrl,
    custom: engine.custom === true || !DEFAULT_SEARCH_ENGINE_KEYS.has(key),
  };
};

export const normalizeSearchEngines = (
  engines?: SearchEngine[] | null,
): SearchEngine[] => {
  const defaults = createDefaultSearchEngines();
  if (!Array.isArray(engines)) return defaults;
  const seen = new Set<string>();
  const normalized: SearchEngine[] = [];

  for (const [index, engine] of engines.entries()) {
    const next = normalizeSearchEngine(engine, index);
    if (!next || seen.has(next.key)) continue;
    seen.add(next.key);
    normalized.push(next);
  }

  return normalized.length > 0 ? normalized : defaults;
};

export const normalizeDefaultSearchEngine = (
  key: string | undefined,
  engines: SearchEngine[],
) => {
  if (key && engines.some((engine) => engine.key === key)) return key;
  return engines[0]?.key || createDefaultSearchEngines()[0]!.key;
};

export const buildSearchEngineUrl = (
  engine: SearchEngine | undefined,
  query: string,
) => {
  const encodedQuery = encodeURIComponent(query.trim());
  const template =
    engine?.urlTemplate || createDefaultSearchEngines()[0]!.urlTemplate;

  if (template.includes(SEARCH_PLACEHOLDER)) {
    return normalizeSiteUrl(
      template.replaceAll(SEARCH_PLACEHOLDER, encodedQuery),
    );
  }

  try {
    const parsed = new URL(normalizeSiteUrl(template));
    parsed.searchParams.set("q", query.trim());
    return parsed.toString();
  } catch {
    return createDefaultSearchEngines()[0]!.urlTemplate.replace(
      SEARCH_PLACEHOLDER,
      encodedQuery,
    );
  }
};
