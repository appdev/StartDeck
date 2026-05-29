import { toApiUrl } from "@/utils/runtimeUrls";
import type { ItabWallpaperEntry } from "./itabWallpaperTypes";

type BingWallpaperPayload =
  | {
      success: true;
      data: {
        entries: ItabWallpaperEntry[];
        sourceStatus?: string;
        updatedAt?: string;
        count?: number;
        totalPages?: number;
        pageSize?: number;
        currentPage?: number;
      };
      sourceStatus?: string;
    }
  | {
      success: false;
      error: string;
    };

export type ItabBingWallpaperResult = {
  entries: ItabWallpaperEntry[];
  sourceStatus: string;
  updatedAt?: string;
  count?: number;
  totalPages: number;
  pageSize: number;
  currentPage: number;
};

const cachedResults = new Map<string, ItabBingWallpaperResult>();
const pendingRequests = new Map<string, Promise<ItabBingWallpaperResult>>();

const normalizeEntry = (entry: ItabWallpaperEntry) => ({
  ...entry,
  id: String(entry.id || "").trim(),
  title: String(entry.title || "").trim(),
  location: String(entry.location || "").trim(),
  credit: String(entry.credit || "Bing").trim(),
  thumbnailUrl: String(entry.thumbnailUrl || "").trim(),
  downloadUrl: String(entry.downloadUrl || "").trim(),
});

export const fetchItabBingWallpapers = async (
  count = 16,
  refresh = false,
  signal?: AbortSignal,
  page = 1,
): Promise<ItabBingWallpaperResult> => {
  const requestPage = Math.max(1, Math.floor(page) || 1);
  const requestCount = Math.max(1, Math.floor(count) || 16);
  const cacheKey = `${requestPage}:${requestCount}`;
  const cachedResult = cachedResults.get(cacheKey);
  if (!refresh && cachedResult) {
    return cachedResult;
  }
  const pendingRequest = pendingRequests.get(cacheKey);
  if (!refresh && pendingRequest) {
    return pendingRequest;
  }

  const request = (async () => {
    const url = new URL(
      toApiUrl("/api/bing-wallpapers"),
      window.location.origin,
    );
    url.searchParams.set("page", String(requestPage));
    url.searchParams.set("pageSize", String(requestCount));
    if (refresh) {
      url.searchParams.set("refresh", "true");
    }

    const response = await fetch(url.toString(), {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal,
    });
    const payload = (await response.json()) as BingWallpaperPayload;
    if (!response.ok || payload.success === false) {
      throw new Error(
        payload.success === false
          ? payload.error
          : `Bing wallpaper request failed: ${response.status}`,
      );
    }

    const entries = payload.data.entries
      .map(normalizeEntry)
      .filter(
        (entry) =>
          entry.id && entry.title && entry.thumbnailUrl && entry.downloadUrl,
      );
    if (!entries.length) {
      throw new Error("Bing wallpaper response contained no usable entries");
    }

    const result = {
      entries,
      sourceStatus: payload.data.sourceStatus || payload.sourceStatus || "ok",
      updatedAt: payload.data.updatedAt,
      count: payload.data.count,
      totalPages: Math.max(1, payload.data.totalPages || requestPage),
      pageSize: payload.data.pageSize || requestCount,
      currentPage: payload.data.currentPage || requestPage,
    };
    cachedResults.set(cacheKey, result);
    return result;
  })();

  pendingRequests.set(cacheKey, request);
  try {
    return await request;
  } finally {
    pendingRequests.delete(cacheKey);
  }
};

export const resetItabBingWallpaperApiCacheForTests = () => {
  cachedResults.clear();
  pendingRequests.clear();
};
