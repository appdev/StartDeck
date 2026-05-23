<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppModalShell from "@/components/base/AppModalShell.vue";
import WidgetSizeVariantPreview from "@/components/home/WidgetSizeVariantPreview.vue";
import {
  useSmartIconMatch,
  type SmartIconMatchResult,
} from "@/composables/useSmartIconMatch";
import { useMainStore } from "@/stores/main";
import type { NavGroup, WidgetConfig } from "@/types";
import type {
  AddComponentPayload,
  AddComponentResult,
  AddSaveMode,
} from "@/utils/addComponentTypes";
import {
  createNavItemFromCustomIcon,
  createNavItemFromSiteShortcut,
  type CustomIconDraft,
} from "@/utils/navItemAdapter";
import {
  SITE_SHORTCUT_CATEGORIES,
  SITE_SHORTCUT_SORT_TABS,
  filterAndSortSiteShortcuts,
  getSiteShortcutIcon,
  type StartDeckSiteShortcutCatalogItem,
  type SiteShortcutCategory,
  type SiteShortcutSortMode,
} from "@/utils/siteShortcutCatalog";
import {
  WIDGET_CATALOG,
  getWidgetCatalogAction,
  getWidgetCatalogItem,
  type WidgetCatalogCategory,
  type WidgetCatalogItem,
  type WidgetCatalogSizeKey,
  type WidgetCatalogSizePreset,
} from "@/utils/widgetCatalog";

type AddTab = "widget" | "site" | "custom";
type ReplicaWidgetCard = {
  id: string;
  catalogItemId: string;
  title: string;
  description: string;
  popularity: string;
  glyph: string;
  previewKind:
    | "pdf"
    | "number"
    | "gradient"
    | "clock"
    | "weather"
    | "quote"
    | "english"
    | "memo"
    | "todo"
    | "pomodoro"
    | "quote"
    | "english"
    | "audio"
    | "offwork"
    | "anniversary"
    | "sbti"
    | "image"
    | "ai"
    | "sports"
    | "game";
  previewTone:
    | "blue"
    | "purple"
    | "amber"
    | "green"
    | "cyan"
    | "pink"
    | "slate";
  previewText?: string;
  previewAsset?: string;
  previewAssetFit?: "contain" | "cover";
};
type WidgetUiCategory =
  | "explore"
  | "all"
  | "productivity"
  | "tool"
  | "development"
  | "design"
  | "creative"
  | "entertainment"
  | "other";

const props = defineProps<{
  show: boolean;
  widgets: WidgetConfig[];
  groups?: NavGroup[];
  activeGroupId?: string;
  siteFixtureState?: {
    loading?: boolean;
    error?: string;
    items?: StartDeckSiteShortcutCatalogItem[];
  };
  onAddComponent?: (
    payload: AddComponentPayload,
  ) => AddComponentResult | Promise<AddComponentResult>;
}>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "add", payload: AddComponentPayload): void;
}>();

const store = useMainStore();

const activeTab = ref<AddTab>("widget");
const searchText = ref("");
const destinationGroupId = ref("");
const activeWidgetCategory = ref<WidgetUiCategory>("explore");
const activeSiteCategory = ref<SiteShortcutCategory | "all">("all");
const activeSortMode = ref<SiteShortcutSortMode>("featured");
const activeRecommendationBatch = ref(0);
const selectedSizeByItemId = ref<Record<string, WidgetCatalogSizeKey>>({});
const busyKey = ref("");
const resultMessage = ref("");
const customUploadInputRef = ref<HTMLInputElement | null>(null);

const customForm = ref<CustomIconDraft>({
  title: "",
  url: "",
  icon: "",
  iconText: "A",
  useTextIcon: false,
  description1: "",
  iconBackgroundMode: "auto",
  iconAutoBackgroundColor: "",
  iconCustomBackgroundColor: "#1890ff",
  color: "bg-gray-100 text-gray-700",
  titleColor: "",
  iconSize: 100,
});

const groups = computed(() => props.groups || store.groups);

const destinationOptions = computed(() =>
  groups.value.map((group) => ({
    id: group.id,
    title: group.title || "未命名分组",
  })),
);

const normalizeDestinationTitle = (title: string) =>
  title === "常用" || title === "常用收藏夹" ? "主页" : title;

const destinationLabel = computed(() =>
  normalizeDestinationTitle(
    destinationOptions.value.find(
      (group) => group.id === destinationGroupId.value,
    )?.title || "主页",
  ),
);

const ensureDestination = () => {
  const preferred = props.activeGroupId || destinationGroupId.value;
  const exists = destinationOptions.value.some(
    (group) => group.id === preferred,
  );
  destinationGroupId.value = exists
    ? preferred
    : destinationOptions.value[0]?.id || "";
};

watch(
  () => props.show,
  (show) => {
    if (!show) return;
    activeTab.value = "widget";
    searchText.value = "";
    activeWidgetCategory.value = "explore";
    activeSiteCategory.value = "browser";
    activeSortMode.value = "featured";
    activeRecommendationBatch.value = 0;
    selectedSizeByItemId.value = {};
    resultMessage.value = "";
    resetCustomForm();
    ensureDestination();
  },
  { immediate: true },
);

watch(destinationOptions, ensureDestination);

const tabs: { id: AddTab; label: string; testId: string; icon: string }[] = [
  {
    id: "widget",
    label: "小组件",
    testId: "itab-add-tab-widget",
    icon: "widget",
  },
  { id: "site", label: "网址导航", testId: "itab-add-tab-site", icon: "site" },
  {
    id: "custom",
    label: "自定义图标",
    testId: "itab-add-tab-custom",
    icon: "custom",
  },
];

const WIDGET_UI_CATEGORIES: {
  label: string;
  value: WidgetUiCategory;
  categories?: WidgetCatalogCategory[];
  types?: string[];
}[] = [
  { label: "探索", value: "explore" },
  { label: "全部", value: "all" },
  { label: "效率", value: "productivity", categories: ["common", "content"] },
  { label: "工具", value: "tool", categories: ["tool"] },
  {
    label: "开发",
    value: "development",
    categories: ["system"],
    types: ["custom-css", "iframe"],
  },
  { label: "设计", value: "design", types: ["custom-css", "iframe"] },
  {
    label: "创意",
    value: "creative",
    categories: ["custom", "content"],
  },
  {
    label: "娱乐",
    value: "entertainment",
    types: ["hot", "rss", "bookmarks"],
  },
  { label: "其他", value: "other", categories: ["system"] },
];

const categoryOptions = computed(() => WIDGET_UI_CATEGORIES);

const ITAB_WIDGET_RECOMMENDATION_BATCHES: ReplicaWidgetCard[][] = [
  [
    {
      id: "source-pdf-master-batch-1",
      catalogItemId: "itab-converter-suite-34",
      title: "PDF转换大师",
      description: "PDF转换大师",
      popularity: "2604",
      glyph: "PDF",
      previewKind: "pdf",
      previewTone: "blue",
      previewAsset: "/itab-live-assets/pdf-master.svg",
    },
    {
      id: "source-number-uppercase",
      catalogItemId: "itab-number-uppercase-35",
      title: "数字大写转换",
      description: "数字大写转换",
      popularity: "3.25万",
      glyph: "壹",
      previewKind: "number",
      previewTone: "slate",
      previewAsset: "/itab-live-assets/uppercase.svg",
    },
    {
      id: "source-gradient",
      catalogItemId: "itab-gradient-25",
      title: "渐变色",
      description:
        "集合180种线性渐变，您可以将其作用于任何网站，并且可以快速复制css3渐变颜色的代码用于您的项目中",
      popularity: "8.16万",
      glyph: "渐",
      previewKind: "gradient",
      previewTone: "purple",
      previewAsset: "/__itab-qa-skins/body/25-2x4.png",
      previewAssetFit: "cover",
    },
    {
      id: "source-weather",
      catalogItemId: "itab-weather-00",
      title: "天气",
      description:
        "准确预报全球近10000多个地区的一周天气预报，包括国内县级和县级以上全部城市",
      popularity: "10.26万",
      glyph: "天",
      previewKind: "weather",
      previewTone: "blue",
    },
    {
      id: "source-anniversary",
      catalogItemId: "itab-anniversary-03",
      title: "纪念日",
      description:
        "可配置纪念日、恋爱日期、倒数日等事件，支持日期、颜色、背景图片和蒙版设置",
      popularity: "9.01万",
      glyph: "纪",
      previewKind: "anniversary",
      previewTone: "pink",
    },
    {
      id: "source-clock",
      catalogItemId: "itab-clock-12",
      title: "时钟",
      description: "桌面翻页时钟，打开后可进入大屏时间面板",
      popularity: "4.56万",
      glyph: "时",
      previewKind: "clock",
      previewTone: "slate",
    },
    {
      id: "source-memo",
      catalogItemId: "itab-memo-04",
      title: "备忘录",
      description: "快速记录备忘内容，支持搜索、编辑和固定到桌面",
      popularity: "12.68万",
      glyph: "备",
      previewKind: "memo",
      previewTone: "amber",
    },
    {
      id: "source-todo",
      catalogItemId: "itab-todo-17",
      title: "待办事项",
      description: "记录任务清单，打开后可新增、编辑和勾选待办",
      popularity: "11.34万",
      glyph: "办",
      previewKind: "todo",
      previewTone: "blue",
    },
    {
      id: "source-pomodoro",
      catalogItemId: "itab-pomodoro-29",
      title: "番茄时钟",
      description: "专注计时、背景音和会话进度",
      popularity: "8.86万",
      glyph: "番",
      previewKind: "pomodoro",
      previewTone: "green",
    },
    {
      id: "source-poem",
      catalogItemId: "itab-poem-10",
      title: "今日诗词",
      description: "每天一句诗词名句，可查看出处、全文、译文和注释",
      popularity: "8.54万",
      glyph: "诗",
      previewKind: "quote",
      previewTone: "green",
    },
    {
      id: "source-daily-english",
      catalogItemId: "itab-daily-english-14",
      title: "今日英语",
      description: "每日英语句子、中文翻译和跟读音频",
      popularity: "7.42万",
      glyph: "英",
      previewKind: "english",
      previewTone: "slate",
    },
    {
      id: "source-audio-convert",
      catalogItemId: "itab-converter-suite-34",
      title: "音频格式转换",
      description: "支持mp3、wav、ogg、ac3、flac、opus、pcm、m4a、aac在线互转",
      popularity: "6.21万",
      glyph: "音",
      previewKind: "audio",
      previewTone: "cyan",
    },
    {
      id: "source-offwork",
      catalogItemId: "itab-offwork-22",
      title: "下班倒计时",
      description: "下班倒计时，打工人的必备神器。 下班还有 休息时间",
      popularity: "9.83万",
      glyph: "下",
      previewKind: "offwork",
      previewTone: "green",
    },
  ],
  [
    {
      id: "source-pdf-master",
      catalogItemId: "itab-converter-suite-34",
      title: "PDF转换大师",
      description: "PDF转换大师",
      popularity: "2604",
      glyph: "PDF",
      previewKind: "pdf",
      previewTone: "blue",
      previewAsset: "/itab-live-assets/pdf-master.svg",
    },
    {
      id: "source-sbti",
      catalogItemId: "custom-css",
      title: "SBTI人格测试",
      description:
        "SBTI（Silly Big Personality Test），直译''傻乎乎人格测试'，由B站UP主创作，核心定位是纯娱乐化精神状态自测工具，无专业心理学依据",
      popularity: "1129",
      glyph: "SB",
      previewKind: "sbti",
      previewTone: "purple",
    },
    {
      id: "source-image-compress",
      catalogItemId: "itab-converter-suite-34",
      title: "图片压缩",
      description: "不改变图片尺寸减小文件大小，支持20张批量处理",
      popularity: "7.17万",
      glyph: "图",
      previewKind: "image",
      previewTone: "cyan",
    },
    {
      id: "source-aippt",
      catalogItemId: "iframe",
      title: "AiPPT",
      description:
        "AiPPT结合最新AI技术，为用户提供一键生成高质量PPT的解决方案。无论是职场展示、教育课件还是销售报告，AiPPT均能快速生成符合需求的专业PPT，简化设计流程，提升工作效率",
      popularity: "7378",
      glyph: "AI",
      previewKind: "ai",
      previewTone: "pink",
    },
    {
      id: "source-pdf-master-alt",
      catalogItemId: "itab-converter-suite-34",
      title: "PDF转换大师",
      description:
        "PDF转换大师，提供PDF转换等功能，支持多种文件格式，PDF转Word、Excel、PPT，Word、Excel、PPT转PDF，PDF和图片互转，PDF拆分",
      popularity: "3.41万",
      glyph: "PDF",
      previewKind: "pdf",
      previewTone: "blue",
      previewAsset: "/itab-live-assets/pdf-master.svg",
    },
    {
      id: "source-sports",
      catalogItemId: "itab-hotsearch-02",
      title: "体育",
      description:
        "关注运动最新资讯和赛程，球迷的福利德乙升降级附加赛05-22 02:30沃尔夫斯堡VS帕德博恩",
      popularity: "5.98万",
      glyph: "体",
      previewKind: "sports",
      previewTone: "green",
    },
    {
      id: "source-2048",
      catalogItemId: "itab-2048-20",
      title: "2048",
      description:
        "《2048》是一款比较流行的数字游戏，合并相同方块，得到2048的方块!",
      popularity: "10.90万",
      glyph: "2",
      previewKind: "game",
      previewTone: "amber",
      previewText: "2048",
    },
  ],
];

const ITAB_SITE_REPLICA_CATALOG: StartDeckSiteShortcutCatalogItem[] = [
  {
    id: "itab-add-icon",
    title: "添加图标",
    description: "添加到桌面后，可以通过此图标快速打开添加图标功能",
    url: "https://go.itab.link/",
    category: "browser",
    glyph: "加",
    featuredRank: 1,
    updatedAt: "2026-05-22",
    popularity: 99,
  },
  {
    id: "itab-bookmarks",
    title: "书签",
    description: "快速打开浏览器书签管理",
    url: "https://go.itab.link/bookmarks",
    category: "browser",
    glyph: "签",
    featuredRank: 2,
    updatedAt: "2026-05-22",
    popularity: 98,
  },
  {
    id: "itab-widget-store",
    title: "组件商城",
    description: "添加到桌面后，快速打开iTab组件商店",
    url: "https://go.itab.link/store",
    category: "browser",
    glyph: "组",
    featuredRank: 3,
    updatedAt: "2026-05-22",
    popularity: 97,
  },
  {
    id: "itab-history",
    title: "历史记录",
    description: "快速打开浏览器历史记录",
    url: "https://go.itab.link/history",
    category: "browser",
    glyph: "历",
    featuredRank: 4,
    updatedAt: "2026-05-22",
    popularity: 96,
  },
  {
    id: "itab-downloads",
    title: "下载管理",
    description: "快速打开浏览器的下载管理",
    url: "https://go.itab.link/downloads",
    category: "browser",
    glyph: "下",
    featuredRank: 5,
    updatedAt: "2026-05-22",
    popularity: 95,
  },
  {
    id: "itab-settings",
    title: "设置",
    description: "iTab设置，iTab设置的快捷访问图标",
    url: "https://go.itab.link/settings",
    category: "browser",
    glyph: "设",
    featuredRank: 6,
    updatedAt: "2026-05-22",
    popularity: 94,
  },
  {
    id: "itab-extensions",
    title: "扩展管理",
    description: "浏览器扩展中心",
    url: "https://chromewebstore.google.com/",
    category: "browser",
    glyph: "扩",
    featuredRank: 7,
    updatedAt: "2026-05-22",
    popularity: 93,
  },
  {
    id: "douyin",
    title: "抖音",
    description: "抖音",
    url: "https://www.douyin.com",
    category: "popular",
    glyph: "抖",
    featuredRank: 8,
    updatedAt: "2026-05-22",
    popularity: 92,
  },
  {
    id: "bilibili-source",
    title: "哔哩哔哩",
    description:
      "bilibili是国内知名的视频弹幕网站，这里有及时的动漫新番，活跃的ACG氛围，有创意的Up主。",
    url: "https://www.bilibili.com",
    category: "popular",
    glyph: "哔",
    featuredRank: 9,
    updatedAt: "2026-05-22",
    popularity: 91,
  },
  {
    id: "tencent-video",
    title: "腾讯视频",
    description: "腾讯视频致力于打造中国领先的在线视频媒体平台",
    url: "https://v.qq.com",
    category: "media",
    glyph: "腾",
    featuredRank: 10,
    updatedAt: "2026-05-22",
    popularity: 90,
  },
];

const query = computed(() => searchText.value.trim().toLowerCase());

const catalogById = computed(
  () => new Map(WIDGET_CATALOG.map((item) => [item.id, item] as const)),
);

const isReplicaWidgetRecommendation = computed(
  () => activeWidgetCategory.value === "explore" && !query.value,
);

const replicaWidgetCards = computed(
  () =>
    ITAB_WIDGET_RECOMMENDATION_BATCHES[
      activeRecommendationBatch.value %
        ITAB_WIDGET_RECOMMENDATION_BATCHES.length
    ] || ITAB_WIDGET_RECOMMENDATION_BATCHES[0]!,
);

const replicaCatalogItem = (card: ReplicaWidgetCard) =>
  catalogById.value.get(card.catalogItemId) ||
  getWidgetCatalogItem(card.catalogItemId);

const replicaActionLabel = (card: ReplicaWidgetCard) => {
  const item = replicaCatalogItem(card);
  return item ? actionLabel(item) : "待迁移";
};

const replicaActionDisabled = (card: ReplicaWidgetCard) => {
  const item = replicaCatalogItem(card);
  return !item || actionDisabled(item);
};

const replicaBusyKey = (card: ReplicaWidgetCard) => {
  const item = replicaCatalogItem(card);
  return `widget:${item?.id || card.catalogItemId}`;
};

const switchRecommendationBatch = () => {
  activeRecommendationBatch.value =
    (activeRecommendationBatch.value + 1) %
    ITAB_WIDGET_RECOMMENDATION_BATCHES.length;
};

const widgetSearchMatches = (item: WidgetCatalogItem) => {
  if (!query.value) return true;
  return [item.title, item.type, item.description].some((value) =>
    value.toLowerCase().includes(query.value),
  );
};

const filteredCatalog = computed(() =>
  WIDGET_CATALOG.filter((item) => {
    const activeCategory = WIDGET_UI_CATEGORIES.find(
      (category) => category.value === activeWidgetCategory.value,
    );
    const matchesCategory =
      !activeCategory ||
      activeCategory.value === "explore" ||
      activeCategory.value === "all" ||
      activeCategory.categories?.includes(item.category) ||
      activeCategory.types?.includes(item.type);
    return matchesCategory && widgetSearchMatches(item);
  }),
);

const siteCatalogItems = computed(
  () => props.siteFixtureState?.items ?? ITAB_SITE_REPLICA_CATALOG,
);
const siteLoading = computed(() => !!props.siteFixtureState?.loading);
const siteError = computed(() => props.siteFixtureState?.error || "");

const filteredSites = computed(() =>
  filterAndSortSiteShortcuts(siteCatalogItems.value, {
    category: activeSiteCategory.value,
    query: searchText.value,
    sortMode: activeSortMode.value,
  }),
);

const defaultSizeFor = (item: WidgetCatalogItem) => {
  const runtimeDefaultKey =
    "defaultSizeKey" in item.sizeFamily
      ? item.sizeFamily.defaultSizeKey
      : undefined;
  return (
    item.sizeFamily.supported.find(
      (candidate) => candidate.key === runtimeDefaultKey,
    ) ||
    item.sizeFamily.supported.find((candidate) => candidate.default) ||
    item.supportedSizes[0]!
  );
};

const selectedSize = (item: WidgetCatalogItem) => {
  const selectedKey = selectedSizeByItemId.value[item.id];
  return (
    item.sizeFamily.supported.find(
      (candidate) => candidate.key === selectedKey,
    ) || defaultSizeFor(item)
  );
};

const selectSize = (item: WidgetCatalogItem, size: WidgetCatalogSizePreset) => {
  selectedSizeByItemId.value = {
    ...selectedSizeByItemId.value,
    [item.id]: size.key,
  };
};

const actionLabel = (item: WidgetCatalogItem) => {
  const action = getWidgetCatalogAction(props.widgets, item);
  if (action === "enabled") return "已启用";
  if (action === "enable") return "启用";
  return "添加";
};

const actionDisabled = (item: WidgetCatalogItem) =>
  getWidgetCatalogAction(props.widgets, item) === "enabled";

const close = () => emit("update:show", false);

const tabIndex = computed(() =>
  tabs.findIndex((tab) => tab.id === activeTab.value),
);

const focusTabByOffset = (offset: number) => {
  const next = (tabIndex.value + offset + tabs.length) % tabs.length;
  activeTab.value = tabs[next]!.id;
};

const onTabKeydown = (event: KeyboardEvent) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  focusTabByOffset(event.key === "ArrowRight" ? 1 : -1);
};

const onSortKeydown = (event: KeyboardEvent) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const index = SITE_SHORTCUT_SORT_TABS.findIndex(
    (tab) => tab.id === activeSortMode.value,
  );
  const offset = event.key === "ArrowRight" ? 1 : -1;
  const next =
    (index + offset + SITE_SHORTCUT_SORT_TABS.length) %
    SITE_SHORTCUT_SORT_TABS.length;
  activeSortMode.value = SITE_SHORTCUT_SORT_TABS[next]!.id;
};

const invokeAdd = async (
  payload: AddComponentPayload,
  busyId: string,
): Promise<AddComponentResult> => {
  emit("add", payload);
  if (!props.onAddComponent) {
    return {
      status: "success",
      id:
        payload.kind === "widget"
          ? payload.catalogItemId
          : payload.navItem.id || "",
      groupId: payload.destinationGroupId,
    };
  }

  busyKey.value = busyId;
  resultMessage.value = "";
  try {
    const result = await props.onAddComponent(payload);
    resultMessage.value = result.message || "";
    return result;
  } finally {
    busyKey.value = "";
  }
};

const addWidget = async (item: WidgetCatalogItem) => {
  if (actionDisabled(item) || !destinationGroupId.value) return;
  const payload: AddComponentPayload = {
    kind: "widget",
    catalogItemId: item.id,
    destinationGroupId: destinationGroupId.value,
    saveMode: "dirty",
    sizeKey: selectedSize(item).key,
  };
  await invokeAdd(payload, `widget:${item.id}`);
};

const addReplicaWidget = async (card: ReplicaWidgetCard) => {
  const item = replicaCatalogItem(card);
  if (!item) {
    resultMessage.value = "当前复刻卡片尚未映射到可添加组件。";
    return;
  }
  await addWidget(item);
};

const addSite = async (itemId: string) => {
  const item = siteCatalogItems.value.find(
    (candidate) => candidate.id === itemId,
  );
  if (!item || !destinationGroupId.value) return;
  const mapped = createNavItemFromSiteShortcut(item);
  if (mapped.ok === false) {
    resultMessage.value = mapped.message;
    return;
  }

  const payload: AddComponentPayload = {
    kind: "site-shortcut",
    catalogItemId: item.id,
    destinationGroupId: destinationGroupId.value,
    saveMode: "save",
    navItem: mapped.navItem,
  };
  await invokeAdd(payload, `site:${item.id}`);
};

function resetCustomForm() {
  customForm.value = {
    title: "",
    url: "",
    icon: "",
    iconText: "A",
    useTextIcon: false,
    description1: "",
    iconBackgroundMode: "auto",
    iconAutoBackgroundColor: "",
    iconCustomBackgroundColor: "#1890ff",
    color: "bg-gray-100 text-gray-700",
    titleColor: "",
    iconSize: 100,
  };
}

const triggerCustomUpload = () => {
  customUploadInputRef.value?.click();
};

const onCustomUploadChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    resultMessage.value = "请上传小于 5MB 的图片。";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === "string") {
      customForm.value.icon = reader.result;
      customForm.value.useTextIcon = false;
    }
  };
  reader.onerror = () => {
    resultMessage.value = "图片读取失败，请重试。";
  };
  reader.readAsDataURL(file);
  if (customUploadInputRef.value) customUploadInputRef.value.value = "";
};

const onIconSelect = (result: SmartIconMatchResult) => {
  customForm.value.icon = result.icon;
  customForm.value.iconAutoBackgroundColor = result.backgroundColor || "";
  if (!customForm.value.title && result.label)
    customForm.value.title = result.label;
  if (customForm.value.iconBackgroundMode !== "custom") {
    customForm.value.iconBackgroundMode = "auto";
  }
};

const {
  smartMatchCandidates,
  selectedSmartMatchCandidateUrl,
  isSmartMatching,
  smartMatchIcons,
  selectSmartMatchCandidate,
} = useSmartIconMatch({
  form: customForm,
  onSelect: onIconSelect,
  notify: (message) => {
    resultMessage.value = message;
  },
});

const submitCustom = async (
  mode: Extract<AddSaveMode, "save" | "save-and-continue">,
) => {
  if (!destinationGroupId.value) return;
  const mapped = createNavItemFromCustomIcon(customForm.value);
  if (mapped.ok === false) {
    resultMessage.value = mapped.message;
    return;
  }
  const payload: AddComponentPayload = {
    kind: "custom-icon",
    destinationGroupId: destinationGroupId.value,
    saveMode: mode,
    navItem: mapped.navItem,
  };
  const result = await invokeAdd(payload, `custom:${mode}`);
  if (result.status === "success") {
    if (mode === "save") {
      close();
    } else {
      resetCustomForm();
    }
  }
};
</script>

<template>
  <AppModalShell
    :show="show"
    :z-index="70"
    close-on-overlay
    close-on-escape
    initial-focus="[data-testid='itab-add-search']"
    overlay-class="itab-add-overlay"
    panel-class="itab-add-panel"
    surface-class="itab-add-surface"
    body-class="itab-add-body"
    aria-label="添加"
    :show-traffic-lights="false"
    :show-close="false"
    @close="close"
  >
    <div data-testid="itab-add-modal" class="itab-add-layout">
      <div class="itab-add-window-controls" aria-hidden="true">
        <span class="is-green"></span>
        <span class="is-red"></span>
      </div>
      <aside class="itab-add-sidebar" role="tablist" aria-label="添加类型">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="itab-add-left-tab"
          :class="{ 'is-active': activeTab === tab.id }"
          role="tab"
          :aria-selected="activeTab === tab.id"
          :tabindex="activeTab === tab.id ? 0 : -1"
          :data-testid="tab.testId"
          @click="activeTab = tab.id"
          @keydown="onTabKeydown"
        >
          <span class="itab-add-left-icon" aria-hidden="true">
            <svg v-if="tab.icon === 'widget'" viewBox="0 0 20 20" fill="none">
              <circle cx="6" cy="6" r="2.1" stroke="currentColor" />
              <circle cx="14" cy="6" r="2.1" stroke="currentColor" />
              <circle cx="6" cy="14" r="2.1" stroke="currentColor" />
              <circle cx="14" cy="14" r="2.1" stroke="currentColor" />
            </svg>
            <svg
              v-else-if="tab.icon === 'site'"
              viewBox="0 0 20 20"
              fill="none"
            >
              <circle cx="10" cy="10" r="7" stroke="currentColor" />
              <path
                d="M3.5 10h13M10 3.2c2 2 2 11.6 0 13.6M10 3.2c-2 2-2 11.6 0 13.6"
                stroke="currentColor"
              />
            </svg>
            <svg v-else viewBox="0 0 20 20" fill="none">
              <path
                d="m5.3 14.7 7.9-7.9M12.5 3.8l3.7 3.7-2.2 2.2-3.7-3.7 2.2-2.2ZM4.2 13.8l2 2-1.9.9-.9-.9.8-2Z"
                stroke="currentColor"
                stroke-linejoin="round"
              />
              <path
                d="M5.3 4.6 7 6.3M3.7 6.2 5.4 8"
                stroke="currentColor"
                stroke-linecap="round"
              />
            </svg>
          </span>
          <span>{{ tab.label }}</span>
        </button>
      </aside>

      <section class="itab-add-main">
        <div v-if="activeTab !== 'custom'" class="itab-add-toolbar">
          <label class="itab-add-search-wrap">
            <span class="sr-only">搜索</span>
            <input
              v-model="searchText"
              data-testid="itab-add-search"
              type="search"
              placeholder="输入并搜索"
              class="itab-add-search"
            />
          </label>

          <label class="itab-add-destination-wrap">
            <span>添加到:</span>
            <span class="itab-add-destination-shell">
              <span class="itab-add-destination-label">{{
                destinationLabel
              }}</span>
              <select
                v-model="destinationGroupId"
                data-testid="itab-add-destination"
                class="itab-add-destination"
                aria-label="添加到"
              >
                <option
                  v-for="group in destinationOptions"
                  :key="group.id"
                  :value="group.id"
                >
                  {{ normalizeDestinationTitle(group.title) }}
                </option>
              </select>
            </span>
          </label>
        </div>

        <div v-if="resultMessage" class="itab-add-result" role="status">
          {{ resultMessage }}
        </div>

        <div v-if="activeTab === 'widget'" class="itab-add-pane">
          <div class="itab-add-chip-row" aria-label="组件分类">
            <button
              v-for="category in categoryOptions"
              :key="category.value"
              type="button"
              data-testid="itab-add-category-chip"
              class="itab-add-chip"
              :class="{ 'is-active': activeWidgetCategory === category.value }"
              :aria-pressed="activeWidgetCategory === category.value"
              @click="activeWidgetCategory = category.value"
            >
              {{ category.label }}
            </button>
          </div>

          <div
            class="itab-add-rank-row"
            role="tablist"
            aria-label="组件排序"
            @keydown="onSortKeydown"
          >
            <button
              v-for="tab in SITE_SHORTCUT_SORT_TABS"
              :key="tab.id"
              type="button"
              data-testid="itab-add-rank-tab"
              class="itab-add-rank-tab"
              :class="{ 'is-active': activeSortMode === tab.id }"
              role="tab"
              :aria-selected="activeSortMode === tab.id"
              :tabindex="activeSortMode === tab.id ? 0 : -1"
              @click="activeSortMode = tab.id"
            >
              {{ tab.label }}
            </button>
            <button
              v-if="isReplicaWidgetRecommendation"
              type="button"
              data-testid="itab-add-batch-button"
              class="itab-add-batch-button"
              @click="switchRecommendationBatch"
            >
              换一批
            </button>
          </div>

          <div
            v-if="isReplicaWidgetRecommendation"
            class="itab-add-widget-grid is-replica"
          >
            <article
              v-for="card in replicaWidgetCards"
              :key="card.id"
              data-testid="itab-add-widget-card"
              class="itab-add-widget-card is-replica-card"
              :class="[
                `is-tone-${card.previewTone}`,
                `is-preview-${card.previewKind}`,
              ]"
            >
              <div class="itab-add-replica-heading">
                <h3>{{ card.title }}</h3>
                <p>{{ card.description }}</p>
              </div>
              <div class="itab-add-replica-preview">
                <span class="itab-add-replica-art">
                  <img
                    v-if="card.previewAsset"
                    :src="card.previewAsset"
                    alt=""
                    class="itab-add-replica-asset"
                    :class="{
                      'is-cover': card.previewAssetFit === 'cover',
                    }"
                  />
                  <span
                    v-else-if="card.previewKind === 'pdf'"
                    class="itab-add-pdf-art"
                  >
                    <span>W</span>
                    <span>X</span>
                    <strong>PDF转换大师</strong>
                    <span>P</span>
                  </span>
                  <span
                    v-else-if="card.previewKind === 'gradient'"
                    class="itab-add-gradient-art"
                  ></span>
                  <span
                    v-else-if="card.previewKind === 'weather'"
                    class="itab-add-weather-art"
                  >
                    <strong>25°</strong>
                    <span>龙华 · 大雨</span>
                  </span>
                  <span
                    v-else-if="card.previewKind === 'clock'"
                    class="itab-add-clock-art"
                  >
                    <strong>21:09</strong>
                    <span>05/21 周四</span>
                  </span>
                  <span
                    v-else-if="card.previewKind === 'offwork'"
                    class="itab-add-offwork-art"
                  >
                    <strong>休息时间</strong>
                    <span>下班倒计时</span>
                  </span>
                  <span
                    v-else-if="card.previewKind === 'memo'"
                    class="itab-add-memo-art"
                  >
                    <strong>备忘录</strong>
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                  <span
                    v-else-if="card.previewKind === 'todo'"
                    class="itab-add-todo-art"
                  >
                    <strong>待办事项(3)</strong>
                    <span><i></i>评审 UI</span>
                    <span><i></i>补充 QA</span>
                  </span>
                  <span
                    v-else-if="card.previewKind === 'pomodoro'"
                    class="itab-add-pomodoro-art"
                  >
                    <strong>25:00</strong>
                    <span>海浪</span>
                  </span>
                  <span
                    v-else-if="card.previewKind === 'english'"
                    class="itab-add-english-art"
                  >
                    <b>跟读</b>
                    <strong>Light stretches longer</strong>
                    <span>日光拉得更长</span>
                  </span>
                  <span v-else class="itab-add-replica-glyph">{{
                    card.glyph
                  }}</span>
                </span>
                <span class="itab-add-replica-dots" aria-hidden="true">
                  <span></span>
                  <span></span>
                  <span></span>
                  <span class="is-active"></span>
                  <span></span>
                </span>
              </div>
              <div class="itab-add-replica-footer">
                <span class="itab-add-replica-popularity">
                  <span aria-hidden="true">🔥</span>
                  {{ card.popularity }}
                </span>
                <button
                  type="button"
                  data-testid="itab-add-card-add"
                  class="itab-add-card-button"
                  :disabled="
                    replicaActionDisabled(card) ||
                    busyKey === replicaBusyKey(card)
                  "
                  :aria-disabled="replicaActionDisabled(card)"
                  :aria-label="`${replicaActionLabel(card)} ${card.title}`"
                  @click="addReplicaWidget(card)"
                >
                  {{
                    busyKey === replicaBusyKey(card)
                      ? "处理中"
                      : replicaActionLabel(card)
                  }}
                </button>
              </div>
            </article>
          </div>

          <div v-else class="itab-add-widget-grid">
            <article
              v-for="item in filteredCatalog"
              :key="item.id"
              data-testid="itab-add-widget-card"
              class="itab-add-widget-card"
              :class="{ 'is-enabled': actionDisabled(item) }"
            >
              <div class="itab-add-widget-preview">
                <WidgetSizeVariantPreview
                  :type="item.type"
                  :title="item.title"
                  :glyph="item.glyph"
                  :size="selectedSize(item)"
                  preview-role="hero"
                />
              </div>
              <div class="itab-add-widget-copy">
                <h3>{{ item.title }}</h3>
                <p>{{ item.description }}</p>
              </div>
              <div class="itab-add-size-row" :aria-label="`${item.title} 尺寸`">
                <button
                  v-for="size in item.sizeFamily.supported"
                  :key="size.key"
                  type="button"
                  class="itab-add-size-button"
                  :class="{ 'is-active': selectedSize(item).key === size.key }"
                  :aria-pressed="selectedSize(item).key === size.key"
                  @click="selectSize(item, size)"
                >
                  {{ size.label }}
                </button>
              </div>
              <button
                type="button"
                data-testid="itab-add-card-add"
                class="itab-add-card-button"
                :disabled="
                  actionDisabled(item) || busyKey === `widget:${item.id}`
                "
                :aria-disabled="actionDisabled(item)"
                :aria-label="`${actionLabel(item)} ${item.title}`"
                @click="addWidget(item)"
              >
                {{
                  busyKey === `widget:${item.id}` ? "处理中" : actionLabel(item)
                }}
              </button>
            </article>
          </div>

          <div
            v-if="
              !isReplicaWidgetRecommendation && filteredCatalog.length === 0
            "
            class="itab-add-empty"
          >
            未找到小组件
          </div>
        </div>

        <div v-else-if="activeTab === 'site'" class="itab-add-pane">
          <div class="itab-add-chip-row" aria-label="网址分类">
            <button
              v-for="category in SITE_SHORTCUT_CATEGORIES"
              :key="category.id"
              type="button"
              data-testid="itab-add-category-chip"
              class="itab-add-chip"
              :class="{ 'is-active': activeSiteCategory === category.id }"
              :aria-pressed="activeSiteCategory === category.id"
              @click="activeSiteCategory = category.id"
            >
              {{ category.label }}
            </button>
          </div>

          <div
            v-if="siteLoading"
            data-testid="itab-add-site-loading"
            class="itab-add-state"
            role="status"
          >
            正在加载网址导航...
          </div>
          <div
            v-else-if="siteError"
            data-testid="itab-add-site-error"
            class="itab-add-state is-error"
            role="alert"
          >
            {{ siteError }}
          </div>
          <div v-else-if="filteredSites.length > 0" class="itab-add-site-grid">
            <article
              v-for="item in filteredSites"
              :key="item.id"
              data-testid="itab-add-site-card"
              class="itab-add-site-card"
            >
              <div class="itab-add-site-icon" aria-hidden="true">
                <img :src="getSiteShortcutIcon(item)" alt="" />
              </div>
              <div class="itab-add-site-copy">
                <h3>{{ item.title }}</h3>
                <p>{{ item.description }}</p>
                <span>{{ item.url.replace(/^https?:\/\//, "") }}</span>
              </div>
              <button
                type="button"
                data-testid="itab-add-card-add"
                class="itab-add-site-add"
                :disabled="busyKey === `site:${item.id}`"
                :aria-label="`添加 ${item.title}`"
                @click="addSite(item.id)"
              >
                添加
              </button>
            </article>
          </div>

          <div v-else data-testid="itab-add-site-empty" class="itab-add-empty">
            未找到网址
          </div>
        </div>

        <form
          v-else
          class="itab-add-custom-form"
          @submit.prevent="submitCustom('save')"
        >
          <div class="itab-add-custom-preview">
            <div class="itab-add-custom-icon">
              <img
                v-if="customForm.icon && !customForm.useTextIcon"
                :src="customForm.icon"
                alt=""
              />
              <span v-else>{{
                customForm.iconText || customForm.title.slice(0, 1) || "+"
              }}</span>
            </div>
            <div>
              <h3>{{ customForm.title || "自定义图标" }}</h3>
              <p>{{ customForm.url || "输入网址后可自动获取图标" }}</p>
            </div>
          </div>

          <label class="itab-add-field">
            <span>地址</span>
            <input
              v-model="customForm.url"
              data-testid="itab-add-custom-url"
              type="url"
              placeholder="https://"
              autocomplete="url"
            />
          </label>
          <button
            type="button"
            data-testid="itab-add-custom-fetch-icon"
            class="itab-add-secondary-button"
            :disabled="isSmartMatching"
            @click="smartMatchIcons"
          >
            {{ isSmartMatching ? "获取中" : "获取图标" }}
          </button>

          <div
            v-if="smartMatchCandidates.length > 0"
            class="itab-add-icon-candidates"
          >
            <button
              v-for="candidate in smartMatchCandidates"
              :key="candidate.url"
              type="button"
              class="itab-add-icon-candidate"
              :class="{
                'is-active': selectedSmartMatchCandidateUrl === candidate.url,
              }"
              :aria-label="`选择 ${candidate.label || '候选图标'}`"
              @click="selectSmartMatchCandidate(candidate)"
            >
              <img :src="candidate.url" alt="" />
            </button>
          </div>

          <label class="itab-add-field">
            <span>名称</span>
            <input
              v-model="customForm.title"
              data-testid="itab-add-custom-title"
              type="text"
              placeholder="网站名称"
              autocomplete="off"
            />
          </label>

          <label class="itab-add-field">
            <span>说明</span>
            <input
              v-model="customForm.description1"
              type="text"
              placeholder="可选说明"
              autocomplete="off"
            />
          </label>

          <div class="itab-add-custom-options">
            <label class="itab-add-field">
              <span>图标颜色</span>
              <input
                v-model="customForm.iconCustomBackgroundColor"
                data-testid="itab-add-custom-icon-color"
                type="color"
                class="itab-add-color-input"
                @input="customForm.iconBackgroundMode = 'custom'"
              />
            </label>

            <label class="itab-add-field">
              <span>图标文字</span>
              <input
                v-model="customForm.iconText"
                data-testid="itab-add-custom-icon-text"
                type="text"
                maxlength="2"
                placeholder="A"
                autocomplete="off"
              />
            </label>

            <label class="itab-add-toggle">
              <input
                v-model="customForm.useTextIcon"
                data-testid="itab-add-custom-text-icon"
                type="checkbox"
              />
              <span>文字图标</span>
            </label>

            <input
              ref="customUploadInputRef"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon"
              class="sr-only"
              @change="onCustomUploadChange"
            />
            <button
              type="button"
              data-testid="itab-add-custom-upload"
              class="itab-add-secondary-button"
              @click="triggerCustomUpload"
            >
              上传
            </button>
          </div>

          <div class="itab-add-custom-actions">
            <button
              type="submit"
              data-testid="itab-add-custom-save"
              class="itab-add-primary-button"
              :disabled="busyKey === 'custom:save'"
            >
              保 存
            </button>
            <button
              type="button"
              data-testid="itab-add-custom-save-continue"
              class="itab-add-secondary-button"
              :disabled="busyKey === 'custom:save-and-continue'"
              @click="submitCustom('save-and-continue')"
            >
              保存并继续
            </button>
          </div>
        </form>
      </section>
    </div>
  </AppModalShell>
</template>

<style scoped>
:global(.itab-add-overlay) {
  background: rgba(0, 0, 0, 0.5);
  -webkit-backdrop-filter: blur(6px) brightness(1.08);
  backdrop-filter: blur(6px) brightness(1.08);
}

:global(.itab-add-panel) {
  width: min(1000px, calc(100vw - 32px));
}

:global(.itab-add-surface) {
  position: relative;
  overflow: hidden auto;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.45);
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
  -webkit-backdrop-filter: blur(24px) saturate(135%) brightness(1.35);
  backdrop-filter: blur(24px) saturate(135%) brightness(1.35);
}

:global(.itab-add-surface > .sd-window-bar) {
  display: none;
}

:global(.itab-add-body) {
  padding: 0;
  overflow: hidden;
}

.itab-add-layout {
  position: relative;
  display: grid;
  grid-template-columns: 154px minmax(0, 1fr);
  height: min(600px, calc(100vh - 96px));
  min-height: min(600px, calc(100vh - 96px));
  color: rgb(223, 221, 221);
}

.itab-add-window-controls {
  position: absolute;
  z-index: 3;
  top: 11px;
  right: 20px;
  display: inline-flex;
  gap: 9px;
}

.itab-add-window-controls span {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.28);
}

.itab-add-window-controls .is-green {
  background: rgb(0, 190, 38);
}

.itab-add-window-controls .is-red {
  background: rgb(255, 70, 82);
}

.itab-add-sidebar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-right: 0;
  background: transparent;
  padding: 78px 12px 22px;
}

.itab-add-left-tab {
  display: inline-flex;
  width: 140px;
  min-height: 38px;
  align-items: center;
  gap: 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: rgb(223, 221, 221);
  font-size: 14px;
  font-weight: 400;
  text-align: left;
  padding: 8px 18px;
}

.itab-add-left-tab:hover,
.itab-add-left-tab:focus-visible {
  background: rgba(255, 255, 255, 0.18);
  outline: none;
}

.itab-add-left-tab.is-active {
  position: relative;
  background: rgba(255, 255, 255, 0.11);
  color: rgb(223, 221, 221);
}

.itab-add-left-tab.is-active::before {
  content: "";
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: -12px;
  width: 3px;
  border-radius: 999px;
  background: rgb(24, 144, 255);
}

.itab-add-left-icon {
  display: inline-grid;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  place-items: center;
  color: rgba(223, 221, 221, 0.82);
}

.itab-add-left-icon svg {
  width: 18px;
  height: 18px;
  stroke-width: 1.8;
}

.itab-add-left-tab.is-active .itab-add-left-icon {
  color: rgba(223, 221, 221, 0.96);
}

.itab-add-main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
}

.itab-add-toolbar {
  display: grid;
  grid-template-columns: 220px auto;
  gap: 18px;
  align-items: center;
  justify-content: start;
  border-bottom: 0;
  padding: 17px 18px 11px;
}

.itab-add-search-wrap,
.itab-add-destination-wrap,
.itab-add-field {
  min-width: 0;
}

.itab-add-destination-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: rgb(223, 221, 221);
  font-size: 12px;
  font-weight: 400;
}

.itab-add-search-wrap {
  position: relative;
  display: flex;
  height: 24px;
  align-items: center;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.1);
  padding-left: 26px;
}

.itab-add-search-wrap::before {
  content: "";
  position: absolute;
  left: 9px;
  width: 11px;
  height: 11px;
  border: 1.5px solid rgba(223, 221, 221, 0.55);
  border-radius: 50%;
}

.itab-add-search-wrap::after {
  content: "";
  position: absolute;
  top: 14px;
  left: 19px;
  width: 6px;
  height: 1.5px;
  border-radius: 999px;
  background: rgba(223, 221, 221, 0.55);
  transform: rotate(45deg);
}

.itab-add-destination-wrap {
  height: 24px;
}

.itab-add-destination-shell {
  position: relative;
  display: inline-grid;
  width: 82px;
  height: 24px;
  align-items: center;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
}

.itab-add-destination-label {
  position: absolute;
  right: 23px;
  left: 11px;
  overflow: hidden;
  color: rgb(223, 221, 221);
  font-size: 12px;
  line-height: 24px;
  pointer-events: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.itab-add-destination-shell::after {
  content: "";
  position: absolute;
  top: 9px;
  right: 11px;
  width: 6px;
  height: 6px;
  border-right: 1.5px solid rgba(223, 221, 221, 0.58);
  border-bottom: 1.5px solid rgba(223, 221, 221, 0.58);
  pointer-events: none;
  transform: rotate(45deg);
}

.itab-add-search,
.itab-add-destination,
.itab-add-field input {
  width: 100%;
  min-width: 0;
  height: 24px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: rgb(223, 221, 221);
  font-size: 12px;
  outline: none;
  padding: 0;
}

.itab-add-destination {
  width: 100%;
  height: 100%;
  appearance: none;
  color: transparent;
  background: transparent;
  font-weight: 400;
  padding: 0;
}

.itab-add-search:focus,
.itab-add-destination:focus,
.itab-add-field input:focus {
  border-color: transparent;
  box-shadow: none;
}

.itab-add-result {
  margin: 10px 18px 0;
  border-radius: 8px;
  background: rgba(24, 144, 255, 0.1);
  color: #075985;
  font-size: 12px;
  font-weight: 700;
  padding: 8px 10px;
}

.itab-add-pane {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 3px;
  overflow: hidden;
  padding: 0 12px 18px 18px;
}

.itab-add-chip-row,
.itab-add-rank-row {
  display: flex;
  flex: 0 0 auto;
  overflow-x: auto;
  padding-bottom: 2px;
}

.itab-add-chip-row {
  gap: 10px;
}

.itab-add-rank-row {
  gap: 20px;
  align-items: center;
}

.itab-add-chip,
.itab-add-rank-tab,
.itab-add-size-button {
  height: 24px;
  border: 0;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(223, 221, 221, 0.82);
  font-size: 12px;
  font-weight: 400;
  white-space: nowrap;
  padding: 0 6px;
}

.itab-add-chip {
  min-width: 38px;
}

.itab-add-chip.is-active,
.itab-add-size-button.is-active {
  background: rgb(24, 144, 255);
  color: #fff;
}

.itab-add-rank-tab {
  height: 22px;
  border-radius: 0;
  background: transparent;
  color: rgba(223, 221, 221, 0.72);
  font-size: 14px;
  font-weight: 400;
  padding: 0;
}

.itab-add-rank-tab.is-active {
  background: transparent;
  color: rgb(223, 221, 221);
  font-size: 18px;
  font-weight: 700;
}

.itab-add-batch-button {
  width: 58px;
  height: 18px;
  margin-left: auto;
  margin-right: 25px;
  border: 0;
  background: transparent;
  color: rgba(223, 221, 221, 0.82);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  padding: 0;
}

.itab-add-widget-grid,
.itab-add-site-grid {
  display: grid;
  min-height: 0;
  flex: 1 1 auto;
  gap: 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 0;
  scrollbar-color: rgba(255, 255, 255, 0.28) transparent;
  scrollbar-width: thin;
}

.itab-add-widget-grid::-webkit-scrollbar,
.itab-add-site-grid::-webkit-scrollbar {
  width: 8px;
}

.itab-add-widget-grid::-webkit-scrollbar-track,
.itab-add-site-grid::-webkit-scrollbar-track {
  background: transparent;
}

.itab-add-widget-grid::-webkit-scrollbar-thumb,
.itab-add-site-grid::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.32);
}

.itab-add-widget-grid {
  grid-template-columns: repeat(2, minmax(260px, 1fr));
}

.itab-add-widget-grid.is-replica {
  grid-template-columns: repeat(2, 391.5px);
  justify-content: start;
  overflow-y: scroll;
  padding-right: 10px;
  scrollbar-gutter: stable;
}

.itab-add-site-grid {
  grid-template-columns: repeat(auto-fit, minmax(190px, 257px));
  align-content: start;
  justify-content: start;
}

.itab-add-widget-card,
.itab-add-site-card {
  position: relative;
  border: 0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.14);
  box-shadow: none;
}

.itab-add-widget-card {
  display: grid;
  grid-template-rows: 168px auto auto auto;
  min-height: 308px;
  padding: 10px;
}

.itab-add-widget-card.is-replica-card {
  grid-template-rows: 58px 190px 40px;
  gap: 0;
  overflow: hidden;
  color: rgb(223, 221, 221);
}

.itab-add-site-card {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 10px;
  min-height: 113px;
  padding: 0;
}

.itab-add-widget-card.is-enabled {
  opacity: 0.64;
}

.itab-add-widget-preview {
  display: grid;
  min-width: 0;
  overflow: hidden;
  place-items: center;
  border-radius: 12px;
  background:
    linear-gradient(135deg, rgba(24, 144, 255, 0.1), transparent),
    rgba(255, 255, 255, 0.22);
}

.itab-add-replica-preview {
  position: relative;
  display: grid;
  min-height: 190px;
  place-items: center;
  border-radius: 0;
  background: transparent;
}

.itab-add-replica-heading {
  display: grid;
  place-items: center;
  text-align: center;
}

.itab-add-replica-heading h3 {
  overflow: hidden;
  max-width: 94%;
  color: rgba(223, 221, 221, 0.92);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.itab-add-replica-heading p {
  display: -webkit-box;
  overflow: hidden;
  max-width: 92%;
  color: rgba(223, 221, 221, 0.64);
  font-size: 12px;
  line-height: 17px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.itab-add-replica-art {
  display: grid;
  place-items: center;
}

.itab-add-replica-dots {
  position: absolute;
  bottom: 14px;
  left: 50%;
  display: inline-flex;
  gap: 7px;
  transform: translateX(-50%);
}

.itab-add-replica-dots span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
}

.itab-add-replica-dots .is-active {
  background: rgba(255, 255, 255, 0.6);
}

.itab-add-widget-card.is-tone-blue .itab-add-replica-preview {
  background:
    radial-gradient(
      circle at 50% 40%,
      rgba(83, 157, 255, 0.38),
      transparent 36%
    ),
    linear-gradient(135deg, rgba(24, 144, 255, 0.32), rgba(12, 35, 64, 0.16));
}

.itab-add-widget-card.is-tone-purple .itab-add-replica-preview {
  background:
    radial-gradient(
      circle at 50% 40%,
      rgba(168, 85, 247, 0.36),
      transparent 36%
    ),
    linear-gradient(135deg, rgba(93, 70, 180, 0.32), rgba(21, 18, 51, 0.18));
}

.itab-add-widget-card.is-tone-amber .itab-add-replica-preview {
  background:
    radial-gradient(
      circle at 50% 40%,
      rgba(245, 158, 11, 0.36),
      transparent 36%
    ),
    linear-gradient(135deg, rgba(120, 73, 13, 0.36), rgba(38, 23, 7, 0.18));
}

.itab-add-widget-card.is-tone-green .itab-add-replica-preview {
  background:
    radial-gradient(
      circle at 50% 40%,
      rgba(74, 222, 128, 0.34),
      transparent 36%
    ),
    linear-gradient(135deg, rgba(22, 101, 52, 0.3), rgba(7, 36, 20, 0.18));
}

.itab-add-widget-card.is-tone-cyan .itab-add-replica-preview {
  background:
    radial-gradient(
      circle at 50% 40%,
      rgba(34, 211, 238, 0.34),
      transparent 36%
    ),
    linear-gradient(135deg, rgba(8, 145, 178, 0.28), rgba(8, 47, 73, 0.18));
}

.itab-add-widget-card.is-tone-pink .itab-add-replica-preview {
  background:
    radial-gradient(
      circle at 50% 40%,
      rgba(244, 114, 182, 0.34),
      transparent 36%
    ),
    linear-gradient(135deg, rgba(190, 24, 93, 0.26), rgba(80, 7, 36, 0.18));
}

.itab-add-widget-card.is-tone-slate .itab-add-replica-preview {
  background:
    radial-gradient(
      circle at 50% 40%,
      rgba(203, 213, 225, 0.25),
      transparent 36%
    ),
    linear-gradient(135deg, rgba(71, 85, 105, 0.3), rgba(15, 23, 42, 0.2));
}

.itab-add-widget-card.is-replica-card .itab-add-replica-preview {
  background: transparent;
}

.itab-add-replica-glyph {
  display: grid;
  width: 150px;
  height: 150px;
  place-items: center;
  border-radius: 18px;
  background: rgba(0, 0, 0, 0.18);
  color: rgba(255, 255, 255, 0.92);
  font-size: 64px;
  font-weight: 800;
}

.itab-add-replica-asset {
  display: block;
  width: 150px;
  height: 150px;
  border-radius: 18px;
  object-fit: contain;
}

.itab-add-replica-asset.is-cover {
  width: 150px;
  height: 90px;
  border-radius: 10px;
  object-fit: cover;
}

.itab-add-widget-card.is-preview-number .itab-add-replica-asset {
  background: rgb(14, 16, 20);
}

.itab-add-widget-card.is-preview-pdf .itab-add-replica-asset {
  width: 184px;
  height: 184px;
  transform: translateY(-5px);
}

.itab-add-widget-card.is-preview-number .itab-add-replica-asset {
  width: 152px;
  height: 152px;
  transform: translateY(-1px);
}

.itab-add-pdf-art {
  position: relative;
  display: grid;
  width: 118px;
  height: 118px;
  place-items: center;
  border-radius: 12px;
  background: linear-gradient(145deg, rgb(28, 136, 255), rgb(42, 90, 244));
  color: white;
  font-size: 12px;
  font-weight: 700;
  box-shadow: 0 12px 24px rgba(0, 39, 115, 0.28);
}

.itab-add-pdf-art span {
  position: absolute;
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 6px;
  color: white;
  font-size: 10px;
  font-weight: 800;
}

.itab-add-pdf-art span:nth-child(1) {
  top: 26px;
  left: 18px;
  background: rgb(86, 156, 255);
  transform: rotate(-10deg);
}

.itab-add-pdf-art span:nth-child(2) {
  bottom: 34px;
  left: 17px;
  background: rgb(79, 197, 116);
  transform: rotate(-14deg);
}

.itab-add-pdf-art span:nth-child(4) {
  top: 24px;
  right: 19px;
  background: rgb(255, 128, 47);
  transform: rotate(8deg);
}

.itab-add-pdf-art strong {
  margin-top: 30px;
  font-size: 14px;
  line-height: 1.1;
}

.itab-add-gradient-art {
  width: 118px;
  height: 118px;
  border-radius: 12px;
  background: linear-gradient(135deg, #cbff75, #70ffd4 50%, #7a63ff);
}

.itab-add-weather-art,
.itab-add-clock-art,
.itab-add-offwork-art,
.itab-add-todo-art,
.itab-add-pomodoro-art {
  display: grid;
  width: 142px;
  height: 92px;
  align-content: center;
  justify-items: center;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.22);
  color: white;
}

.itab-add-english-art {
  position: relative;
  overflow: hidden;
  display: grid;
  width: 142px;
  height: 92px;
  align-content: center;
  justify-items: start;
  padding: 12px;
  border-radius: 12px;
  background:
    linear-gradient(rgba(0, 0, 0, 0.58), rgba(0, 0, 0, 0.58)),
    url("/api/itab-resources/itab-itab-daily-english-14-body-2x4-background-86acdbf74c")
      center/cover no-repeat,
    #000;
  color: #fff;
}

.itab-add-english-art b {
  position: absolute;
  top: 9px;
  right: 9px;
  color: rgba(255, 255, 255, 0.52);
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
}

.itab-add-english-art strong {
  max-width: 96px;
  overflow: hidden;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.itab-add-english-art span {
  margin-top: 5px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
  line-height: 18px;
}

.itab-add-weather-art strong,
.itab-add-clock-art strong,
.itab-add-pomodoro-art strong {
  font-size: 38px;
  line-height: 1;
}

.itab-add-offwork-art strong {
  font-size: 20px;
  line-height: 1;
}

.itab-add-weather-art span,
.itab-add-clock-art span,
.itab-add-offwork-art span,
.itab-add-pomodoro-art span {
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

.itab-add-pomodoro-art {
  background:
    linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.45)),
    url("/itab/widget/tomato/hailang.jpg") center/cover no-repeat,
    #1b4d47;
}

.itab-add-memo-art {
  overflow: hidden;
  display: grid;
  width: 118px;
  height: 118px;
  border-radius: 18px;
  background: #fff;
  box-shadow: rgba(0, 0, 0, 0.16) 0 10px 22px;
}

.itab-add-memo-art strong {
  display: grid;
  height: 30px;
  place-items: center;
  background-image: linear-gradient(0deg, rgb(255, 201, 39), rgb(255, 164, 3));
  color: #fff;
  font-size: 12px;
  line-height: 18px;
}

.itab-add-memo-art span {
  height: 29px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.itab-add-todo-art {
  align-content: start;
  justify-items: stretch;
  padding: 10px 12px;
  background: #fff;
  color: rgba(0, 0, 0, 0.82);
  text-align: left;
}

.itab-add-todo-art strong {
  margin-bottom: 6px;
  color: rgb(52, 110, 253);
  font-size: 12px;
  line-height: 18px;
}

.itab-add-todo-art span {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
  color: rgba(0, 0, 0, 0.78);
  font-size: 12px;
  line-height: 24px;
}

.itab-add-todo-art i {
  width: 12px;
  height: 12px;
  flex: 0 0 12px;
  border: 2px solid rgb(147, 147, 147);
  border-radius: 3px;
}

.itab-add-replica-footer {
  display: flex;
  align-items: end;
  justify-content: space-between;
  padding: 13px 0 0;
}

.itab-add-widget-copy h3,
.itab-add-site-copy h3,
.itab-add-custom-preview h3 {
  overflow: hidden;
  color: rgb(223, 221, 221);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.itab-add-widget-copy p,
.itab-add-site-copy p,
.itab-add-custom-preview p {
  display: -webkit-box;
  overflow: hidden;
  color: rgba(223, 221, 221, 0.78);
  font-size: 12px;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.itab-add-replica-popularity {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 0;
  color: rgba(223, 221, 221, 0.64);
  font-size: 12px;
  line-height: 1.2;
}

.itab-add-size-row {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 2px 0;
}

.itab-add-card-button,
.itab-add-site-add,
.itab-add-primary-button,
.itab-add-secondary-button {
  height: 32px;
  border: 0;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 800;
}

.itab-add-card-button,
.itab-add-site-add,
.itab-add-primary-button {
  background: rgb(24, 144, 255);
  color: #fff;
}

.itab-add-card-button {
  position: static;
  width: 46px;
  height: 24px;
  border-radius: 20px;
  font-weight: 400;
}

.itab-add-widget-card:not(.is-replica-card) .itab-add-card-button {
  position: absolute;
  right: 10px;
  bottom: 10px;
}

.itab-add-card-button:disabled,
.itab-add-site-add:disabled,
.itab-add-primary-button:disabled,
.itab-add-secondary-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.itab-add-site-icon {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  align-self: start;
  margin: 12px 0 0 12px;
  overflow: hidden;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  color: rgb(223, 221, 221);
  font-size: 13px;
  font-weight: 900;
}

.itab-add-site-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.itab-add-site-copy {
  min-width: 0;
  padding-top: 12px;
  padding-right: 48px;
}

.itab-add-site-copy span {
  display: block;
  overflow: hidden;
  color: #94a3b8;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.itab-add-site-add {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 48px;
  height: 24px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.1);
  color: rgb(207, 211, 220);
  font-weight: 500;
}

.itab-add-empty {
  display: grid;
  min-height: 160px;
  place-items: center;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

.itab-add-state {
  display: grid;
  min-height: 160px;
  place-items: center;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.58);
  color: #475569;
  font-size: 13px;
  font-weight: 800;
}

.itab-add-state.is-error {
  background: rgba(254, 226, 226, 0.72);
  color: #991b1b;
}

.itab-add-custom-form {
  display: grid;
  align-content: start;
  grid-template-columns: 84px 290px 86px minmax(0, 1fr);
  gap: 18px 10px;
  overflow-y: auto;
  padding: 49px 18px 18px 30px;
}

.itab-add-custom-preview {
  display: none;
  align-items: center;
  gap: 12px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  padding: 14px;
}

.itab-add-custom-icon,
.itab-add-icon-candidate {
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 0;
  background: #e0f2fe;
}

.itab-add-custom-icon {
  width: 58px;
  height: 58px;
  border-radius: 16px;
  color: #0369a1;
  font-size: 24px;
  font-weight: 900;
}

.itab-add-custom-icon img,
.itab-add-icon-candidate img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.itab-add-field {
  display: grid;
  gap: 7px;
}

.itab-add-custom-form > .itab-add-field {
  display: contents;
}

.itab-add-custom-form > .itab-add-field:nth-of-type(3) {
  display: none;
}

.itab-add-custom-form > .itab-add-field span {
  grid-column: 1;
  align-self: center;
  justify-self: end;
}

.itab-add-custom-form > .itab-add-field input {
  grid-column: 2;
  width: 290px;
  height: 30px;
  border: 1px solid rgba(148, 163, 184, 0.32);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.12);
  padding: 0 10px;
}

.itab-add-custom-form > .itab-add-field:nth-of-type(2) input {
  grid-column: 2 / span 2;
  width: 376px;
}

.itab-add-custom-form > .itab-add-secondary-button {
  width: 86px;
}

.itab-add-field span {
  color: rgb(223, 221, 221);
  font-size: 12px;
  font-weight: 400;
}

.itab-add-custom-options {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: minmax(0, 156px) minmax(0, 156px) 120px 120px;
  gap: 12px;
  align-items: end;
  margin-top: 18px;
  padding-left: 84px;
}

.itab-add-custom-options .itab-add-field input {
  height: 34px;
  border: 1px solid rgba(148, 163, 184, 0.32);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.12);
  padding: 0 10px;
}

.itab-add-color-input {
  padding: 3px !important;
}

.itab-add-toggle {
  display: inline-flex;
  height: 34px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid rgba(148, 163, 184, 0.32);
  border-radius: 17px;
  background: rgb(44, 44, 44);
  color: rgb(223, 221, 221);
  font-size: 12px;
  font-weight: 800;
}

.itab-add-secondary-button {
  width: 120px;
  border: 1px solid rgba(148, 163, 184, 0.32);
  background: rgb(44, 44, 44);
  color: rgb(223, 221, 221);
}

.itab-add-icon-candidates {
  display: flex;
  grid-column: 2 / -1;
  gap: 8px;
}

.itab-add-icon-candidate {
  width: 40px;
  height: 40px;
  border-radius: 10px;
}

.itab-add-icon-candidate.is-active {
  box-shadow: 0 0 0 2px rgb(24, 144, 255);
}

.itab-add-custom-actions {
  display: flex;
  grid-column: 1 / -1;
  gap: 10px;
  margin-top: 111px;
  padding-left: 66px;
  padding-top: 4px;
}

.itab-add-primary-button {
  width: 120px;
}

@media (max-width: 834px) {
  .itab-add-layout {
    grid-template-columns: 1fr;
    height: min(680px, calc(100vh - 32px));
  }

  .itab-add-sidebar {
    flex-direction: row;
    overflow-x: auto;
    border-right: 0;
    border-bottom: 1px solid rgba(148, 163, 184, 0.22);
    padding: 10px 12px;
  }

  .itab-add-left-tab {
    width: auto;
    min-width: 104px;
    text-align: center;
  }

  .itab-add-toolbar {
    grid-template-columns: 1fr;
  }

  .itab-add-widget-grid,
  .itab-add-site-grid {
    grid-template-columns: 1fr;
  }

  .itab-add-custom-options {
    grid-template-columns: 1fr;
  }
}
</style>
