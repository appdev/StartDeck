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
  type WidgetCatalogCategory,
  type WidgetCatalogItem,
  type WidgetCatalogSizeKey,
} from "@/utils/widgetCatalog";

type WidgetUiCategory =
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
const activeWidgetCategory = ref<WidgetUiCategory>("all");
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
    activeWidgetCategory.value = "all";
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

const query = computed(() => searchText.value.trim().toLowerCase());

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

          <div class="itab-add-widget-grid is-replica">
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

          <div v-if="filteredCatalog.length === 0" class="itab-add-empty">
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

.itab-add-chip-row {
  display: flex;
  flex: 0 0 auto;
  overflow-x: auto;
  padding-bottom: 2px;
}

.itab-add-chip-row {
  gap: 10px;
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

.itab-add-widget-grid {
  display: grid;
  width: 100%;
  min-height: 0;
  flex: 1 1 auto;
  gap: 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 0;
  scrollbar-color: var(--sd-scrollbar-thumb) var(--sd-scrollbar-track);
  scrollbar-width: thin;
}

.itab-add-widget-grid::-webkit-scrollbar {
  width: var(--sd-scrollbar-size);
}

.itab-add-widget-grid::-webkit-scrollbar-track {
  background: var(--sd-scrollbar-track);
}

.itab-add-widget-grid::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--sd-scrollbar-thumb);
}

.itab-add-widget-grid::-webkit-scrollbar-thumb:hover {
  background: var(--sd-scrollbar-thumb-hover);
}

.itab-add-widget-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
}

.itab-add-widget-grid.is-replica {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: 308px;
  align-content: start;
  align-items: start;
  justify-content: stretch;
  overflow-y: auto;
  padding-right: 0;
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
  width: 100%;
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
