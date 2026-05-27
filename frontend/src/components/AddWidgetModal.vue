<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppModalShell from "@/components/base/AppModalShell.vue";
import AppWindowControls from "@/components/base/AppWindowControls.vue";
import { useMainStore } from "@/stores/main";
import type { NavGroup, WidgetConfig } from "@/types";
import type {
  AddComponentPayload,
  AddComponentResult,
} from "@/utils/addComponentTypes";
import {
  WIDGET_CATALOG,
  getWidgetCatalogAction,
  getWidgetCatalogItem,
  type WidgetCatalogCategory,
  type WidgetCatalogItem,
  type WidgetCatalogSizeKey,
} from "@/utils/widgetCatalog";

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
  onAddComponent?: (
    payload: AddComponentPayload,
  ) => AddComponentResult | Promise<AddComponentResult>;
}>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "add", payload: AddComponentPayload): void;
}>();

const store = useMainStore();

const searchText = ref("");
const destinationGroupId = ref("");
const activeWidgetCategory = ref<WidgetUiCategory>("explore");
const activeRecommendationBatch = ref(0);
const busyKey = ref("");
const resultMessage = ref("");
const previewSizeKey: WidgetCatalogSizeKey = "2x2";

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
    searchText.value = "";
    activeWidgetCategory.value = "explore";
    activeRecommendationBatch.value = 0;
    resultMessage.value = "";
    ensureDestination();
  },
  { immediate: true },
);

watch(destinationOptions, ensureDestination);

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
</script>

<template>
  <AppModalShell
    :show="show"
    :z-index="130"
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

      <section class="itab-add-main">
        <div class="itab-add-toolbar">
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

        <div class="itab-add-pane">
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
      </section>
    </div>
  </AppModalShell>
</template>

<style scoped>
:global(.itab-add-overlay) {
  background: var(--sd-shell-overlay);
  -webkit-backdrop-filter: var(--sd-shell-overlay-filter);
  backdrop-filter: var(--sd-shell-overlay-filter);
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
  -webkit-backdrop-filter: var(--sd-shell-surface-filter);
  backdrop-filter: var(--sd-shell-surface-filter);
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
  grid-template-columns: minmax(0, 1fr);
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
.itab-add-destination-wrap {
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
.itab-add-destination {
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
.itab-add-destination:focus {
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

.itab-add-widget-grid {
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

.itab-add-widget-grid::-webkit-scrollbar {
  width: 8px;
}

.itab-add-widget-grid::-webkit-scrollbar-track {
  background: transparent;
}

.itab-add-widget-grid::-webkit-scrollbar-thumb {
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

.itab-add-widget-card {
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
  background: var(--sd-theme-add-widget-modal-preview-surface);
  color: var(--sd-theme-add-widget-modal-preview-text);
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

.itab-add-card-button {
  height: 32px;
  border: 0;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 800;
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

.itab-add-card-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.itab-add-empty {
  display: grid;
  min-height: 160px;
  place-items: center;
  color: var(--sd-theme-add-widget-modal-accent-text-03);
  font-size: 13px;
  font-weight: 700;
}

@media (max-width: 834px) {
  .itab-add-layout {
    grid-template-columns: 1fr;
    height: min(680px, calc(100vh - 32px));
  }

  .itab-add-toolbar {
    grid-template-columns: 1fr;
  }

  .itab-add-widget-grid {
    grid-template-columns: 1fr;
  }

  .itab-add-widget-grid.is-replica {
    grid-template-columns: minmax(0, 1fr);
  }

  .itab-add-widget-card.is-replica-card {
    width: 100%;
  }
}
</style>
