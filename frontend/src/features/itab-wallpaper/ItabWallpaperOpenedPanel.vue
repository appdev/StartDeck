<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import type { WidgetConfig } from "@/types";
import { useMainStore } from "@/stores/main";
import { patchItabWallpaperData } from "./itabWallpaperModel";
import { useItabWallpaperRuntime } from "./useItabWallpaperRuntime";
import type {
  ItabWallpaperApplyPayload,
  ItabWallpaperEntry,
} from "./itabWallpaperTypes";

const props = defineProps<{
  widget: WidgetConfig;
}>();

const emit = defineEmits<{
  applied: [payload: ItabWallpaperApplyPayload];
  updateData: [data: Record<string, unknown>];
}>();

const store = useMainStore();
const widgetRef = computed(() => props.widget);
const runtime = useItabWallpaperRuntime(widgetRef);
const applyingWallpaperId = ref("");
const applyState = ref<"idle" | "applying" | "saved" | "error">("idle");
const applyMessage = ref("");
const panelRef = ref<HTMLElement | null>(null);
const loadMoreSentinelRef = ref<HTMLElement | null>(null);
const featuredWallpaper = computed(() => runtime.featuredWallpaper.value);
const emptyWallpaperMessage = computed(() => {
  if (runtime.loading.value) return "正在从后端加载壁纸";
  if (runtime.error.value) return runtime.error.value;
  return "后端暂未返回可用壁纸";
});
const loadMoreButtonLabel = computed(() =>
  runtime.hasMoreWallpapers.value ? "加载更多" : "已全部加载",
);

let loadMoreObserver: IntersectionObserver | null = null;
const AUTO_LOAD_DISTANCE = 180;

const loadMoreIfNeeded = () => {
  if (!runtime.hasMoreWallpapers.value) return;
  runtime.loadMoreWallpapers();
};

const maybeAutoLoadMore = () => {
  const panel = panelRef.value;
  if (!panel || panel.clientHeight <= 0 || !runtime.hasMoreWallpapers.value) {
    return;
  }

  const distanceToBottom =
    panel.scrollHeight - panel.scrollTop - panel.clientHeight;
  if (
    panel.scrollHeight <= panel.clientHeight ||
    distanceToBottom <= AUTO_LOAD_DISTANCE
  ) {
    loadMoreIfNeeded();
  }
};

const syncLoadMoreObserver = () => {
  loadMoreObserver?.disconnect();
  loadMoreObserver = null;
  if (
    !runtime.hasMoreWallpapers.value ||
    !panelRef.value ||
    !loadMoreSentinelRef.value ||
    typeof IntersectionObserver === "undefined"
  ) {
    return;
  }

  loadMoreObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadMoreIfNeeded();
      }
    },
    {
      root: panelRef.value,
      rootMargin: `${AUTO_LOAD_DISTANCE}px 0px`,
      threshold: 0,
    },
  );
  loadMoreObserver.observe(loadMoreSentinelRef.value);
};

const handlePanelScroll = () => {
  maybeAutoLoadMore();
};

const targetWidget = computed(
  () =>
    store.widgets.find((widget) => widget.id === props.widget.id) ||
    props.widget,
);

const persistWidgetWallpaperState = (entry: ItabWallpaperEntry) => {
  const updatedData = patchItabWallpaperData(
    targetWidget.value.data,
    entry,
    runtime.settings,
  );
  targetWidget.value.data = updatedData;
  emit("updateData", updatedData);
};

const applyWallpaper = async (entry: ItabWallpaperEntry) => {
  runtime.selectWallpaper(entry);
  persistWidgetWallpaperState(entry);
  store.appConfig.background = entry.downloadUrl;
  store.appConfig.solidBackgroundColor = "";
  store.appConfig.pcRotation = false;
  store.appConfig.wallpaperConfig = {
    type: "api",
    url: entry.downloadUrl,
    enabled: false,
    lastUpdated: Date.now(),
  };

  applyingWallpaperId.value = entry.id;
  applyState.value = "applying";
  applyMessage.value = "正在应用";

  try {
    const result = await store.saveData(true, true);
    emit("applied", { entry, result });
    if (result === "conflict" || result === "unauthorized") {
      applyState.value = "error";
      applyMessage.value = result === "conflict" ? "保存冲突" : "登录后保存";
      return;
    }
    applyState.value = "saved";
    applyMessage.value = "已应用";
  } catch (error) {
    applyState.value = "error";
    applyMessage.value =
      error instanceof Error && error.message ? error.message : "保存失败";
  } finally {
    applyingWallpaperId.value = "";
  }
};

onMounted(async () => {
  await nextTick();
  syncLoadMoreObserver();
  maybeAutoLoadMore();
});

onBeforeUnmount(() => {
  loadMoreObserver?.disconnect();
  loadMoreObserver = null;
});

watch(
  () =>
    [
      runtime.visibleBingWallpapers.value.length,
      runtime.hasMoreWallpapers.value,
    ] as const,
  async () => {
    await nextTick();
    syncLoadMoreObserver();
    maybeAutoLoadMore();
  },
  { flush: "post" },
);
</script>

<template>
  <section
    ref="panelRef"
    class="itab-wallpaper-opened-panel"
    data-itab-wallpaper-opened-panel
    :data-itab-wallpaper-source-status="runtime.sourceStatus.value"
    @scroll.passive="handlePanelScroll"
  >
    <button
      type="button"
      class="wallpaper-settings-trigger"
      :class="{ active: runtime.settingsOpen.value }"
      aria-label="参数设置"
      data-itab-inner-control
      data-itab-wallpaper-settings-trigger
      :aria-expanded="runtime.settingsOpen.value"
      @click="runtime.toggleSettings"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.3 7.3 0 0 0-1.69-.98l-.38-2.65A.49.49 0 0 0 14 2h-4a.49.49 0 0 0-.49.42l-.38 2.65c-.61.24-1.18.57-1.69.98l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.08.65-.08.98s.03.66.08.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.13.22.4.31.63.22l2.46-1a7.3 7.3 0 0 0 1.69.98l.38 2.65c.04.24.25.42.49.42h4c.24 0 .45-.18.49-.42l.38-2.65c.61-.24 1.18-.57 1.69-.98l2.46 1c.23.09.5 0 .63-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
        />
      </svg>
    </button>

    <div
      v-if="runtime.settingsOpen.value"
      class="wallpaper-settings-popover"
      data-itab-wallpaper-settings-popover
    >
      <label>
        <input
          v-model="runtime.settings.dailyAutoUpdate"
          type="checkbox"
          data-itab-inner-control
        />
        <span>选中壁纸每日自动更新</span>
      </label>
      <label>
        <input
          v-model="runtime.settings.dimWallpaper"
          type="checkbox"
          data-itab-inner-control
        />
        <span>桌面背景增加暗色遮罩</span>
      </label>
      <label class="wallpaper-range">
        <span>背景模糊</span>
        <input
          v-model.number="runtime.settings.blurLevel"
          type="range"
          min="0"
          max="20"
          data-itab-inner-control
        />
        <b>{{ runtime.settings.blurLevel }}</b>
      </label>
    </div>

    <header class="wallpaper-panel-head">
      <h2>壁纸库</h2>
      <p>必应每日壁纸 可以使用快捷键 Ctrl+G 打开壁纸应用</p>
    </header>

    <section v-if="featuredWallpaper" class="wallpaper-featured">
      <button
        type="button"
        class="wallpaper-featured-image"
        :aria-label="`应用 ${featuredWallpaper.title}`"
        data-itab-inner-control
        data-itab-wallpaper-apply-featured
        @click="applyWallpaper(featuredWallpaper)"
      >
        <img
          :alt="featuredWallpaper.title"
          :src="featuredWallpaper.thumbnailUrl"
        />
      </button>
      <div class="wallpaper-featured-copy">
        <strong>
          {{ featuredWallpaper.title
          }}<template v-if="featuredWallpaper.location"
            >，{{ featuredWallpaper.location }}</template
          >
          (©
          {{ featuredWallpaper.credit }})
        </strong>
        <p>选中此图像每天会自动更新壁纸</p>
        <p>
          图像来源：<b>必应</b>
          <a
            data-itab-inner-control
            :href="featuredWallpaper.downloadUrl"
            target="_blank"
            rel="noreferrer"
            @click.stop
            >点此下载4k高清壁纸</a
          >
        </p>
      </div>
    </section>

    <p v-else class="wallpaper-empty-state" data-itab-wallpaper-empty-state>
      {{ emptyWallpaperMessage }}
    </p>

    <div
      v-if="runtime.visibleBingWallpapers.value.length"
      class="wallpaper-grid"
      data-itab-wallpaper-grid
    >
      <button
        v-for="wallpaper in runtime.visibleBingWallpapers.value"
        :key="wallpaper.id"
        type="button"
        class="wallpaper-grid-card"
        :class="{ active: wallpaper.id === runtime.activeWallpaper.value?.id }"
        :aria-pressed="wallpaper.id === runtime.activeWallpaper.value?.id"
        :data-wallpaper-id="wallpaper.id"
        data-itab-inner-control
        @click="applyWallpaper(wallpaper)"
      >
        <img :alt="wallpaper.title" :src="wallpaper.thumbnailUrl" />
        <span v-if="wallpaper.id === runtime.activeWallpaper.value?.id">✓</span>
      </button>
    </div>

    <div ref="loadMoreSentinelRef" class="wallpaper-opened-footer">
      <button
        type="button"
        data-itab-inner-control
        data-itab-wallpaper-load-more
        :disabled="!runtime.hasMoreWallpapers.value"
        @click="runtime.loadMoreWallpapers"
      >
        {{ loadMoreButtonLabel }}
      </button>
      <p
        v-if="applyState !== 'idle'"
        :class="`is-${applyState}`"
        data-itab-wallpaper-apply-status
      >
        {{
          applyState === "applying" && applyingWallpaperId
            ? `${applyMessage} ${applyingWallpaperId}`
            : applyMessage
        }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.itab-wallpaper-opened-panel {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  min-height: 600px;
  overflow: hidden auto;
  background: rgba(245, 247, 250, 0.82);
  color: rgba(16, 24, 40, 0.88);
  font-family:
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Helvetica Neue",
    sans-serif;
  letter-spacing: 0;
  padding: 38px 44px 22px;
}

.wallpaper-settings-trigger {
  position: absolute;
  top: 11px;
  right: 91px;
  z-index: 5;
  display: grid;
  width: 16px;
  height: 16px;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  color: rgb(24, 144, 255);
  padding: 0;
  box-shadow: 0 0 16px rgba(255, 255, 255, 0.72);
}

.wallpaper-settings-trigger svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.wallpaper-settings-trigger.active {
  background: #fff;
}

.wallpaper-settings-popover {
  position: absolute;
  top: 25px;
  right: 77px;
  z-index: 6;
  display: grid;
  width: 268px;
  gap: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.2);
  padding: 20px 22px;
}

.wallpaper-settings-popover label {
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgba(0, 0, 0, 0.78);
  font-size: 15px;
  font-weight: 700;
}

.wallpaper-settings-popover input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: rgb(24, 144, 255);
}

.wallpaper-range {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 24px;
}

.wallpaper-range input {
  width: 100%;
  accent-color: rgb(24, 144, 255);
}

.wallpaper-range b {
  color: rgb(24, 144, 255);
  text-align: right;
}

.wallpaper-panel-head {
  display: flex;
  align-items: baseline;
  gap: 28px;
  padding-right: 116px;
}

.wallpaper-panel-head h2 {
  margin: 0;
  color: rgba(0, 0, 0, 0.86);
  font-size: 30px;
  font-weight: 800;
  line-height: 42px;
}

.wallpaper-panel-head p {
  margin: 0;
  color: rgba(0, 0, 0, 0.44);
  font-size: 14px;
  line-height: 22px;
}

.wallpaper-featured {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 28px;
  align-items: start;
  margin-top: 16px;
}

.wallpaper-featured-image {
  position: relative;
  display: block;
  width: 360px;
  height: 202px;
  overflow: hidden;
  border: 0;
  border-radius: 12px;
  background: #d7d9dc;
  padding: 0;
  cursor: pointer;
}

.wallpaper-featured-image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wallpaper-featured-copy {
  padding-top: 2px;
  color: rgba(62, 66, 72, 0.62);
  font-size: 14px;
  line-height: 22px;
}

.wallpaper-featured-copy strong {
  display: block;
  margin-bottom: 10px;
  color: rgba(49, 54, 60, 0.62);
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.wallpaper-featured-copy p {
  margin: 5px 0;
}

.wallpaper-featured-copy b,
.wallpaper-featured-copy a {
  color: rgb(24, 144, 255);
  font-weight: 600;
  text-decoration: none;
}

.wallpaper-empty-state {
  display: grid;
  min-height: 240px;
  place-items: center;
  border-radius: 18px;
  background: var(--sd-component-empty-surface);
  color: var(--sd-component-empty-text);
  font-size: 14px;
  line-height: 1.6;
  text-align: center;
}

.wallpaper-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px 16px;
  margin-top: 22px;
  padding: 0 0 14px;
}

.wallpaper-grid-card {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  height: auto;
  overflow: hidden;
  border: 0;
  border-radius: 10px;
  background: #dfe6ee;
  padding: 0;
  box-shadow: none;
}

.wallpaper-grid-card img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wallpaper-grid-card.active::after {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.18);
  content: "";
}

.wallpaper-grid-card span {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 2;
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.38);
  color: #fff;
  font-size: 26px;
  font-weight: 800;
}

.wallpaper-opened-footer {
  position: relative;
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin: 6px 0 0;
  padding: 14px 0 10px;
  background: transparent;
}

.wallpaper-opened-footer button {
  border: 0;
  border-radius: 999px;
  background: rgb(24, 144, 255);
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  padding: 10px 22px;
}

.wallpaper-opened-footer button:disabled {
  cursor: default;
  opacity: 0.78;
}

.wallpaper-opened-footer p {
  margin: 0;
  color: rgba(16, 24, 40, 0.54);
  font-size: 13px;
  font-weight: 700;
}

.wallpaper-opened-footer p.is-error {
  color: #dc2626;
}

@media (max-width: 760px) {
  .itab-wallpaper-opened-panel {
    min-height: min(620px, calc(100vh - 72px));
    padding: 48px 14px 18px;
  }

  .wallpaper-settings-trigger {
    top: 10px;
    right: 78px;
  }

  .wallpaper-settings-popover {
    top: 38px;
    right: 12px;
    width: min(268px, calc(100vw - 48px));
  }

  .wallpaper-panel-head {
    display: grid;
    gap: 2px;
    padding-right: 96px;
  }

  .wallpaper-panel-head h2 {
    font-size: 26px;
  }

  .wallpaper-featured {
    grid-template-columns: 1fr;
    gap: 12px;
    margin-top: 12px;
  }

  .wallpaper-featured-image {
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
  }

  .wallpaper-featured-copy {
    padding-top: 0;
  }

  .wallpaper-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .wallpaper-opened-footer {
    margin-top: 4px;
    padding-right: 0;
    padding-left: 0;
  }
}
</style>
