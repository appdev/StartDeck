import { computed, reactive, ref, watch, type Ref } from "vue";
import type { WidgetConfig } from "@/types";
import { fetchSdBingWallpapers } from "./sdWallpaperApi";
import {
  createSdWallpaperEntryFromState,
  DEFAULT_SD_WALLPAPER_PAGE_SIZE,
  DEFAULT_SD_WALLPAPER_VISIBLE_COUNT,
  readSdWallpaperState,
  resolveSdWallpaperSettings,
  shouldApplySdWallpaperDailyAutoUpdate,
} from "./sdWallpaperModel";
import type {
  SdWallpaperEntry,
  SdWallpaperSettings,
} from "./sdWallpaperTypes";

type WidgetLike = Pick<WidgetConfig, "data"> | null | undefined;

interface SdWallpaperRuntimeOptions {
  onDailyAutoUpdate?: (
    entry: SdWallpaperEntry,
    settings: SdWallpaperSettings,
  ) => void | Promise<void>;
}

export const useSdWallpaperRuntime = (
  widget: Ref<WidgetLike>,
  options: SdWallpaperRuntimeOptions = {},
) => {
  const initialState = readSdWallpaperState(widget.value?.data);
  const widgetState = computed(() =>
    readSdWallpaperState(widget.value?.data),
  );
  const activeWallpaperId = ref(initialState.selectedWallpaperId || "");
  const bingWallpapers = ref<SdWallpaperEntry[]>([]);
  const visibleCount = ref(DEFAULT_SD_WALLPAPER_VISIBLE_COUNT);
  const currentPage = ref(1);
  const totalPages = ref(1);
  const settingsOpen = ref(false);
  const settings = reactive(resolveSdWallpaperSettings(initialState));
  const sourceStatus = ref("loading");
  const loading = ref(false);
  const error = ref("");

  watch(
    widgetState,
    (state) => {
      if (state.selectedWallpaperId) {
        activeWallpaperId.value = state.selectedWallpaperId;
      }
      const nextSettings = resolveSdWallpaperSettings(state);
      settings.dailyAutoUpdate = nextSettings.dailyAutoUpdate;
      settings.dimWallpaper = nextSettings.dimWallpaper;
      settings.blurLevel = nextSettings.blurLevel;
    },
    { immediate: true },
  );

  const featuredWallpaper = computed<SdWallpaperEntry | null>(
    () => bingWallpapers.value[0] || null,
  );
  const activeWallpaper = computed<SdWallpaperEntry | null>(
    () =>
      bingWallpapers.value.find(
        (entry) => entry.id === activeWallpaperId.value,
      ) ||
      createSdWallpaperEntryFromState(widgetState.value) ||
      featuredWallpaper.value ||
      null,
  );
  const visibleBingWallpapers = computed(() =>
    bingWallpapers.value.slice(0, visibleCount.value),
  );
  const hasMoreWallpapers = computed(
    () =>
      visibleCount.value < bingWallpapers.value.length ||
      currentPage.value < totalPages.value,
  );
  const wallpaperCardStyle = computed<Record<string, string>>(() => ({
    "--wallpaper-image": activeWallpaper.value
      ? `url("${activeWallpaper.value.thumbnailUrl}")`
      : "none",
  }));

  const selectWallpaper = (wallpaper: SdWallpaperEntry) => {
    activeWallpaperId.value = wallpaper.id;
  };

  const maybeApplyDailyAutoUpdate = async (
    latestWallpaper: SdWallpaperEntry | null | undefined,
  ) => {
    if (!options.onDailyAutoUpdate) return;
    const state = widgetState.value;
    const currentSettings = { ...settings };
    if (
      !shouldApplySdWallpaperDailyAutoUpdate(
        state,
        currentSettings,
        latestWallpaper,
      )
    ) {
      return;
    }
    activeWallpaperId.value = latestWallpaper!.id;
    await options.onDailyAutoUpdate(latestWallpaper!, currentSettings);
  };

  const mergeWallpapers = (
    previous: SdWallpaperEntry[],
    incoming: SdWallpaperEntry[],
  ) => {
    const seen = new Set(previous.map((entry) => entry.id));
    const merged = [...previous];
    incoming.forEach((entry) => {
      if (seen.has(entry.id)) return;
      seen.add(entry.id);
      merged.push(entry);
    });
    return merged;
  };

  const loadBingWallpapers = async (refresh = false, page = 1) => {
    if (typeof window === "undefined") return;
    loading.value = true;
    error.value = "";
    try {
      const result = await fetchSdBingWallpapers(
        DEFAULT_SD_WALLPAPER_PAGE_SIZE,
        refresh,
        undefined,
        page,
      );
      bingWallpapers.value =
        page <= 1
          ? [...result.entries]
          : mergeWallpapers(bingWallpapers.value, result.entries);
      if (
        !activeWallpaperId.value ||
        !bingWallpapers.value.some(
          (entry) => entry.id === activeWallpaperId.value,
        )
      ) {
        activeWallpaperId.value = bingWallpapers.value[0]?.id || "";
      }
      currentPage.value = result.currentPage;
      totalPages.value = result.totalPages;
      sourceStatus.value = result.sourceStatus || "ok";
      if (page <= 1) {
        await maybeApplyDailyAutoUpdate(bingWallpapers.value[0]);
      }
    } catch (loadError) {
      error.value =
        loadError instanceof Error && loadError.message
          ? loadError.message
          : "Bing wallpaper request failed";
      sourceStatus.value = "error";
    } finally {
      loading.value = false;
    }
  };

  const loadMoreWallpapers = async () => {
    const nextVisibleCount = visibleCount.value + 8;
    if (
      nextVisibleCount > bingWallpapers.value.length &&
      currentPage.value < totalPages.value &&
      !loading.value
    ) {
      await loadBingWallpapers(false, currentPage.value + 1);
    }
    visibleCount.value = Math.min(
      bingWallpapers.value.length,
      nextVisibleCount,
    );
  };

  const toggleSettings = () => {
    settingsOpen.value = !settingsOpen.value;
  };

  void loadBingWallpapers();

  return {
    activeWallpaper,
    activeWallpaperId,
    bingWallpapers,
    currentPage,
    error,
    featuredWallpaper,
    hasMoreWallpapers,
    loadBingWallpapers,
    loadMoreWallpapers,
    loading,
    selectWallpaper,
    settings,
    settingsOpen,
    sourceStatus,
    toggleSettings,
    visibleBingWallpapers,
    visibleCount,
    wallpaperCardStyle,
  };
};
