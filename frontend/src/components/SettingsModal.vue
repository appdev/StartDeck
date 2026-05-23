<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from "vue";
import { useWindowSize } from "@vueuse/core";
import { useMainStore } from "../stores/main";
import type { WidgetConfig, NavGroup, NavItem } from "@/types";
import IconUploader from "./IconUploader.vue";
import WallpaperLibrary from "./WallpaperLibrary.vue";
import PasswordConfirmModal from "./PasswordConfirmModal.vue";
import DockerWidget from "./DockerWidget.vue";
import SystemStatusWidget from "./SystemStatusWidget.vue";
import ScriptManager from "./ScriptManager.vue";
import MarketplaceModal from "./MarketplaceModal.vue";
import AppButton from "@/components/base/AppButton.vue";
import AppFieldRow from "@/components/base/AppFieldRow.vue";
import AppInspectorPanel from "@/components/base/AppInspectorPanel.vue";
import AppModalShell from "@/components/base/AppModalShell.vue";
import AppRangeField from "@/components/base/AppRangeField.vue";
import AppSectionCard from "@/components/base/AppSectionCard.vue";
import AppSegmentedControl from "@/components/base/AppSegmentedControl.vue";
import AppSettingsShell from "@/components/base/AppSettingsShell.vue";
import AppSwitch from "@/components/base/AppSwitch.vue";
import BlockingProgressOverlay from "@/components/base/BlockingProgressOverlay.vue";
import ConfirmDialog from "@/components/base/ConfirmDialog.vue";
import StatusBanner from "@/components/base/StatusBanner.vue";
import {
  useDirtyStateGuard,
  type DirtyCloseReason,
} from "@/composables/useDirtyStateGuard";
import { useUiFeedbackStore } from "@/stores/uiFeedback";
import { toApiUrl } from "@/utils/runtimeUrls";
import { getSiteIconUrl, normalizeSiteUrl } from "@/utils/siteMetadata";

const props = defineProps<{ show: boolean }>();
const emit = defineEmits(["update:show"]);
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
    blocking?: boolean;
    actionLabel?: string;
  } = {},
) =>
  uiFeedback.alert({
    title: options.title ?? "设置提示",
    message,
    tone: options.tone ?? "info",
    blocking: options.blocking ?? false,
    actionLabel: options.actionLabel,
  });

const requestFeedbackConfirm = (
  message: string,
  options: {
    title?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: "default" | "danger";
    blocking?: boolean;
  } = {},
) =>
  uiFeedback.confirm({
    title: options.title ?? "确认操作",
    message,
    confirmLabel: options.confirmLabel,
    cancelLabel: options.cancelLabel,
    tone: options.tone,
    blocking: options.blocking,
  });

// 自动保存所有设置修改
watch(
  [() => store.widgets, () => store.appConfig],
  () => {
    if (props.show) {
      store.saveData();
    }
  },
  { deep: true },
);

onMounted(() => {
  store.lockServerSync();
});
onUnmounted(() => {
  store.unlockServerSync();
});

const DEFAULT_LATENCY_THRESHOLD_MS = 200;
const latencyThresholdDraft = ref("");
const latencyThresholdTouched = ref(false);
const latencyThresholdAppliedToast = ref("");
let latencyThresholdToastTimer: number | null = null;
const latencyThresholdValidation = computed(() => {
  const raw = latencyThresholdDraft.value.trim();
  if (!raw)
    return {
      ok: false,
      value: null as number | null,
      error: "请输入阈值（20–30000）",
    };
  if (!/^\d+$/.test(raw))
    return { ok: false, value: null as number | null, error: "仅支持正整数" };
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n))
    return { ok: false, value: null as number | null, error: "数值无效" };
  if (n < 20 || n > 30000)
    return { ok: false, value: n, error: "范围需在 20–30000 ms" };
  return { ok: true, value: n, error: "" };
});
const whitelistLatencyEnabled = computed(() => {
  return store.appConfig.whitelistLatencyMode === true;
});
const toggleWhitelistLatency = () => {
  store.appConfig.whitelistLatencyMode = !store.appConfig.whitelistLatencyMode;
  store.markDirty();
};
const syncLatencyThresholdDraft = () => {
  const v = store.appConfig.latencyThresholdMs ?? DEFAULT_LATENCY_THRESHOLD_MS;
  latencyThresholdDraft.value = String(v);
  latencyThresholdTouched.value = false;
};
watch(
  () => store.forceNetworkMode,
  (mode) => {
    if (mode === "latency") syncLatencyThresholdDraft();
  },
  { immediate: true },
);
watch(
  () => store.appConfig.latencyThresholdMs,
  () => {
    if (!latencyThresholdTouched.value) syncLatencyThresholdDraft();
  },
);
const onLatencyThresholdInput = (e: Event) => {
  latencyThresholdTouched.value = true;
  const raw = (e.target as HTMLInputElement).value ?? "";
  const digits = raw.replace(/[^\d]/g, "");
  latencyThresholdDraft.value = digits;
};
const applyLatencyThreshold = async () => {
  const v = latencyThresholdValidation.value;
  if (!v.ok || typeof v.value !== "number") return;
  store.appConfig.latencyThresholdMs = v.value;
  latencyThresholdTouched.value = false;
  store.markDirty();
  latencyThresholdAppliedToast.value = `已生效：${v.value} ms`;
  if (latencyThresholdToastTimer)
    window.clearTimeout(latencyThresholdToastTimer);
  latencyThresholdToastTimer = window.setTimeout(() => {
    latencyThresholdAppliedToast.value = "";
    latencyThresholdToastTimer = null;
  }, 1200);
};
const onLatencyThresholdBlur = async () => {
  if (!latencyThresholdTouched.value) return;
  const v = latencyThresholdValidation.value;
  if (!v.ok || typeof v.value !== "number") {
    syncLatencyThresholdDraft();
    return;
  }
  await applyLatencyThreshold();
};
const resetLatencyThreshold = async () => {
  store.appConfig.latencyThresholdMs = DEFAULT_LATENCY_THRESHOLD_MS;
  syncLatencyThresholdDraft();
  store.markDirty();
  latencyThresholdAppliedToast.value = `已重置：${DEFAULT_LATENCY_THRESHOLD_MS} ms`;
  if (latencyThresholdToastTimer)
    window.clearTimeout(latencyThresholdToastTimer);
  latencyThresholdToastTimer = window.setTimeout(() => {
    latencyThresholdAppliedToast.value = "";
    latencyThresholdToastTimer = null;
  }, 1200);
};

type WallpaperLibraryTab = "pc" | "mobile" | "api";

const settingsChildModalZIndex = 140;
const settingsBlockingModalZIndex = 150;
const showWallpaperLibrary = ref(false);
const wallpaperLibraryTab = ref<WallpaperLibraryTab>("pc");
const currentHour = ref(new Date().getHours());
let daylightTimer: number | null = null;
const updateHour = () => {
  currentHour.value = new Date().getHours();
};
const isNightTime = computed(
  () => currentHour.value >= 18 || currentHour.value < 6,
);
const isNightDaylightMode = computed(
  () => store.appConfig.daylightModeEnabled && isNightTime.value,
);
const daylightMaskPercent = computed({
  get: () => Math.round((store.appConfig.daylightMask ?? 0.5) * 100),
  set: (val: number) => {
    const v = Number.isFinite(val) ? val : 50;
    const clamped = Math.min(100, Math.max(0, v));
    store.appConfig.daylightMask = clamped / 100;
    store.markDirty();
  },
});
const cardBorderHoverPreview = computed(() =>
  store.appConfig.cardBorderColor &&
  store.appConfig.cardBorderColor !== "transparent"
    ? store.appConfig.cardBorderColor
    : store.appConfig.background || store.appConfig.solidBackgroundColor
      ? "rgba(255, 255, 255, 0.35)"
      : "rgba(15, 23, 42, 0.12)",
);
const styleVariableRows = computed(() => [
  {
    name: "--group-title-color",
    desc: "分组标题文字颜色",
    value: store.appConfig.groupTitleColor || "#ffffff",
  },
  {
    name: "--card-bg-color",
    desc: "卡片背景颜色",
    value: store.appConfig.cardBgColor || "transparent",
  },
  {
    name: "--card-border-color",
    desc: "卡片边框颜色",
    value: store.appConfig.cardBorderColor || "transparent",
  },
  {
    name: "--card-border-hover-color",
    desc: "卡片边框悬停颜色",
    value: cardBorderHoverPreview.value,
  },
  {
    name: "--card-title-color",
    desc: "卡片标题文字颜色",
    value: store.appConfig.cardTitleColor || "#111827",
  },
]);
const styleVariableStatus = {
  contrast: "待校验",
  visual: "未配置",
};
const solidBackgroundColorProxy = computed({
  get: () => store.appConfig.solidBackgroundColor || "#f3f4f6",
  set: (val: string) => {
    store.appConfig.solidBackgroundColor = val;
    store.markDirty();
  },
});

const setSolidColorAsWallpaper = () => {
  const color = store.appConfig.solidBackgroundColor || "#f3f4f6";
  if (!color) return;

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const dataUrl = canvas.toDataURL("image/png");
    store.appConfig.background = dataUrl;
    store.appConfig.solidBackgroundColor = "";
    store.markDirty();
  }
};

const handleWallpaperSelect = (
  payload: { url: string; type: string } | string,
) => {
  const url = typeof payload === "string" ? payload : payload.url;
  const type = typeof payload === "string" ? "pc" : payload.type;

  if (type === "mobile") {
    store.appConfig.mobileBackground = url;
  } else {
    store.appConfig.background = url;
  }
  store.markDirty();
};

const openWallpaperLibrary = (tab: WallpaperLibraryTab) => {
  wallpaperLibraryTab.value = tab;
  if (tab === "mobile" && !store.appConfig.enableMobileWallpaper) {
    store.appConfig.enableMobileWallpaper = true;
    store.markDirty();
  }
  showWallpaperLibrary.value = true;
};

type SettingsTabId =
  | "style"
  | "docker"
  | "account"
  | "network"
  | "lucky-stun"
  | "about";

type SettingsTabGroup = "personalization" | "system" | "extensions";

interface SettingsTabMeta {
  title: string;
  summary: string;
  glyph: string;
  group: SettingsTabGroup;
  danger?: boolean;
}

interface SettingsNavGroup {
  id: SettingsTabGroup;
  label: string;
  items: Array<{ id: SettingsTabId } & SettingsTabMeta>;
}

const activeTab = ref<SettingsTabId>("style");
const settingsTabMeta: Record<SettingsTabId, SettingsTabMeta> = {
  style: {
    title: "外观布局",
    summary: "背景、壁纸、版式与页脚设置",
    glyph: "AP",
    group: "personalization",
  },
  docker: {
    title: "Docker 管理",
    summary: "服务状态、容器诊断与系统能力",
    glyph: "DK",
    group: "system",
  },
  account: {
    title: "账户管理",
    summary: "认证模式、用户、版本与数据操作",
    glyph: "AC",
    group: "system",
  },
  network: {
    title: "网络判定",
    summary: "自动/LAN/WAN/延迟规则与诊断",
    glyph: "NW",
    group: "system",
  },
  "lucky-stun": {
    title: "开放中心",
    summary: "脚本、RSS、搜索与扩展入口",
    glyph: "JS",
    group: "extensions",
  },
  about: {
    title: "关于",
    summary: "版本、技术栈与项目能力说明",
    glyph: "AB",
    group: "system",
    danger: true,
  },
};

const settingsNavGroupLabels: Record<SettingsTabGroup, string> = {
  personalization: "Personalization",
  system: "System",
  extensions: "Extensions",
};

const settingsNavOrder: SettingsTabId[] = [
  "style",
  "docker",
  "account",
  "network",
  "lucky-stun",
  "about",
];

const settingsNavGroups = computed<SettingsNavGroup[]>(() =>
  (["personalization", "system", "extensions"] as SettingsTabGroup[])
    .map((groupId) => ({
      id: groupId,
      label: settingsNavGroupLabels[groupId],
      items: settingsNavOrder
        .filter((tabId) => settingsTabMeta[tabId].group === groupId)
        .map((tabId) => ({
          id: tabId,
          ...settingsTabMeta[tabId],
        })),
    }))
    .filter((group) => group.items.length > 0),
);

const currentSettingsTab = computed(
  () => settingsTabMeta[activeTab.value] ?? settingsTabMeta.style,
);
const { width: viewportWidth, height: viewportHeight } = useWindowSize();
const settingsIsMobile = computed(() => viewportWidth.value < 768);
const settingsShellSurfaceClass = computed(() =>
  settingsIsMobile.value
    ? "settings-shell-window is-mobile"
    : "settings-shell-window",
);
const settingsOverlayClass = computed(() => "settings-shell-overlay");
const showSettingsInspector = computed(() => viewportWidth.value >= 1440);
const settingsWindowTitle = computed(() =>
  activeTab.value === "style"
    ? "Appearance and Wallpaper"
    : "StartDeck Settings",
);
const settingsWindowSubtitle = computed(() =>
  settingsIsMobile.value ? currentSettingsTab.value.summary : "",
);
const settingsNeedsCloseConfirm = computed(() => store.hasUnsavedChanges);
const settingsStatusBanner = computed(() => {
  if (isImporting.value) {
    return {
      title: "导入进行中",
      message: "当前流程为阻断态，导入和图标补齐完成前不会允许关闭设置窗口。",
      tone: "warning" as const,
    };
  }
  if (store.isSaving || store.hasPendingSave || store.hasUnsavedChanges) {
    return {
      title: "正在同步设置",
      message: "当前修改会自动保存到服务器。建议等待同步完成后再关闭窗口。",
      tone: "info" as const,
    };
  }
  if (store.isLogged && !store.isConnected) {
    return {
      title: "实时连接已断开",
      message: "设置修改会暂存到本地，连接恢复后自动重放并同步。",
      tone: "warning" as const,
    };
  }
  return null;
});

const wallpaperSourceLabel = computed(() => {
  if (store.appConfig.empireMode) return "帝国模式背景";
  if (store.appConfig.background && inspectorPreviewImageFailed.value)
    return "桌面壁纸缺失";
  if (store.appConfig.background) return "已配置桌面壁纸";
  if (store.appConfig.solidBackgroundColor) return "纯色背景";
  return "渐变背景";
});

const mobileWallpaperLabel = computed(() => {
  if (!store.appConfig.enableMobileWallpaper) return "跟随桌面背景";
  if (store.appConfig.mobileBackground) return "已配置移动端背景";
  return "未配置移动端背景";
});

const settingsThemeLabel = computed(() =>
  isNightDaylightMode.value ? "夜间强制深色" : "跟随系统深浅色",
);

const settingsModeLabel = computed(() =>
  showSettingsInspector.value ? "宽屏三栏" : "紧凑两栏 / 移动单栏",
);

const settingsSaveStateLabel = computed(() => {
  if (isImporting.value) return "导入中";
  if (store.isSaving || store.hasPendingSave) return "同步中";
  if (store.hasUnsavedChanges) return "待保存";
  return "已保存";
});

const settingsSaveStateTone = computed(() => {
  if (isImporting.value || store.isSaving || store.hasPendingSave)
    return "info";
  if (store.hasUnsavedChanges) return "warning";
  return "success";
});
const settingsPreviewStatusLabel = computed(() => {
  if (isImporting.value) return "Blocking";
  if (store.isSaving || store.hasPendingSave) return "Saving";
  return "Visible";
});
const probePreviewImage = (url: string, timeoutMs = 1200): Promise<boolean> =>
  new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }
    const img = new Image();
    let settled = false;
    const finalize = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      img.src = "";
      resolve(ok);
    };
    const timer = window.setTimeout(() => finalize(false), timeoutMs);
    img.onload = () => finalize((img.naturalWidth || 0) > 0);
    img.onerror = () => finalize(false);
    img.src = url;
    if (img.complete) {
      finalize((img.naturalWidth || 0) > 0);
    }
  });
const inspectorPreviewImageLoaded = ref(false);
const inspectorPreviewImageFailed = ref(false);
const inspectorPreviewImageUrl = computed(() =>
  store.appConfig.background
    ? store.getAssetUrl(store.appConfig.background)
    : "",
);
const settingsPreviewSourceLabel = computed(() => {
  let label = "";
  if (store.appConfig.empireMode) {
    label = "帝国模式背景";
  } else if (store.appConfig.solidBackgroundColor) {
    label = `${store.appConfig.solidBackgroundColor} 纯色背景`;
  } else if (!store.appConfig.background) {
    label = "当前桌面使用渐变背景";
  } else if (inspectorPreviewImageFailed.value) {
    label = "桌面壁纸文件缺失，当前使用渐变回退";
  } else {
    label = store.appConfig.background;
  }
  return label.length > 44 ? `${label.slice(0, 43)}…` : label;
});
const settingsPreviewEffectsLabel = computed(
  () =>
    `${store.appConfig.backgroundBlur ?? 0}px / ${Math.round((store.appConfig.backgroundMask ?? 0) * 100)}%`,
);
const inspectorPreviewSurfaceStyle = computed(() => {
  if (store.appConfig.empireMode) {
    return {
      background:
        "radial-gradient(circle at 50% 50%, rgb(42, 42, 42), rgb(0, 0, 0))",
    };
  }
  if (store.appConfig.solidBackgroundColor) {
    return {
      backgroundColor: store.appConfig.solidBackgroundColor,
      backgroundImage: "none",
    };
  }
  return {
    backgroundImage: "linear-gradient(to top, #a18cd1 0%, #fbc2eb 100%)",
  };
});
const handleInspectorPreviewImageLoad = () => {
  inspectorPreviewImageLoaded.value = true;
  inspectorPreviewImageFailed.value = false;
};
const handleInspectorPreviewBackgroundError = () => {
  inspectorPreviewImageLoaded.value = false;
  inspectorPreviewImageFailed.value = true;
};
watch(
  inspectorPreviewImageUrl,
  async (url) => {
    inspectorPreviewImageLoaded.value = false;
    inspectorPreviewImageFailed.value = false;
    if (!url) return;
    const ok = await probePreviewImage(url);
    if (inspectorPreviewImageUrl.value !== url) return;
    inspectorPreviewImageLoaded.value = ok;
    inspectorPreviewImageFailed.value = !ok;
  },
  { immediate: true },
);
const inspectorPreviewItems = computed(() =>
  store.items
    .filter((item) => item.title || item.url)
    .slice(0, 3)
    .map((item) => item.title?.trim() || "链接"),
);

const headerLayoutOptions = [
  { label: "标准", value: "left" },
  { label: "居中", value: "center" },
  { label: "反转", value: "right" },
];

const webLayoutOptions = [
  { label: "一栏页", value: "single" },
  { label: "按组分页", value: "group" },
];

const cardLayoutOptions = [
  { label: "竖排", value: "vertical" },
  { label: "横排", value: "horizontal" },
];

const iconShapeOptions = [
  { label: "圆角", value: "rounded" },
  { label: "圆形", value: "circle" },
  { label: "方形", value: "square" },
  { label: "隐藏", value: "hidden" },
];

const handleNavWheel = (e: WheelEvent) => {
  if (window.innerWidth < 768) {
    const container = e.currentTarget as HTMLElement;
    container.scrollLeft += e.deltaY;
  }
};

const dockerWidget = computed(() =>
  store.widgets.find((w) => w.type === "docker"),
);
const systemStatusWidget = computed(() =>
  store.widgets.find((w) => w.type === "system-status"),
);

// Debug Active Tab
watch(activeTab, (val) => {
  console.log("Active Tab Changed:", val);
});

// Ensure Docker Widget Exists
onMounted(async () => {
  if (import.meta.env.MODE === "test") return;

  // 移除强制恢复逻辑，避免覆盖用户配置
  // const hasDocker = store.widgets.some((w) => w.type === "docker");
  // if (!hasDocker) { ... }
  updateHour();
  if (daylightTimer) window.clearInterval(daylightTimer);
  daylightTimer = window.setInterval(updateHour, 60 * 1000);
});

onUnmounted(() => {
  if (daylightTimer) window.clearInterval(daylightTimer);
  daylightTimer = null;
});

const showMarketplace = ref(false);

const passwordInput = ref("");
const newPasswordInput = ref("");
const hasAdminAccess = computed(
  () =>
    store.isLogged &&
    (store.systemConfig.authMode === "single" || store.username === "admin"),
);
const canManageUsers = computed(
  () => hasAdminAccess.value && store.systemConfig.authMode === "multi",
);
const isDockerSystemEnabled = computed(() =>
  Boolean(store.systemConfig.enableDocker),
);
const isUpdatingDockerSystem = ref(false);

const toggleDockerSystemEnabled = async (checked: boolean) => {
  if (isUpdatingDockerSystem.value) return;
  const current = Boolean(store.systemConfig.enableDocker);
  if (current === checked) return;

  isUpdatingDockerSystem.value = true;
  try {
    const success = await store.updateSystemConfig({ enableDocker: checked });
    if (!success) {
      void showFeedbackAlert("请确认当前账号具有管理员权限。", {
        title: "Docker 服务切换失败",
        tone: "warning",
      });
    }
  } finally {
    isUpdatingDockerSystem.value = false;
  }
};

const toggleDockerMock = (checked: boolean) => {
  const w = dockerWidget.value;
  if (w) {
    if (!w.data) w.data = {};
    w.data.useMock = checked;
    store.markDirty();
  }
};

const fileInput = ref<HTMLInputElement | null>(null);
const formatDockerConnectionError = (error: string, socketPath?: string) => {
  const lower = error.toLowerCase();
  if (lower.includes("docker is disabled")) {
    return "Docker 服务已关闭。\n请先打开“Docker 服务”总开关，再进行连接测试。";
  }
  if (lower.includes("docker not available")) {
    return `Docker 未启用或未配置连接地址。\n容器部署请挂载 /var/run/docker.sock 并设置 dockerHost=unix:///var/run/docker.sock\nSocket: ${socketPath || "-"}`;
  }
  if (
    lower.includes("docker.sock") ||
    lower.includes("unix:///var/run/docker.sock")
  ) {
    return `无法连接 Docker Socket，请确认宿主机 Docker 已启动，并在容器中挂载 /var/run/docker.sock\nSocket: ${socketPath || "-"}`;
  }
  return `连接失败: ${error}\nSocket: ${socketPath || "-"}`;
};

const checkDockerConnection = async () => {
  if (!isDockerSystemEnabled.value) {
    void showFeedbackAlert("开启总开关后才会尝试连接 Docker Engine。", {
      title: "Docker 服务当前已关闭",
      tone: "warning",
    });
    return;
  }
  try {
    const headers = store.getHeaders();
    const res = await fetch("/api/docker/info", { headers });
    const data = await res.json();
    if (data.success && data.state === "ready") {
      void showFeedbackAlert(
        `Socket: ${data.socketPath}\n版本: ${data.version.Version}\n系统: ${data.info.OSType} / ${data.info.Architecture}\n容器: ${data.info.Containers}\n名称: ${data.info.Name}`,
        { title: "Docker 连接成功", tone: "success" },
      );
    } else if (data.state === "disabled") {
      void showFeedbackAlert("请先打开“Docker 服务”总开关。", {
        title: "Docker 服务已关闭",
        tone: "warning",
      });
    } else {
      void showFeedbackAlert(
        formatDockerConnectionError(
          data.error || "Docker 不可用",
          data.socketPath,
        ),
        {
          title: "Docker 连接失败",
          tone: "danger",
        },
      );
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    void showFeedbackAlert("网络错误: " + msg, {
      title: "Docker 连接失败",
      tone: "danger",
    });
  }
};

const isExportingDockerLogs = ref(false);
const exportDockerLogs = async () => {
  if (isExportingDockerLogs.value) return;
  if (!isDockerSystemEnabled.value) {
    void showFeedbackAlert("已停止日志导出请求。", {
      title: "Docker 服务当前已关闭",
      tone: "warning",
    });
    return;
  }
  try {
    isExportingDockerLogs.value = true;
    const headers = store.getHeaders();
    const res = await fetch("/api/docker/export-logs", { headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || String(res.status));
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const link = document.createElement("a");
    link.href = url;
    link.download = `docker-logs-${ts}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    void showFeedbackAlert("导出失败: " + msg, {
      title: "日志导出失败",
      tone: "danger",
    });
  } finally {
    isExportingDockerLogs.value = false;
  }
};

// Password Confirm Logic
const showPasswordConfirm = ref(false);
const showMultiUserWarning = ref(false);
const pendingAction = ref<(() => void | Promise<void>) | null>(null);
const confirmTitle = ref("");

const requestAuth = (action: () => void | Promise<void>, title: string) => {
  pendingAction.value = action;
  confirmTitle.value = title;
  showPasswordConfirm.value = true;
};

const onAuthSuccess = async () => {
  const action = pendingAction.value;
  pendingAction.value = null;
  if (!action) return;
  await action();
};

const showSettingsCloseConfirm = ref(false);
const close = () => emit("update:show", false);
const { requestClose, handleDismissAttempt } = useDirtyStateGuard({
  isDirty: settingsNeedsCloseConfirm,
  onCleanClose: () => close(),
  onDirtyAttempt: () => {
    showSettingsCloseConfirm.value = true;
  },
});
const handleSettingsDismissAttempt = (reason: DirtyCloseReason) => {
  if (isImporting.value) return;
  handleDismissAttempt(reason);
};
const requestSettingsClose = (reason: DirtyCloseReason = "programmatic") => {
  if (isImporting.value) return;
  requestClose(reason);
};
const confirmSettingsClose = () => {
  showSettingsCloseConfirm.value = false;
  close();
};
const dismissSettingsCloseConfirm = () => {
  showSettingsCloseConfirm.value = false;
};

const showPassword = ref(false);

const handleLogin = async () => {
  try {
    const success = await store.login("admin", passwordInput.value);
    if (success) {
      notify("管理员身份已验证。", "success", "登录成功");
      passwordInput.value = "";
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "密码错误！";
    void showFeedbackAlert(msg, { title: "登录失败", tone: "danger" });
  }
};
const handleChangePassword = () => {
  if (!newPasswordInput.value || newPasswordInput.value.length < 4) {
    notify("密码至少需要 4 位。", "warning", "无法修改密码");
    return;
  }
  requestAuth(async () => {
    store.changePassword(newPasswordInput.value);
    store.markDirty();
    await store.saveData(true);
    void showFeedbackAlert("请使用新密码重新登录验证。", {
      title: "密码修改成功",
      tone: "success",
    });
    newPasswordInput.value = "";
  }, "请输入当前密码以确认修改");
};

const onMobileDockerDisplayChange = (e: Event) => {
  const checked = (e.target as HTMLInputElement | null)?.checked ?? false;
  const w = dockerWidget.value;
  if (w) {
    w.hideOnMobile = !checked;
    store.markDirty();
  }
};

// Admin User Management
const userList = ref<string[]>([]);
const newUser = ref("");
const newPwd = ref("");
const licenseKey = ref("");

const loadUsers = async () => {
  if (!canManageUsers.value) {
    userList.value = [];
    return;
  }
  const users = await store.fetchUsers();
  if (Array.isArray(users)) {
    userList.value = users;
  }
};

const handleAddUser = async () => {
  if (!newUser.value || !newPwd.value) {
    notify("请输入用户名和密码。", "warning", "无法添加用户");
    return;
  }
  try {
    await store.addUser(newUser.value, newPwd.value);
    notify(`用户 ${newUser.value} 已创建。`, "success", "添加成功");
    newUser.value = "";
    newPwd.value = "";
    loadUsers();
  } catch (e: unknown) {
    void showFeedbackAlert((e as Error).message || "添加失败", {
      title: "添加用户失败",
      tone: "danger",
    });
  }
};

const handleDeleteUser = async (u: string) => {
  const confirmed = await requestFeedbackConfirm(`确定删除用户 ${u} 吗？`, {
    title: "删除用户",
    confirmLabel: "删除",
    cancelLabel: "取消",
    tone: "danger",
  });
  if (!confirmed) return;
  try {
    await store.deleteUser(u);
    notify(`用户 ${u} 已删除。`, "success", "删除成功");
    loadUsers();
  } catch {
    void showFeedbackAlert("删除失败", {
      title: "删除用户失败",
      tone: "danger",
    });
  }
};

const handleUploadLicense = async () => {
  if (!licenseKey.value) {
    notify("请输入许可证密钥。", "warning", "无法导入密钥");
    return;
  }
  try {
    await store.uploadLicense(licenseKey.value);
    notify("限制已解除。", "success", "密钥导入成功");
    licenseKey.value = "";
  } catch (e: unknown) {
    void showFeedbackAlert((e as Error).message || "导入失败", {
      title: "密钥导入失败",
      tone: "danger",
    });
  }
};

// Watch for tab change to load users
watch(
  activeTab,
  (val) => {
    if (val === "account" && canManageUsers.value) {
      loadUsers();
    }
  },
  { immediate: true },
);

const toggleAuthMode = async () => {
  const currentMode = store.systemConfig.authMode;
  const newMode = currentMode === "single" ? "multi" : "single";

  if (newMode === "single") {
    const confirmed = await requestFeedbackConfirm(
      "确定要切换到单用户模式吗？\n切换后将隐藏注册入口，默认登录 Admin 账户。",
      {
        title: "切换到单用户模式",
        confirmLabel: "确认切换",
        cancelLabel: "取消",
        tone: "danger",
      },
    );
    if (!confirmed) return;
    requestAuth(
      () => performAuthModeSwitch(newMode),
      "请输入管理员密码以确认切换",
    );
  } else {
    // Show custom warning for multi-user mode switch
    showMultiUserWarning.value = true;
  }
};

const performAuthModeSwitch = async (newMode: string) => {
  const success = await store.updateSystemConfig({ authMode: newMode });
  if (success) {
    close();
    store.logout();
  } else {
    void showFeedbackAlert("请检查当前登录权限。", {
      title: "切换失败",
      tone: "danger",
    });
  }
};

onMounted(() => {
  store.checkUpdate();
});

// 单用户模式：配置版本管理
const versionLabel = ref("");
const versions = ref<
  { id: string; label: string; createdAt: number; size: number }[]
>([]);
const loadingVersions = ref(false);
const isImporting = ref(false);
/** 上传阶段 | 导入完成后后台补图标 */
const importOverlayMode = ref<"upload" | "icons">("upload");
const importProgress = ref(0);
const importTotal = ref(0);

const findNavItemByIdInStore = (id: string): NavItem | null => {
  for (const g of store.groups) {
    const found = g.items.find((it) => it.id === id);
    if (found) return found;
  }
  return null;
};

const fetchVersions = async () => {
  try {
    loadingVersions.value = true;
    const token = localStorage.getItem("start-deck-token");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const r = await fetch("/api/config-versions", { headers });
    if (!r.ok) return;
    const j = await r.json();
    versions.value = j.versions || [];
  } finally {
    loadingVersions.value = false;
  }
};

const saveVersion = async () => {
  try {
    const token = localStorage.getItem("start-deck-token");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const r = await fetch("/api/config-versions", {
      method: "POST",
      headers,
      body: JSON.stringify({ label: versionLabel.value.trim() }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      void showFeedbackAlert("保存版本失败: " + (d.error || r.status), {
        title: "版本快照保存失败",
        tone: "danger",
      });
      return;
    }
    versionLabel.value = "";
    await fetchVersions();
  } catch (e) {
    console.error("[SettingsModal][SaveVersion]", e);
  }
};

const restoreVersion = async (id: string) => {
  try {
    const confirmed = await requestFeedbackConfirm(
      "确认恢复该版本？当前配置将被覆盖（密码不变）",
      {
        title: "恢复版本",
        confirmLabel: "恢复",
        cancelLabel: "取消",
        tone: "danger",
      },
    );
    if (!confirmed) return;
    const token = localStorage.getItem("start-deck-token");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const r = await fetch("/api/config-versions/restore", {
      method: "POST",
      headers,
      body: JSON.stringify({ id }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      void showFeedbackAlert("恢复失败: " + (d.error || r.status), {
        title: "版本恢复失败",
        tone: "danger",
      });
      return;
    }
    window.location.reload();
  } catch (e) {
    console.error("[SettingsModal][RestoreVersion]", e);
  }
};

const deleteVersion = async (id: string) => {
  try {
    const token = localStorage.getItem("start-deck-token");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const r = await fetch(`/api/config-versions/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers,
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      void showFeedbackAlert("删除失败: " + (d.error || r.status), {
        title: "版本删除失败",
        tone: "danger",
      });
      return;
    }
    await fetchVersions();
  } catch (e) {
    console.error("[SettingsModal][DeleteVersion]", e);
  }
};

onMounted(() => {
  if (hasAdminAccess.value && store.systemConfig.authMode === "single") {
    fetchVersions();
  } else if (store.isLogged) {
    // 非单用户模式下，也允许查看自己的版本
    fetchVersions();
  }
});

const getWebhookUrl = () => {
  return toApiUrl("/api/webhook/lucky/stun");
};

const browserHelperHandshakeLink = computed(() => {
  if (typeof window === "undefined") return "";
  const token = localStorage.getItem("start-deck-token") || "";
  if (!token) return "";

  const origin = window.location.origin;
  const url = new URL(`${origin}/`);
  const params = new URLSearchParams();
  params.set("startdeck-helper-handshake", "1");
  params.set("origin", origin);
  params.set("token", token);
  params.set("source", "open-center");
  url.hash = params.toString();
  return url.toString();
});

const copyBrowserHelperHandshakeLink = async () => {
  const link = browserHelperHandshakeLink.value;
  if (!link) {
    notify(
      "请先登录 StartDeck，再生成浏览器助手握手链接。",
      "warning",
      "无法复制握手链接",
    );
    return;
  }
  await navigator.clipboard.writeText(link);
  notify("浏览器助手握手链接已复制到剪贴板。", "success", "复制成功");
};

const openBrowserHelperHandshakeLink = () => {
  const link = browserHelperHandshakeLink.value;
  if (!link) {
    notify(
      "请先登录 StartDeck，再生成浏览器助手握手链接。",
      "warning",
      "无法打开握手链接",
    );
    return;
  }
  window.open(link, "_blank", "noopener,noreferrer");
};

const copyWebhookUrl = () => {
  navigator.clipboard.writeText(getWebhookUrl()).then(() => {
    notify("Webhook 地址已复制到剪贴板。", "success", "复制成功");
  });
};

const formatTime = (ts?: number) => {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
};

onMounted(() => {
  store.fetchLuckyStunData();
});

const enableDockerWidget = () => {
  const def: WidgetConfig = {
    id: "docker",
    type: "docker",
    enable: true,
    isPublic: true,
    colSpan: 1,
    rowSpan: 1,
    data: { useMock: false },
  };
  const exists = store.widgets.find((w) => w.type === "docker");
  if (!exists) {
    store.widgets.push(def);
    store.markDirty();
  } else {
    exists.enable = true;
    store.markDirty();
  }
};

const toggleSystemStatusMock = (checked: boolean) => {
  const w = systemStatusWidget.value;
  if (w) {
    if (!w.data) w.data = {};
    w.data.useMock = checked;
    store.markDirty();
  }
};

const enableSystemStatusWidget = () => {
  const def: WidgetConfig = {
    id: "system-status",
    type: "system-status",
    enable: true,
    isPublic: true,
    colSpan: 1,
    rowSpan: 1,
    data: { useMock: false },
  };
  const exists = store.widgets.find((w) => w.type === "system-status");
  if (!exists) {
    store.widgets.push(def);
    store.markDirty();
  } else {
    exists.enable = true;
    store.markDirty();
  }
};

const onMobileSystemStatusDisplayChange = (e: Event) => {
  const checked = (e.target as HTMLInputElement | null)?.checked ?? false;
  const w = systemStatusWidget.value;
  if (w) {
    w.hideOnMobile = !checked;
    store.markDirty();
  }
};

const handleExport = async () => {
  try {
    // 强制立即保存，确保后端数据也是最新的
    store.markDirty();

    const backupData = {
      items: store.items,
      widgets: store.widgets,
      appConfig: store.appConfig,
      groups: store.groups,
      rssFeeds: store.rssFeeds,
      rssCategories: store.rssCategories,
    };
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `start-deck-backup-${new Date().toISOString().substring(0, 10).replace(/-/g, "")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    void showFeedbackAlert("导出失败", {
      title: "配置导出失败",
      tone: "danger",
    });
    console.error("[SettingsModal][Export] failed", e);
  }
};

const triggerImport = () => {
  fileInput.value?.click();
};

const AUTO_ICON_CHECK_TIMEOUT_MS = 1500;
const autoIconCache = new Map<string, Promise<string>>();

const checkImage = (
  url: string,
  timeoutMs = AUTO_ICON_CHECK_TIMEOUT_MS,
): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finalize = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      // Stop any pending image work once we already know the result.
      img.src = "";
      resolve(ok);
    };
    const timer = window.setTimeout(() => finalize(false), timeoutMs);
    img.onload = () => finalize(true);
    img.onerror = () => finalize(false);
    img.src = url;
  });
};

const getAutoIcon = async (url: string) => {
  if (!url) return "";
  try {
    const normalizedUrl = normalizeSiteUrl(url);
    const cacheKey =
      new URL(normalizedUrl).hostname.toLowerCase() || normalizedUrl;
    let task = autoIconCache.get(cacheKey);

    if (!task) {
      task = (async () => {
        const src = getSiteIconUrl(normalizedUrl);
        return (await checkImage(src)) ? src : "";
      })();
      autoIconCache.set(cacheKey, task);
    }

    return await task;
  } catch {
    // ignore
  }
  return "";
};

const handleFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e: ProgressEvent<FileReader>) => {
    let sunPanelItemsNeedingIcons: NavItem[] = [];
    try {
      const content = e.target?.result as string;
      let data = JSON.parse(content);

      // SunPanel format support
      if (Array.isArray(data.icons)) {
        const newGroups: NavGroup[] = data.icons.map(
          (
            g: {
              title?: string;
              children?: {
                title?: string;
                url?: string;
                lanUrl?: string;
                description?: string;
                openMethod?: number;
                icon?: { src?: string };
              }[];
            },
            gIdx: number,
          ) => ({
            id: Date.now().toString() + "_" + gIdx,
            title: g.title || "New Group",
            items: (g.children || []).map(
              (
                c: {
                  title?: string;
                  url?: string;
                  lanUrl?: string;
                  description?: string;
                  openMethod?: number;
                  icon?: { src?: string };
                },
                cIdx: number,
              ) => {
                let icon = c.icon?.src || "";
                // Only keep absolute URLs (http/https), discard relative paths (server-local)
                if (!icon.startsWith("http")) {
                  icon = "";
                }

                return {
                  id: Date.now().toString() + "_" + gIdx + "_" + cIdx,
                  title: c.title || "New Item",
                  url: c.url || "",
                  lanUrl: c.lanUrl || "",
                  icon: icon,
                  description1: c.description || "",
                  // SunPanel: 2 usually means new tab
                  openInNewTab: c.openMethod === 2,
                  isPublic: true,
                };
              },
            ),
          }),
        );

        // SunPanel：先快速导入；图标在「导入成功」后于后台抓取并单独保存（见下方 POST 之后逻辑）
        const allItems = newGroups.flatMap((g) => g.items);
        sunPanelItemsNeedingIcons = allItems.filter(
          (it) => !it.icon && !!(it.url || it.lanUrl),
        );

        // Preserve existing config, append new groups
        const existingGroups = store.groups;
        const finalGroups = [...existingGroups, ...newGroups];

        data = {
          groups: finalGroups,
          items: finalGroups.flatMap((g) => g.items),
          widgets: store.widgets,
          appConfig: store.appConfig,
        };
      } else if ((!data.groups || data.groups.length === 0) && data.items) {
        const items = data.items.map((item: NavItem) => ({
          ...item,
          isPublic: item.isPublic ?? true,
        }));
        data.groups = [
          { id: Date.now().toString(), title: "默认分组", items: items },
        ];
      }
      if ("password" in data) {
        delete data.password;
      }

      isImporting.value = true;
      importOverlayMode.value = "upload";
      importProgress.value = 0;
      importTotal.value = 0;

      const token = localStorage.getItem("start-deck-token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const r = await fetch("/api/data/import", {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("import_post_failed:" + r.status);

      await store.fetchData();

      if (sunPanelItemsNeedingIcons.length > 0) {
        importOverlayMode.value = "icons";
        importTotal.value = sunPanelItemsNeedingIcons.length;
        importProgress.value = 0;

        const batchSize = 10;
        for (let i = 0; i < sunPanelItemsNeedingIcons.length; i += batchSize) {
          const batch = sunPanelItemsNeedingIcons.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async (refItem) => {
              try {
                const live = findNavItemByIdInStore(refItem.id);
                if (!live || live.icon) return;
                const targetUrl = live.url || live.lanUrl;
                if (targetUrl) {
                  const icon = await getAutoIcon(targetUrl);
                  if (icon) live.icon = icon;
                }
              } finally {
                importProgress.value++;
              }
            }),
          );
        }

        const saveResult = await store.saveData(true, true);
        if (saveResult !== "saved" && saveResult !== "no_change") {
          console.warn(
            "[SettingsModal][Import] post-icon saveData:",
            saveResult,
          );
          if (saveResult === "conflict") {
            void showFeedbackAlert("请刷新页面后再试。", {
              title: "配置已导入，但补图标保存发生版本冲突",
              tone: "warning",
            });
            return;
          }
        }
      }

      notify("配置和资源已写入当前面板。", "success", "导入成功");
    } catch (err) {
      void showFeedbackAlert("请检查文件格式是否为 JSON。", {
        title: "导入失败",
        tone: "danger",
      });
      console.error("[SettingsModal][Import] failed", err);
    } finally {
      if (fileInput.value) fileInput.value.value = "";
      isImporting.value = false;
      importOverlayMode.value = "upload";
      importProgress.value = 0;
      importTotal.value = 0;
    }
  };
  reader.readAsText(file);
};

const saveDefaultBtnText = ref("设为默认模板");

const handleReset = async () => {
  requestAuth(async () => {
    // 密码验证通过后直接执行
    try {
      const token = localStorage.getItem("start-deck-token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const r = await fetch("/api/reset", {
        method: "POST",
        headers,
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || "reset_failed");
      }
      // 移除成功弹窗，直接刷新
      window.location.reload();
    } catch (e: unknown) {
      const err = e as Error;
      void showFeedbackAlert("恢复失败: " + (err.message || "未知错误"), {
        title: "恢复初始化失败",
        tone: "danger",
      });
      console.error("[SettingsModal][Reset] failed", e);
    }
  }, "请输入密码以确认恢复初始化");
};

const handleSaveAsDefault = async () => {
  requestAuth(async () => {
    // 密码验证通过后直接执行
    try {
      const token = localStorage.getItem("start-deck-token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const r = await fetch("/api/default/save", {
        method: "POST",
        headers,
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || "save_default_failed");
      }

      // 移除成功弹窗，使用按钮文字反馈
      saveDefaultBtnText.value = "保存成功！";
      setTimeout(() => {
        saveDefaultBtnText.value = "设为默认模板";
      }, 2000);
    } catch (e: unknown) {
      const err = e as Error;
      void showFeedbackAlert("保存失败: " + (err.message || "未知错误"), {
        title: "保存默认模板失败",
        tone: "danger",
      });
      console.error("[SettingsModal][SaveDefault] failed", e);
    }
  }, "请输入密码以确认保存默认模板");
};

const normalizeFileTransferWidgets = () => {
  const list = store.widgets;
  const all = list.filter((w) => w.type === "file-transfer");
  if (all.length === 0) return;

  const keep = all.find((w) => w.id === "file-transfer") || all[0]!;
  let changed = false;

  for (let i = list.length - 1; i >= 0; i--) {
    const w = list[i];
    if (w && w.type === "file-transfer" && w.id !== keep.id) {
      list.splice(i, 1);
      changed = true;
    }
  }

  if (
    keep.id !== "file-transfer" &&
    !list.some((w) => w.id === "file-transfer" && w.type !== "file-transfer")
  ) {
    keep.id = "file-transfer";
    changed = true;
  }

  if (changed) store.markDirty();
};

// 修复：移除 computed 中的副作用，改用 onMounted 初始化
onMounted(() => {
  store.widgets.forEach((w: WidgetConfig) => {
    if (w.type === "iframe" && !w.data) {
      w.data = { url: "" };
    }
  });
  normalizeFileTransferWidgets();
});

// Wallpaper Library Logic
// Wallpaper logic moved to WallpaperLibrary.vue
// Keeping minimal code if needed, or remove completely if unused.
// Since we removed the UI that uses these functions, we can remove the functions too.
// However, to be safe and clean, I will remove the unused refs and functions.

/* Removed: wallpapers, loadingWallpapers, fetchWallpapers, deleteWallpaper, uploadWallpaperInput, triggerWallpaperUpload, handleWallpaperUpload */
/* Removed: mobileWallpapers, loadingMobileWallpapers, fetchMobileWallpapers, deleteMobileWallpaper, uploadMobileWallpaperInput, triggerMobileWallpaperUpload, handleMobileWallpaperUpload */

onMounted(() => {
  // Removed wallpaper fetches
});

// Dragging Logic
const modalPosition = ref({ x: 0, y: 0 });
const isDragging = ref(false);
const dragStart = { x: 0, y: 0 };
const initialModalPosition = { x: 0, y: 0 };
const resetSettingsWindowPosition = () => {
  modalPosition.value = { x: 0, y: 0 };
};

const getSettingsPanelSize = () => {
  const panel = document.querySelector<HTMLElement>(".sd-settings-shell-panel");
  if (panel) {
    return {
      width: panel.offsetWidth,
      height: panel.offsetHeight,
    };
  }
  return {
    width: Math.min(1180, Math.max(320, window.innerWidth - 32)),
    height: Math.min(724, Math.max(360, window.innerHeight - 32)),
  };
};

const clampModalPosition = (x: number, y: number) => {
  const { width, height } = getSettingsPanelSize();
  const gutter = 16;
  const maxOffsetX = Math.max(0, (window.innerWidth - width) / 2 - gutter);
  const maxOffsetY = Math.max(0, (window.innerHeight - height) / 2 - gutter);
  return {
    x: Math.min(maxOffsetX, Math.max(-maxOffsetX, x)),
    y: Math.min(maxOffsetY, Math.max(-maxOffsetY, y)),
  };
};

const syncModalPositionToViewport = () => {
  if (window.innerWidth < 768) {
    resetSettingsWindowPosition();
    return;
  }
  modalPosition.value = clampModalPosition(
    modalPosition.value.x,
    modalPosition.value.y,
  );
};

const onMouseDown = (e: MouseEvent) => {
  // Prevent dragging if clicking on interactive elements
  if ((e.target as HTMLElement).closest("button, input, textarea, a, .no-drag"))
    return;

  isDragging.value = true;
  dragStart.x = e.clientX;
  dragStart.y = e.clientY;
  initialModalPosition.x = modalPosition.value.x;
  initialModalPosition.y = modalPosition.value.y;

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
};

const onMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return;
  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;
  modalPosition.value = clampModalPosition(
    initialModalPosition.x + dx,
    initialModalPosition.y + dy,
  );
};

const onMouseUp = () => {
  isDragging.value = false;
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseUp);
};

watch([viewportWidth, viewportHeight, () => props.show], ([width, , show]) => {
  if (!show) return;
  if (width < 768) {
    resetSettingsWindowPosition();
    return;
  }
  void nextTick(syncModalPositionToViewport);
});

// Nav Dragging Logic
const navRef = ref<HTMLElement | null>(null);
const isNavDragging = ref(false);
const navStartX = ref(0);
const navScrollLeft = ref(0);

const onNavMouseDown = (e: MouseEvent) => {
  if (!navRef.value) return;
  isNavDragging.value = true;
  navStartX.value = e.pageX - navRef.value.offsetLeft;
  navScrollLeft.value = navRef.value.scrollLeft;
};

const onNavMouseMove = (e: MouseEvent) => {
  if (!isNavDragging.value || !navRef.value) return;
  e.preventDefault();
  const x = e.pageX - navRef.value.offsetLeft;
  const walk = (x - navStartX.value) * 2;
  navRef.value.scrollLeft = navScrollLeft.value - walk;
};

const onNavMouseUp = () => {
  isNavDragging.value = false;
};

watch(
  () => props.show,
  (val) => {
    if (val && activeTab.value === "account" && store.isLogged) {
      if (canManageUsers.value) {
        loadUsers();
      }
      if (store.systemConfig.authMode === "single" || !canManageUsers.value) {
        fetchVersions();
      }
    }
  },
);

watch(activeTab, (val) => {
  if (
    val === "account" &&
    store.isLogged &&
    (store.systemConfig.authMode === "single" || !canManageUsers.value)
  ) {
    fetchVersions();
  }
});
</script>

<template>
  <BlockingProgressOverlay
    :show="show"
    v-if="isImporting"
    :z-index="130"
    :title="
      importOverlayMode === 'upload' ? '正在导入配置…' : '正在后台抓取图标…'
    "
    :message="
      importOverlayMode === 'upload'
        ? '正在保存到服务器，请稍候（完成后若需补图标会继续显示进度）'
        : '配置已保存。正在从网络获取网站图标，完成后会自动写入配置。若某个站点较慢会短暂停顿，属于正常现象。'
    "
    :progress="importProgress"
    :total="importTotal"
    :progress-label="
      importTotal > 0 ? `图标进度：${importProgress} / ${importTotal}` : ''
    "
  />

  <AppSettingsShell
    :show="show"
    :z-index="120"
    :title="settingsWindowTitle"
    :subtitle="settingsWindowSubtitle"
    :close-on-overlay="!isImporting && !settingsNeedsCloseConfirm"
    :close-on-escape="!isImporting && !settingsNeedsCloseConfirm"
    :show-close="!isImporting"
    :show-inspector="showSettingsInspector"
    :scheme="isNightDaylightMode ? 'dark' : 'auto'"
    :overlay-class="settingsOverlayClass"
    :surface-class="settingsShellSurfaceClass"
    panel-class="w-full max-w-[1280px]"
    :panel-style="{
      transform: `translate(${modalPosition.x}px, ${modalPosition.y}px)`,
    }"
    @dismiss-attempt="handleSettingsDismissAttempt"
    @close="requestSettingsClose"
  >
    <template #headerActions>
      <div v-if="!settingsIsMobile" class="flex items-center gap-2">
        <AppButton
          variant="primary"
          size="sm"
          :disabled="isImporting"
          title="完成并关闭设置"
          @click="requestSettingsClose('programmatic')"
        >
          完成
        </AppButton>
      </div>
    </template>

    <template #sidebar>
      <div class="settings-shell-sidebar cursor-move" @mousedown="onMouseDown">
        <div class="settings-shell-sidebar-copy">
          <p class="settings-shell-sidebar-eyebrow">StartDeck Settings</p>
          <h3 class="settings-shell-sidebar-title">
            {{ currentSettingsTab.title }}
          </h3>
          <p class="settings-shell-sidebar-summary">
            {{ currentSettingsTab.summary }}
          </p>
        </div>
        <nav
          ref="navRef"
          class="settings-shell-nav overflow-visible no-drag cursor-grab active:cursor-grabbing overscroll-contain"
          @mousedown="onNavMouseDown"
          @mousemove="onNavMouseMove"
          @mouseup="onNavMouseUp"
          @mouseleave="onNavMouseUp"
          @wheel.stop.passive="handleNavWheel"
        >
          <div
            v-for="group in settingsNavGroups"
            :key="group.id"
            class="sd-settings-nav-group"
          >
            <div class="sd-settings-nav-label">{{ group.label }}</div>
            <button
              v-for="item in group.items"
              :key="item.id"
              type="button"
              class="sd-settings-nav-item"
              :class="{
                'is-active': activeTab === item.id,
                'is-danger': item.danger,
              }"
              @click="activeTab = item.id"
            >
              <span class="sd-settings-nav-item-glyph">{{ item.glyph }}</span>
              <span class="sd-settings-nav-item-copy">
                <span class="sd-settings-nav-item-title">{{ item.title }}</span>
                <span class="sd-settings-nav-item-summary">{{
                  item.summary
                }}</span>
              </span>
            </button>
          </div>
        </nav>
      </div>
    </template>

    <div
      class="settings-shell-content sd-theme-bridge flex-1 flex flex-col overflow-hidden"
    >
      <div
        class="settings-shell-scroll flex-1 p-3 overscroll-contain"
        @wheel.stop
      >
        <StatusBanner
          v-if="settingsStatusBanner"
          class="mb-3"
          :title="settingsStatusBanner.title"
          :message="settingsStatusBanner.message"
          :tone="settingsStatusBanner.tone"
        />
        <div v-if="activeTab === 'style'" class="space-y-4">
          <AppSectionCard
            title="桌面外观"
            description="网站标题、布局模式、组件区域、页脚、日光模式和天气效果保留在同一组，实时反映到右侧预览。"
            body-class="space-y-4"
          >
            <AppFieldRow
              label="网站标题"
              hint="导航主标题。修改后会立即进入待保存状态。"
            >
              <template #control>
                <input
                  v-model="store.appConfig.customTitle"
                  type="text"
                  class="sd-input w-full"
                />
              </template>
            </AppFieldRow>

            <AppFieldRow
              label="Web 端展现方式"
              hint="一栏页按组分页，分页时可禁止翻页。"
            >
              <template #control>
                <AppSegmentedControl
                  :model-value="
                    store.appConfig.webGroupPagination ? 'group' : 'single'
                  "
                  :options="webLayoutOptions"
                  @update:modelValue="
                    (value) => {
                      store.appConfig.webGroupPagination = value === 'group';
                      if (value !== 'group') {
                        store.appConfig.webGroupPaginationDisableFlip = false;
                      }
                      store.markDirty();
                    }
                  "
                />
              </template>
            </AppFieldRow>

            <AppFieldRow
              label="白昼模式"
              hint="白天 6:00-18:00，夜间 18:00-6:00 自动调整遮罩。"
              align="center"
            >
              <template #control>
                <AppSwitch
                  v-model="store.appConfig.daylightModeEnabled"
                  label=""
                  @change="store.markDirty()"
                >
                  <template #suffix>
                    <div class="flex items-center gap-2">
                      <div
                        class="flex items-center gap-1 rounded-lg border border-[var(--sd-color-border-subtle)] bg-[var(--sd-color-surface)] px-2 py-1"
                      >
                        <input
                          v-model.number="daylightMaskPercent"
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          class="w-12 bg-transparent text-xs text-[var(--sd-color-text-primary)] outline-none"
                        />
                        <span
                          class="text-xs text-[var(--sd-color-text-secondary)]"
                          >%</span
                        >
                      </div>
                    </div>
                  </template>
                  <div class="text-xs text-[var(--sd-color-text-tertiary)]">
                    当前夜间遮罩 {{ daylightMaskPercent }}%
                  </div>
                </AppSwitch>
              </template>
            </AppFieldRow>
          </AppSectionCard>

          <AppSectionCard
            title="壁纸库"
            description="桌面、移动端与 API 来源分开管理，优先保证预览和切换路径清晰。"
            body-class="space-y-4"
          >
            <div class="settings-wallpaper-grid">
              <button
                type="button"
                class="settings-wallpaper-card"
                @click="openWallpaperLibrary('pc')"
              >
                <span class="settings-wallpaper-pill is-pc">PC</span>
                <strong class="settings-wallpaper-title">桌面壁纸</strong>
                <span class="settings-wallpaper-summary">{{
                  wallpaperSourceLabel
                }}</span>
                <span class="settings-wallpaper-meta">
                  模糊 {{ store.appConfig.backgroundBlur ?? 0 }}px · 遮罩
                  {{ Math.round((store.appConfig.backgroundMask ?? 0) * 100) }}%
                </span>
              </button>
              <button
                type="button"
                class="settings-wallpaper-card"
                @click="openWallpaperLibrary('mobile')"
              >
                <span class="settings-wallpaper-pill is-mobile">Mobile</span>
                <strong class="settings-wallpaper-title">移动端背景</strong>
                <span class="settings-wallpaper-summary">{{
                  mobileWallpaperLabel
                }}</span>
                <span class="settings-wallpaper-meta"
                  >优先使用安全区裁切与独立图片路径。</span
                >
              </button>
              <button
                type="button"
                class="settings-wallpaper-card"
                @click="openWallpaperLibrary('api')"
              >
                <span class="settings-wallpaper-pill is-api">API</span>
                <strong class="settings-wallpaper-title">壁纸接口</strong>
                <span class="settings-wallpaper-summary">{{
                  store.appConfig.wallpaperApiPcList || "/api/backgrounds"
                }}</span>
                <span class="settings-wallpaper-meta"
                  >失败时保留上一张缓存，不提升为阻断弹窗。</span
                >
              </button>
            </div>
          </AppSectionCard>

          <WallpaperLibrary
            v-model:show="showWallpaperLibrary"
            :initial-tab="wallpaperLibraryTab"
            :z-index="settingsChildModalZIndex"
            @select="handleWallpaperSelect"
          />

          <AppSectionCard
            title="背景与可读性"
            description="上传、裁剪与可读性参数仍保留在这里，避免打断设置首页的主信息流。"
            body-class="space-y-4"
          >
            <AppFieldRow
              label="背景图片"
              hint="上传、裁剪与预览背景图，统一从壁纸库管理。"
            >
              <template #control>
                <div class="sd-section space-y-3">
                  <IconUploader
                    v-model="store.appConfig.background"
                    @update:modelValue="store.markDirty()"
                    :crop="false"
                    :previewStyle="{
                      filter: `blur(${store.appConfig.backgroundBlur ?? 0}px)`,
                      transform: 'scale(1.1)',
                    }"
                    :overlayStyle="{
                      backgroundColor: `rgba(0,0,0,${store.appConfig.backgroundMask ?? 0})`,
                    }"
                  />
                  <div
                    class="flex flex-wrap items-center justify-between gap-2"
                  >
                    <AppButton
                      v-if="store.appConfig.background"
                      variant="danger-soft"
                      size="sm"
                      @click="
                        store.appConfig.background = '';
                        store.markDirty();
                      "
                    >
                      清除背景
                    </AppButton>
                    <AppButton
                      class="ml-auto"
                      variant="primary"
                      size="sm"
                      @click="openWallpaperLibrary('pc')"
                    >
                      管理壁纸库
                    </AppButton>
                    <span class="text-xs text-[var(--sd-color-text-tertiary)]">
                      {{ wallpaperSourceLabel }} · 遮罩
                      {{
                        Math.round((store.appConfig.backgroundMask ?? 0) * 100)
                      }}%
                    </span>
                  </div>
                </div>
              </template>
            </AppFieldRow>

            <div class="grid gap-4 md:grid-cols-2">
              <AppRangeField
                label="桌面背景模糊"
                :model-value="store.appConfig.backgroundBlur ?? 0"
                :min="0"
                :max="24"
                :step="1"
                :value-text="`${store.appConfig.backgroundBlur ?? 0}px`"
                @update:modelValue="
                  (value) => {
                    store.appConfig.backgroundBlur = value;
                    store.markDirty();
                  }
                "
              />

              <AppRangeField
                label="桌面遮罩"
                :model-value="
                  Math.round((store.appConfig.backgroundMask ?? 0) * 100)
                "
                :min="0"
                :max="90"
                :step="5"
                :value-text="`${Math.round((store.appConfig.backgroundMask ?? 0) * 100)}%`"
                @update:modelValue="
                  (value) => {
                    store.appConfig.backgroundMask = value / 100;
                    store.markDirty();
                  }
                "
              />
            </div>

            <AppFieldRow
              label="移动端背景"
              hint="移动端可独立管理壁纸，优先使用安全区域裁切。"
            >
              <template #control>
                <div class="space-y-3">
                  <div class="settings-inline-switch">
                    <div class="settings-inline-switch-copy">
                      <span class="settings-inline-switch-title"
                        >启用独立移动端背景</span
                      >
                      <span class="settings-inline-switch-summary">{{
                        mobileWallpaperLabel
                      }}</span>
                    </div>
                    <AppSwitch
                      v-model="store.appConfig.enableMobileWallpaper"
                      label=""
                      @change="store.markDirty()"
                    />
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <AppButton
                      variant="secondary"
                      size="sm"
                      @click="openWallpaperLibrary('mobile')"
                    >
                      选择移动背景
                    </AppButton>
                    <span class="text-xs text-[var(--sd-color-text-tertiary)]">
                      {{ store.appConfig.mobileBackground || "未设置单独路径" }}
                    </span>
                  </div>
                </div>
              </template>
            </AppFieldRow>

            <AppFieldRow
              label="纯色背景"
              hint="为空时使用上传背景；也可以直接设为当前壁纸。"
            >
              <template #control>
                <div class="flex flex-wrap items-center gap-2">
                  <input
                    type="color"
                    v-model="solidBackgroundColorProxy"
                    class="h-10 w-10 cursor-pointer rounded-lg border border-[var(--sd-color-border-subtle)] bg-transparent p-0"
                  />
                  <input
                    v-model="store.appConfig.solidBackgroundColor"
                    @change="store.markDirty()"
                    type="text"
                    placeholder="#f3f4f6"
                    class="sd-input min-w-[12rem] flex-1"
                  />
                  <AppButton
                    variant="danger-soft"
                    size="sm"
                    title="清除纯色背景"
                    @click="
                      store.appConfig.solidBackgroundColor = '';
                      store.markDirty();
                    "
                  >
                    重置
                  </AppButton>
                  <AppButton
                    variant="secondary"
                    size="sm"
                    title="设为壁纸"
                    @click="setSolidColorAsWallpaper"
                  >
                    设为壁纸
                  </AppButton>
                </div>
              </template>
            </AppFieldRow>
          </AppSectionCard>

          <AppSectionCard
            title="布局与组件外观"
            description="顶部栏、组件区域尺寸、默认图标和卡片节奏。"
            body-class="space-y-5"
          >
            <section class="settings-layout-group">
              <header class="settings-layout-group-head">
                <h4 class="settings-layout-group-title">顶部与标题</h4>
                <p class="settings-layout-group-summary">
                  先定义标题区域的布局、文字大小和移动端显隐。
                </p>
              </header>

              <div class="settings-layout-group-body">
                <AppFieldRow
                  label="顶部栏布局"
                  hint="桌面布局顺序与移动端顶部显隐。"
                >
                  <template #control>
                    <div class="space-y-3">
                      <AppSegmentedControl
                        :model-value="store.appConfig.titleAlign || 'left'"
                        :options="headerLayoutOptions"
                        @update:modelValue="
                          (value) => {
                            store.appConfig.titleAlign = String(value);
                            store.markDirty();
                          }
                        "
                      />
                      <div class="settings-inline-switch">
                        <div class="settings-inline-switch-copy">
                          <span class="settings-inline-switch-title"
                            >手机隐藏顶部</span
                          >
                          <span class="settings-inline-switch-summary"
                            >移动端优先留出首屏空间。</span
                          >
                        </div>
                        <AppSwitch
                          v-model="store.appConfig.hideHeaderOnMobile"
                          label=""
                          @change="store.markDirty()"
                        />
                      </div>
                    </div>
                  </template>
                </AppFieldRow>

                <div class="settings-layout-pair-grid">
                  <AppRangeField
                    label="标题大小"
                    :model-value="store.appConfig.titleSize ?? 48"
                    :min="20"
                    :max="80"
                    :step="1"
                    :value-text="`${store.appConfig.titleSize ?? 48}px`"
                    @update:modelValue="
                      (value) => {
                        store.appConfig.titleSize = value;
                        store.markDirty();
                      }
                    "
                  />

                  <AppFieldRow label="标题颜色" hint="默认使用白色。">
                    <template #control>
                      <div class="flex flex-wrap items-center gap-2">
                        <input
                          type="color"
                          v-model="store.appConfig.titleColor"
                          class="h-10 w-10 cursor-pointer rounded-lg border border-[var(--sd-color-border-subtle)] bg-transparent p-0"
                        />
                        <AppButton
                          variant="danger-soft"
                          size="sm"
                          title="重置颜色"
                          @click="
                            store.appConfig.titleColor = '#ffffff';
                            store.markDirty();
                          "
                        >
                          重置
                        </AppButton>
                      </div>
                    </template>
                  </AppFieldRow>
                </div>

                <AppFieldRow
                  label="WEB端布局"
                  hint="统一控制一栏页与按组分页。"
                >
                  <template #control>
                    <div class="space-y-3">
                      <AppSegmentedControl
                        :model-value="
                          store.appConfig.webGroupPagination
                            ? 'group'
                            : 'single'
                        "
                        :options="webLayoutOptions"
                        @update:modelValue="
                          (value) => {
                            store.appConfig.webGroupPagination =
                              value === 'group';
                            store.markDirty();
                          }
                        "
                      />
                      <div class="flex justify-end">
                        <AppButton
                          size="sm"
                          :variant="
                            store.appConfig.webGroupPaginationDisableFlip
                              ? 'danger-soft'
                              : 'secondary'
                          "
                          :disabled="!store.appConfig.webGroupPagination"
                          @click="
                            store.appConfig.webGroupPaginationDisableFlip =
                              !store.appConfig.webGroupPaginationDisableFlip;
                            store.markDirty();
                          "
                        >
                          {{
                            store.appConfig.webGroupPaginationDisableFlip
                              ? "禁止翻页中"
                              : "禁止翻页"
                          }}
                        </AppButton>
                      </div>
                    </div>
                  </template>
                </AppFieldRow>
              </div>
            </section>

            <section class="settings-layout-group">
              <header class="settings-layout-group-head">
                <h4 class="settings-layout-group-title">组件区节奏</h4>
                <p class="settings-layout-group-summary">
                  统一控制组件区密度、图标尺寸和分组呼吸感。
                </p>
              </header>

              <div class="settings-layout-group-body">
                <AppFieldRow
                  label="组件区整区尺寸"
                  hint="控制组件区整体列宽与行高。"
                >
                  <template #control>
                    <div class="settings-layout-metric-row">
                      <input
                        type="number"
                        v-model.number="store.appConfig.widgetAreaCols"
                        min="0.5"
                        step="0.5"
                        max="16"
                        class="sd-input w-24"
                      />
                      <span class="text-xs text-[var(--sd-color-text-tertiary)]"
                        >×</span
                      >
                      <input
                        type="number"
                        v-model.number="store.appConfig.widgetAreaRows"
                        min="0.5"
                        step="0.5"
                        max="16"
                        class="sd-input w-24"
                      />
                      <span class="settings-layout-metric-value">
                        {{ store.appConfig.widgetAreaCols ?? 4 }}×{{
                          store.appConfig.widgetAreaRows ?? 4
                        }}
                      </span>
                    </div>
                  </template>
                </AppFieldRow>

                <div class="settings-layout-pair-grid">
                  <AppRangeField
                    label="分组垂直间距"
                    :model-value="store.appConfig.groupGap ?? 30"
                    :min="0"
                    :max="100"
                    :step="5"
                    :value-text="`${store.appConfig.groupGap ?? 30}`"
                    @update:modelValue="
                      (value) => {
                        store.appConfig.groupGap = value;
                        store.markDirty();
                      }
                    "
                  />

                  <AppRangeField
                    label="默认图标大小"
                    :model-value="store.appConfig.iconSize ?? 64"
                    :min="32"
                    :max="96"
                    :step="4"
                    :value-text="`${store.appConfig.iconSize ?? 64}px`"
                    @update:modelValue="
                      (value) => {
                        store.appConfig.iconSize = value;
                        store.markDirty();
                      }
                    "
                  />
                </div>
              </div>
            </section>

            <section class="settings-layout-group">
              <header class="settings-layout-group-head">
                <h4 class="settings-layout-group-title">卡片与交互</h4>
                <p class="settings-layout-group-summary">
                  把默认卡片方向、图标形状和悬停反馈放在同一层看齐。
                </p>
              </header>

              <div class="settings-layout-group-body">
                <AppFieldRow
                  label="卡片布局"
                  hint="控制默认卡片纵向或横向排布。"
                >
                  <template #control>
                    <AppSegmentedControl
                      :model-value="store.appConfig.cardLayout || 'vertical'"
                      :options="cardLayoutOptions"
                      @update:modelValue="
                        (value) => {
                          store.appConfig.cardLayout = String(value);
                          store.markDirty();
                        }
                      "
                    />
                  </template>
                </AppFieldRow>

                <AppFieldRow
                  label="默认图标形状"
                  hint="应用到默认卡片与组件预览。"
                >
                  <template #control>
                    <AppSegmentedControl
                      :model-value="store.appConfig.iconShape || 'rounded'"
                      :options="iconShapeOptions"
                      @update:modelValue="
                        (value) => {
                          store.appConfig.iconShape = String(value);
                          store.markDirty();
                        }
                      "
                    />
                  </template>
                </AppFieldRow>

                <AppFieldRow label="鼠标悬停效果" hint="卡片 hover 反馈样式。">
                  <template #control>
                    <select
                      v-model="store.appConfig.mouseHoverEffect"
                      class="sd-select w-full"
                      @change="store.markDirty()"
                    >
                      <option value="scale">缩放 (默认)</option>
                      <option value="lift">上浮</option>
                      <option value="glow">发光</option>
                      <option value="none">无</option>
                    </select>
                  </template>
                </AppFieldRow>
              </div>
            </section>
          </AppSectionCard>

          <AppSectionCard
            title="页脚与统计"
            description="访客统计、尺寸与自定义 HTML 输出。"
            body-class="space-y-4"
          >
            <AppFieldRow
              label="显示访客统计"
              hint="为公开页脚补充访问统计信息。"
              align="center"
            >
              <template #control>
                <AppSwitch
                  v-model="store.appConfig.showFooterStats"
                  label=""
                  @change="store.markDirty()"
                />
              </template>
            </AppFieldRow>

            <div class="grid gap-4 md:grid-cols-2">
              <AppFieldRow label="页脚高度 (px)" hint="0 为自适应。">
                <template #control>
                  <input
                    type="number"
                    v-model="store.appConfig.footerHeight"
                    class="sd-input w-full"
                    placeholder="0"
                  />
                </template>
              </AppFieldRow>

              <AppFieldRow label="页脚内容宽度 (px)" hint="默认 1280。">
                <template #control>
                  <input
                    type="number"
                    v-model="store.appConfig.footerWidth"
                    class="sd-input w-full"
                    placeholder="1280"
                  />
                </template>
              </AppFieldRow>

              <AppFieldRow label="页脚距底部 (px)" hint="调整页脚垂直位置。">
                <template #control>
                  <input
                    type="number"
                    v-model="store.appConfig.footerMarginBottom"
                    class="sd-input w-full"
                    placeholder="0"
                  />
                </template>
              </AppFieldRow>

              <AppFieldRow label="页脚字体大小 (px)" hint="默认 12。">
                <template #control>
                  <input
                    type="number"
                    v-model="store.appConfig.footerFontSize"
                    class="sd-input w-full"
                    placeholder="12"
                  />
                </template>
              </AppFieldRow>
            </div>

            <AppFieldRow
              label="自定义页脚内容 (HTML)"
              hint="可输入备案号等信息，支持 HTML 标签。"
            >
              <template #control>
                <textarea
                  v-model="store.appConfig.footerHtml"
                  rows="3"
                  placeholder="可输入备案号等信息，支持 HTML 标签"
                  class="sd-textarea w-full font-mono"
                ></textarea>
              </template>
            </AppFieldRow>
          </AppSectionCard>
        </div>

        <div v-if="activeTab === 'docker'" class="space-y-4">
          <div class="flex items-center justify-between mb-4 mr-8">
            <h4
              class="text-base font-bold text-gray-900 border-l-4 border-gray-900 pl-3"
            >
              Docker 管理 (内测中)
            </h4>
            <div
              v-if="dockerWidget || isDockerSystemEnabled"
              class="flex items-center gap-3 text-xs mr-[10px]"
            >
              <button
                @click="exportDockerLogs"
                :disabled="isExportingDockerLogs || !isDockerSystemEnabled"
                class="text-gray-900 px-3 py-1 rounded-lg transition-colors font-bold disabled:opacity-60 glass-chip selectable-outline"
              >
                {{ isExportingDockerLogs ? "导出中" : "导出日志" }}
              </button>
              <button
                @click="checkDockerConnection"
                :disabled="!isDockerSystemEnabled || isUpdatingDockerSystem"
                class="text-gray-900 px-3 py-1 rounded-lg transition-colors font-bold disabled:opacity-50 glass-chip selectable-outline"
              >
                测试连接
              </button>
            </div>
          </div>

          <div class="space-y-3 mb-6 pb-6 border-b border-gray-100">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-bold text-gray-900">Docker 服务</div>
                <p class="mt-1 text-xs text-gray-500">
                  控制后端是否访问 Docker Engine。Windows 默认使用
                  <code>npipe:////./pipe/docker_engine</code>，Linux/macOS
                  默认使用 <code>unix:///var/run/docker.sock</code>。
                </p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  :checked="isDockerSystemEnabled"
                  :disabled="isUpdatingDockerSystem || !hasAdminAccess"
                  aria-label="Docker 服务启用"
                  @change="
                    (e) =>
                      toggleDockerSystemEnabled(
                        (e.target as HTMLInputElement).checked,
                      )
                  "
                  class="sr-only peer"
                />
                <div
                  class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white peer-disabled:opacity-50 after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"
                ></div>
                <span class="text-sm text-gray-700 ml-3">
                  {{
                    isUpdatingDockerSystem
                      ? "切换中"
                      : isDockerSystemEnabled
                        ? "已启用"
                        : "已关闭"
                  }}
                </span>
              </label>
            </div>

            <div
              class="rounded-xl border px-3 py-2 text-xs"
              :class="
                isDockerSystemEnabled
                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-700'
                  : 'border-amber-200 bg-amber-50/70 text-amber-700'
              "
            >
              <p>
                {{
                  isDockerSystemEnabled
                    ? "当前会允许 Docker 管理、连接检测、容器状态读取和组件预览。"
                    : "当前已停止 Docker 探测与接口轮询；下方组件设置仅控制展示，不会触发后端访问。"
                }}
              </p>
              <p class="mt-1 text-[11px] opacity-80">
                “Docker 服务”是系统级总开关，“显示 Docker
                组件”只影响首页卡片显示，“模拟数据”只影响组件展示数据来源。
              </p>
              <p v-if="!hasAdminAccess" class="mt-1 text-[11px] opacity-80">
                当前账号没有系统配置权限，仅可查看状态，不能切换 Docker
                服务总开关。
              </p>
            </div>
          </div>

          <!-- Host Status Widget Section -->
          <div class="space-y-3 mb-6 pb-6 border-b border-gray-100">
            <div class="flex items-center justify-between">
              <span class="text-sm font-bold text-gray-900"
                >宿主机状态组件</span
              >
              <div class="flex items-center gap-4">
                <div
                  v-if="systemStatusWidget && systemStatusWidget.enable"
                  class="flex items-center gap-2 animate-fade-in"
                >
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-700 font-medium"
                      >公开访问</span
                    >
                    <label
                      class="relative inline-flex items-center cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        v-model="systemStatusWidget.isPublic"
                        class="sr-only peer"
                      />
                      <div
                        class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"
                      ></div>
                    </label>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-700 font-medium"
                      >手机端显示</span
                    >
                    <label
                      class="relative inline-flex items-center cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        :checked="!systemStatusWidget.hideOnMobile"
                        @change="onMobileSystemStatusDisplayChange"
                        class="sr-only peer"
                      />
                      <div
                        class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"
                      ></div>
                    </label>
                  </div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    :checked="systemStatusWidget?.enable"
                    aria-label="启用"
                    @change="
                      (e) => {
                        if ((e.target as HTMLInputElement).checked)
                          enableSystemStatusWidget();
                        else if (systemStatusWidget) {
                          systemStatusWidget.enable = false;
                          store.markDirty();
                        }
                      }
                    "
                    class="sr-only peer"
                  />
                  <div
                    class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"
                  ></div>
                  <span class="text-sm text-gray-700 ml-3">启用</span>
                </label>
              </div>
            </div>

            <div
              v-if="systemStatusWidget && systemStatusWidget.enable"
              class="animate-fade-in space-y-3"
            >
              <div
                class="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3"
              >
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500">使用模拟数据</span>
                  <label
                    class="relative inline-flex items-center cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      :checked="!!systemStatusWidget.data?.useMock"
                      @change="
                        (e) =>
                          toggleSystemStatusMock(
                            (e.target as HTMLInputElement).checked,
                          )
                      "
                      class="sr-only peer"
                    />
                    <div
                      class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"
                    ></div>
                  </label>
                </div>
              </div>
              <div class="h-40 w-full max-w-sm">
                <SystemStatusWidget :widget="systemStatusWidget" />
              </div>
            </div>
          </div>

          <div v-if="dockerWidget" class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-bold text-gray-900">Docker 组件</span>
              <div class="flex items-center gap-4">
                <div
                  v-if="dockerWidget.enable"
                  class="flex items-center gap-2 animate-fade-in"
                >
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-700 font-medium"
                      >公开访问</span
                    >
                    <label
                      class="relative inline-flex items-center cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        v-model="dockerWidget.isPublic"
                        class="sr-only peer"
                      />
                      <div
                        class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"
                      ></div>
                    </label>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-700 font-medium"
                      >手机端显示</span
                    >
                    <label
                      class="relative inline-flex items-center cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        :checked="!dockerWidget.hideOnMobile"
                        @change="onMobileDockerDisplayChange"
                        class="sr-only peer"
                      />
                      <div
                        class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"
                      ></div>
                    </label>
                  </div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="dockerWidget.enable"
                    aria-label="显示 Docker 组件"
                    class="sr-only peer"
                  />
                  <div
                    class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"
                  ></div>
                  <span class="text-sm text-gray-700 ml-3">显示组件</span>
                </label>
              </div>
            </div>

            <p class="text-xs text-gray-500">
              这里控制首页 Docker 卡片是否显示，不影响后端 Docker 服务是否连接。
            </p>

            <div
              class="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3"
            >
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">模拟数据启用</span>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    :checked="!!dockerWidget.data?.useMock"
                    @change="
                      (e) =>
                        toggleDockerMock((e.target as HTMLInputElement).checked)
                    "
                    class="sr-only peer"
                  />
                  <div
                    class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"
                  ></div>
                </label>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">自动升级镜像(每2小时)</span>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    :checked="!!dockerWidget.data?.autoUpdate"
                    @change="
                      (e) => {
                        if (dockerWidget) {
                          if (!dockerWidget.data) dockerWidget.data = {};
                          dockerWidget.data.autoUpdate = (
                            e.target as HTMLInputElement
                          ).checked;
                          store.markDirty();
                        }
                      }
                    "
                    class="sr-only peer"
                  />
                  <div
                    class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"
                  ></div>
                </label>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[10px] text-gray-500">保留版本</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  :disabled="!dockerWidget?.data?.autoUpdate"
                  :value="dockerWidget?.data?.autoUpdateKeepImages ?? 2"
                  @change="
                    (e) => {
                      if (dockerWidget) {
                        if (!dockerWidget.data) dockerWidget.data = {};
                        dockerWidget.data.autoUpdateKeepImages = Math.max(
                          1,
                          Math.min(
                            20,
                            Number((e.target as HTMLInputElement).value || 2),
                          ),
                        );
                        store.markDirty();
                      }
                    }
                  "
                  class="w-16 px-2 py-1 border border-gray-200 rounded text-xs focus:border-gray-900 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                />
                <span class="text-[10px] text-gray-500">个</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[10px] text-gray-500">最小可用空间</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  :disabled="!dockerWidget?.data?.autoUpdate"
                  :value="dockerWidget?.data?.autoUpdateMinFreeGB ?? 5"
                  @change="
                    (e) => {
                      if (dockerWidget) {
                        if (!dockerWidget.data) dockerWidget.data = {};
                        dockerWidget.data.autoUpdateMinFreeGB = Math.max(
                          0,
                          Number((e.target as HTMLInputElement).value || 5),
                        );
                        store.markDirty();
                      }
                    }
                  "
                  class="w-20 px-2 py-1 border border-gray-200 rounded text-xs focus:border-gray-900 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                />
                <span class="text-[10px] text-gray-500">GB</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-700 font-medium">内网主机</span>
                <input
                  :value="dockerWidget?.data?.lanHost"
                  @change="
                    (e) => {
                      if (dockerWidget) {
                        if (!dockerWidget.data) dockerWidget.data = {};
                        dockerWidget.data.lanHost = (
                          e.target as HTMLInputElement
                        ).value;
                        store.markDirty();
                      }
                    }
                  "
                  type="text"
                  placeholder="例如：192.168.1.10"
                  class="px-2 py-1 border border-gray-200 rounded text-xs focus:border-gray-900 outline-none"
                />
              </div>
            </div>
            <div
              v-if="isDockerSystemEnabled && dockerWidget.enable"
              class="h-[500px]"
            >
              <DockerWidget :widget="dockerWidget" :compact="true" />
            </div>
            <div
              v-else
              class="h-[160px] rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 flex items-center justify-center text-center px-6"
            >
              <div class="text-sm text-gray-500 space-y-2">
                <p v-if="!isDockerSystemEnabled">
                  Docker 服务已关闭，组件预览已暂停。
                </p>
                <p v-else>Docker 组件当前未显示，打开“显示组件”后可预览。</p>
                <p class="text-xs text-gray-400">
                  关闭系统级总开关后，不会继续自动探测 Docker 或轮询容器状态。
                </p>
              </div>
            </div>
          </div>

          <div v-else class="text-center py-8 text-gray-500">
            <p class="mb-4">未启用 Docker 组件</p>
            <button
              @click="enableDockerWidget"
              class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors shadow-sm"
            >
              启用 Docker 组件
            </button>
            <p class="mt-4 text-xs text-gray-500 max-w-xs mx-auto">
              如果您的系统不支持
              Docker（如旧版本），启用后可以在上方开启"使用模拟数据"以体验功能。
            </p>
          </div>
        </div>

        <div v-if="activeTab === 'network'" class="p-4 space-y-4">
          <div class="flex items-center gap-3 mb-4">
            <h4
              class="text-base font-bold text-gray-900 border-l-4 border-gray-900 pl-3"
            >
              网络环境判定设置
            </h4>
          </div>

          <AppSectionCard
            title="域名白名单"
            description="域名按行维护，命中后可继续进入延迟阈值判定。"
            bodyClass="space-y-4"
          >
            <StatusBanner
              title="判定规则"
              tone="info"
              message="访问白名单域名时，会根据延迟自动判定：延迟低 = 内网，延迟高 = 外网；未命中白名单时直接视为外网。"
            />
            <AppFieldRow
              label="域名白名单"
              hint="每行一个域名，例如 hp.fnos996.top 或 fnos996.top。"
            >
              <template #control>
                <textarea
                  v-model="store.appConfig.internalDomains"
                  @change="store.markDirty()"
                  rows="5"
                  class="sd-textarea w-full text-xs font-mono"
                  placeholder="每行一个域名（如 hp.fnos996.top 或 fnos996.top）"
                ></textarea>
              </template>
            </AppFieldRow>
          </AppSectionCard>

          <AppSectionCard
            title="白名单 + 延迟判定"
            description="对命中的白名单域名按 RTT 阈值判定内外网。"
            bodyClass="space-y-4"
          >
            <AppSwitch
              label="启用延迟判定"
              :hint="
                whitelistLatencyEnabled
                  ? '白名单域名将继续按 RTT 阈值区分 LAN / WAN。'
                  : '关闭后白名单域名默认按外网处理。'
              "
              :model-value="whitelistLatencyEnabled"
              @update:model-value="toggleWhitelistLatency"
            />
            <AppFieldRow
              v-if="whitelistLatencyEnabled"
              label="延迟阈值"
              :hint="`默认 ${DEFAULT_LATENCY_THRESHOLD_MS} ms，低于该值视为内网。`"
            >
              <template #control>
                <div class="flex flex-wrap items-center gap-2">
                  <input
                    :value="latencyThresholdDraft"
                    inputmode="numeric"
                    @input="onLatencyThresholdInput"
                    @blur="onLatencyThresholdBlur"
                    @keydown.enter.prevent="applyLatencyThreshold"
                    placeholder="20–30000"
                    class="sd-input w-32 text-xs font-mono"
                    :class="
                      latencyThresholdTouched && !latencyThresholdValidation.ok
                        ? 'border-red-300'
                        : ''
                    "
                  />
                  <span class="text-xs text-gray-500">ms</span>
                  <AppButton
                    size="sm"
                    variant="primary"
                    :disabled="!latencyThresholdValidation.ok"
                    @click="applyLatencyThreshold"
                  >
                    确认
                  </AppButton>
                  <AppButton
                    size="sm"
                    variant="secondary"
                    @click="resetLatencyThreshold"
                  >
                    重置
                  </AppButton>
                </div>
              </template>
            </AppFieldRow>
            <StatusBanner
              v-if="latencyThresholdTouched && !latencyThresholdValidation.ok"
              tone="danger"
              :message="latencyThresholdValidation.error"
            />
            <StatusBanner
              v-else-if="latencyThresholdAppliedToast"
              tone="success"
              :message="latencyThresholdAppliedToast"
            />
            <p v-else class="text-[11px] text-gray-500">
              白名单域名访问时，延迟低于此值判定为内网，高于此值判定为外网。默认
              {{ DEFAULT_LATENCY_THRESHOLD_MS }} ms。
            </p>
          </AppSectionCard>
        </div>

        <div v-if="activeTab === 'lucky-stun'" class="p-4 space-y-4">
          <div class="flex items-center gap-2 mb-4">
            <h4
              class="text-base font-bold text-gray-900 border-l-4 border-gray-900 pl-3"
            >
              开放中心
            </h4>
          </div>

          <AppSectionCard
            title="浏览器助手通信"
            description="为 startdeck-helper 生成专用握手链接，插件会自动保存站点与令牌。"
            bodyClass="space-y-3"
          >
            <template v-if="browserHelperHandshakeLink">
              <a
                :href="browserHelperHandshakeLink"
                :data-startdeck-helper-link="browserHelperHandshakeLink"
                target="_blank"
                rel="noopener noreferrer"
                class="block w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-[11px] text-blue-600 break-all hover:border-blue-300 transition-colors"
              >
                {{ browserHelperHandshakeLink }}
              </a>
              <div class="flex flex-wrap items-center gap-2">
                <AppButton @click="copyBrowserHelperHandshakeLink">
                  复制握手链接
                </AppButton>
                <AppButton
                  @click="openBrowserHelperHandshakeLink"
                  variant="secondary"
                >
                  打开握手页
                </AppButton>
                <a
                  href="https://qdnas.icu/c/8/g/14"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="sd-btn sd-btn-primary min-h-9 px-3 text-xs inline-flex"
                >
                  下载浏览器助手
                </a>
              </div>
              <p class="text-[11px] text-gray-500">
                如果插件提示未连接，请先停留在这个页面，再点击浏览器助手图标进行自动配对。
              </p>
            </template>
            <StatusBanner
              v-else
              tone="warning"
              message="当前未检测到登录令牌。请先登录 StartDeck，随后这里会自动生成浏览器助手握手链接。"
            />
          </AppSectionCard>

          <!-- Custom CSS Section -->
          <div class="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-6">
            <h4 class="text-base font-bold mb-4 text-gray-900">自定义 CSS</h4>
            <div>
              <ScriptManager
                v-if="store.appConfig.customCssList"
                v-model="store.appConfig.customCssList"
                type="css"
                placeholder="/* 输入自定义 CSS 代码 */
.card-item {
  border-radius: 20px;
}"
                @change="store.updateCustomScripts()"
              />
              <div class="text-xs text-gray-500 mt-2">
                提示：在此处输入的 CSS 将直接应用到页面，可用于微调样式。
              </div>
              <div class="mt-3 rounded-xl border border-gray-100 bg-white/70">
                <div class="px-3 py-2 text-xs font-bold text-gray-700">
                  样式变量表
                </div>
                <div
                  class="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] gap-y-2 gap-x-3 px-3 pb-3 text-xs"
                >
                  <div class="text-[10px] font-semibold text-gray-400">
                    变量
                  </div>
                  <div class="text-[10px] font-semibold text-gray-400">
                    用途
                  </div>
                  <div class="text-[10px] font-semibold text-gray-400">
                    当前值
                  </div>
                  <template v-for="row in styleVariableRows" :key="row.name">
                    <div class="font-mono text-[11px] text-gray-700">
                      {{ row.name }}
                    </div>
                    <div class="text-gray-500">{{ row.desc }}</div>
                    <div class="font-mono text-[11px] text-gray-600">
                      {{ row.value }}
                    </div>
                  </template>
                </div>
                <div
                  class="flex items-center justify-between px-3 py-2 border-t border-gray-100 text-[10px] text-gray-500"
                >
                  <span>对比度：{{ styleVariableStatus.contrast }}</span>
                  <span>视觉回归：{{ styleVariableStatus.visual }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Custom JS Section -->
          <div class="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-6">
            <h4 class="text-base font-bold mb-4 text-gray-900">自定义 JS</h4>

            <div
              v-if="!store.appConfig.customJsDisclaimerAgreed"
              class="p-4 bg-white rounded-lg border border-gray-200 shadow-sm"
            >
              <h5 class="font-bold text-gray-700 mb-2 flex items-center gap-2">
                安全免责声明
              </h5>
              <div class="text-sm text-gray-600 mb-3 leading-relaxed">
                使用自定义 JavaScript 功能允许您向页面注入任意代码。这可能导致：
                <ul class="list-disc list-inside ml-2 mt-1 space-y-1 text-xs">
                  <li>XSS (跨站脚本) 攻击风险</li>
                  <li>页面功能异常或崩溃</li>
                  <li>敏感数据泄露</li>
                </ul>
              </div>
              <p class="text-sm text-gray-600 mb-4 font-bold">
                由此产生的一切后果由您自行承担。请确保您完全信任并理解您所添加的代码。
              </p>
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  v-model="store.appConfig.customJsDisclaimerAgreed"
                  class="w-4 h-4 text-gray-900 rounded border-gray-300 focus:ring-blue-400 accent-blue-400"
                />
                <span class="text-sm font-medium text-gray-700"
                  >我已阅读并同意上述风险，确认启用此功能</span
                >
              </label>
            </div>

            <div v-else>
              <ScriptManager
                v-if="store.appConfig.customJsList"
                v-model="store.appConfig.customJsList"
                type="js"
                placeholder="// 输入自定义 JS 代码
console.log('Hello from Custom JS!');
document.querySelector('.card-item').addEventListener('click', () => {
  console.log('Clicked!');
});"
                @change="store.updateCustomScripts()"
              />
              <div
                class="text-xs text-gray-500 mt-2 flex justify-between items-center"
              >
                <span
                  >提示：JS 代码将在页面加载时执行。可与自定义 CSS
                  配合实现高级交互。</span
                >
                <button
                  @click="store.appConfig.customJsDisclaimerAgreed = false"
                  class="text-xs text-gray-500 hover:text-gray-600 underline"
                >
                  撤销免责声明并禁用
                </button>
              </div>
            </div>
          </div>

          <!-- Webhook Settings -->
          <div class="bg-gray-50 border border-gray-100 rounded-xl p-4">
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-base font-bold text-gray-900">
                Webhook 设置 (内测中)
              </h4>
            </div>

            <div class="mb-6">
              <h5 class="font-bold text-gray-900 mb-2">Webhook 地址</h5>
              <div
                class="flex items-center gap-2 bg-white/60 p-2 rounded border border-gray-200"
              >
                <code class="text-xs text-gray-600 flex-1 break-all">{{
                  getWebhookUrl()
                }}</code>
                <button
                  @click="copyWebhookUrl"
                  class="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200 font-bold transition-colors"
                >
                  复制
                </button>
              </div>
              <p class="text-xs text-gray-500 mt-2">
                请在 STUN 穿透配置中，将全局 Webhook
                的地址设置为上述地址，并使用以下配置：
              </p>

              <div
                class="mt-3 space-y-3 bg-white/60 p-3 rounded-lg border border-gray-200"
              >
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs font-bold text-gray-700"
                      >请求头 (Header)</span
                    >
                  </div>
                  <code
                    class="block text-xs text-gray-600 font-mono bg-gray-50 p-1.5 rounded border border-gray-200"
                    >Content-Type: application/json</code
                  >
                </div>
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs font-bold text-gray-700"
                      >请求体 (Body)</span
                    >
                  </div>
                  <pre
                    class="text-xs text-gray-600 font-mono bg-gray-50 p-1.5 rounded border border-gray-200 whitespace-pre"
                  >
{
  "stun": "success",
  "ip": "#{ip}",
  "port": "#{port}"
}</pre
                  >
                </div>
              </div>
            </div>

            <div class="space-y-3">
              <h5 class="font-bold text-gray-900">最新状态</h5>
              <div
                v-if="store.luckyStunData && store.luckyStunData.data"
                class="grid grid-cols-2 gap-3"
              >
                <div class="bg-white/60 p-3 rounded-lg border border-gray-200">
                  <div class="text-xs text-gray-500 mb-1">状态</div>
                  <div
                    class="font-bold"
                    :class="
                      store.luckyStunData.data.stun === 'success'
                        ? 'text-gray-900'
                        : 'text-gray-500'
                    "
                  >
                    {{ store.luckyStunData.data.stun || "未知" }}
                  </div>
                </div>
                <div class="bg-white/60 p-3 rounded-lg border border-gray-200">
                  <div class="text-xs text-gray-500 mb-1">公网 IP</div>
                  <div class="font-bold text-gray-900 font-mono break-all">
                    {{ store.luckyStunData.data.ip || "-" }}
                  </div>
                </div>
                <div class="bg-white/60 p-3 rounded-lg border border-gray-200">
                  <div class="text-xs text-gray-500 mb-1">端口</div>
                  <div class="font-bold text-gray-900">
                    {{ store.luckyStunData.data.port || "-" }}
                  </div>
                </div>
                <div class="bg-white/60 p-3 rounded-lg border border-gray-200">
                  <div class="text-xs text-gray-500 mb-1">更新时间</div>
                  <div class="text-xs text-gray-900">
                    {{ formatTime(store.luckyStunData.ts) }}
                  </div>
                </div>
              </div>
              <div
                v-else
                class="text-center py-8 text-gray-400 text-sm bg-white rounded-xl border border-dashed border-gray-200"
              >
                暂无数据，请等待 Webhook 触发...
              </div>
            </div>

            <div class="flex justify-end mt-4">
              <button
                @click="store.fetchLuckyStunData"
                class="text-sm text-gray-500 hover:text-gray-900 hover:underline flex items-center gap-1 font-bold transition-colors"
              >
                <span>🔄</span> 刷新数据
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="activeTab === 'account'"
          class="min-h-full flex flex-col justify-center"
        >
          <div v-if="!store.isLogged" class="text-center">
            <h4 class="text-xl font-bold mb-6 text-gray-900">管理员登录</h4>
            <input
              v-model="passwordInput"
              type="password"
              placeholder="密码..."
              class="w-full max-w-xs px-4 py-3 border border-gray-200 rounded-xl mb-4 mx-auto text-center focus:border-gray-900 outline-none"
              @keyup.enter="handleLogin"
            />
            <button
              @click="handleLogin"
              class="bg-gray-900 text-white px-10 py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors"
            >
              登 录
            </button>
          </div>
          <div v-else class="max-w-sm mx-auto w-full">
            <div class="bg-gray-50 p-5 rounded-xl border border-gray-100 mb-6">
              <h5 class="text-sm font-bold text-gray-900 mb-3">
                📦 备份与恢复
              </h5>
              <div class="grid grid-cols-2 gap-3">
                <button
                  @click="handleExport"
                  class="col-span-2 bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors"
                >
                  📤 导出配置
                </button>
                <button
                  @click="triggerImport"
                  class="col-span-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors"
                >
                  📥 导入配置
                </button>
                <button
                  v-if="hasAdminAccess"
                  @click="handleSaveAsDefault"
                  class="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-900 transition-all"
                >
                  {{ saveDefaultBtnText }}
                </button>
                <button
                  @click="handleReset"
                  class="bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                >
                  🧹 恢复初始化
                </button>
                <input
                  ref="fileInput"
                  type="file"
                  accept=".navbak,.json"
                  class="hidden"
                  @change="handleFileChange"
                />
              </div>
            </div>
            <div
              v-if="hasAdminAccess"
              class="bg-gray-50 p-5 rounded-xl border border-gray-200 mb-6"
            >
              <h5 class="text-sm font-bold text-gray-900 mb-3">系统模式</h5>
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-700"
                  >当前模式：{{
                    store.systemConfig.authMode === "single"
                      ? "单用户模式"
                      : "多用户模式"
                  }}</span
                >
                <button
                  v-if="hasAdminAccess"
                  @click="toggleAuthMode"
                  class="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all bg-gray-900 hover:bg-gray-800"
                >
                  切换为{{
                    store.systemConfig.authMode === "single"
                      ? "多用户模式"
                      : "单用户模式"
                  }}
                </button>
                <span
                  v-else
                  class="px-4 py-2 rounded-lg text-sm font-bold text-gray-500 bg-gray-100"
                >
                  仅管理员可切换
                </span>
              </div>
              <p class="text-xs text-gray-500 mt-2">
                {{
                  store.systemConfig.authMode === "single"
                    ? "单用户模式下，登录界面简化，仅需输入密码即可登录 Admin 账户。"
                    : "多用户模式下，允许多个用户注册和登录，数据相互隔离。"
                }}
              </p>
              <p class="text-xs text-gray-500 mt-1">
                默认管理员为 admin；Docker 可通过 STARTDECK_ADMIN_PASSWORD
                指定启动密码。
              </p>
            </div>
            <div class="bg-gray-50 p-5 rounded-xl border border-gray-200 mb-6">
              <h5 class="text-sm font-bold text-gray-900 mb-3">🕘 配置版本</h5>
              <div class="flex gap-2 items-center mb-2">
                <input
                  v-model="versionLabel"
                  placeholder="版本备注（可选）"
                  class="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-gray-900 outline-none"
                />
                <button
                  @click="saveVersion"
                  class="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all bg-gray-900 hover:bg-gray-800"
                >
                  保存为版本
                </button>
              </div>
              <div class="text-[10px] text-gray-500 mb-2">
                {{
                  store.systemConfig.authMode === "single"
                    ? "保存位置：data/config_versions"
                    : "保存位置：data/config_versions (仅当前用户可见)"
                }}
              </div>
              <div class="max-h-40 overflow-y-auto space-y-1">
                <div v-if="loadingVersions" class="text-xs text-gray-500">
                  加载中...
                </div>
                <div
                  v-else-if="versions.length === 0"
                  class="text-xs text-gray-400 text-center py-4"
                >
                  暂无保存的版本
                </div>
                <div
                  v-for="v in versions"
                  :key="v.id"
                  class="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-200"
                >
                  <div class="flex-1">
                    <div class="text-sm font-medium text-gray-900 truncate">
                      {{ v.label || "未命名版本" }}
                    </div>
                    <div class="text-[10px] text-gray-500">
                      {{ new Date(v.createdAt).toLocaleString() }} ·
                      {{ Math.round(v.size / 1024) }}KB
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button
                      @click="restoreVersion(v.id)"
                      class="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                    >
                      恢复
                    </button>
                    <button
                      @click="deleteVersion(v.id)"
                      class="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div class="bg-gray-50 p-5 rounded-xl border border-gray-200 mb-6">
              <h5 class="text-sm font-medium text-gray-700 mb-1">
                🔑 修改密码
              </h5>
              <p class="text-xs text-gray-500 mb-2">点击修改后请输入原来密码</p>
              <div class="flex gap-2">
                <div class="relative flex-1">
                  <input
                    v-model="newPasswordInput"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="新密码..."
                    class="w-full px-3 py-2 rounded-lg border border-gray-300 pr-10 focus:border-gray-900 outline-none"
                  />
                  <button
                    @click="showPassword = !showPassword"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    type="button"
                    tabindex="-1"
                    :title="showPassword ? '隐藏密码' : '显示密码'"
                  >
                    <svg
                      v-if="showPassword"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="w-5 h-5"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                    <svg
                      v-else
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="w-5 h-5"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </button>
                </div>
                <button
                  @click="handleChangePassword"
                  class="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition-colors"
                >
                  修改
                </button>
              </div>
            </div>
            <!-- Admin User Management UI -->
            <div
              v-if="canManageUsers"
              class="bg-gray-50 p-5 rounded-xl border border-gray-200 mb-6"
            >
              <h5 class="text-sm font-bold text-gray-900 mb-3">
                👥 用户管理 (Admin)
              </h5>

              <!-- Add User -->
              <div class="flex flex-col gap-2 mb-4">
                <div class="flex gap-2">
                  <input
                    v-model="newUser"
                    placeholder="用户名"
                    class="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-gray-900 outline-none"
                  />
                  <input
                    v-model="newPwd"
                    type="password"
                    placeholder="密码"
                    class="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-gray-900 outline-none"
                  />
                </div>
                <button
                  @click="handleAddUser"
                  class="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors"
                >
                  添加用户
                </button>
              </div>

              <!-- User List -->
              <div class="space-y-2 max-h-40 overflow-y-auto">
                <div
                  v-for="u in userList"
                  :key="u"
                  class="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-gray-200"
                >
                  <span class="text-sm text-gray-700 font-medium">
                    {{ u }}
                    <span v-if="u === 'admin'" class="text-xs text-gray-500"
                      >(管理员)</span
                    >
                  </span>
                  <button
                    v-if="u !== 'admin'"
                    @click="handleDeleteUser(u)"
                    class="text-gray-400 hover:text-gray-600 text-xs font-bold px-2"
                  >
                    删除
                  </button>
                </div>
              </div>

              <!-- License Management -->
              <div class="mt-4 pt-4 border-t border-gray-200">
                <h6 class="text-xs font-bold text-gray-900 mb-2">
                  🔑 授权密钥 (License Key)
                </h6>
                <div class="flex gap-2">
                  <input
                    v-model="licenseKey"
                    placeholder="输入密钥解除限制..."
                    class="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-gray-900 outline-none"
                  />
                  <button
                    @click="handleUploadLicense"
                    class="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 whitespace-nowrap transition-colors"
                  >
                    导入
                  </button>
                </div>
                <p class="text-[10px] text-gray-500 mt-1">
                  导入有效密钥可解除5个用户的注册限制。
                </p>
              </div>
            </div>

            <button
              @click="store.logout"
              class="w-full text-gray-700 py-3 rounded-xl font-bold border border-gray-200 transition-colors glass-chip selectable-outline"
            >
              退出登录
            </button>
          </div>
        </div>
        <div
          v-if="activeTab === 'about'"
          class="min-h-full flex flex-col p-8 -mt-4"
        >
          <section class="bg-white/70 border border-gray-100 rounded-xl p-5">
            <div
              class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
            >
              <div>
                <p class="text-xs font-semibold text-gray-500">项目介绍</p>
                <h5 class="mt-1 text-2xl font-bold text-gray-900">StartDeck</h5>
              </div>
              <span class="text-sm text-gray-400 font-mono"
                >v{{ store.currentVersion }}</span
              >
            </div>
            <p class="mt-4 text-sm text-gray-600 leading-relaxed">
              StartDeck 是面向
              NAS、自托管和个人工作台场景的浏览器起始页。它把常用网站、
              内网服务、文件传输、媒体播放、RSS、天气、系统状态和 Docker
              管理集中到一个
              可配置的仪表盘中，让家庭服务器、开发环境和日常信息入口可以在同一页面完成组织。
            </p>
          </section>

          <section class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="bg-white/60 border border-gray-100 rounded-xl p-4">
              <h6 class="text-sm font-bold text-gray-900">核心定位</h6>
              <p class="mt-2 text-xs text-gray-600 leading-relaxed">
                以“个人导航 + NAS
                工具面板”为中心，提供分组书签、可拖拽布局、组件化信息区和
                多端响应式访问体验，适合放在浏览器首页、内网入口或家庭服务控制台。
              </p>
            </div>
            <div class="bg-white/60 border border-gray-100 rounded-xl p-4">
              <h6 class="text-sm font-bold text-gray-900">数据与运行</h6>
              <p class="mt-2 text-xs text-gray-600 leading-relaxed">
                配置、上传文件、壁纸、音乐和图标缓存都落在本地运行目录，便于迁移、备份和
                Docker 卷挂载。后端负责 API、代理、文件服务和站点元数据解析。
              </p>
            </div>
          </section>

          <section
            class="mt-4 bg-white/60 border border-gray-100 rounded-xl p-4"
          >
            <h6 class="text-sm font-bold text-gray-900">主要能力</h6>
            <div
              class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3 text-xs text-gray-600"
            >
              <div>
                <span class="font-semibold text-gray-800">导航组织：</span>
                分组、卡片、内外网地址、图标库、搜索入口和自定义卡片样式。
              </div>
              <div>
                <span class="font-semibold text-gray-800">桌面组件：</span>
                时钟、天气、日历、倒计时、备忘录、待办、RSS、热榜和 iframe。
              </div>
              <div>
                <span class="font-semibold text-gray-800">文件媒体：</span>
                跨设备文件传输、桌面壁纸和移动端壁纸管理。
              </div>
              <div>
                <span class="font-semibold text-gray-800">服务管理：</span>
                Docker 容器管理、系统状态、代理转发和混合网络环境识别。
              </div>
              <div>
                <span class="font-semibold text-gray-800">个性化：</span>
                自定义 CSS、JavaScript、HTML 组件、布局尺寸和组件可见性。
              </div>
              <div>
                <span class="font-semibold text-gray-800">站点元数据：</span>
                独立 Go
                图标服务负责抓取网站标题、描述和图标，并与前端卡片编辑联动。
              </div>
            </div>
          </section>

          <section
            class="mt-4 bg-white/60 border border-gray-100 rounded-xl p-4"
          >
            <h6 class="text-sm font-bold text-gray-900">技术组成</h6>
            <div class="mt-3 flex flex-wrap gap-2">
              <span
                class="px-2.5 py-1 rounded-md bg-gray-900 text-white text-xs"
                >Vue 3</span
              >
              <span
                class="px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 text-xs"
                >TypeScript</span
              >
              <span
                class="px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 text-xs"
                >Pinia</span
              >
              <span
                class="px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 text-xs"
                >Vite</span
              >
              <span
                class="px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 text-xs"
                >Go / Gin</span
              >
              <span
                class="px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 text-xs"
                >Icon Service</span
              >
              <span
                class="px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 text-xs"
                >Docker</span
              >
              <span
                class="px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 text-xs"
                >Debian</span
              >
            </div>
            <p class="mt-3 text-xs text-gray-500 leading-relaxed">
              前端负责仪表盘交互和组件配置，Go
              后端负责本地数据持久化、系统能力和文件接口，
              图标元数据服务独立运行，便于在 Docker、Debian
              或本地开发环境中组合部署。
            </p>
          </section>
        </div>
      </div>
    </div>

    <template #inspector>
      <div class="settings-shell-inspector p-3 space-y-3">
        <AppInspectorPanel
          title="实时预览"
          description="背景、标题、组件节奏与主题状态。"
        >
          <div class="settings-preview-stage">
            <div
              class="settings-preview-surface"
              :style="inspectorPreviewSurfaceStyle"
            >
              <img
                v-if="inspectorPreviewImageUrl"
                :src="inspectorPreviewImageUrl"
                class="settings-preview-image"
                :class="{
                  'is-visible':
                    inspectorPreviewImageLoaded && !inspectorPreviewImageFailed,
                }"
                :style="{
                  filter: `blur(${store.appConfig.backgroundBlur ?? 0}px)`,
                }"
                alt=""
                @load="handleInspectorPreviewImageLoad"
                @error="handleInspectorPreviewBackgroundError"
              />
              <div
                class="settings-preview-surface-mask"
                :style="{
                  backgroundColor: `rgba(15,23,42,${store.appConfig.backgroundMask ?? 0.12})`,
                }"
              ></div>
              <div class="settings-preview-surface-copy">
                <span class="settings-preview-pill">{{
                  settingsThemeLabel
                }}</span>
                <strong class="settings-preview-title">{{
                  store.appConfig.customTitle || "我的导航"
                }}</strong>
                <div class="settings-preview-card-row">
                  <span
                    v-for="item in inspectorPreviewItems"
                    :key="item"
                    class="settings-preview-card"
                  >
                    {{ item }}
                  </span>
                  <span
                    v-if="inspectorPreviewItems.length === 0"
                    class="settings-preview-card"
                    >预览</span
                  >
                </div>
              </div>
            </div>
            <div class="settings-meta-stack mt-3">
              <span class="settings-meta-chip">{{ wallpaperSourceLabel }}</span>
              <span class="settings-meta-chip">{{ settingsModeLabel }}</span>
            </div>
            <div class="mt-3 space-y-3">
              <div class="settings-inspector-row">
                <span class="settings-inspector-label">背景 URL / API</span>
                <span class="settings-inspector-value">{{
                  settingsPreviewSourceLabel
                }}</span>
              </div>
              <div class="settings-inspector-row">
                <span class="settings-inspector-label">模糊与遮罩</span>
                <span class="settings-inspector-value">{{
                  settingsPreviewEffectsLabel
                }}</span>
              </div>
              <div class="settings-inspector-row">
                <span class="settings-inspector-label">上传状态</span>
                <span
                  class="settings-inspector-badge"
                  :class="`is-${settingsSaveStateTone}`"
                >
                  {{ settingsPreviewStatusLabel }}
                </span>
              </div>
            </div>
          </div>
        </AppInspectorPanel>

        <AppInspectorPanel
          title="规则摘要"
          description="关闭契约、移动端策略与版本状态。"
        >
          <div class="space-y-3 text-sm text-[var(--sd-color-text-secondary)]">
            <div class="settings-inspector-row">
              <span class="settings-inspector-label">当前模式</span>
              <span class="settings-inspector-value">{{
                settingsModeLabel
              }}</span>
            </div>
            <div class="settings-inspector-row">
              <span class="settings-inspector-label">当前主题</span>
              <span class="settings-inspector-value">{{
                settingsThemeLabel
              }}</span>
            </div>
            <div class="settings-inspector-row">
              <span class="settings-inspector-label">最近状态</span>
              <span
                class="settings-inspector-badge"
                :class="`is-${settingsSaveStateTone}`"
              >
                {{ settingsSaveStateLabel }}
              </span>
            </div>
            <div class="settings-inspector-row">
              <span class="settings-inspector-label">当前版本</span>
              <span class="settings-inspector-value">{{
                store.currentVersion || "本地配置"
              }}</span>
            </div>
            <div class="settings-inspector-row">
              <span class="settings-inspector-label">移动端背景</span>
              <span class="settings-inspector-value">{{
                mobileWallpaperLabel
              }}</span>
            </div>
            <ul class="settings-inspector-list">
              <li>阻断性流程禁止点遮罩关闭。</li>
              <li>普通弹窗仅在 clean 状态允许关闭。</li>
              <li>移动端优先全屏设置流，不缩成桌面三栏。</li>
            </ul>
          </div>
        </AppInspectorPanel>
      </div>
    </template>
  </AppSettingsShell>
  <PasswordConfirmModal
    v-model:show="showPasswordConfirm"
    :title="confirmTitle"
    :z-index="settingsBlockingModalZIndex"
    :on-success="onAuthSuccess"
  />

  <!-- Multi-User Warning Modal -->
  <AppModalShell
    :show="showMultiUserWarning"
    :z-index="settingsBlockingModalZIndex"
    title="切换模式警告"
    blocking
    :show-close="false"
    overlay-class="sd-overlay-strong"
    panel-class="w-full max-w-sm"
    surface-class="max-w-sm"
  >
    <p class="text-sm leading-relaxed text-[var(--sd-color-text-secondary)]">
      请先导出配置！<br />
      切换到多用户模式会导致当前单用户配置丢失（数据隔离），是否确认继续？
    </p>

    <template #footer>
      <AppButton variant="secondary" @click="showMultiUserWarning = false"
        >取消</AppButton
      >
      <AppButton
        variant="primary"
        @click="
          showMultiUserWarning = false;
          requestAuth(
            () => performAuthModeSwitch('multi'),
            '请输入管理员密码以确认切换',
          );
        "
      >
        确认切换
      </AppButton>
    </template>
  </AppModalShell>

  <ConfirmDialog
    v-model:show="showSettingsCloseConfirm"
    :z-index="settingsBlockingModalZIndex"
    title="继续关闭设置窗口？"
    :message="
      store.hasUnsavedChanges
        ? '当前设置仍有未完成保存的修改。继续关闭会结束本次设置会话。'
        : '当前设置仍在后台同步。继续关闭会结束本次设置会话，但同步会在后台继续尝试。'
    "
    confirm-label="继续关闭"
    cancel-label="继续编辑"
    tone="danger"
    blocking
    @confirm="confirmSettingsClose"
    @cancel="dismissSettingsCloseConfirm"
  />

  <MarketplaceModal
    :show="showMarketplace"
    :z-index="settingsChildModalZIndex"
    @update:show="showMarketplace = $event"
  />
</template>

<style scoped>
.settings-shell-window {
  color: var(--sd-color-text-primary);
}
.settings-shell-window.is-mobile {
  min-height: 100dvh;
  border-radius: 0;
}
.settings-shell-sidebar {
  position: relative;
  z-index: 2;
  min-height: 100%;
  padding: 0.875rem;
}
.settings-shell-sidebar-copy {
  margin-bottom: 0.875rem;
  padding: 0 0.5rem;
}
.settings-shell-sidebar-eyebrow {
  color: var(--sd-color-text-tertiary);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.settings-shell-sidebar-title {
  margin-top: 0.375rem;
  color: var(--sd-color-text-primary);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.3;
}
.settings-shell-sidebar-summary {
  margin-top: 0.25rem;
  color: var(--sd-color-text-secondary);
  font-size: 0.8125rem;
  line-height: 1.35;
}
.settings-shell-nav {
  display: grid;
  gap: 0.25rem;
  padding-bottom: 0.25rem;
}
.settings-shell-content {
  background: color-mix(in srgb, var(--sd-color-surface) 86%, transparent);
  min-height: 0;
}
.settings-shell-scroll {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.settings-shell-inspector {
  min-height: 100%;
}
.settings-inline-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 0.875rem;
  border: 1px solid var(--sd-color-border-subtle);
  border-radius: 0.875rem;
  background: color-mix(
    in srgb,
    var(--sd-color-surface-muted) 58%,
    var(--sd-color-surface) 42%
  );
}
.settings-inline-switch-copy {
  display: grid;
  gap: 0.1875rem;
  min-width: 0;
}
.settings-inline-switch-title {
  color: var(--sd-color-text-primary);
  font-size: 0.8125rem;
  font-weight: 700;
}
.settings-inline-switch-summary {
  color: var(--sd-color-text-secondary);
  font-size: 0.75rem;
  line-height: 1rem;
}
.settings-layout-group {
  display: grid;
  gap: 1rem;
  padding-top: 0.25rem;
}
.settings-layout-group + .settings-layout-group {
  border-top: 1px solid
    color-mix(in srgb, var(--sd-color-border-subtle) 82%, transparent);
  padding-top: 1.25rem;
}
.settings-layout-group-head {
  display: grid;
  gap: 0.25rem;
}
.settings-layout-group-title {
  color: var(--sd-color-text-primary);
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.25rem;
}
.settings-layout-group-summary {
  color: var(--sd-color-text-secondary);
  font-size: 0.75rem;
  line-height: 1.2rem;
}
.settings-layout-group-body {
  display: grid;
  gap: 1rem;
}
.settings-layout-pair-grid {
  display: grid;
  gap: 1rem;
}
.settings-layout-metric-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.625rem;
}
.settings-layout-metric-value {
  margin-left: auto;
  color: var(--sd-color-text-secondary);
  font-size: 0.75rem;
  font-weight: 700;
}
.settings-wallpaper-grid {
  display: grid;
  gap: 0.875rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.settings-wallpaper-card {
  display: grid;
  gap: 0.5rem;
  min-height: 9.5rem;
  align-content: start;
  border: 1px solid var(--sd-color-border-subtle);
  border-radius: 1rem;
  background: color-mix(
    in srgb,
    var(--sd-color-surface-muted) 48%,
    var(--sd-color-surface) 52%
  );
  padding: 1rem;
  text-align: left;
}
.settings-wallpaper-card[type="button"] {
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    transform 0.18s ease;
}
.settings-wallpaper-card[type="button"]:hover {
  border-color: color-mix(
    in srgb,
    var(--sd-color-accent-primary) 28%,
    var(--sd-color-border-subtle) 72%
  );
  background: color-mix(
    in srgb,
    var(--sd-color-surface-muted) 34%,
    var(--sd-color-surface) 66%
  );
  transform: translateY(-1px);
}
.settings-wallpaper-pill {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  border-radius: 999px;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 700;
}
.settings-wallpaper-pill.is-pc {
  background: color-mix(
    in srgb,
    var(--sd-color-accent-primary) 16%,
    var(--sd-color-surface) 84%
  );
  color: var(--sd-color-accent-primary);
}
.settings-wallpaper-pill.is-mobile {
  background: color-mix(
    in srgb,
    var(--sd-color-surface-muted) 74%,
    var(--sd-color-surface) 26%
  );
  color: var(--sd-color-text-secondary);
}
.settings-wallpaper-pill.is-api {
  background: color-mix(
    in srgb,
    var(--sd-color-warning) 12%,
    var(--sd-color-surface) 88%
  );
  color: var(--sd-color-warning);
}
.settings-wallpaper-title {
  color: var(--sd-color-text-primary);
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.2rem;
}
.settings-wallpaper-summary {
  color: var(--sd-color-text-primary);
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.25rem;
  word-break: break-word;
}
.settings-wallpaper-meta {
  color: var(--sd-color-text-secondary);
  font-size: 0.75rem;
  line-height: 1.1rem;
}
.settings-meta-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.settings-meta-chip {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--sd-color-border-subtle);
  border-radius: 999px;
  background: color-mix(
    in srgb,
    var(--sd-color-surface-muted) 74%,
    var(--sd-color-surface) 26%
  );
  padding: 0.3125rem 0.625rem;
  color: var(--sd-color-text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
}
.settings-preview-stage {
  display: grid;
  gap: 0.75rem;
}
.settings-preview-surface {
  position: relative;
  overflow: hidden;
  min-height: 11rem;
  border: 1px solid
    color-mix(in srgb, var(--sd-color-border-subtle) 88%, transparent);
  border-radius: 1rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(15, 23, 42, 0.16)),
    color-mix(
      in srgb,
      var(--sd-color-surface-muted) 82%,
      var(--sd-color-surface) 18%
    );
}
.settings-preview-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.04);
  opacity: 0;
  transition: opacity 0.24s ease-in-out;
}
.settings-preview-image.is-visible {
  opacity: 1;
}
.settings-preview-surface-mask {
  position: absolute;
  inset: 0;
}
.settings-preview-surface-copy {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 11rem;
  flex-direction: column;
  justify-content: space-between;
  padding: 0.875rem;
}
.settings-preview-pill {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  padding: 0.3125rem 0.625rem;
  color: rgba(255, 255, 255, 0.92);
  font-size: 0.6875rem;
  font-weight: 700;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.settings-preview-title {
  color: #ffffff;
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.35;
  text-shadow: 0 2px 8px rgba(15, 23, 42, 0.32);
}
.settings-preview-card-row {
  display: flex;
  gap: 0.5rem;
}
.settings-preview-card {
  display: inline-flex;
  min-width: 3rem;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 0.875rem;
  background: rgba(255, 255, 255, 0.18);
  padding: 0.5rem 0.75rem;
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.settings-inspector-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}
.settings-inspector-label {
  color: var(--sd-color-text-tertiary);
  font-size: 0.75rem;
  font-weight: 600;
}
.settings-inspector-value {
  color: var(--sd-color-text-primary);
  font-size: 0.75rem;
  font-weight: 700;
  text-align: right;
}
.settings-inspector-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.3125rem 0.625rem;
  font-size: 0.6875rem;
  font-weight: 700;
}
.settings-inspector-badge.is-success {
  background: color-mix(
    in srgb,
    var(--sd-color-success) 14%,
    var(--sd-color-surface) 86%
  );
  color: var(--sd-color-success);
}
.settings-inspector-badge.is-warning {
  background: color-mix(
    in srgb,
    var(--sd-color-warning) 14%,
    var(--sd-color-surface) 86%
  );
  color: var(--sd-color-warning);
}
.settings-inspector-badge.is-info {
  background: color-mix(
    in srgb,
    var(--sd-color-accent-primary) 14%,
    var(--sd-color-surface) 86%
  );
  color: var(--sd-color-accent-primary);
}
.settings-inspector-list {
  margin: 0;
  padding-left: 1rem;
  color: var(--sd-color-text-secondary);
  font-size: 0.8125rem;
  line-height: 1.45;
}
.glass-panel,
.glass-card,
.glass-chip {
  color: var(--sd-color-text-primary);
  background-color: color-mix(
    in srgb,
    var(--sd-color-surface-floating) 88%,
    transparent
  );
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--sd-color-border-subtle);
}
.glass-chip:hover {
  background-color: color-mix(
    in srgb,
    var(--sd-color-surface-muted) 84%,
    var(--sd-color-surface) 16%
  );
}
.selected-outline {
  border: 1px solid var(--sd-color-border-accent);
  background: color-mix(
    in srgb,
    var(--sd-color-surface-muted) 84%,
    var(--sd-color-surface) 16%
  );
  box-shadow: inset 0 0 0 1px
    color-mix(in srgb, var(--sd-color-accent-primary) 18%, transparent);
  font-weight: 700;
}
.selectable-outline:focus-visible,
.selectable-outline:active {
  box-shadow: var(--sd-focus-ring);
}

@media (max-width: 767px) {
  .settings-shell-nav {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;
    scrollbar-width: none;
  }

  .settings-shell-nav::-webkit-scrollbar {
    display: none;
  }

  .settings-shell-sidebar-copy {
    margin-bottom: 0.625rem;
    padding: 0;
  }

  .settings-shell-sidebar-summary {
    display: none;
  }

  .settings-wallpaper-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .settings-shell-inspector {
    display: none;
  }
}

@media (min-width: 768px) {
  .settings-layout-pair-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
