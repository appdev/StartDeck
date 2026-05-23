import type { NavItem } from "@/types";
import {
  normalizeIconBackgroundColor,
  normalizeLegacyIconBackground,
} from "@/utils/iconAppearance";
import { resolveManagedUrl, toAppUrl } from "@/utils/runtimeUrls";
import { getSiteIconUrl, normalizeSiteUrl } from "@/utils/siteMetadata";
import {
  getSiteShortcutIcon,
  type StartDeckSiteShortcutCatalogItem,
} from "@/utils/siteShortcutCatalog";

export type NavItemDraft = Omit<NavItem, "id"> & { id?: string };

export interface CustomIconDraft {
  title: string;
  url: string;
  icon?: string;
  iconText?: string;
  useTextIcon?: boolean;
  description1?: string;
  iconBackgroundMode?: NavItem["iconBackgroundMode"];
  iconAutoBackgroundColor?: string;
  iconCustomBackgroundColor?: string;
  color?: string;
  titleColor?: string;
  iconSize?: number;
}

export type NavItemAdapterResult =
  | { ok: true; navItem: NavItemDraft }
  | { ok: false; message: string };

const normalizeTitle = (value: string) => value.trim().slice(0, 80);

const normalizeUrl = (value: string) => normalizeSiteUrl(value.trim());

export const validateNavItemDraft = (
  draft: Pick<CustomIconDraft, "title" | "url">,
):
  | { ok: true; title: string; url: string }
  | { ok: false; message: string } => {
  const title = normalizeTitle(draft.title || "");
  const url = normalizeUrl(draft.url || "");
  if (!title && !url) {
    return { ok: false, message: "标题和链接至少需要填写一项。" };
  }
  if (!url) {
    return { ok: false, message: "请输入有效的网址。" };
  }
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { ok: false, message: "网址仅支持 http 或 https。" };
    }
  } catch {
    return { ok: false, message: "请输入有效的网址。" };
  }
  return { ok: true, title: title || new URL(url).hostname, url };
};

export const normalizeNavIconBackground = (
  input: Pick<
    CustomIconDraft,
    | "iconBackgroundMode"
    | "iconAutoBackgroundColor"
    | "iconCustomBackgroundColor"
    | "color"
  >,
) => {
  const auto =
    normalizeIconBackgroundColor(input.iconAutoBackgroundColor) || "";
  const custom =
    normalizeIconBackgroundColor(input.iconCustomBackgroundColor) || "";
  const legacy = normalizeLegacyIconBackground(input.color) || "";
  const mode =
    input.iconBackgroundMode === "custom" && custom ? "custom" : "auto";

  return {
    iconBackgroundMode: mode,
    iconAutoBackgroundColor: auto,
    iconCustomBackgroundColor: mode === "custom" ? custom : "",
    color: legacy || "bg-gray-100 text-gray-700",
  } satisfies Pick<
    NavItem,
    | "iconBackgroundMode"
    | "iconAutoBackgroundColor"
    | "iconCustomBackgroundColor"
    | "color"
  >;
};

export const createNavItemFromSiteShortcut = (
  item: StartDeckSiteShortcutCatalogItem,
): NavItemAdapterResult => {
  const valid = validateNavItemDraft({ title: item.title, url: item.url });
  if (valid.ok === false) return { ok: false, message: valid.message };

  return {
    ok: true,
    navItem: {
      title: valid.title,
      url: valid.url,
      icon: getSiteShortcutIcon(item),
      description1: item.description,
      isPublic: true,
      iconBackgroundMode: "auto",
      iconAutoBackgroundColor: "",
      iconCustomBackgroundColor: "",
      color: "bg-gray-100 text-gray-700",
      titleColor: "",
      iconSize: 100,
    },
  };
};

export const createNavItemFromCustomIcon = (
  draft: CustomIconDraft,
): NavItemAdapterResult => {
  const valid = validateNavItemDraft(draft);
  if (valid.ok === false) return { ok: false, message: valid.message };
  const background = normalizeNavIconBackground(draft);
  const iconText = (draft.iconText || "").trim().slice(0, 2);
  const icon =
    draft.useTextIcon && iconText
      ? createTextIconDataUrl(
          iconText,
          background.iconCustomBackgroundColor ||
            background.iconAutoBackgroundColor ||
            "#1890ff",
        )
      : (draft.icon || "").trim() || getSiteIconUrl(valid.url);

  return {
    ok: true,
    navItem: {
      title: valid.title,
      url: valid.url,
      icon,
      description1: (draft.description1 || "").trim(),
      isPublic: true,
      titleColor: draft.titleColor || "",
      iconSize: Math.max(40, Math.min(220, draft.iconSize ?? 100)),
      ...background,
    },
  };
};

export const createTextIconDataUrl = (text: string, color = "#1890ff") => {
  const safeText = text.trim().slice(0, 2) || "A";
  const safeColor = normalizeIconBackgroundColor(color) || "#1890ff";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="216" height="216" viewBox="0 0 216 216"><rect width="216" height="216" rx="48" fill="${safeColor}"/><text x="108" y="128" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="${safeText.length > 1 ? 82 : 104}" font-weight="800" fill="#fff">${safeText.replace(/[<>&]/g, "")}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

type IconCacheErrorResponse = {
  error?: string | { code?: string; message?: string };
  success?: boolean;
  path?: string;
};

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
    };
    const tip = code && tips[code] ? `（${tips[code]}）` : "";
    return `${data.error.message}${tip}`;
  }
  return "图标缓存失败，请稍后重试";
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

const normalizeIconUrlForCache = (value: string) => {
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/api/site/icon")) {
    return new URL(resolveManagedUrl(value), window.location.origin).toString();
  }
  if (value.startsWith("/icons/")) {
    return new URL(toAppUrl(value), window.location.origin).toString();
  }
  if (value.startsWith("icons/")) {
    return new URL(toAppUrl(`/${value}`), window.location.origin).toString();
  }
  return "";
};

export const cacheNavItemIconToLocal = async (
  icon: string,
): Promise<{ path: string | null; error: string | null }> => {
  const trimmed = icon.trim();
  if (!trimmed) return { path: null, error: null };
  if (trimmed.startsWith("/icon-cache/")) return { path: trimmed, error: null };

  let payload: { dataUrl?: string; url?: string } | null = null;
  if (trimmed.startsWith("data:")) {
    payload = { dataUrl: trimmed };
  } else {
    const normalized = normalizeIconUrlForCache(trimmed);
    if (normalized) {
      if (
        trimmed.startsWith("icons/") ||
        trimmed.startsWith("/icons/") ||
        trimmed.startsWith("/api/site/icon")
      ) {
        const dataUrl = await iconUrlToDataUrl(normalized);
        payload = dataUrl ? { dataUrl } : null;
      } else {
        payload = { url: normalized };
      }
    }
  }

  if (!payload) {
    return {
      path: null,
      error: "图标地址格式不支持本地缓存，请改为上传图片或使用 http/https 链接",
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
    if (data?.success && typeof data.path === "string" && data.path) {
      return { path: data.path, error: null };
    }
    return { path: null, error: extractIconCacheError(data) };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "";
    return { path: null, error: message || "图标缓存请求失败，请稍后重试" };
  }
};
