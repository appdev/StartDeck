<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { VueDraggable } from "vue-draggable-plus";
import type { SearchEngine } from "@/types";
import { useMainStore } from "../stores/main";
import SearchEngineIcon from "@/components/SearchEngineIcon.vue";
import { getSearchEngineSourceUrl, hydrateSearchEngineIcon } from "@/utils/searchEngines";

const store = useMainStore();
const refreshingKeys = ref(new Set<string>());
let hydrateTimer: ReturnType<typeof setTimeout> | null = null;

const searchEngines = computed(() => store.appConfig.searchEngines || []);

const searchEngineFingerprint = computed(() =>
  searchEngines.value.map((engine) => `${engine.key}:${engine.urlTemplate}`).join("|"),
);

const updateRefreshing = (key: string, refreshing: boolean) => {
  const next = new Set(refreshingKeys.value);
  if (refreshing) next.add(key);
  else next.delete(key);
  refreshingKeys.value = next;
};

const saveSearchEngineConfig = () => {
  if (store.isLogged) void store.saveData();
};

const refreshSearchEngineIcon = async (engine: SearchEngine, force = false) => {
  if (refreshingKeys.value.has(engine.key)) return;
  updateRefreshing(engine.key, true);
  try {
    const changed = await hydrateSearchEngineIcon(engine, force);
    if (changed) saveSearchEngineConfig();
  } finally {
    updateRefreshing(engine.key, false);
  }
};

const scheduleHydrateSearchEngineIcons = () => {
  if (hydrateTimer) clearTimeout(hydrateTimer);
  hydrateTimer = setTimeout(() => {
    hydrateTimer = null;
    searchEngines.value.forEach((engine) => {
      void refreshSearchEngineIcon(engine);
    });
  }, 600);
};

watch(searchEngineFingerprint, scheduleHydrateSearchEngineIcons, { immediate: true });

onUnmounted(() => {
  if (hydrateTimer) clearTimeout(hydrateTimer);
});

const addSearchEngine = () => {
  const id = Date.now().toString();
  const key = "custom-" + id;
  const engine: SearchEngine = {
    id,
    key,
    label: "新搜索引擎",
    urlTemplate: "https://example.com/search?q={q}",
  };

  if (!store.appConfig.searchEngines) {
    store.appConfig.searchEngines = [];
  }
  store.appConfig.searchEngines.push(engine);
  void refreshSearchEngineIcon(engine, true);
};

const removeSearchEngine = (key: string) => {
  const list = searchEngines.value.filter((engine) => engine.key !== key);
  store.appConfig.searchEngines = list;
  if (store.appConfig.defaultSearchEngine === key) {
    store.appConfig.defaultSearchEngine = list[0]?.key || "";
  }
};

const setDefaultSearchEngine = (key: string) => {
  store.appConfig.defaultSearchEngine = key;
};
</script>

<template>
  <div class="space-y-5">
    <div>
      <h4 class="text-base font-semibold text-slate-900">搜索引擎</h4>
      <p class="mt-1 text-xs leading-5 text-slate-500">
        拖拽调整顺序；图标会根据 URL 模板自动从站点元数据中匹配。
      </p>
    </div>

    <VueDraggable
      v-model="store.appConfig.searchEngines"
      :animation="300"
      :forceFallback="true"
      handle=".drag-handle"
      class="space-y-2"
      ghost-class="opacity-50"
      fallback-class="drag-fallback"
    >
      <div
        v-for="engine in store.appConfig.searchEngines"
        :key="engine.id"
        class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-slate-300"
      >
        <div class="flex items-start gap-3">
          <div
            class="drag-handle mt-1 inline-flex h-8 w-8 shrink-0 cursor-grab select-none items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
            title="拖拽排序"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              class="h-5 w-5"
            >
              <path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" />
            </svg>
          </div>

          <div class="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <SearchEngineIcon :engine="engine" :size="22" />
          </div>

          <div class="min-w-0 flex-1 space-y-2">
            <div class="grid gap-2 sm:grid-cols-[minmax(8rem,0.6fr)_minmax(12rem,1.4fr)]">
              <label class="block">
                <span class="sd-label mb-1">名称</span>
                <input v-model="engine.label" class="sd-input" />
              </label>
              <label class="block">
                <span class="sd-label mb-1">URL 模板</span>
                <input
                  v-model="engine.urlTemplate"
                  class="sd-input font-mono text-xs"
                  placeholder="https://example.com/search?q={q}"
                />
              </label>
            </div>
            <div class="truncate text-xs text-slate-400">
              {{ getSearchEngineSourceUrl(engine) || "等待有效 URL 模板" }}
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-1">
            <button
              type="button"
              class="sd-icon-button !h-8 !min-h-8 !w-8 !min-w-8 !rounded-lg"
              :class="{ 'text-blue-600': store.appConfig.defaultSearchEngine === engine.key }"
              :title="store.appConfig.defaultSearchEngine === engine.key ? '当前默认' : '设为默认'"
              :aria-label="store.appConfig.defaultSearchEngine === engine.key ? '当前默认' : '设为默认'"
              @click="setDefaultSearchEngine(engine.key)"
            >
              <svg
                viewBox="0 0 24 24"
                :fill="store.appConfig.defaultSearchEngine === engine.key ? 'currentColor' : 'none'"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="h-4 w-4"
              >
                <path
                  d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6L12 16.76 6.6 19.6l1.03-6-4.36-4.25 6.03-.88L12 3Z"
                />
              </svg>
            </button>

            <button
              type="button"
              class="sd-icon-button !h-8 !min-h-8 !w-8 !min-w-8 !rounded-lg"
              :disabled="refreshingKeys.has(engine.key)"
              title="刷新图标"
              aria-label="刷新图标"
              @click="refreshSearchEngineIcon(engine, true)"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="h-4 w-4"
                :class="{ 'animate-spin': refreshingKeys.has(engine.key) }"
              >
                <path d="M21 12a9 9 0 0 1-15.5 6.2" />
                <path d="M3 12A9 9 0 0 1 18.5 5.8" />
                <path d="M18 2v4h4" />
                <path d="M6 22v-4H2" />
              </svg>
            </button>

            <button
              type="button"
              class="sd-icon-button !h-8 !min-h-8 !w-8 !min-w-8 !rounded-lg hover:!text-red-600"
              title="删除"
              aria-label="删除"
              @click="removeSearchEngine(engine.key)"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="h-4 w-4"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M6 6l1 14h10l1-14" />
                <path d="M10 11v5" />
                <path d="M14 11v5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </VueDraggable>

    <label
      class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
    >
      <span>
        <span class="block text-sm font-medium text-slate-700">记住上次选择</span>
        <span class="block text-xs text-slate-500">打开后，搜索栏会沿用最近一次使用的引擎。</span>
      </span>
      <input
        v-model="store.appConfig.rememberLastEngine"
        type="checkbox"
        class="h-4 w-4 accent-blue-600"
      />
    </label>

    <button type="button" class="sd-btn sd-btn-secondary w-full" @click="addSearchEngine">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        class="h-4 w-4"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      添加搜索引擎
    </button>
  </div>
</template>

<style scoped>
.drag-fallback {
  opacity: 1 !important;
  background: white;
  border: 1px solid #2563eb;
  box-shadow:
    0 10px 15px -3px rgba(15, 23, 42, 0.12),
    0 4px 6px -2px rgba(15, 23, 42, 0.08);
  transform: scale(1.01);
  cursor: grabbing;
  z-index: 9999;
}
</style>
