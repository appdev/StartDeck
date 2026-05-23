import { getSiteIconUrl, normalizeSiteUrl } from "@/utils/siteMetadata";

export type SiteShortcutCategory =
  | "browser"
  | "ai"
  | "popular"
  | "app"
  | "news"
  | "media"
  | "tech"
  | "image"
  | "productivity"
  | "learning"
  | "game"
  | "shopping"
  | "social"
  | "reading"
  | "travel"
  | "finance"
  | "other";

export type SiteShortcutSortMode = "featured" | "updated" | "popular";

export interface StartDeckSiteShortcutCatalogItem {
  id: string;
  title: string;
  description: string;
  url: string;
  category: SiteShortcutCategory;
  iconSourceUrl?: string;
  glyph?: string;
  featuredRank: number;
  updatedAt: string;
  popularity: number;
}

export const SITE_SHORTCUT_CATEGORIES: {
  id: SiteShortcutCategory | "all";
  label: string;
}[] = [
  { id: "browser", label: "浏览器" },
  { id: "ai", label: "AI" },
  { id: "popular", label: "热门" },
  { id: "app", label: "应用" },
  { id: "news", label: "新闻" },
  { id: "media", label: "影音" },
  { id: "tech", label: "科技" },
  { id: "image", label: "图片" },
  { id: "productivity", label: "效率" },
  { id: "learning", label: "学习" },
  { id: "game", label: "游戏" },
  { id: "shopping", label: "购物" },
  { id: "social", label: "社交" },
  { id: "reading", label: "阅读" },
  { id: "travel", label: "出行" },
  { id: "finance", label: "金融" },
  { id: "other", label: "其他" },
];

export const SITE_SHORTCUT_SORT_TABS: {
  id: SiteShortcutSortMode;
  label: string;
}[] = [
  { id: "featured", label: "今日推荐" },
  { id: "updated", label: "最近更新" },
  { id: "popular", label: "最受欢迎" },
];

export const STARTDECK_SITE_SHORTCUT_CATALOG: StartDeckSiteShortcutCatalogItem[] =
  [
    {
      id: "openai",
      title: "OpenAI",
      description: "AI 模型与开发者平台",
      url: "https://openai.com",
      category: "ai",
      glyph: "AI",
      featuredRank: 1,
      updatedAt: "2026-05-01",
      popularity: 98,
    },
    {
      id: "github",
      title: "GitHub",
      description: "代码托管与协作",
      url: "https://github.com",
      category: "tech",
      glyph: "GH",
      featuredRank: 2,
      updatedAt: "2026-04-20",
      popularity: 96,
    },
    {
      id: "figma",
      title: "Figma",
      description: "产品设计与原型协作",
      url: "https://www.figma.com",
      category: "productivity",
      glyph: "F",
      featuredRank: 3,
      updatedAt: "2026-04-12",
      popularity: 89,
    },
    {
      id: "notion",
      title: "Notion",
      description: "文档、知识库与项目管理",
      url: "https://www.notion.so",
      category: "productivity",
      glyph: "N",
      featuredRank: 4,
      updatedAt: "2026-03-28",
      popularity: 88,
    },
    {
      id: "youtube",
      title: "YouTube",
      description: "视频与频道订阅",
      url: "https://www.youtube.com",
      category: "media",
      glyph: "YT",
      featuredRank: 5,
      updatedAt: "2026-02-18",
      popularity: 93,
    },
    {
      id: "bilibili",
      title: "哔哩哔哩",
      description: "视频、直播与社区内容",
      url: "https://www.bilibili.com",
      category: "media",
      glyph: "B",
      featuredRank: 6,
      updatedAt: "2026-05-09",
      popularity: 91,
    },
    {
      id: "wikipedia",
      title: "Wikipedia",
      description: "开放百科与知识检索",
      url: "https://www.wikipedia.org",
      category: "learning",
      glyph: "W",
      featuredRank: 7,
      updatedAt: "2026-01-15",
      popularity: 86,
    },
    {
      id: "product-hunt",
      title: "Product Hunt",
      description: "发现新产品与工具",
      url: "https://www.producthunt.com",
      category: "tech",
      glyph: "PH",
      featuredRank: 8,
      updatedAt: "2026-05-11",
      popularity: 79,
    },
    {
      id: "unsplash",
      title: "Unsplash",
      description: "高质量开放图片",
      url: "https://unsplash.com",
      category: "image",
      glyph: "U",
      featuredRank: 9,
      updatedAt: "2026-03-08",
      popularity: 82,
    },
    {
      id: "the-verge",
      title: "The Verge",
      description: "科技与文化新闻",
      url: "https://www.theverge.com",
      category: "news",
      glyph: "V",
      featuredRank: 10,
      updatedAt: "2026-04-30",
      popularity: 77,
    },
    {
      id: "amazon",
      title: "Amazon",
      description: "购物与云服务入口",
      url: "https://www.amazon.com",
      category: "shopping",
      glyph: "A",
      featuredRank: 11,
      updatedAt: "2026-02-05",
      popularity: 90,
    },
    {
      id: "x",
      title: "X",
      description: "实时信息与社交网络",
      url: "https://x.com",
      category: "social",
      glyph: "X",
      featuredRank: 12,
      updatedAt: "2026-04-02",
      popularity: 87,
    },
    {
      id: "google-news",
      title: "Google News",
      description: "聚合新闻与主题追踪",
      url: "https://news.google.com",
      category: "news",
      glyph: "G",
      featuredRank: 13,
      updatedAt: "2026-05-13",
      popularity: 84,
    },
    {
      id: "steam",
      title: "Steam",
      description: "游戏库与商店",
      url: "https://store.steampowered.com",
      category: "game",
      glyph: "S",
      featuredRank: 14,
      updatedAt: "2026-03-19",
      popularity: 85,
    },
    {
      id: "airbnb",
      title: "Airbnb",
      description: "民宿与旅行住宿",
      url: "https://www.airbnb.com",
      category: "travel",
      glyph: "AB",
      featuredRank: 15,
      updatedAt: "2026-02-26",
      popularity: 74,
    },
    {
      id: "tradingview",
      title: "TradingView",
      description: "行情图表与市场观察",
      url: "https://www.tradingview.com",
      category: "finance",
      glyph: "TV",
      featuredRank: 16,
      updatedAt: "2026-04-26",
      popularity: 83,
    },
    {
      id: "chrome-web-store",
      title: "Chrome Web Store",
      description: "浏览器扩展与主题",
      url: "https://chromewebstore.google.com",
      category: "browser",
      glyph: "C",
      featuredRank: 17,
      updatedAt: "2026-01-20",
      popularity: 72,
    },
    {
      id: "internet-archive",
      title: "Internet Archive",
      description: "网页、书籍与媒体档案",
      url: "https://archive.org",
      category: "reading",
      glyph: "IA",
      featuredRank: 18,
      updatedAt: "2026-03-14",
      popularity: 71,
    },
  ];

export const getSiteShortcutCatalogItem = (id: string) =>
  STARTDECK_SITE_SHORTCUT_CATALOG.find((item) => item.id === id);

export const getSiteShortcutIcon = (
  item: StartDeckSiteShortcutCatalogItem,
): string => item.iconSourceUrl || getSiteIconUrl(item.url);

export const filterAndSortSiteShortcuts = (
  items: StartDeckSiteShortcutCatalogItem[],
  options: {
    category?: SiteShortcutCategory | "all";
    query?: string;
    sortMode?: SiteShortcutSortMode;
  } = {},
) => {
  const category = options.category || "all";
  const query = (options.query || "").trim().toLowerCase();
  const sortMode = options.sortMode || "featured";

  return items
    .filter((item) => {
      if (
        category !== "all" &&
        category !== "popular" &&
        item.category !== category
      )
        return false;
      if (!query) return true;
      return [item.title, item.description, item.url, item.category].some(
        (value) => value.toLowerCase().includes(query),
      );
    })
    .sort((a, b) => {
      if (sortMode === "updated") {
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
          a.featuredRank - b.featuredRank
        );
      }
      if (sortMode === "popular") {
        return b.popularity - a.popularity || a.featuredRank - b.featuredRank;
      }
      return a.featuredRank - b.featuredRank;
    });
};

export const isDuplicateSiteShortcut = (
  existingUrls: string[],
  candidateUrl: string,
) => {
  const normalizedCandidate = normalizeSiteUrl(candidateUrl);
  if (!normalizedCandidate) return false;
  return existingUrls.some(
    (url) => normalizeSiteUrl(url) === normalizedCandidate,
  );
};
