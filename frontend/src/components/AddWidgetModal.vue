<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppModalShell from "@/components/base/AppModalShell.vue";
import AppWindowControls from "@/components/base/AppWindowControls.vue";
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
} from "@/utils/widgetCatalog";

type AddTab = "widget" | "site" | "custom";
type ReplicaWidgetCard = {
  id: string;
  catalogItemId: string;
  title: string;
  description: string;
  glyph: string;
  previewKind:
    | "number"
    | "clock"
    | "weather"
    | "quote"
    | "english"
    | "memo"
    | "todo"
    | "pomodoro"
    | "food"
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
  | "system"
  | "development"
  | "design"
  | "creative"
  | "entertainment";

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
const busyKey = ref("");
const resultMessage = ref("");
const customUploadInputRef = ref<HTMLInputElement | null>(null);
const previewSizeKey: WidgetCatalogSizeKey = "2x2";

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
  { label: "系统", value: "system", categories: ["system"] },
  {
    label: "开发",
    value: "development",
    types: ["custom-css"],
  },
  { label: "设计", value: "design", types: ["custom-css"] },
  {
    label: "创意",
    value: "creative",
    categories: ["custom", "content"],
  },
  {
    label: "娱乐",
    value: "entertainment",
    types: ["itab-movie-calendar-05", "itab-poem-10", "itab-daily-english-14"],
  },
];

const categoryOptions = computed(() => WIDGET_UI_CATEGORIES);

const ITAB_WIDGET_RECOMMENDATION_BATCHES: ReplicaWidgetCard[][] = [
  [
    {
      id: "source-number-uppercase",
      catalogItemId: "itab-number-uppercase-35",
      title: "金额换算",
      description: "将金额转为大写",
      glyph: "¥",
      previewKind: "number",
      previewTone: "slate",
    },
    {
      id: "source-weather",
      catalogItemId: "itab-weather-00",
      title: "天气",
      description:
        "准确预报全球近10000多个地区的一周天气预报，包括国内县级和县级以上全部城市",
      glyph: "天",
      previewKind: "weather",
      previewTone: "blue",
    },
    {
      id: "source-ip",
      catalogItemId: "ip",
      title: "本机IP",
      description: "显示当前 IP 地址、归属地和网络信息",
      glyph: "IP",
      previewKind: "number",
      previewTone: "blue",
      previewAsset: "/itab-live-assets/ip.svg",
    },
    {
      id: "source-anniversary",
      catalogItemId: "itab-anniversary-03",
      title: "纪念日",
      description:
        "可配置纪念日、恋爱日期、倒数日等事件，支持日期、颜色、背景图片和蒙版设置",
      glyph: "纪",
      previewKind: "anniversary",
      previewTone: "pink",
    },
    {
      id: "source-clock",
      catalogItemId: "itab-clock-12",
      title: "时钟",
      description: "桌面翻页时钟，打开后可进入大屏时间面板",
      glyph: "时",
      previewKind: "clock",
      previewTone: "slate",
    },
    {
      id: "source-food-picker",
      catalogItemId: "itab-food-picker-15",
      title: "今天吃什么",
      description: "随机抽取用餐候选并维护本地菜单",
      glyph: "吃",
      previewKind: "food",
      previewTone: "amber",
    },
    {
      id: "source-memo",
      catalogItemId: "itab-memo-04",
      title: "备忘录",
      description: "快速记录备忘内容，支持搜索、编辑和固定到桌面",
      glyph: "备",
      previewKind: "memo",
      previewTone: "amber",
    },
    {
      id: "source-todo",
      catalogItemId: "itab-todo-17",
      title: "待办事项",
      description: "记录任务清单，打开后可新增、编辑和勾选待办",
      glyph: "办",
      previewKind: "todo",
      previewTone: "blue",
    },
    {
      id: "source-pomodoro",
      catalogItemId: "itab-pomodoro-29",
      title: "番茄时钟",
      description: "专注计时、背景音和会话进度",
      glyph: "番",
      previewKind: "pomodoro",
      previewTone: "green",
    },
    {
      id: "source-poem",
      catalogItemId: "itab-poem-10",
      title: "今日诗词",
      description: "每天一句诗词名句，可查看出处、全文、译文和注释",
      glyph: "诗",
      previewKind: "quote",
      previewTone: "green",
    },
    {
      id: "source-daily-english",
      catalogItemId: "itab-daily-english-14",
      title: "今日英语",
      description: "每日英语句子、中文翻译和跟读音频",
      glyph: "英",
      previewKind: "english",
      previewTone: "slate",
    },
    {
      id: "source-audio-convert",
      catalogItemId: "itab-converter-suite-34",
      title: "音频格式转换",
      description: "支持mp3、wav、ogg、ac3、flac、opus、pcm、m4a、aac在线互转",
      glyph: "音",
      previewKind: "audio",
      previewTone: "cyan",
    },
    {
      id: "source-offwork",
      catalogItemId: "itab-offwork-22",
      title: "下班倒计时",
      description: "下班倒计时，打工人的必备神器。 下班还有 休息时间",
      glyph: "下",
      previewKind: "offwork",
      previewTone: "green",
    },
  ],
  [
    {
      id: "source-sbti",
      catalogItemId: "custom-css",
      title: "SBTI人格测试",
      description:
        "SBTI（Silly Big Personality Test），直译''傻乎乎人格测试'，由B站UP主创作，核心定位是纯娱乐化精神状态自测工具，无专业心理学依据",
      glyph: "SB",
      previewKind: "sbti",
      previewTone: "purple",
    },
    {
      id: "source-image-compress",
      catalogItemId: "itab-converter-suite-34",
      title: "图片压缩",
      description: "不改变图片尺寸减小文件大小，支持20张批量处理",
      glyph: "图",
      previewKind: "image",
      previewTone: "cyan",
    },
    {
      id: "source-sports",
      catalogItemId: "itab-hotsearch-02",
      title: "体育",
      description:
        "关注运动最新资讯和赛程，球迷的福利德乙升降级附加赛05-22 02:30沃尔夫斯堡VS帕德博恩",
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

const previewSizeFor = (item: WidgetCatalogItem) =>
  item.sizeFamily.supported.find(
    (candidate) => candidate.key === previewSizeKey,
  ) || defaultSizeFor(item);

const widgetPreviewFrameSrc = (item: WidgetCatalogItem) =>
  `/widget-preview?catalogId=${encodeURIComponent(item.id)}&size=${encodeURIComponent(previewSizeFor(item).key)}`;

const replicaPreviewFrameSrc = (card: ReplicaWidgetCard) => {
  const item = replicaCatalogItem(card);
  return item ? widgetPreviewFrameSrc(item) : "";
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
    sizeKey: defaultSizeFor(item).key,
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
      <AppWindowControls
        class="itab-add-window-controls"
        aria-label="添加组件窗口控制"
        close-label="关闭添加组件"
        @close="close"
      />
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

          <div v-if="isReplicaWidgetRecommendation" class="itab-add-rank-row">
            <button
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
                  <iframe
                    v-if="replicaPreviewFrameSrc(card)"
                    class="itab-add-widget-preview-frame"
                    :src="replicaPreviewFrameSrc(card)"
                    :title="`${card.title} 2x2 预览`"
                    loading="lazy"
                    sandbox="allow-scripts allow-same-origin"
                    aria-hidden="true"
                    tabindex="-1"
                  ></iframe>
                  <img
                    v-else-if="card.previewAsset"
                    :src="card.previewAsset"
                    alt=""
                    class="itab-add-replica-asset"
                    :class="{
                      'is-cover': card.previewAssetFit === 'cover',
                    }"
                  />
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
              </div>
              <div class="itab-add-replica-footer">
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

          <div v-else class="itab-add-widget-grid is-replica">
            <article
              v-for="item in filteredCatalog"
              :key="item.id"
              data-testid="itab-add-widget-card"
              class="itab-add-widget-card is-replica-card is-catalog-card"
              :class="{ 'is-enabled': actionDisabled(item) }"
            >
              <div class="itab-add-replica-heading">
                <h3>{{ item.title }}</h3>
                <p>{{ item.description }}</p>
              </div>
              <div class="itab-add-replica-preview">
                <span class="itab-add-replica-art">
                  <iframe
                    class="itab-add-widget-preview-frame"
                    :src="widgetPreviewFrameSrc(item)"
                    :title="`${item.title} 2x2 预览`"
                    loading="lazy"
                    sandbox="allow-scripts allow-same-origin"
                    aria-hidden="true"
                    tabindex="-1"
                  ></iframe>
                </span>
              </div>
              <div class="itab-add-replica-footer">
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
                    busyKey === `widget:${item.id}`
                      ? "处理中"
                      : actionLabel(item)
                  }}
                </button>
              </div>
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
  background: var(--sd-theme-add-widget-modal-surface-01);
  -webkit-backdrop-filter: blur(10px) saturate(135%) brightness(0.7);
  backdrop-filter: blur(10px) saturate(135%) brightness(0.7);
}

:global(.itab-add-panel) {
  width: min(1000px, calc(100vw - 32px));
}

:global(.itab-add-surface) {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--sd-shell-border);
  border-radius: 20px;
  background: var(--sd-shell-surface);
  background-image: none;
  box-shadow: var(--sd-shadow-window);
  -webkit-backdrop-filter: saturate(135%) blur(28px) brightness(0.62);
  backdrop-filter: saturate(135%) blur(28px) brightness(0.62);
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
  color: var(--sd-shell-text-primary);
}

.itab-add-window-controls {
  position: absolute;
  z-index: 3;
  top: 11px;
  right: 20px;
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
  color: var(--sd-theme-add-widget-modal-text-01);
  font-size: 14px;
  font-weight: 400;
  text-align: left;
  padding: 8px 18px;
}

.itab-add-left-tab:hover,
.itab-add-left-tab:focus-visible {
  background: var(--sd-theme-add-widget-modal-surface-02);
  outline: none;
}

.itab-add-left-tab.is-active {
  position: relative;
  background: var(--sd-theme-add-widget-modal-surface-03);
  color: var(--sd-theme-add-widget-modal-text-01);
}

.itab-add-left-tab.is-active::before {
  content: "";
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: -12px;
  width: 3px;
  border-radius: 999px;
  background: var(--sd-theme-add-widget-modal-accent-surface-01);
}

.itab-add-left-icon {
  display: inline-grid;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  place-items: center;
  color: var(--sd-theme-add-widget-modal-text-02);
}

.itab-add-left-icon svg {
  width: 18px;
  height: 18px;
  stroke-width: 1.8;
}

.itab-add-left-tab.is-active .itab-add-left-icon {
  color: var(--sd-theme-add-widget-modal-text-03);
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
  color: var(--sd-theme-add-widget-modal-text-01);
  font-size: 12px;
  font-weight: 400;
}

.itab-add-search-wrap {
  position: relative;
  display: flex;
  height: 24px;
  align-items: center;
  border-radius: 14px;
  background: var(--sd-theme-add-widget-modal-surface-04);
  padding-left: 26px;
}

.itab-add-search-wrap::before {
  content: "";
  position: absolute;
  left: 9px;
  width: 11px;
  height: 11px;
  border: 1.5px solid var(--sd-theme-add-widget-modal-border-01);
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
  background: var(--sd-theme-add-widget-modal-surface-05);
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
  background: var(--sd-theme-add-widget-modal-surface-04);
}

.itab-add-destination-label {
  position: absolute;
  right: 23px;
  left: 11px;
  overflow: hidden;
  color: var(--sd-theme-add-widget-modal-text-01);
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
  border-right: 1.5px solid var(--sd-theme-add-widget-modal-border-02);
  border-bottom: 1.5px solid var(--sd-theme-add-widget-modal-border-02);
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
  color: var(--sd-theme-add-widget-modal-text-01);
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
  background: var(--sd-theme-add-widget-modal-accent-surface-02);
  color: var(--sd-theme-add-widget-modal-accent-text-01);
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
  align-items: center;
}

.itab-add-chip {
  height: 24px;
  border: 0;
  border-radius: 11px;
  background: var(--sd-theme-add-widget-modal-surface-06);
  color: var(--sd-theme-add-widget-modal-text-02);
  font-size: 12px;
  font-weight: 400;
  white-space: nowrap;
  padding: 0 6px;
}

.itab-add-chip {
  min-width: 38px;
}

.itab-add-chip.is-active {
  background: var(--sd-theme-add-widget-modal-accent-surface-01);
  color: var(--sd-theme-add-widget-modal-text-04);
}

.itab-add-batch-button {
  width: 58px;
  height: 18px;
  margin-left: auto;
  margin-right: 25px;
  border: 0;
  background: transparent;
  color: var(--sd-theme-add-widget-modal-text-02);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  padding: 0;
}

.itab-add-widget-grid,
.itab-add-site-grid {
  display: grid;
  width: 100%;
  min-height: 0;
  flex: 1 1 auto;
  gap: 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 0;
  scrollbar-color: var(--sd-theme-add-widget-modal-text-05) transparent;
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
  background: var(--sd-theme-add-widget-modal-surface-07);
}

.itab-add-widget-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
}

.itab-add-widget-grid.is-replica {
  grid-template-columns: repeat(2, 390px);
  grid-auto-rows: 308px;
  align-content: start;
  align-items: start;
  justify-content: start;
  overflow-y: auto;
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
  background: var(--sd-theme-add-widget-modal-surface-08);
  box-shadow: none;
}

.itab-add-widget-card {
  display: grid;
  grid-template-rows: 168px auto auto auto;
  min-height: 308px;
  padding: 10px;
}

.itab-add-widget-card.is-replica-card {
  width: 390px;
  height: 308px;
  min-height: 308px;
  grid-template-rows: 58px 190px 40px;
  gap: 0;
  overflow: hidden;
  color: var(--sd-theme-add-widget-modal-text-01);
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

.itab-add-widget-preview-frame {
  display: block;
  width: 150px;
  height: 150px;
  border: 0;
  border-radius: 18px;
  background: transparent;
  color-scheme: light dark;
  pointer-events: none;
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
  color: var(--sd-theme-add-widget-modal-text-06);
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
  color: var(--sd-theme-add-widget-modal-text-07);
  font-size: 12px;
  line-height: 17px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.itab-add-replica-art {
  display: grid;
  place-items: center;
}

.itab-add-widget-card.is-tone-blue .itab-add-replica-preview {
  background:
    radial-gradient(
      circle at 50% 40%,
      var(--sd-theme-add-widget-modal-accent-surface-03),
      transparent 36%
    ),
    linear-gradient(
      135deg,
      var(--sd-theme-add-widget-modal-accent-surface-04),
      var(--sd-theme-add-widget-modal-accent-surface-05)
    );
}

.itab-add-widget-card.is-tone-purple .itab-add-replica-preview {
  background:
    radial-gradient(
      circle at 50% 40%,
      var(--sd-theme-add-widget-modal-accent-surface-06),
      transparent 36%
    ),
    linear-gradient(
      135deg,
      var(--sd-theme-add-widget-modal-accent-surface-07),
      var(--sd-theme-add-widget-modal-accent-surface-08)
    );
}

.itab-add-widget-card.is-tone-amber .itab-add-replica-preview {
  background:
    radial-gradient(
      circle at 50% 40%,
      var(--sd-theme-add-widget-modal-accent-surface-09),
      transparent 36%
    ),
    linear-gradient(
      135deg,
      var(--sd-theme-add-widget-modal-accent-surface-10),
      var(--sd-theme-add-widget-modal-accent-surface-11)
    );
}

.itab-add-widget-card.is-tone-green .itab-add-replica-preview {
  background:
    radial-gradient(
      circle at 50% 40%,
      var(--sd-theme-add-widget-modal-accent-surface-12),
      transparent 36%
    ),
    linear-gradient(
      135deg,
      var(--sd-theme-add-widget-modal-accent-surface-13),
      var(--sd-theme-add-widget-modal-accent-surface-14)
    );
}

.itab-add-widget-card.is-tone-cyan .itab-add-replica-preview {
  background:
    radial-gradient(
      circle at 50% 40%,
      var(--sd-theme-add-widget-modal-accent-surface-15),
      transparent 36%
    ),
    linear-gradient(
      135deg,
      var(--sd-theme-add-widget-modal-accent-surface-16),
      var(--sd-theme-add-widget-modal-accent-surface-17)
    );
}

.itab-add-widget-card.is-tone-pink .itab-add-replica-preview {
  background:
    radial-gradient(
      circle at 50% 40%,
      var(--sd-theme-add-widget-modal-accent-surface-18),
      transparent 36%
    ),
    linear-gradient(
      135deg,
      var(--sd-theme-add-widget-modal-accent-surface-19),
      var(--sd-theme-add-widget-modal-accent-surface-20)
    );
}

.itab-add-widget-card.is-tone-slate .itab-add-replica-preview {
  background:
    radial-gradient(
      circle at 50% 40%,
      var(--sd-theme-add-widget-modal-surface-09),
      transparent 36%
    ),
    linear-gradient(
      135deg,
      var(--sd-theme-add-widget-modal-accent-surface-21),
      var(--sd-theme-add-widget-modal-accent-surface-22)
    );
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
  background: var(--sd-theme-add-widget-modal-surface-10);
  color: var(--sd-theme-add-widget-modal-text-08);
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
  background: var(--sd-theme-add-widget-modal-accent-surface-23);
}

.itab-add-widget-card.is-preview-number .itab-add-replica-asset {
  width: 152px;
  height: 152px;
  transform: translateY(-1px);
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
  background: var(--sd-theme-add-widget-modal-surface-01);
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
    linear-gradient(
      var(--sd-theme-add-widget-modal-surface-11),
      var(--sd-theme-add-widget-modal-surface-11)
    ),
    url("/api/itab-resources/itab-itab-daily-english-14-body-2x4-background-86acdbf74c")
      center/cover no-repeat,
    var(--sd-theme-add-widget-modal-surface-12);
  color: var(--sd-theme-add-widget-modal-text-04);
}

.itab-add-english-art b {
  position: absolute;
  top: 9px;
  right: 9px;
  color: var(--sd-theme-add-widget-modal-text-09);
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
  color: var(--sd-theme-add-widget-modal-text-10);
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
  color: var(--sd-theme-add-widget-modal-text-10);
  font-size: 12px;
}

.itab-add-pomodoro-art {
  background:
    linear-gradient(
      var(--sd-theme-add-widget-modal-surface-13),
      var(--sd-theme-add-widget-modal-surface-14)
    ),
    url("/itab/widget/tomato/hailang.jpg") center/cover no-repeat,
    var(--sd-theme-add-widget-modal-accent-surface-24);
}

.itab-add-memo-art {
  overflow: hidden;
  display: grid;
  width: 118px;
  height: 118px;
  border-radius: 18px;
  background: var(--sd-theme-add-widget-modal-surface-15);
  box-shadow: var(--sd-theme-add-widget-modal-shadow-01) 0 10px 22px;
}

.itab-add-memo-art strong {
  display: grid;
  height: 30px;
  place-items: center;
  background-image: linear-gradient(
    0deg,
    var(--sd-theme-add-widget-modal-accent-surface-25),
    var(--sd-theme-add-widget-modal-accent-surface-26)
  );
  color: var(--sd-theme-add-widget-modal-text-04);
  font-size: 12px;
  line-height: 18px;
}

.itab-add-memo-art span {
  height: 29px;
  border-bottom: 1px solid var(--sd-theme-add-widget-modal-border-03);
}

.itab-add-todo-art {
  align-content: start;
  justify-items: stretch;
  padding: 10px 12px;
  background: var(--sd-theme-add-widget-modal-surface-15);
  color: var(--sd-theme-add-widget-modal-text-11);
  text-align: left;
}

.itab-add-todo-art strong {
  margin-bottom: 6px;
  color: var(--sd-theme-add-widget-modal-accent-text-02);
  font-size: 12px;
  line-height: 18px;
}

.itab-add-todo-art span {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
  color: var(--sd-theme-add-widget-modal-text-12);
  font-size: 12px;
  line-height: 24px;
}

.itab-add-todo-art i {
  width: 12px;
  height: 12px;
  flex: 0 0 12px;
  border: 2px solid var(--sd-theme-add-widget-modal-border-04);
  border-radius: 3px;
}

.itab-add-replica-footer {
  display: flex;
  align-items: end;
  justify-content: flex-end;
  padding: 13px 12px 0;
}

.itab-add-site-copy h3,
.itab-add-custom-preview h3 {
  overflow: hidden;
  color: var(--sd-theme-add-widget-modal-text-01);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.itab-add-site-copy p,
.itab-add-custom-preview p {
  display: -webkit-box;
  overflow: hidden;
  color: var(--sd-theme-add-widget-modal-text-13);
  font-size: 12px;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
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
  background: var(--sd-theme-add-widget-modal-accent-surface-01);
  color: var(--sd-theme-add-widget-modal-text-04);
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
  background: var(--sd-theme-add-widget-modal-surface-04);
  color: var(--sd-theme-add-widget-modal-text-01);
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
  color: var(--sd-theme-add-widget-modal-text-14);
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
  background: var(--sd-theme-add-widget-modal-surface-04);
  color: var(--sd-theme-add-widget-modal-text-15);
  font-weight: 500;
}

.itab-add-empty {
  display: grid;
  min-height: 160px;
  place-items: center;
  color: var(--sd-theme-add-widget-modal-accent-text-03);
  font-size: 13px;
  font-weight: 700;
}

.itab-add-state {
  display: grid;
  min-height: 160px;
  place-items: center;
  border: 1px solid var(--sd-theme-add-widget-modal-border-05);
  border-radius: 8px;
  background: var(--sd-theme-add-widget-modal-surface-16);
  color: var(--sd-theme-add-widget-modal-accent-text-04);
  font-size: 13px;
  font-weight: 800;
}

.itab-add-state.is-error {
  background: var(--sd-theme-add-widget-modal-surface-17);
  color: var(--sd-theme-add-widget-modal-accent-text-05);
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
  border: 1px solid var(--sd-theme-add-widget-modal-border-05);
  border-radius: 8px;
  background: var(--sd-theme-add-widget-modal-surface-18);
  padding: 14px;
}

.itab-add-custom-icon,
.itab-add-icon-candidate {
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 0;
  background: var(--sd-theme-add-widget-modal-surface-19);
}

.itab-add-custom-icon {
  width: 58px;
  height: 58px;
  border-radius: 16px;
  color: var(--sd-theme-add-widget-modal-accent-text-06);
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
  border: 1px solid var(--sd-theme-add-widget-modal-border-06);
  border-radius: 6px;
  background: var(--sd-theme-add-widget-modal-surface-06);
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
  color: var(--sd-theme-add-widget-modal-text-01);
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
  border: 1px solid var(--sd-theme-add-widget-modal-border-06);
  border-radius: 6px;
  background: var(--sd-theme-add-widget-modal-surface-06);
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
  border: 1px solid var(--sd-theme-add-widget-modal-border-06);
  border-radius: 17px;
  background: var(--sd-theme-add-widget-modal-surface-20);
  color: var(--sd-theme-add-widget-modal-text-01);
  font-size: 12px;
  font-weight: 800;
}

.itab-add-secondary-button {
  width: 120px;
  border: 1px solid var(--sd-theme-add-widget-modal-border-06);
  background: var(--sd-theme-add-widget-modal-surface-20);
  color: var(--sd-theme-add-widget-modal-text-01);
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
  box-shadow: 0 0 0 2px var(--sd-theme-add-widget-modal-shadow-02);
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
    border-bottom: 1px solid var(--sd-theme-add-widget-modal-border-05);
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

  .itab-add-widget-grid.is-replica {
    grid-template-columns: minmax(0, 1fr);
  }

  .itab-add-widget-card.is-replica-card {
    width: 100%;
  }

  .itab-add-custom-options {
    grid-template-columns: 1fr;
  }
}
</style>
