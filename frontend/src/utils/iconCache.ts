import { resolveManagedUrl, toAppUrl } from "@/utils/runtimeUrls";

type IconCacheErrorResponse = {
  error?: string | { code?: string; message?: string };
  success?: boolean;
  path?: string;
  url?: string;
};

type IconCachePayload = { dataUrl?: string; url?: string };

type NormalizedIconCacheSource = {
  url: string;
  inlineBeforeCache: boolean;
};

export type IconCacheResult = {
  path: string | null;
  error: string | null;
};

const ICON_IMAGE_PATH_RE = /\.(png|jpe?g|gif|webp|svg|ico)(?:[?#].*)?$/i;

const extractIconCacheError = (data: IconCacheErrorResponse | null): string => {
  if (!data) return "图标缓存失败，请稍后重试";
  if (typeof data.error === "string") return data.error;
  if (data.error && typeof data.error.message === "string") {
    const code = typeof data.error.code === "string" ? data.error.code : "";
    const tips: Record<string, string> = {
      invalid_url: "请使用有效的 http/https 图标地址",
      blocked_host: "该地址属于受限内网地址，建议先上传图标再保存",
      icon_too_large: "图标超过 5MB，建议压缩后重试",
      unsupported_icon_type: "仅支持 png/jpg/webp/gif/svg/ico",
      unsafe_svg: "SVG 含高风险脚本内容，请换一个安全图标",
      fetch_failed: "远程图标拉取失败，请检查网络后重试",
      data_url_required: "图标缓存请求缺少图片数据",
    };
    const tip = code && tips[code] ? `（${tips[code]}）` : "";
    return `${data.error.message}${tip}`;
  }
  return "图标缓存失败，请稍后重试";
};

const extractIconCachePath = (data: IconCacheErrorResponse | null) => {
  if (!data?.success) return "";
  const path = typeof data.path === "string" ? data.path : "";
  if (path) return path;
  return typeof data.url === "string" ? data.url : "";
};

const iconUrlToDataUrl = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const normalizeLocalImagePathForCache = (value: string) => {
  if (!ICON_IMAGE_PATH_RE.test(value)) return "";
  if (value.startsWith("//") || /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)) {
    return "";
  }
  if (value.includes("..")) return "";
  return value.startsWith("/") ? value : `/${value.replace(/^\.\//, "")}`;
};

const normalizeIconUrlForCache = (
  value: string,
): NormalizedIconCacheSource | null => {
  if (/^https?:\/\//i.test(value)) {
    return { url: value, inlineBeforeCache: false };
  }
  if (value.startsWith("/api/site/icon")) {
    return {
      url: new URL(resolveManagedUrl(value), window.location.origin).toString(),
      inlineBeforeCache: true,
    };
  }
  if (value.startsWith("/icons/")) {
    return {
      url: new URL(toAppUrl(value), window.location.origin).toString(),
      inlineBeforeCache: true,
    };
  }
  if (value.startsWith("icons/")) {
    return {
      url: new URL(toAppUrl(`/${value}`), window.location.origin).toString(),
      inlineBeforeCache: true,
    };
  }
  const localPath = normalizeLocalImagePathForCache(value);
  if (localPath) {
    return {
      url: new URL(
        resolveManagedUrl(localPath),
        window.location.origin,
      ).toString(),
      inlineBeforeCache: true,
    };
  }
  return null;
};

export const cacheIconToLocal = async (
  icon: string,
): Promise<IconCacheResult> => {
  const trimmed = icon.trim();
  if (!trimmed) return { path: null, error: null };
  if (trimmed.startsWith("/icon-cache/")) return { path: trimmed, error: null };

  let payload: IconCachePayload | null = null;
  let payloadError = "";
  if (trimmed.startsWith("data:")) {
    payload = { dataUrl: trimmed };
  } else {
    const normalized = normalizeIconUrlForCache(trimmed);
    if (normalized) {
      if (normalized.inlineBeforeCache) {
        const dataUrl = await iconUrlToDataUrl(normalized.url);
        if (dataUrl) {
          payload = { dataUrl };
        } else {
          payloadError =
            "图标地址可识别，但本地读取失败，请确认图片可访问后重试";
        }
      } else {
        payload = { url: normalized.url };
      }
    }
  }

  if (!payload) {
    return {
      path: null,
      error:
        payloadError ||
        "图标地址格式不支持本地缓存，请改为上传图片、http/https 链接或应用内图片路径",
    };
  }

  try {
    const res = await fetch("/api/icon-cache", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res
      .json()
      .catch(() => null)) as IconCacheErrorResponse | null;
    if (!res.ok) return { path: null, error: extractIconCacheError(data) };
    const cachedPath = extractIconCachePath(data);
    if (cachedPath) {
      return { path: cachedPath, error: null };
    }
    return { path: null, error: extractIconCacheError(data) };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "";
    return { path: null, error: message || "图标缓存请求失败，请稍后重试" };
  }
};
