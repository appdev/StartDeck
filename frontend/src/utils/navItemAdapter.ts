import type { NavItem } from "@/types";
import {
  normalizeIconBackgroundColor,
  normalizeLegacyIconBackground,
} from "@/utils/iconAppearance";
import { cacheIconToLocal } from "@/utils/iconCache";
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

export const cacheNavItemIconToLocal = cacheIconToLocal;
