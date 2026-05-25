<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useMainStore } from "../stores/main";
import { VueDraggable } from "vue-draggable-plus";
import AppButton from "@/components/base/AppButton.vue";
import AppModalShell from "@/components/base/AppModalShell.vue";
import AppRangeField from "@/components/base/AppRangeField.vue";
import AppSectionCard from "@/components/base/AppSectionCard.vue";
import AppSegmentedControl from "@/components/base/AppSegmentedControl.vue";
import AppSwitch from "@/components/base/AppSwitch.vue";
import ConfirmDialog from "@/components/base/ConfirmDialog.vue";
import StatusBanner from "@/components/base/StatusBanner.vue";
import { fetchItabBingWallpapers } from "@/features/itab-wallpaper/itabWallpaperApi";
import type { ItabWallpaperEntry } from "@/features/itab-wallpaper/itabWallpaperTypes";
import { useUiFeedbackStore } from "@/stores/uiFeedback";

const props = defineProps<{
  show: boolean;
  title?: string;
  initialTab?: "pc" | "mobile" | "api";
  zIndex?: number | string;
}>();

const emit = defineEmits(["update:show", "select"]);
const store = useMainStore();
const uiFeedback = useUiFeedbackStore();

const notify = (
  message: string,
  tone: "info" | "success" | "warning" | "danger" = "info",
  title?: string,
) => {
  uiFeedback.notify({ title, message, tone });
};

const showFeedbackAlert = (
  message: string,
  options: {
    title?: string;
    tone?: "info" | "success" | "warning" | "danger";
  } = {},
) =>
  uiFeedback.alert({
    title: options.title ?? "壁纸库提示",
    message,
    tone: options.tone ?? "info",
  });

/** GET / multipart：只带 Bearer，不设 Content-Type（避免破坏 FormData） */
const authHeadersOnly = (): Record<string, string> => {
  const h: Record<string, string> = {};
  const t = store.token || localStorage.getItem("start-deck-token");
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
};

const activeTab = ref<"pc" | "mobile" | "api">(props.initialTab || "pc");
const wallpaperTabOptions = computed(() => [
  { label: "PC 壁纸", value: "pc" },
  { label: "手机壁纸", value: "mobile" },
  { label: "Bing API", value: "api" },
]);
const dialogSubtitle = computed(() => {
  if (activeTab.value === "pc") return `${wallpapers.value.length} 张 PC 壁纸`;
  if (activeTab.value === "mobile")
    return `${mobileWallpapers.value.length} 张手机壁纸`;
  return "Bing 历史壁纸接口";
});
const wallpapers = computed<string[]>({
  get: () => store.wallpaperListPc,
  set: (val) => {
    store.wallpaperListPc = [...val];
  },
});
const mobileWallpapers = computed<string[]>({
  get: () => store.wallpaperListMobile,
  set: (val) => {
    store.wallpaperListMobile = [...val];
  },
});
const loading = ref(false);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const wallpaperPreviewErrors = ref<Record<string, string>>({});

// Confirm Modal State
const showConfirmModal = ref(false);
const confirmMessage = ref("");
const confirmAction = ref<() => void>(() => {});

const closeConfirmModal = () => {
  showConfirmModal.value = false;
};

const handleConfirm = () => {
  confirmAction.value();
  closeConfirmModal();
};

const DEFAULT_WALLPAPER = "default-wallpaper.svg";

const fetchWallpapers = async () => {
  loading.value = true;
  try {
    await store.fetchWallpaperLists();
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

const stripTransientQueryParams = (url: string) => {
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.delete("t");
    parsed.searchParams.delete("v");
    if (/^https?:\/\//.test(url)) {
      return `${parsed.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url.replace(/([?&])(t|v)=\d+/g, "$1").replace(/[?&]$/, "");
  }
};

const getWallpaperPath = (name: string, type: "pc" | "mobile") => {
  if (name === DEFAULT_WALLPAPER) {
    return `/${DEFAULT_WALLPAPER}`;
  }
  const base =
    type === "pc"
      ? store.appConfig.wallpaperPcImageBase || "/backgrounds"
      : store.appConfig.wallpaperMobileImageBase || "/mobile_backgrounds";
  const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${trimmed}/${encodeURIComponent(name)}`;
};

const getWallpaperDisplayUrl = (name: string, type: "pc" | "mobile") =>
  store.getAssetUrl(getWallpaperPath(name, type));

const selectWallpaper = (name: string, type: "pc" | "mobile") => {
  if (setWallpaper(name, type)) {
    const url = getWallpaperDisplayUrl(name, type);
    emit("select", { url, type });
    emit("update:show", false);
  }
};

const setWallpaper = (name: string, type: "pc" | "mobile") => {
  const url = getWallpaperPath(name, type);
  if (type === "pc") {
    store.appConfig.background = url;
  } else {
    store.appConfig.mobileBackground = url;
  }
  return true;
};

const prependWallpaperToList = (name: string, type: "pc" | "mobile") => {
  if (!name || name === DEFAULT_WALLPAPER) return;
  const currentList = type === "pc" ? wallpapers.value : mobileWallpapers.value;
  const nextList = [
    DEFAULT_WALLPAPER,
    name,
    ...currentList.filter(
      (item) => item !== DEFAULT_WALLPAPER && item !== name,
    ),
  ];
  if (type === "pc") {
    wallpapers.value = nextList;
    store.appConfig.pcWallpaperOrder = nextList;
  } else {
    mobileWallpapers.value = nextList;
    store.appConfig.mobileWallpaperOrder = nextList;
  }
};

const inferImageExtension = (blob: Blob, urlHint: string) => {
  const mime = (blob.type || "").toLowerCase();
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("svg")) return "svg";
  if (mime.includes("bmp")) return "bmp";
  if (mime.includes("avif")) return "avif";

  const normalizedHint = stripTransientQueryParams(urlHint);
  const matched = normalizedHint.match(/\.([a-zA-Z0-9]+)$/);
  if (matched?.[1]) {
    return matched[1].toLowerCase();
  }
  return "jpg";
};

const getWallpaperErrorKey = (name: string, type: "pc" | "mobile") =>
  `${type}:${name}`;

const getWallpaperPreviewError = (name: string, type: "pc" | "mobile") =>
  wallpaperPreviewErrors.value[getWallpaperErrorKey(name, type)] || "";

const clearWallpaperPreviewError = (name: string, type: "pc" | "mobile") => {
  const key = getWallpaperErrorKey(name, type);
  if (!wallpaperPreviewErrors.value[key]) return;
  const next = { ...wallpaperPreviewErrors.value };
  delete next[key];
  wallpaperPreviewErrors.value = next;
};

const handleWallpaperPreviewError = (
  name: string,
  type: "pc" | "mobile",
  event: Event,
) => {
  const img = event.target as HTMLImageElement | null;
  const attemptedUrl =
    img?.currentSrc || img?.src || getWallpaperDisplayUrl(name, type);
  wallpaperPreviewErrors.value = {
    ...wallpaperPreviewErrors.value,
    [getWallpaperErrorKey(name, type)]: attemptedUrl,
  };
};

const draggableList = computed({
  get() {
    const list =
      activeTab.value === "pc"
        ? [...wallpapers.value]
        : [...mobileWallpapers.value];
    const currentBg =
      activeTab.value === "pc"
        ? store.appConfig.background
        : store.appConfig.mobileBackground;

    const type: "pc" | "mobile" = activeTab.value === "pc" ? "pc" : "mobile";
    const normalizedCurrentBg = stripTransientQueryParams(currentBg || "");
    const index = list.findIndex(
      (name) => getWallpaperPath(name, type) === normalizedCurrentBg,
    );
    if (index > -1) {
      const [item] = list.splice(index, 1);
      if (item) list.unshift(item);
    }
    return list;
  },
  set(val) {
    if (activeTab.value === "pc") {
      wallpapers.value = val;
      store.appConfig.pcWallpaperOrder = val;
    } else {
      mobileWallpapers.value = val;
      store.appConfig.mobileWallpaperOrder = val;
    }

    const first = val[0];
    if (first) {
      const type: "pc" | "mobile" = activeTab.value === "pc" ? "pc" : "mobile";
      const currentBg =
        type === "pc"
          ? store.appConfig.background
          : store.appConfig.mobileBackground;
      const firstUrl = getWallpaperPath(first, type);

      if (firstUrl !== stripTransientQueryParams(currentBg || "")) {
        setWallpaper(first, type);
      }
    }
  },
});

const triggerUpload = () => {
  fileInput.value?.click();
};

const pendingFiles = ref<File[]>([]);

const handleUpload = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  pendingFiles.value = Array.from(input.files);

  // Check file size
  const hasLargeFile = pendingFiles.value.some(
    (f) => f.size > 10 * 1024 * 1024,
  );

  if (hasLargeFile) {
    confirmMessage.value =
      "检测到文件超过 10MB，可能导致内存占用过高，是否继续上传？";
    confirmAction.value = executeUpload;
    showConfirmModal.value = true;
  } else {
    executeUpload();
  }

  // Clear input so same file can be selected again
  input.value = "";
};

const executeUpload = async () => {
  if (pendingFiles.value.length === 0) return;

  uploading.value = true;
  const formData = new FormData();
  pendingFiles.value.forEach((file) => {
    formData.append("files", file);
  });

  // Determine endpoint based on active tab
  const endpoint =
    activeTab.value === "pc"
      ? store.appConfig.wallpaperApiPcUpload || "/api/backgrounds/upload"
      : store.appConfig.wallpaperApiMobileUpload ||
        "/api/mobile_backgrounds/upload";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: authHeadersOnly(),
      body: formData,
    });

    if (res.ok) {
      await fetchWallpapers();
      store.refreshResources(); // 刷新资源版本号，更新图片缓存
      notify("新壁纸已加入当前分类。", "success", "上传完成");
    } else {
      void showFeedbackAlert("上传失败", {
        title: "壁纸上传失败",
        tone: "danger",
      });
    }
  } catch (e) {
    console.error(e);
    void showFeedbackAlert("请求过程中发生异常，请稍后重试。", {
      title: "壁纸上传失败",
      tone: "danger",
    });
  } finally {
    uploading.value = false;
    pendingFiles.value = [];
  }
};

const handleDelete = (name: string, type: "pc" | "mobile") => {
  if (name === DEFAULT_WALLPAPER) {
    notify("默认壁纸不能删除。", "warning", "操作已拦截");
    return;
  }
  confirmMessage.value = "确定要删除这张壁纸吗？";
  confirmAction.value = () => executeDelete(name, type);
  showConfirmModal.value = true;
};

const executeDelete = async (name: string, type: "pc" | "mobile") => {
  // Check if active wallpaper is being deleted
  const url = getWallpaperPath(name, type);
  const currentBg = stripTransientQueryParams(
    type === "pc"
      ? store.appConfig.background
      : store.appConfig.mobileBackground,
  );

  if (url === currentBg) {
    // Reset to default
    const defaultUrl = getWallpaperPath(DEFAULT_WALLPAPER, type);
    if (type === "pc") store.appConfig.background = defaultUrl;
    else store.appConfig.mobileBackground = defaultUrl;
  }

  const base =
    type === "pc"
      ? store.appConfig.wallpaperApiPcDeleteBase || "/api/backgrounds"
      : store.appConfig.wallpaperApiMobileDeleteBase ||
        "/api/mobile_backgrounds";
  const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
  const endpoint = `${trimmed}/${encodeURIComponent(name)}`;

  try {
    const res = await fetch(endpoint, {
      method: "DELETE",
      headers: store.getHeaders(),
    });

    if (res.ok) {
      await fetchWallpapers();
      store.refreshResources();
      notify("壁纸已从本地库移除。", "success", "删除完成");
    } else {
      void showFeedbackAlert("删除失败", {
        title: "壁纸删除失败",
        tone: "danger",
      });
    }
  } catch (e) {
    console.error(e);
  }
};

// Rotation Logic Helpers
const currentRotationEnabled = computed({
  get: () =>
    activeTab.value === "pc"
      ? store.appConfig.pcRotation
      : store.appConfig.mobileRotation,
  set: (val) => {
    if (activeTab.value === "pc") store.appConfig.pcRotation = val;
    else store.appConfig.mobileRotation = val;
  },
});

const currentRotationInterval = computed({
  get: () =>
    activeTab.value === "pc"
      ? (store.appConfig.pcRotationInterval ?? 30)
      : (store.appConfig.mobileRotationInterval ?? 30),
  set: (val) => {
    if (activeTab.value === "pc") store.appConfig.pcRotationInterval = val;
    else store.appConfig.mobileRotationInterval = val;
  },
});

const currentRotationMode = computed({
  get: () =>
    activeTab.value === "pc"
      ? (store.appConfig.pcRotationMode ?? "random")
      : (store.appConfig.mobileRotationMode ?? "random"),
  set: (val) => {
    if (activeTab.value === "pc") store.appConfig.pcRotationMode = val;
    else store.appConfig.mobileRotationMode = val;
  },
});

const isWallpaperLocked = computed(
  () => !store.appConfig.pcRotation && !store.appConfig.mobileRotation,
);

const toggleRotation = () => {
  currentRotationEnabled.value = !currentRotationEnabled.value;
};

const togglePlayMode = () => {
  currentRotationMode.value =
    currentRotationMode.value === "random" ? "sequential" : "random";
};

const stopAndLockRotation = () => {
  store.appConfig.pcRotation = false;
  store.appConfig.mobileRotation = false;
};

const lockButtonLabel = computed(() =>
  isWallpaperLocked.value ? "已锁定" : "停止并锁定",
);

const applyingApi = ref(false);
const apiApplyingTarget = ref("");
const apiWallpapers = ref<ItabWallpaperEntry[]>([]);
const apiPage = ref(1);
const apiTotalPages = ref(1);
const apiLoading = ref(false);
const apiError = ref("");
const apiPageSize = 24;

const apiHasMoreWallpapers = computed(
  () => apiPage.value < apiTotalPages.value,
);
const apiSourceSummary = computed(() => {
  if (apiLoading.value && !apiWallpapers.value.length) return "正在加载";
  if (apiError.value) return "接口暂不可用";
  return `${apiWallpapers.value.length} 张 Bing 壁纸`;
});

const mergeApiWallpapers = (
  previous: ItabWallpaperEntry[],
  incoming: ItabWallpaperEntry[],
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

const loadBingApiWallpapers = async (refresh = false, page = 1) => {
  if (apiLoading.value) return;
  apiLoading.value = true;
  apiError.value = "";
  try {
    const result = await fetchItabBingWallpapers(
      apiPageSize,
      refresh,
      undefined,
      page,
    );
    apiWallpapers.value =
      page <= 1
        ? [...result.entries]
        : mergeApiWallpapers(apiWallpapers.value, result.entries);
    apiPage.value = result.currentPage;
    apiTotalPages.value = result.totalPages;
  } catch (error) {
    apiError.value =
      error instanceof Error && error.message
        ? error.message
        : "Bing wallpaper request failed";
  } finally {
    apiLoading.value = false;
  }
};

const ensureBingApiWallpapers = () => {
  if (apiWallpapers.value.length || apiLoading.value) return;
  void loadBingApiWallpapers();
};

watch(
  () => props.show,
  (visible) => {
    if (!visible) return;
    activeTab.value = props.initialTab || "pc";
    fetchWallpapers();
    if (activeTab.value === "api") {
      ensureBingApiWallpapers();
    }
  },
);

watch(
  () => props.initialTab,
  (value) => {
    if (props.show && value) {
      activeTab.value = value;
      if (value === "api") {
        ensureBingApiWallpapers();
      }
    }
  },
);

watch(activeTab, (value) => {
  if (value === "api" && props.show) {
    ensureBingApiWallpapers();
  }
});

const wallpaperStatusBanner = computed(() => {
  if (uploading.value) {
    return {
      title: "正在上传壁纸",
      message: "上传完成后会刷新资源版本并更新当前列表。",
      tone: "info" as const,
    };
  }
  if (applyingApi.value) {
    return {
      title: "正在准备壁纸",
      message: "正在获取高清壁纸并落盘到本地壁纸库。",
      tone: "warning" as const,
    };
  }
  if (activeTab.value === "api" && apiLoading.value) {
    return {
      title: "正在加载 Bing 壁纸",
      message: "列表预览使用小图，应用时会获取高清图。",
      tone: "info" as const,
    };
  }
  return null;
});

const normalizeApiWallpaperFilename = (entry: ItabWallpaperEntry) =>
  entry.id.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "") ||
  "bing-wallpaper";

const fetchRemoteWallpaperBlob = async (
  sourceUrl: string,
  requestId: string,
) => {
  const proxyRes = await fetch(
    `/api/wallpaper/proxy?url=${encodeURIComponent(sourceUrl)}&uuid=${requestId}`,
    { headers: authHeadersOnly() },
  );
  if (proxyRes.ok) {
    return proxyRes.blob();
  }

  const directRes = await fetch(sourceUrl, { cache: "no-store" });
  if (directRes.ok) {
    return directRes.blob();
  }
  return null;
};

const applyBingApiWallpaper = async (
  entry: ItabWallpaperEntry,
  type: "pc" | "mobile",
  apply: boolean = true,
) => {
  if (!entry.downloadUrl) return;

  applyingApi.value = true;
  apiApplyingTarget.value = `${entry.id}:${type}:${apply ? "apply" : "save"}`;
  try {
    let backgroundPath = "";
    let uploadedFilename = "";
    const cleanDownloadUrl = stripTransientQueryParams(entry.downloadUrl);
    const blob = await fetchRemoteWallpaperBlob(
      cleanDownloadUrl,
      `bing-${entry.id}-${Date.now()}`,
    );

    if (blob) {
      if (apply && type === "pc") {
        document.body.style.backgroundImage = `url(${entry.thumbnailUrl})`;
      }

      const formData = new FormData();
      const ext = inferImageExtension(blob, cleanDownloadUrl);
      const filename = `${normalizeApiWallpaperFilename(entry)}_${Date.now()}.${ext}`;
      formData.append("files", blob, filename);

      const endpoint =
        type === "pc"
          ? store.appConfig.wallpaperApiPcUpload || "/api/backgrounds/upload"
          : store.appConfig.wallpaperApiMobileUpload ||
            "/api/mobile_backgrounds/upload";

      const uploadRes = await fetch(endpoint, {
        method: "POST",
        headers: authHeadersOnly(),
        body: formData,
      });

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        if (
          uploadData.success &&
          uploadData.files &&
          uploadData.files.length > 0
        ) {
          backgroundPath = uploadData.files[0].path;
          uploadedFilename = uploadData.files[0].filename || "";
        } else {
          throw new Error("Upload failed: No path returned");
        }
      } else {
        throw new Error("Upload failed: " + uploadRes.statusText);
      }
    } else {
      throw new Error("No preview image available");
    }

    // Now apply configuration
    if (apply) {
      const config = {
        type: "api" as const,
        url: cleanDownloadUrl,
        enabled: false,
        lastUpdated: Date.now(),
      };

      if (type === "pc") {
        store.appConfig.background = backgroundPath; // Use the server path
        store.appConfig.wallpaperConfig = config;
      } else {
        store.appConfig.mobileBackground = backgroundPath;
        store.appConfig.mobileWallpaperConfig = config;
      }
      if (uploadedFilename) {
        prependWallpaperToList(uploadedFilename, type);
      }
      store.refreshResources();
      store.markDirty();
      notify("当前设备的默认壁纸已经更新。", "success", "设置成功");
    } else {
      if (uploadedFilename) {
        prependWallpaperToList(uploadedFilename, type);
      }
      await fetchWallpapers();
      if (uploadedFilename) {
        prependWallpaperToList(uploadedFilename, type);
      }
      store.refreshResources();
      store.markDirty();
      activeTab.value = type;
      notify(
        type === "pc" ? "已保存到 PC 壁纸库。" : "已保存到手机壁纸库。",
        "success",
        "保存完成",
      );
    }
  } catch (e) {
    console.error(e);
    void showFeedbackAlert("请求出错，请检查网络。", {
      title: "壁纸请求失败",
      tone: "danger",
    });
  } finally {
    applyingApi.value = false;
    apiApplyingTarget.value = "";
  }
};

onMounted(() => {
  fetchWallpapers();
  if (activeTab.value === "api") {
    ensureBingApiWallpapers();
  }
});
</script>

<template>
  <AppModalShell
    :show="show"
    :z-index="zIndex || 100"
    close-on-overlay
    close-on-escape
    trap-focus
    restore-focus
    :title="title || '壁纸库'"
    :subtitle="dialogSubtitle"
    overlay-class="sd-overlay-strong"
    panel-class="w-full md:max-w-5xl h-full md:max-h-[85vh]"
    body-class="p-0"
    @close="$emit('update:show', false)"
  >
    <div
      class="sd-theme-bridge w-full h-full flex flex-col overflow-hidden bg-[var(--sd-color-surface)] text-[var(--sd-color-text-primary)]"
    >
      <div
        class="border-b border-[var(--sd-color-border-subtle)] bg-[var(--sd-color-surface)] px-4 py-3 md:px-6"
      >
        <AppSegmentedControl v-model="activeTab" :options="wallpaperTabOptions">
          <template #option="{ option }">
            <span class="inline-flex items-center gap-2">
              <span>{{ option.label }}</span>
              <span v-if="option.value === 'pc'" class="sd-value-badge">{{
                wallpapers.length
              }}</span>
              <span
                v-else-if="option.value === 'mobile'"
                class="sd-value-badge"
                >{{ mobileWallpapers.length }}</span
              >
            </span>
          </template>
        </AppSegmentedControl>
      </div>

      <div
        class="border-b border-[var(--sd-color-border-subtle)] bg-[var(--sd-color-surface-muted)] px-4 py-3 md:px-6"
      >
        <div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <AppSectionCard
            title="轮播与锁定"
            description="轮播模式、播放状态与当前壁纸锁定统一放在同一组。"
            body-class="space-y-3"
          >
            <div class="flex flex-wrap items-center gap-2">
              <AppButton
                size="sm"
                :variant="
                  currentRotationMode === 'random' ? 'primary' : 'secondary'
                "
                :title="
                  currentRotationMode === 'random'
                    ? '播放方式：随机（仅轮播开启后生效）'
                    : '播放方式：顺序（仅轮播开启后生效）'
                "
                @click="togglePlayMode"
              >
                {{ currentRotationMode === "random" ? "随机播放" : "顺序播放" }}
              </AppButton>
              <AppButton
                size="sm"
                :variant="currentRotationEnabled ? 'primary' : 'secondary'"
                @click="toggleRotation"
              >
                {{ currentRotationEnabled ? "轮播中" : "开启轮播" }}
              </AppButton>
              <div
                v-if="!currentRotationEnabled"
                class="flex items-center gap-2 rounded-lg border border-[var(--sd-color-border-subtle)] bg-[var(--sd-color-surface)] px-2 py-1.5"
              >
                <input
                  v-model="currentRotationInterval"
                  type="number"
                  min="5"
                  class="w-12 bg-transparent text-center text-xs text-[var(--sd-color-text-primary)] outline-none"
                  title="轮播间隔(分钟)"
                />
                <span class="text-xs text-[var(--sd-color-text-secondary)]"
                  >分钟</span
                >
              </div>
              <AppButton
                size="sm"
                :variant="isWallpaperLocked ? 'primary' : 'ghost'"
                @click="stopAndLockRotation"
              >
                {{ lockButtonLabel }}
              </AppButton>
            </div>
            <div class="text-xs text-[var(--sd-color-text-tertiary)]">
              请拖动壁纸调整顺序。
            </div>
          </AppSectionCard>

          <AppSectionCard
            :title="activeTab === 'api' ? '接口模式' : '显示效果'"
            :description="
              activeTab === 'api'
                ? 'Bing 历史壁纸统一通过同一个接口加载。'
                : '统一调节模糊、遮罩和移动端优先壁纸策略。'
            "
            body-class="space-y-3"
          >
            <template v-if="activeTab === 'pc' || activeTab === 'mobile'">
              <div class="grid gap-3 md:grid-cols-2">
                <AppRangeField
                  label="模糊"
                  :model-value="
                    activeTab === 'pc'
                      ? (store.appConfig.backgroundBlur ?? 0)
                      : (store.appConfig.mobileBackgroundBlur ?? 0)
                  "
                  :min="0"
                  :max="20"
                  :step="1"
                  :value-text="`${activeTab === 'pc' ? (store.appConfig.backgroundBlur ?? 0) : (store.appConfig.mobileBackgroundBlur ?? 0)}px`"
                  @update:modelValue="
                    (value) => {
                      if (activeTab === 'pc') {
                        store.appConfig.backgroundBlur = value;
                      } else {
                        store.appConfig.mobileBackgroundBlur = value;
                      }
                      store.markDirty();
                    }
                  "
                />
                <AppRangeField
                  label="遮罩"
                  :model-value="
                    activeTab === 'pc'
                      ? (store.appConfig.backgroundMask ?? 0)
                      : (store.appConfig.mobileBackgroundMask ?? 0)
                  "
                  :min="0"
                  :max="1"
                  :step="0.1"
                  :value-text="`${Math.round(((activeTab === 'pc' ? (store.appConfig.backgroundMask ?? 0) : (store.appConfig.mobileBackgroundMask ?? 0)) as number) * 100)}%`"
                  @update:modelValue="
                    (value) => {
                      if (activeTab === 'pc') {
                        store.appConfig.backgroundMask = value;
                      } else {
                        store.appConfig.mobileBackgroundMask = value;
                      }
                      store.markDirty();
                    }
                  "
                />
              </div>

              <AppSwitch
                v-if="activeTab === 'mobile'"
                v-model="store.appConfig.enableMobileWallpaper"
                label="手机端优先壁纸"
                hint="开启后，手机端优先使用手机壁纸；关闭后沿用 PC 端壁纸。"
                @change="store.markDirty()"
              />
            </template>

            <div v-else class="text-sm text-[var(--sd-color-text-secondary)]">
              当前模式使用 Bing API 列表，不参与本地壁纸效果调节。
            </div>

            <div
              v-if="activeTab !== 'api'"
              class="flex flex-wrap items-center gap-2"
            >
              <AppButton size="sm" variant="secondary" @click="fetchWallpapers"
                >刷新</AppButton
              >
              <AppButton
                size="sm"
                variant="primary"
                :busy="uploading"
                @click="triggerUpload"
              >
                {{ uploading ? "上传中..." : "上传壁纸" }}
              </AppButton>
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                multiple
                class="hidden"
                @change="handleUpload"
              />
            </div>
          </AppSectionCard>
        </div>
      </div>

      <div v-if="wallpaperStatusBanner" class="px-4 pt-3 md:px-6">
        <StatusBanner
          :title="wallpaperStatusBanner.title"
          :message="wallpaperStatusBanner.message"
          :tone="wallpaperStatusBanner.tone"
        />
      </div>

      <!-- Content -->
      <div
        class="flex-1 overflow-y-auto bg-[var(--sd-color-surface-muted)] p-6"
      >
        <!-- Resolving/Loading overlay for API tab -->
        <div
          v-if="activeTab === 'api' && applyingApi"
          class="absolute inset-x-0 top-[120px] bottom-0 z-50 flex flex-col items-center justify-center gap-3 bg-[var(--sd-color-surface-floating)] text-[var(--sd-color-accent-primary)] backdrop-blur-[8px]"
        >
          <div
            class="h-10 w-10 animate-spin rounded-full border-4 border-[color-mix(in_srgb,var(--sd-color-accent-primary)_18%,transparent)] border-t-[var(--sd-color-accent-primary)]"
          ></div>
          <span
            class="rounded-full bg-[var(--sd-color-surface)] px-4 py-1.5 text-sm font-bold shadow-sm"
            >正在获取高清壁纸并保存...</span
          >
        </div>

        <div
          v-if="loading"
          class="flex h-full flex-col items-center justify-center text-[var(--sd-color-text-tertiary)]"
        >
          <div
            class="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-[color-mix(in_srgb,var(--sd-color-accent-primary)_18%,transparent)] border-t-[var(--sd-color-accent-primary)]"
          ></div>
          <span class="text-xs">加载中...</span>
        </div>

        <div
          v-else-if="
            (activeTab === 'pc' && wallpapers.length === 0) ||
            (activeTab === 'mobile' && mobileWallpapers.length === 0)
          "
          class="flex h-full flex-col items-center justify-center text-[var(--sd-color-text-tertiary)]"
        >
          <span class="text-4xl mb-2">🖼️</span>
          <span class="text-sm">暂无壁纸，请先上传</span>
        </div>

        <VueDraggable
          v-else-if="activeTab !== 'api'"
          v-model="draggableList"
          class="grid gap-2 md:gap-4"
          :class="
            activeTab === 'pc'
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
          "
          :animation="150"
          :forceFallback="true"
        >
          <div
            v-for="(img, index) in draggableList"
            :key="img"
            class="sd-gallery-card group cursor-grab border-2 border-transparent"
            :class="activeTab === 'pc' ? 'aspect-video' : 'aspect-[9/16]'"
          >
            <img
              :src="
                getWallpaperDisplayUrl(
                  img,
                  activeTab === 'pc' ? 'pc' : 'mobile',
                )
              "
              v-show="
                !getWallpaperPreviewError(
                  img,
                  activeTab === 'pc' ? 'pc' : 'mobile',
                )
              "
              class="w-full h-full object-cover transition-all duration-300 group-hover:scale-110"
              decoding="async"
              @load="
                clearWallpaperPreviewError(
                  img,
                  activeTab === 'pc' ? 'pc' : 'mobile',
                )
              "
              @error="
                handleWallpaperPreviewError(
                  img,
                  activeTab === 'pc' ? 'pc' : 'mobile',
                  $event,
                )
              "
            />
            <div
              v-if="
                getWallpaperPreviewError(
                  img,
                  activeTab === 'pc' ? 'pc' : 'mobile',
                )
              "
              class="sd-gallery-card-fallback"
            >
              <span class="text-2xl">🖼️</span>
              <span class="text-xs font-medium break-all">{{ img }}</span>
              <span class="text-[10px] break-all opacity-70">{{
                getWallpaperPreviewError(
                  img,
                  activeTab === "pc" ? "pc" : "mobile",
                )
              }}</span>
            </div>

            <!-- Mask Overlay for index 0 (Removed for better preview clarity) -->
            <!-- <div
              v-if="index === 0"
              class="absolute inset-0 transition-all duration-300 pointer-events-none"
              :style="{
                backgroundColor: `rgba(0,0,0,${
                  activeTab === 'pc'
                    ? (store.appConfig.backgroundMask ?? 0)
                    : (store.appConfig.mobileBackgroundMask ?? 0)
                })`,
              }"
            ></div> -->

            <!-- Current Wallpaper Badge -->
            <div v-if="index === 0" class="sd-gallery-card-badge">
              <span>默认壁纸</span>
            </div>

            <!-- Hover Overlay -->
            <div class="sd-gallery-card-scrim"></div>

            <!-- Set as Default Overlay -->
            <div
              class="sd-gallery-card-action"
              @click="
                selectWallpaper(img, activeTab === 'pc' ? 'pc' : 'mobile')
              "
            >
              设为默认壁纸
            </div>

            <!-- Delete Button -->
            <button
              @click.stop="
                handleDelete(img, activeTab === 'pc' ? 'pc' : 'mobile')
              "
              class="sd-gallery-card-delete sd-btn sd-btn-danger opacity-0 transition-opacity group-hover:opacity-100"
              title="删除"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </VueDraggable>

        <!-- API Management -->
        <div v-if="activeTab === 'api'" class="space-y-6 p-1">
          <AppSectionCard title="Bing 壁纸接口" body-class="space-y-4">
            <div
              class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div
                  class="text-sm font-semibold text-[var(--sd-color-text-primary)]"
                >
                  {{ apiSourceSummary }}
                </div>
                <div class="mt-1 text-xs text-[var(--sd-color-text-tertiary)]">
                  api.timelessq.com / bing/list
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <AppButton
                  variant="secondary"
                  size="sm"
                  :busy="apiLoading"
                  :disabled="apiLoading || applyingApi"
                  @click="loadBingApiWallpapers(true)"
                >
                  刷新
                </AppButton>
                <AppButton
                  v-if="apiHasMoreWallpapers"
                  variant="secondary"
                  size="sm"
                  :busy="apiLoading"
                  :disabled="apiLoading || applyingApi"
                  @click="loadBingApiWallpapers(false, apiPage + 1)"
                >
                  加载更多
                </AppButton>
              </div>
            </div>

            <StatusBanner
              v-if="apiError"
              title="Bing 壁纸接口失败"
              :message="apiError"
              tone="danger"
            />

            <div
              v-if="apiWallpapers.length"
              class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
            >
              <article
                v-for="entry in apiWallpapers"
                :key="entry.id"
                class="overflow-hidden rounded-lg border border-[var(--sd-color-border-subtle)] bg-[var(--sd-color-surface)] shadow-sm"
              >
                <div
                  class="relative aspect-video bg-[var(--sd-color-surface-muted)]"
                >
                  <img
                    :src="entry.thumbnailUrl"
                    :alt="entry.title"
                    class="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div class="space-y-3 p-3">
                  <div class="min-w-0">
                    <h3
                      class="truncate text-sm font-bold text-[var(--sd-color-text-primary)]"
                      :title="entry.title"
                    >
                      {{ entry.title }}
                    </h3>
                    <p
                      class="mt-1 truncate text-xs text-[var(--sd-color-text-secondary)]"
                      :title="entry.location || entry.credit"
                    >
                      {{ entry.location || entry.credit }}
                    </p>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <AppButton
                      size="sm"
                      variant="primary"
                      :busy="apiApplyingTarget === `${entry.id}:pc:apply`"
                      :disabled="applyingApi"
                      @click="applyBingApiWallpaper(entry, 'pc')"
                    >
                      应用到 PC
                    </AppButton>
                    <AppButton
                      size="sm"
                      variant="secondary"
                      :busy="apiApplyingTarget === `${entry.id}:mobile:apply`"
                      :disabled="applyingApi"
                      @click="applyBingApiWallpaper(entry, 'mobile')"
                    >
                      应用到手机
                    </AppButton>
                    <AppButton
                      size="sm"
                      variant="ghost"
                      :busy="apiApplyingTarget === `${entry.id}:pc:save`"
                      :disabled="applyingApi"
                      @click="applyBingApiWallpaper(entry, 'pc', false)"
                    >
                      存入 PC
                    </AppButton>
                    <AppButton
                      size="sm"
                      variant="ghost"
                      :busy="apiApplyingTarget === `${entry.id}:mobile:save`"
                      :disabled="applyingApi"
                      @click="applyBingApiWallpaper(entry, 'mobile', false)"
                    >
                      存入手机
                    </AppButton>
                  </div>
                </div>
              </article>
            </div>

            <div
              v-else-if="apiLoading"
              class="flex min-h-48 items-center justify-center text-sm text-[var(--sd-color-text-tertiary)]"
            >
              正在加载 Bing 壁纸...
            </div>

            <div
              v-else
              class="flex min-h-48 items-center justify-center text-sm text-[var(--sd-color-text-tertiary)]"
            >
              暂无可用壁纸
            </div>
          </AppSectionCard>
        </div>
      </div>
    </div>
  </AppModalShell>

  <ConfirmDialog
    v-model:show="showConfirmModal"
    title="提示"
    :message="confirmMessage"
    confirm-label="确定"
    @confirm="handleConfirm"
    @cancel="closeConfirmModal"
  />
</template>
