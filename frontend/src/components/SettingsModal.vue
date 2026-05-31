<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from "vue";
import { useWindowSize } from "@vueuse/core";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "@lucide/vue";
import { SolarDay } from "tyme4ts";
import { useMainStore } from "../stores/main";
import IconUploader from "./IconUploader.vue";
import WallpaperLibrary from "./WallpaperLibrary.vue";
import PasswordConfirmModal from "./PasswordConfirmModal.vue";
import AppButton from "@/components/base/AppButton.vue";
import AppFieldRow from "@/components/base/AppFieldRow.vue";
import AppInspectorPanel from "@/components/base/AppInspectorPanel.vue";
import AppRangeField from "@/components/base/AppRangeField.vue";
import AppSectionCard from "@/components/base/AppSectionCard.vue";
import AppSegmentedControl from "@/components/base/AppSegmentedControl.vue";
import AppSettingsShell from "@/components/base/AppSettingsShell.vue";
import AppSwitch from "@/components/base/AppSwitch.vue";
import AppWindowControls from "@/components/base/AppWindowControls.vue";
import BlockingProgressOverlay from "@/components/base/BlockingProgressOverlay.vue";
import ConfirmDialog from "@/components/base/ConfirmDialog.vue";
import StatusBanner from "@/components/base/StatusBanner.vue";
import {
  useDirtyStateGuard,
  type DirtyCloseReason,
} from "@/composables/useDirtyStateGuard";
import { normalizeThemeMode } from "@/composables/useThemeMode";
import { fetchItabIpHistory } from "@/features/itab-ip/itabIpApi";
import type { ItabIpHistoryEntry } from "@/features/itab-ip/itabIpTypes";
import { useItabIpRuntime } from "@/features/itab-ip/useItabIpRuntime";
import { useUiFeedbackStore } from "@/stores/uiFeedback";
import type {
  NetworkLocationAddress,
  SearchEngine,
  NavGroup,
  NavItem,
} from "@/types";
import {
  networkLocationMatches,
  normalizeNetworkLocationAddress,
} from "@/utils/network";
import { getSiteIconUrl, normalizeSiteUrl } from "@/utils/siteMetadata";
import {
  DEFAULT_SEARCH_ENGINE_KEYS,
  createDefaultSearchEngines,
  createSearchEngineKey,
  normalizeDefaultSearchEngine,
  normalizeSearchEngines,
} from "@/utils/searchEngines";

const props = defineProps<{ show: boolean }>();
const emit = defineEmits(["update:show"]);
const store = useMainStore();
const uiFeedback = useUiFeedbackStore();
const ipRuntime = useItabIpRuntime();

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

interface NetworkLocationHistoryRow {
  key: string;
  label: string;
  address: NetworkLocationAddress;
  ips: string[];
  seenCount: number;
  lastSeenAt: number;
}

const ipHistoryLoading = ref(false);
const ipHistoryError = ref("");
const ipHistoryEntries = ref<ItabIpHistoryEntry[]>([]);
const currentNetworkLocation = computed(() =>
  normalizeNetworkLocationAddress(ipRuntime.result.value),
);
const internalNetworkLocation = computed(() =>
  normalizeNetworkLocationAddress(store.appConfig.internalLocation),
);
const currentNetworkLocationLabel = computed(
  () => currentNetworkLocation.value?.label || "定位中",
);
const currentLocationIsInternal = computed(() =>
  networkLocationMatches(
    currentNetworkLocation.value,
    internalNetworkLocation.value,
  ),
);
const networkLocationRows = computed<NetworkLocationHistoryRow[]>(() => {
  const rows = new Map<string, NetworkLocationHistoryRow>();
  const addEntry = (
    address: NetworkLocationAddress | null,
    ip: string,
    seenCount: number,
    lastSeenAt: number,
  ) => {
    if (!address) return;
    const existing = rows.get(address.key);
    if (existing) {
      if (ip && !existing.ips.includes(ip)) existing.ips.push(ip);
      existing.seenCount += seenCount;
      existing.lastSeenAt = Math.max(existing.lastSeenAt, lastSeenAt);
      return;
    }
    rows.set(address.key, {
      key: address.key,
      label: address.label,
      address,
      ips: ip ? [ip] : [],
      seenCount,
      lastSeenAt,
    });
  };

  for (const entry of ipHistoryEntries.value) {
    addEntry(
      normalizeNetworkLocationAddress(entry),
      entry.queryIp || entry.ip || "",
      Math.max(1, entry.seenCount || 0),
      entry.lastSeenAt || 0,
    );
  }

  addEntry(
    currentNetworkLocation.value,
    ipRuntime.result.value.queryIp || ipRuntime.result.value.ip || "",
    0,
    Date.now(),
  );

  return Array.from(rows.values()).sort(
    (left, right) => right.lastSeenAt - left.lastSeenAt,
  );
});
const formatNetworkLocationSeenAt = (timestamp: number) => {
  if (!timestamp) return "未记录";
  return new Date(timestamp).toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};
const formatNetworkLocationMeta = (row: NetworkLocationHistoryRow) => {
  const ipText =
    row.ips.length > 0 ? `IP ${row.ips.slice(0, 3).join("、")}` : "当前定位";
  const seenText = row.seenCount > 0 ? `${row.seenCount} 次` : "本次刷新检测";
  return `${ipText} · ${seenText} · ${formatNetworkLocationSeenAt(row.lastSeenAt)}`;
};
const isInternalLocationRow = (row: NetworkLocationHistoryRow) =>
  internalNetworkLocation.value?.key === row.key;
const refreshIpLocationHistory = async () => {
  if (!store.isLogged) {
    ipHistoryEntries.value = [];
    ipHistoryError.value = "";
    return;
  }
  ipHistoryLoading.value = true;
  ipHistoryError.value = "";
  try {
    await ipRuntime.ensureResult().catch(() => null);
    ipHistoryEntries.value = await fetchItabIpHistory();
  } catch (error) {
    ipHistoryError.value =
      error instanceof Error ? error.message : "地址历史加载失败";
  } finally {
    ipHistoryLoading.value = false;
  }
};
const setInternalNetworkLocation = (address: NetworkLocationAddress) => {
  store.appConfig.internalLocation = { ...address };
  store.markDirty();
  notify(`已设为内网地址：${address.label}`, "success", "网络判定");
};
const clearInternalNetworkLocation = () => {
  store.appConfig.internalLocation = null;
  store.markDirty();
  notify("已清除内网地址", "info", "网络判定");
};

type WallpaperLibraryTab = "pc" | "mobile" | "api";

const settingsChildModalZIndex = 140;
const settingsBlockingModalZIndex = 150;
const showWallpaperLibrary = ref(false);
const wallpaperLibraryTab = ref<WallpaperLibraryTab>("pc");
const settingsPreviewNow = ref(new Date());
let daylightTimer: number | null = null;
const updateHour = () => {
  const now = new Date();
  settingsPreviewNow.value = now;
};
const daylightMaskPercent = computed({
  get: () => Math.round((store.appConfig.daylightMask ?? 0.5) * 100),
  set: (val: number) => {
    const v = Number.isFinite(val) ? val : 50;
    const clamped = Math.min(100, Math.max(0, v));
    store.appConfig.daylightMask = clamped / 100;
    store.markDirty();
  },
});
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
  | "appearance"
  | "wallpaper"
  | "topbar"
  | "cards"
  | "footer"
  | "account"
  | "network"
  | "about";

type SettingsTabGroup = "personalization" | "system";

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

const activeTab = ref<SettingsTabId>("appearance");
watch(
  [() => props.show, activeTab],
  ([visible, tab]) => {
    if (visible && tab === "network") {
      void refreshIpLocationHistory();
    }
  },
  { immediate: true },
);
const settingsTabMeta: Record<SettingsTabId, SettingsTabMeta> = {
  appearance: {
    title: "桌面外观",
    summary: "标题、日光模式与基础显示",
    glyph: "AP",
    group: "personalization",
  },
  wallpaper: {
    title: "壁纸背景",
    summary: "桌面、移动端、API 与可读性",
    glyph: "WP",
    group: "personalization",
  },
  topbar: {
    title: "顶部与搜索",
    summary: "顶部栏、时间、搜索与引擎",
    glyph: "TB",
    group: "personalization",
  },
  cards: {
    title: "分组交互",
    summary: "分组布局、图标形状与悬停反馈",
    glyph: "CI",
    group: "personalization",
  },
  footer: {
    title: "页脚统计",
    summary: "访客统计、页脚尺寸与 HTML",
    glyph: "FT",
    group: "personalization",
  },
  account: {
    title: "账户管理",
    summary: "用户、版本与数据操作",
    glyph: "AC",
    group: "system",
  },
  network: {
    title: "网络判定",
    summary: "自动/LAN/WAN/延迟规则与诊断",
    glyph: "NW",
    group: "system",
  },
  about: {
    title: "关于",
    summary: "版本、技术栈与项目能力说明",
    glyph: "AB",
    group: "system",
  },
};

const settingsNavGroupLabels: Record<SettingsTabGroup, string> = {
  personalization: "Personalization",
  system: "System",
};

const settingsNavOrder: SettingsTabId[] = [
  "appearance",
  "wallpaper",
  "topbar",
  "cards",
  "footer",
  "account",
  "network",
  "about",
];

const settingsNavGroups = computed<SettingsNavGroup[]>(() =>
  (["personalization", "system"] as SettingsTabGroup[])
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
  () => settingsTabMeta[activeTab.value] ?? settingsTabMeta.appearance,
);
const personalizationTabIds = new Set<SettingsTabId>([
  "appearance",
  "wallpaper",
  "topbar",
  "cards",
  "footer",
]);
const isPersonalizationTab = computed(() =>
  personalizationTabIds.has(activeTab.value),
);
const { width: viewportWidth, height: viewportHeight } = useWindowSize();
const settingsIsMobile = computed(() => viewportWidth.value < 768);
const settingsShellSurfaceClass = computed(() =>
  settingsIsMobile.value
    ? "settings-shell-window settings-shell-itab is-mobile"
    : "settings-shell-window settings-shell-itab",
);
const settingsOverlayClass = computed(() => "settings-shell-overlay");
const showSettingsInspector = computed(() => viewportWidth.value >= 1440);
const settingsWindowTitle = computed(() =>
  isPersonalizationTab.value ? "Appearance and Layout" : "StartDeck Settings",
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

const searchEngineEditorRows = ref<SearchEngine[]>([]);
const searchEngineDraft = ref({ label: "", urlTemplate: "" });

const loadSearchEngineEditorRows = () => {
  searchEngineEditorRows.value = normalizeSearchEngines(
    store.appConfig.searchEngines,
  ).map((engine) => ({ ...engine }));
};

const persistSearchEngineEditorRows = () => {
  const normalized = normalizeSearchEngines(searchEngineEditorRows.value);
  searchEngineEditorRows.value = normalized.map((engine) => ({ ...engine }));
  store.appConfig.searchEngines = normalized.map((engine) => ({ ...engine }));
  store.appConfig.defaultSearchEngine = normalizeDefaultSearchEngine(
    store.appConfig.defaultSearchEngine,
    normalized,
  );
  store.markDirty();
};

const searchEngineDefaultKey = computed({
  get: () =>
    normalizeDefaultSearchEngine(
      store.appConfig.defaultSearchEngine,
      searchEngineEditorRows.value.length
        ? searchEngineEditorRows.value
        : normalizeSearchEngines(store.appConfig.searchEngines),
    ),
  set: (value: string) => {
    store.appConfig.defaultSearchEngine = normalizeDefaultSearchEngine(
      value,
      searchEngineEditorRows.value,
    );
    store.markDirty();
  },
});

const searchEngineDefaultPreview = computed(() => {
  const key = searchEngineDefaultKey.value;
  return (
    searchEngineEditorRows.value.find((engine) => engine.key === key) ||
    searchEngineEditorRows.value[0] ||
    createDefaultSearchEngines()[0]
  );
});

const searchEngineCustomCount = computed(
  () =>
    searchEngineEditorRows.value.filter(
      (engine) => !isBuiltInSearchEngine(engine),
    ).length,
);

const isBuiltInSearchEngine = (engine: SearchEngine) =>
  DEFAULT_SEARCH_ENGINE_KEYS.has(engine.key);

const moveSearchEngine = (index: number, step: -1 | 1) => {
  const target = index + step;
  if (target < 0 || target >= searchEngineEditorRows.value.length) return;
  const rows = [...searchEngineEditorRows.value];
  const [item] = rows.splice(index, 1);
  if (!item) return;
  rows.splice(target, 0, item);
  searchEngineEditorRows.value = rows;
  persistSearchEngineEditorRows();
};

const removeSearchEngine = (index: number) => {
  const engine = searchEngineEditorRows.value[index];
  if (!engine || searchEngineEditorRows.value.length <= 1) return;
  searchEngineEditorRows.value = searchEngineEditorRows.value.filter(
    (_, rowIndex) => rowIndex !== index,
  );
  persistSearchEngineEditorRows();
};

const addSearchEngine = () => {
  const label = searchEngineDraft.value.label.trim();
  const urlTemplate = searchEngineDraft.value.urlTemplate.trim();
  if (!label || !urlTemplate) {
    notify("请填写搜索引擎名称和搜索地址。", "warning", "搜索引擎");
    return;
  }
  const key = createSearchEngineKey(label);
  searchEngineEditorRows.value = [
    ...searchEngineEditorRows.value,
    {
      id: key,
      key,
      label,
      urlTemplate,
      custom: true,
    },
  ];
  searchEngineDraft.value = { label: "", urlTemplate: "" };
  persistSearchEngineEditorRows();
};

const resetSearchEngines = () => {
  searchEngineEditorRows.value = createDefaultSearchEngines();
  store.appConfig.defaultSearchEngine = searchEngineEditorRows.value[0]?.key;
  persistSearchEngineEditorRows();
};

watch(
  () => props.show,
  (visible) => {
    if (visible) loadSearchEngineEditorRows();
  },
  { immediate: true },
);

const wallpaperSourceLabel = computed(() => {
  if (store.appConfig.empireMode) return "帝国模式背景";
  if (store.appConfig.background && inspectorPreviewImageFailed.value)
    return "桌面壁纸缺失";
  if (store.appConfig.background) return "已配置桌面壁纸";
  if (store.appConfig.solidBackgroundColor) return "已配置桌面背景";
  return "渐变背景";
});

const settingsPreviewWeekNames = ["日", "一", "二", "三", "四", "五", "六"];
const formatSettingsPreviewClock = (value: number) =>
  String(value).padStart(2, "0");
const settingsPreviewHourText = computed(() =>
  formatSettingsPreviewClock(settingsPreviewNow.value.getHours()),
);
const settingsPreviewMinuteText = computed(() =>
  formatSettingsPreviewClock(settingsPreviewNow.value.getMinutes()),
);
const settingsPreviewDateText = computed(() => {
  const value = settingsPreviewNow.value;
  const month = value.getMonth() + 1;
  const day = value.getDate();
  const weekday = settingsPreviewWeekNames[value.getDay()] || "";
  try {
    const lunarDay = SolarDay.fromYmd(
      value.getFullYear(),
      month,
      day,
    ).getLunarDay();
    return `${month}月${day}日星期${weekday}${lunarDay
      .getLunarMonth()
      .getName()}${lunarDay.getName()}`;
  } catch {
    return `${month}月${day}日星期${weekday}`;
  }
});
const settingsPreviewSearchEngineLabel = computed(() => {
  const engines = normalizeSearchEngines(store.appConfig.searchEngines);
  const key = normalizeDefaultSearchEngine(
    store.appConfig.defaultSearchEngine,
    engines,
  );
  return engines.find((engine) => engine.key === key)?.label || "百度";
});

const mobileWallpaperLabel = computed(() => {
  if (!store.appConfig.enableMobileWallpaper) return "跟随桌面背景";
  if (store.appConfig.mobileBackground) return "已配置移动端背景";
  return "未配置移动端背景";
});

const settingsThemeModeLabelMap = {
  auto: "跟随系统",
  light: "浅色",
  dark: "深色",
} as const;
const settingsThemeLabel = computed(
  () =>
    settingsThemeModeLabelMap[normalizeThemeMode(store.appConfig.themeMode)],
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
    label = "当前桌面使用自定义背景";
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
      background: "var(--sd-home-preview-empire-background)",
    };
  }
  if (store.appConfig.solidBackgroundColor) {
    return {
      backgroundColor: store.appConfig.solidBackgroundColor,
      backgroundImage: "none",
    };
  }
  return {
    backgroundImage: "var(--sd-home-preview-default-background)",
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
const headerLayoutOptions = [
  { label: "标准", value: "left" },
  { label: "居中", value: "center" },
  { label: "反转", value: "right" },
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

const themeModeOptions = [
  { label: "自动", value: "auto" },
  { label: "浅色", value: "light" },
  { label: "深色", value: "dark" },
];

const handleNavWheel = (e: WheelEvent) => {
  if (window.innerWidth < 768) {
    const container = e.currentTarget as HTMLElement;
    container.scrollLeft += e.deltaY;
  }
};

onMounted(async () => {
  if (import.meta.env.MODE === "test") return;

  updateHour();
  if (daylightTimer) window.clearInterval(daylightTimer);
  daylightTimer = window.setInterval(updateHour, 60 * 1000);
});

onUnmounted(() => {
  if (daylightTimer) window.clearInterval(daylightTimer);
  daylightTimer = null;
});

const passwordInput = ref("");
const loginUsernameInput = ref("");
const newPasswordInput = ref("");
const hasAdminAccess = computed(
  () => store.isLogged && store.username === "admin",
);
const canManageUsers = computed(() => hasAdminAccess.value);

const fileInput = ref<HTMLInputElement | null>(null);

// Password Confirm Logic
const showPasswordConfirm = ref(false);
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
  if (!loginUsernameInput.value.trim()) {
    notify("请输入用户名。", "warning", "无法登录");
    return;
  }
  try {
    const success = await store.login(
      loginUsernameInput.value,
      passwordInput.value,
    );
    if (success) {
      notify("用户身份已验证。", "success", "登录成功");
      loginUsernameInput.value = "";
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
    if (val !== "account") return;
    if (canManageUsers.value) loadUsers();
    if (store.isLogged) fetchVersions();
  },
  { immediate: true },
);

onMounted(() => {
  store.checkUpdate({ force: true, notify: true });
});

// 配置版本管理
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
  if (store.isLogged) fetchVersions();
});

const handleExport = async () => {
  try {
    // 强制立即保存，确保后端数据也是最新的
    store.markDirty();

    const backupData = {
      items: store.items,
      widgets: store.widgets,
      appConfig: store.appConfig,
      groups: store.groups,
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
      if (canManageUsers.value) loadUsers();
      fetchVersions();
    }
  },
);

watch(activeTab, (val) => {
  if (val === "account" && store.isLogged) fetchVersions();
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
    :show-close="false"
    :show-inspector="showSettingsInspector"
    scheme="auto"
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
      <div class="settings-shell-header-actions">
        <AppButton
          v-if="!settingsIsMobile"
          variant="primary"
          size="sm"
          :disabled="isImporting"
          title="完成并关闭设置"
          @click="requestSettingsClose('programmatic')"
        >
          完成
        </AppButton>
        <AppWindowControls
          v-if="!isImporting"
          class="settings-shell-window-controls"
          aria-label="设置窗口控制"
          close-label="关闭设置"
          @close="requestSettingsClose('programmatic')"
        />
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
        <div v-if="isPersonalizationTab" class="space-y-4">
          <AppSectionCard
            v-if="activeTab === 'appearance'"
            title="桌面外观"
            description="只保留标题显示和日光模式这些基础视觉开关，实时反映到右侧预览。"
            body-class="space-y-4"
          >
            <AppFieldRow
              label="显示标题"
              hint="控制首页和右侧预览是否显示导航主标题。"
              align="center"
            >
              <template #control>
                <AppSwitch
                  v-model="store.appConfig.showHomeTitle"
                  label=""
                  @change="store.markDirty()"
                />
              </template>
            </AppFieldRow>

            <AppFieldRow
              label="网站标题"
              :hint="
                store.appConfig.showHomeTitle === false
                  ? '标题已隐藏，打开显示标题后才能修改。'
                  : '导航主标题。修改后会立即进入待保存状态。'
              "
            >
              <template #control>
                <input
                  v-model="store.appConfig.customTitle"
                  type="text"
                  class="sd-input w-full"
                  :disabled="store.appConfig.showHomeTitle === false"
                />
              </template>
            </AppFieldRow>

            <AppFieldRow
              label="界面主题"
              hint="统一控制设置弹窗、首页组件和打开态面板的语义色。"
            >
              <template #control>
                <AppSegmentedControl
                  :model-value="normalizeThemeMode(store.appConfig.themeMode)"
                  :options="themeModeOptions"
                  @update:modelValue="
                    (value) => {
                      store.appConfig.themeMode = normalizeThemeMode(value);
                      store.markDirty();
                    }
                  "
                />
              </template>
            </AppFieldRow>

            <AppFieldRow
              label="白昼模式"
              hint="只调整夜间桌面背景遮罩，不再切换界面主题。"
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
            v-if="activeTab === 'wallpaper'"
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
            v-if="activeTab === 'wallpaper'"
            title="背景与可读性"
            description="上传、裁剪、模糊遮罩和移动端背景集中在壁纸背景页内管理。"
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
          </AppSectionCard>

          <AppSectionCard
            v-if="activeTab === 'topbar' || activeTab === 'cards'"
            :title="activeTab === 'topbar' ? '顶部与搜索' : '分组交互'"
            :description="
              activeTab === 'topbar'
                ? '顶部栏、时间、搜索框和搜索引擎单独维护。'
                : '分组布局、图标形状和悬停反馈单独维护。'
            "
            body-class="space-y-5"
          >
            <section
              v-if="activeTab === 'topbar'"
              class="settings-layout-group"
            >
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

                <AppFieldRow
                  label="源站顶部"
                  hint="控制 iTab 风格时间和搜索框是否显示。"
                >
                  <template #control>
                    <div class="settings-top-switch-grid">
                      <div class="settings-inline-switch">
                        <div class="settings-inline-switch-copy">
                          <span class="settings-inline-switch-title"
                            >显示时间</span
                          >
                          <span class="settings-inline-switch-summary"
                            >显示大号时钟、日期和农历。</span
                          >
                        </div>
                        <AppSwitch
                          v-model="store.appConfig.showHomeTime"
                          label=""
                          @change="store.markDirty()"
                        />
                      </div>
                      <div class="settings-inline-switch">
                        <div class="settings-inline-switch-copy">
                          <span class="settings-inline-switch-title"
                            >显示搜索框</span
                          >
                          <span class="settings-inline-switch-summary"
                            >显示源站同款顶部搜索入口。</span
                          >
                        </div>
                        <AppSwitch
                          v-model="store.appConfig.showHomeSearch"
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
                  class="settings-search-engine-field"
                  label="搜索引擎"
                  hint="管理首页搜索来源、默认引擎和自定义地址。"
                >
                  <template #control>
                    <div class="settings-search-engine-panel">
                      <div class="settings-search-engine-summary">
                        <div class="settings-search-engine-current">
                          <span>当前默认</span>
                          <strong>{{
                            searchEngineDefaultPreview?.label || "百度"
                          }}</strong>
                          <small>
                            {{ searchEngineEditorRows.length }} 个引擎 ·
                            {{ searchEngineCustomCount }} 个自定义
                          </small>
                        </div>
                        <label class="settings-search-engine-default">
                          <span>默认引擎</span>
                          <select
                            v-model="searchEngineDefaultKey"
                            class="sd-select"
                          >
                            <option
                              v-for="engine in searchEngineEditorRows"
                              :key="`default-${engine.key}`"
                              :value="engine.key"
                            >
                              {{ engine.label }}
                            </option>
                          </select>
                        </label>
                        <div class="settings-search-engine-global-actions">
                          <div class="settings-inline-switch compact">
                            <div class="settings-inline-switch-copy">
                              <span class="settings-inline-switch-title"
                                >记住上次选择</span
                              >
                              <span class="settings-inline-switch-summary">
                                {{
                                  store.appConfig.rememberLastEngine === false
                                    ? "始终使用默认"
                                    : "跟随首页选择"
                                }}
                              </span>
                            </div>
                            <AppSwitch
                              v-model="store.appConfig.rememberLastEngine"
                              label=""
                              @change="store.markDirty()"
                            />
                          </div>
                          <button
                            class="settings-search-icon-button"
                            type="button"
                            title="恢复默认搜索引擎"
                            aria-label="恢复默认搜索引擎"
                            @click="resetSearchEngines"
                          >
                            <RotateCcw :size="16" />
                          </button>
                        </div>
                      </div>

                      <div
                        class="settings-search-engine-table"
                        role="group"
                        aria-label="搜索引擎列表"
                      >
                        <div
                          class="settings-search-engine-table-head"
                          aria-hidden="true"
                        >
                          <span>名称</span>
                          <span>搜索地址</span>
                          <span>操作</span>
                        </div>
                        <article
                          v-for="(engine, index) in searchEngineEditorRows"
                          :key="engine.key"
                          class="settings-search-engine-row"
                        >
                          <div class="settings-search-engine-name-cell">
                            <input
                              v-model="engine.label"
                              class="sd-input"
                              :aria-label="`${engine.label || '搜索引擎'}名称`"
                              placeholder="名称"
                              @change="persistSearchEngineEditorRows"
                            />
                            <span class="settings-search-engine-badges">
                              <span
                                v-if="engine.key === searchEngineDefaultKey"
                                class="settings-search-engine-badge is-default"
                                >默认</span
                              >
                              <span class="settings-search-engine-badge">
                                {{
                                  isBuiltInSearchEngine(engine)
                                    ? "内置"
                                    : "自定义"
                                }}
                              </span>
                            </span>
                          </div>
                          <input
                            v-model="engine.urlTemplate"
                            class="sd-input settings-search-engine-url-input"
                            :aria-label="`${engine.label || '搜索引擎'}搜索地址`"
                            placeholder="https://example.com/search?q={q}"
                            @change="persistSearchEngineEditorRows"
                          />
                          <div class="settings-search-engine-actions">
                            <button
                              type="button"
                              title="上移"
                              aria-label="上移搜索引擎"
                              :disabled="index === 0"
                              @click="moveSearchEngine(index, -1)"
                            >
                              <ArrowUp :size="15" />
                            </button>
                            <button
                              type="button"
                              title="下移"
                              aria-label="下移搜索引擎"
                              :disabled="
                                index === searchEngineEditorRows.length - 1
                              "
                              @click="moveSearchEngine(index, 1)"
                            >
                              <ArrowDown :size="15" />
                            </button>
                            <button
                              type="button"
                              title="删除搜索引擎"
                              aria-label="删除搜索引擎"
                              :disabled="searchEngineEditorRows.length <= 1"
                              @click="removeSearchEngine(index)"
                            >
                              <Trash2 :size="15" />
                            </button>
                          </div>
                        </article>
                      </div>

                      <div class="settings-search-engine-add">
                        <input
                          v-model="searchEngineDraft.label"
                          class="sd-input"
                          placeholder="自定义名称"
                        />
                        <input
                          v-model="searchEngineDraft.urlTemplate"
                          class="sd-input"
                          placeholder="搜索地址，建议包含 {q}"
                          @keyup.enter="addSearchEngine"
                        />
                        <button
                          class="settings-search-add-button"
                          type="button"
                          title="添加搜索引擎"
                          @click="addSearchEngine"
                        >
                          <Plus :size="16" />
                          <span>添加引擎</span>
                        </button>
                      </div>
                    </div>
                  </template>
                </AppFieldRow>
              </div>
            </section>

            <section v-if="activeTab === 'cards'" class="settings-layout-group">
              <header class="settings-layout-group-head">
                <h4 class="settings-layout-group-title">分组交互</h4>
                <p class="settings-layout-group-summary">
                  统一管理分组项目布局、图标形状和悬停反馈。
                </p>
              </header>

              <div class="settings-layout-group-body">
                <AppFieldRow
                  label="分组布局"
                  hint="控制分组项目默认纵向或横向排布。"
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
                  hint="应用到分组项目与组件预览。"
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

                <AppFieldRow
                  label="鼠标悬停效果"
                  hint="分组项目 hover 反馈样式。"
                >
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
            v-if="activeTab === 'footer'"
            title="页脚与统计"
            description="访客统计、尺寸与自定义 HTML 输出。"
            body-class="space-y-4"
          >
            <AppFieldRow
              label="显示访客统计"
              hint="为页脚补充访问统计信息。"
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

        <div v-if="activeTab === 'network'" class="settings-system-page">
          <header class="settings-system-hero">
            <div>
              <p class="settings-system-kicker">System Rules</p>
              <h4 class="settings-system-title">网络环境判定</h4>
              <p class="settings-system-summary">
                白名单和延迟阈值共同决定内网、外网和自动切换行为。
              </p>
            </div>
            <div class="settings-system-metric">
              <span>延迟阈值</span>
              <strong
                >{{
                  store.appConfig.latencyThresholdMs ??
                  DEFAULT_LATENCY_THRESHOLD_MS
                }}ms</strong
              >
            </div>
          </header>

          <AppSectionCard
            class="settings-system-card"
            title="地址判定"
            description="使用当前 IP 定位得到的省、市、区匹配内网环境。"
            body-class="settings-system-stack"
          >
            <StatusBanner
              v-if="!store.isLogged"
              tone="warning"
              title="未登录"
              message="登录后会显示当前用户的地址历史。"
            />
            <template v-else>
              <div class="settings-system-mode-row">
                <div>
                  <span>当前定位</span>
                  <strong>{{ currentNetworkLocationLabel }}</strong>
                  <small>{{
                    currentLocationIsInternal
                      ? "已匹配内网地址"
                      : "未匹配内网地址"
                  }}</small>
                </div>
                <div class="settings-system-row-actions">
                  <AppButton
                    size="sm"
                    variant="secondary"
                    :disabled="ipHistoryLoading"
                    @click="refreshIpLocationHistory"
                  >
                    刷新
                  </AppButton>
                  <AppButton
                    v-if="internalNetworkLocation"
                    size="sm"
                    variant="secondary"
                    @click="clearInternalNetworkLocation"
                  >
                    清除
                  </AppButton>
                </div>
              </div>

              <StatusBanner
                v-if="ipHistoryError"
                tone="danger"
                :message="ipHistoryError"
              />
              <StatusBanner
                v-else-if="internalNetworkLocation"
                tone="success"
                :message="`内网地址：${internalNetworkLocation.label}`"
              />
              <StatusBanner v-else tone="info" message="尚未设置内网地址。" />

              <div class="settings-system-list settings-location-list">
                <div
                  v-if="!ipHistoryLoading && networkLocationRows.length === 0"
                  class="settings-system-empty"
                >
                  暂无地址记录
                </div>
                <div
                  v-for="row in networkLocationRows"
                  :key="row.key"
                  class="settings-system-list-row settings-location-row"
                  :class="{ 'is-selected': isInternalLocationRow(row) }"
                >
                  <div>
                    <strong>
                      {{ row.label }}
                      <span v-if="isInternalLocationRow(row)">内网地址</span>
                    </strong>
                    <span>{{ formatNetworkLocationMeta(row) }}</span>
                  </div>
                  <AppButton
                    size="sm"
                    :variant="
                      isInternalLocationRow(row) ? 'secondary' : 'primary'
                    "
                    :disabled="isInternalLocationRow(row)"
                    @click="setInternalNetworkLocation(row.address)"
                  >
                    {{ isInternalLocationRow(row) ? "已设置" : "设为内网" }}
                  </AppButton>
                </div>
              </div>
            </template>
          </AppSectionCard>

          <AppSectionCard
            class="settings-system-card"
            title="域名白名单"
            description="域名按行维护，命中后可继续进入延迟阈值判定。"
            body-class="settings-system-stack"
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
                  rows="5"
                  class="sd-textarea w-full text-xs font-mono"
                  placeholder="每行一个域名（如 hp.fnos996.top 或 fnos996.top）"
                  @change="store.markDirty()"
                ></textarea>
              </template>
            </AppFieldRow>
          </AppSectionCard>

          <AppSectionCard
            class="settings-system-card"
            title="白名单 + 延迟判定"
            description="对命中的白名单域名按 RTT 阈值判定内外网。"
            body-class="settings-system-stack"
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
                <div class="settings-system-inline-form">
                  <input
                    :value="latencyThresholdDraft"
                    inputmode="numeric"
                    placeholder="20-30000"
                    class="sd-input settings-system-small-input font-mono"
                    :class="
                      latencyThresholdTouched && !latencyThresholdValidation.ok
                        ? 'is-invalid'
                        : ''
                    "
                    @input="onLatencyThresholdInput"
                    @blur="onLatencyThresholdBlur"
                    @keydown.enter.prevent="applyLatencyThreshold"
                  />
                  <span class="settings-system-unit">ms</span>
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
            <p v-else class="settings-system-note">
              白名单域名访问时，延迟低于此值判定为内网，高于此值判定为外网。默认
              {{ DEFAULT_LATENCY_THRESHOLD_MS }} ms。
            </p>
          </AppSectionCard>
        </div>

        <div v-if="activeTab === 'account'" class="settings-system-page">
          <header class="settings-system-hero">
            <div>
              <p class="settings-system-kicker">Account Control</p>
              <h4 class="settings-system-title">账户与数据</h4>
              <p class="settings-system-summary">
                配置版本、用户和授权集中管理。
              </p>
            </div>
            <div class="settings-system-metric">
              <span>当前身份</span>
              <strong>{{
                store.isLogged ? store.username || "Admin" : "未登录"
              }}</strong>
            </div>
          </header>

          <div v-if="!store.isLogged" class="settings-system-login-card">
            <p class="settings-system-kicker">User Login</p>
            <h4>用户登录</h4>
            <input
              v-model="loginUsernameInput"
              type="text"
              placeholder="用户名..."
              class="sd-input"
              @keyup.enter="handleLogin"
            />
            <input
              v-model="passwordInput"
              type="password"
              placeholder="密码..."
              class="sd-input"
              @keyup.enter="handleLogin"
            />
            <AppButton variant="primary" @click="handleLogin">登录</AppButton>
          </div>

          <div v-else class="settings-system-grid">
            <AppSectionCard
              class="settings-system-card"
              title="备份与恢复"
              description="导入、导出、初始化和默认配置写入。"
            >
              <div class="settings-system-action-grid">
                <AppButton variant="secondary" @click="handleExport">
                  导出配置
                </AppButton>
                <AppButton variant="primary" @click="triggerImport">
                  导入配置
                </AppButton>
                <AppButton
                  v-if="hasAdminAccess"
                  variant="secondary"
                  @click="handleSaveAsDefault"
                >
                  {{ saveDefaultBtnText }}
                </AppButton>
                <AppButton variant="danger-soft" @click="handleReset">
                  恢复初始化
                </AppButton>
                <input
                  ref="fileInput"
                  type="file"
                  accept=".navbak,.json"
                  class="hidden"
                  @change="handleFileChange"
                />
              </div>
            </AppSectionCard>

            <AppSectionCard
              class="settings-system-card settings-system-card-wide"
              title="配置版本"
              description="仅当前用户可见。"
            >
              <div class="settings-system-inline-form">
                <input
                  v-model="versionLabel"
                  placeholder="版本备注（可选）"
                  class="sd-input"
                />
                <AppButton variant="primary" @click="saveVersion">
                  保存为版本
                </AppButton>
              </div>

              <div class="settings-system-list">
                <div v-if="loadingVersions" class="settings-system-empty">
                  加载中...
                </div>
                <div
                  v-else-if="versions.length === 0"
                  class="settings-system-empty"
                >
                  暂无保存的版本
                </div>
                <article
                  v-for="v in versions"
                  :key="v.id"
                  class="settings-system-list-row"
                >
                  <div>
                    <strong>{{ v.label || "未命名版本" }}</strong>
                    <span>
                      {{ new Date(v.createdAt).toLocaleString() }} ·
                      {{ Math.round(v.size / 1024) }}KB
                    </span>
                  </div>
                  <div class="settings-system-row-actions">
                    <button type="button" @click="restoreVersion(v.id)">
                      恢复
                    </button>
                    <button type="button" @click="deleteVersion(v.id)">
                      删除
                    </button>
                  </div>
                </article>
              </div>
            </AppSectionCard>

            <AppSectionCard
              class="settings-system-card"
              title="修改密码"
              description="点击修改后需要输入原密码完成确认。"
            >
              <div class="settings-system-password-row">
                <div class="settings-system-password-input">
                  <input
                    v-model="newPasswordInput"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="新密码..."
                    class="sd-input"
                  />
                  <button
                    type="button"
                    tabindex="-1"
                    :title="showPassword ? '隐藏密码' : '显示密码'"
                    @click="showPassword = !showPassword"
                  >
                    <svg
                      v-if="showPassword"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                        stroke="currentColor"
                        stroke-width="1.5"
                      />
                    </svg>
                    <svg
                      v-else
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                        stroke="currentColor"
                        stroke-width="1.5"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        stroke="currentColor"
                        stroke-width="1.5"
                      />
                    </svg>
                  </button>
                </div>
                <AppButton variant="primary" @click="handleChangePassword">
                  修改
                </AppButton>
              </div>
            </AppSectionCard>

            <AppSectionCard
              v-if="canManageUsers"
              class="settings-system-card settings-system-card-wide"
              title="用户管理"
              description="添加用户、删除普通用户并导入授权密钥。"
              body-class="settings-system-stack"
            >
              <div class="settings-system-inline-form">
                <input
                  v-model="newUser"
                  placeholder="用户名"
                  class="sd-input"
                />
                <input
                  v-model="newPwd"
                  type="password"
                  placeholder="密码"
                  class="sd-input"
                />
                <AppButton variant="primary" @click="handleAddUser">
                  添加用户
                </AppButton>
              </div>

              <div class="settings-system-list">
                <article
                  v-for="u in userList"
                  :key="u"
                  class="settings-system-list-row"
                >
                  <div>
                    <strong>
                      {{ u }}
                      <span v-if="u === 'admin'">(管理员)</span>
                    </strong>
                  </div>
                  <button
                    v-if="u !== 'admin'"
                    type="button"
                    class="settings-system-danger-link"
                    @click="handleDeleteUser(u)"
                  >
                    删除
                  </button>
                </article>
              </div>

              <div class="settings-system-divider"></div>

              <AppFieldRow label="授权密钥" hint="导入有效密钥可启用授权能力。">
                <template #control>
                  <div class="settings-system-inline-form">
                    <input
                      v-model="licenseKey"
                      placeholder="输入密钥解除限制..."
                      class="sd-input"
                    />
                    <AppButton variant="primary" @click="handleUploadLicense">
                      导入
                    </AppButton>
                  </div>
                </template>
              </AppFieldRow>
            </AppSectionCard>

            <AppButton
              class="settings-system-card-wide"
              variant="danger-soft"
              block
              @click="store.logout"
            >
              退出登录
            </AppButton>
          </div>
        </div>
        <div v-if="activeTab === 'about'" class="settings-system-page">
          <header class="settings-system-hero settings-about-hero">
            <div>
              <p class="settings-system-kicker">About StartDeck</p>
              <h4 class="settings-system-title">StartDeck</h4>
              <p class="settings-system-summary">
                面向 NAS、自托管和个人工作台场景的浏览器起始页。
              </p>
            </div>
            <div class="settings-system-metric">
              <span>当前版本</span>
              <strong>v{{ store.currentVersion }}</strong>
            </div>
          </header>

          <section class="settings-about-grid">
            <AppSectionCard
              class="settings-system-card"
              title="核心定位"
              description="个人导航和 NAS 工具面板集中在一个可配置桌面中。"
            >
              <p class="settings-system-note">
                分组导航、可拖拽布局、组件化信息区和多端响应式访问体验适合放在浏览器首页、内网入口或家庭服务控制台。
              </p>
            </AppSectionCard>

            <AppSectionCard
              class="settings-system-card"
              title="数据与运行"
              description="本地数据、缓存和运行服务分层管理。"
            >
              <p class="settings-system-note">
                配置、壁纸、音乐和图标缓存都落在本地运行目录，便于迁移、备份和
                Docker 卷挂载。
              </p>
            </AppSectionCard>
          </section>

          <AppSectionCard
            class="settings-system-card"
            title="主要能力"
            description="导航、组件、文件媒体、服务管理和站点元数据联动。"
          >
            <div class="settings-about-feature-grid">
              <div>
                <strong>导航组织</strong>
                <span>分组、卡片、内外网地址、图标库和自定义卡片样式。</span>
              </div>
              <div>
                <strong>桌面组件</strong>
                <span>时钟、天气、日历、备忘录、待办和自定义组件。</span>
              </div>
              <div>
                <strong>文件媒体</strong>
                <span>桌面壁纸、移动端壁纸和本地音乐管理。</span>
              </div>
              <div>
                <strong>服务管理</strong>
                <span>Docker、系统状态、代理转发和混合网络环境识别。</span>
              </div>
              <div>
                <strong>个性化</strong>
                <span
                  >自定义 CSS、JavaScript、HTML 组件、布局尺寸和可见性。</span
                >
              </div>
              <div>
                <strong>站点元数据</strong>
                <span
                  >元数据服务抓取网站标题、描述和图标，并与卡片编辑联动。</span
                >
              </div>
            </div>
          </AppSectionCard>

          <AppSectionCard
            class="settings-system-card"
            title="技术组成"
            description="前端、后端、元数据服务和部署路径保持解耦。"
          >
            <div class="settings-about-chip-row">
              <span>Vue 3</span>
              <span>TypeScript</span>
              <span>Pinia</span>
              <span>Vite</span>
              <span>Rust</span>
              <span>SQLite</span>
              <span>MetaServer</span>
              <span>Docker</span>
              <span>Debian</span>
            </div>
            <p class="settings-system-note">
              前端负责仪表盘交互和组件配置；后端负责本地数据持久化、系统能力和文件接口；站点元数据服务独立运行，便于在
              Docker、Debian 或本地开发环境中组合部署。
            </p>
          </AppSectionCard>
        </div>
      </div>
    </div>

    <template #inspector>
      <div class="settings-shell-inspector p-3 space-y-3">
        <AppInspectorPanel
          title="实时预览"
          description="背景、标题与主题状态。"
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
                <div class="settings-preview-surface-header">
                  <span class="settings-preview-pill">{{
                    settingsThemeLabel
                  }}</span>
                </div>
                <div
                  v-if="
                    store.appConfig.showHomeTitle !== false ||
                    store.appConfig.showHomeTime !== false ||
                    store.appConfig.showHomeSearch !== false
                  "
                  class="settings-preview-source-top"
                  :class="{
                    'has-title': store.appConfig.showHomeTitle !== false,
                    'has-time': store.appConfig.showHomeTime !== false,
                    'has-search': store.appConfig.showHomeSearch !== false,
                  }"
                >
                  <strong
                    v-if="store.appConfig.showHomeTitle !== false"
                    class="settings-preview-title"
                    >{{ store.appConfig.customTitle || "我的导航" }}</strong
                  >
                  <div
                    v-if="store.appConfig.showHomeTime !== false"
                    class="settings-preview-clock"
                  >
                    <strong>
                      {{ settingsPreviewHourText }}:{{
                        settingsPreviewMinuteText
                      }}
                    </strong>
                    <span>{{ settingsPreviewDateText }}</span>
                  </div>
                  <div
                    v-if="store.appConfig.showHomeSearch !== false"
                    class="settings-preview-search"
                  >
                    <span class="settings-preview-search-icon"></span>
                    <span class="settings-preview-search-placeholder"
                      >输入搜索内容</span
                    >
                    <em>{{ settingsPreviewSearchEngineLabel }}</em>
                  </div>
                </div>
              </div>
            </div>
            <div class="settings-meta-stack mt-3">
              <span class="settings-meta-chip">{{ wallpaperSourceLabel }}</span>
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
          description="关闭契约、版本与同步状态。"
        >
          <div class="space-y-3 text-sm text-[var(--sd-color-text-secondary)]">
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
</template>

<style scoped>
:global(.settings-shell-overlay) {
  background: var(--sd-shell-overlay);
  -webkit-backdrop-filter: var(--sd-shell-overlay-filter);
  backdrop-filter: var(--sd-shell-overlay-filter);
}

:global(.settings-shell-itab) {
  overflow: hidden;
  border: 1px solid var(--sd-shell-border);
  border-radius: 20px;
  background: var(--sd-shell-surface);
  box-shadow: var(--sd-shadow-window);
  -webkit-backdrop-filter: var(--sd-shell-surface-filter);
  backdrop-filter: var(--sd-shell-surface-filter);
}

:global(.settings-shell-itab > .sd-window-bar) {
  border-bottom-color: var(--sd-shell-border);
  background: var(--sd-shell-surface-muted);
}

:global(.settings-shell-itab > .sd-window-bar .sd-window-traffic) {
  display: none;
}

:global(.settings-shell-itab .sd-window-title) {
  color: var(--sd-shell-text-primary);
}

:global(.settings-shell-itab .sd-window-subtitle) {
  color: var(--sd-theme-settings-modal-text-01);
}

.settings-shell-window {
  color: var(--sd-color-text-primary);
}

.settings-shell-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 12px;
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
  display: flex;
  height: 5rem;
  flex-direction: column;
  justify-content: flex-start;
  margin-bottom: 0.875rem;
  padding: 0 0.5rem;
  overflow: hidden;
}
.settings-shell-sidebar-eyebrow {
  min-height: 0.875rem;
  color: var(--sd-color-text-tertiary);
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 0.875rem;
  letter-spacing: 0;
  text-transform: uppercase;
  white-space: nowrap;
}
.settings-shell-sidebar-title {
  margin-top: 0.375rem;
  min-height: 1.3rem;
  color: var(--sd-color-text-primary);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.settings-shell-sidebar-summary {
  margin-top: 0.25rem;
  color: var(--sd-color-text-secondary);
  font-size: 0.8125rem;
  line-height: 1.35;
  display: -webkit-box;
  min-height: 2.1875rem;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
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
    linear-gradient(
      180deg,
      var(--sd-theme-settings-modal-surface-01),
      var(--sd-theme-settings-modal-accent-surface-01)
    ),
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
  justify-content: flex-start;
  gap: 0.75rem;
  padding: 0.875rem;
}
.settings-preview-surface-header {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}
.settings-preview-pill {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  border: 1px solid var(--sd-theme-settings-modal-border-01);
  border-radius: 999px;
  background: var(--sd-theme-settings-modal-surface-02);
  padding: 0.3125rem 0.625rem;
  color: var(--sd-theme-settings-modal-text-02);
  font-size: 0.6875rem;
  font-weight: 700;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.settings-preview-source-top {
  display: grid;
  gap: 0.5rem;
  align-self: stretch;
  justify-items: center;
}
.settings-preview-source-top.has-time.has-search {
  gap: 0.375rem;
}
.settings-preview-clock {
  display: grid;
  justify-items: center;
  gap: 0.0625rem;
  color: var(--sd-theme-settings-modal-text-03);
  text-align: center;
  text-shadow: 0 2px 10px var(--sd-theme-settings-modal-shadow-01);
}
.settings-preview-clock strong {
  font-size: clamp(1.875rem, 8vw, 2.625rem);
  font-weight: 800;
  line-height: 0.95;
}
.settings-preview-clock span {
  max-width: 100%;
  overflow: hidden;
  color: var(--sd-theme-settings-modal-text-04);
  font-size: 0.625rem;
  font-weight: 700;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.settings-preview-search {
  display: flex;
  width: min(100%, 13.5rem);
  min-height: 2rem;
  align-items: center;
  gap: 0.4375rem;
  border: 1px solid var(--sd-theme-settings-modal-border-02);
  border-radius: 999px;
  background: var(--sd-theme-settings-modal-surface-03);
  padding: 0.25rem 0.375rem 0.25rem 0.625rem;
  color: var(--sd-theme-settings-modal-accent-text-01);
  box-shadow: 0 0.75rem 1.875rem var(--sd-theme-settings-modal-shadow-02);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.settings-preview-search-icon {
  position: relative;
  flex: 0 0 auto;
  width: 0.6875rem;
  height: 0.6875rem;
  border: 2px solid var(--sd-theme-settings-modal-accent-border-01);
  border-radius: 999px;
}
.settings-preview-search-icon::after {
  position: absolute;
  right: -0.3125rem;
  bottom: -0.25rem;
  width: 0.375rem;
  height: 0.125rem;
  border-radius: 999px;
  background: var(--sd-theme-settings-modal-accent-surface-02);
  content: "";
  transform: rotate(45deg);
  transform-origin: left center;
}
.settings-preview-search-placeholder {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.settings-preview-search em {
  flex: 0 0 auto;
  max-width: 4.5rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--sd-theme-settings-modal-accent-surface-03);
  padding: 0.25rem 0.4375rem;
  color: var(--sd-theme-settings-modal-accent-text-02);
  font-size: 0.625rem;
  font-style: normal;
  font-weight: 800;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.settings-preview-title {
  max-width: min(100%, 14rem);
  overflow: hidden;
  color: var(--sd-theme-settings-modal-text-03);
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
  text-shadow: 0 2px 8px var(--sd-theme-settings-modal-shadow-03);
  text-overflow: ellipsis;
  white-space: nowrap;
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

.settings-shell-sidebar {
  background: color-mix(
    in srgb,
    var(--sd-shell-surface-muted) 42%,
    transparent
  );
  border-right-color: var(--sd-shell-border);
}

.settings-shell-sidebar-eyebrow,
.settings-shell-sidebar-summary {
  color: var(--sd-shell-text-secondary);
}

.settings-shell-sidebar-title {
  color: var(--sd-shell-text-primary);
}

.settings-shell-content,
.settings-shell-scroll,
.settings-shell-inspector {
  background: transparent;
}

.settings-shell-scroll {
  padding: 0.875rem;
}

.settings-inline-switch {
  border-color: var(--sd-theme-settings-modal-border-03);
  background: var(--sd-theme-settings-modal-surface-04);
}

.settings-inline-switch-title {
  color: var(--sd-theme-settings-modal-text-05);
}

.settings-inline-switch-summary,
.settings-layout-group-summary {
  color: var(--sd-theme-settings-modal-text-06);
}

.settings-layout-group-title {
  color: var(--sd-theme-settings-modal-text-05);
}

.settings-system-page {
  display: grid;
  gap: 0.875rem;
  padding: 0.25rem;
}

.settings-system-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  min-height: 7rem;
  border: 1px solid var(--sd-theme-settings-modal-border-03);
  border-radius: 16px;
  background:
    radial-gradient(
      circle at top right,
      var(--sd-theme-settings-modal-accent-surface-04),
      transparent 36%
    ),
    var(--sd-theme-settings-modal-surface-05);
  padding: 1rem;
}

.settings-system-kicker {
  margin: 0;
  color: var(--sd-theme-settings-modal-text-07);
  font-size: 0.6875rem;
  font-weight: 800;
  line-height: 1rem;
  letter-spacing: 0;
  text-transform: uppercase;
}

.settings-system-title {
  margin: 0.1875rem 0;
  color: var(--sd-theme-settings-modal-text-05);
  font-size: 1.45rem;
  font-weight: 800;
  line-height: 1.15;
}

.settings-system-summary,
.settings-system-note {
  color: var(--sd-theme-settings-modal-text-08);
  font-size: 0.8125rem;
  line-height: 1.45;
}

.settings-system-metric {
  display: grid;
  min-width: 8.5rem;
  justify-items: end;
  gap: 0.125rem;
  border: 1px solid var(--sd-theme-settings-modal-border-03);
  border-radius: 14px;
  background: var(--sd-theme-settings-modal-surface-06);
  padding: 0.75rem 0.875rem;
}

.settings-system-metric span,
.settings-system-mode-row span {
  color: var(--sd-theme-settings-modal-text-09);
  font-size: 0.75rem;
  font-weight: 700;
}

.settings-system-metric strong,
.settings-system-mode-row strong {
  max-width: 12rem;
  overflow: hidden;
  color: var(--sd-theme-settings-modal-text-05);
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-system-grid,
.settings-about-grid {
  display: grid;
  gap: 0.875rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.settings-system-card-wide {
  grid-column: 1 / -1;
}

.settings-system-stack {
  display: grid;
  gap: 0.875rem;
}

.settings-system-page :deep(.sd-section-card) {
  border-color: var(--sd-theme-settings-modal-border-03);
  background: var(--sd-theme-settings-modal-surface-07);
  box-shadow: none;
}

.settings-system-page :deep(.sd-section-card-title),
.settings-system-page :deep(.sd-field-label) {
  color: var(--sd-theme-settings-modal-text-05);
}

.settings-system-page :deep(.sd-section-card-description),
.settings-system-page :deep(.sd-field-hint),
.settings-system-page :deep(.sd-switch-hint) {
  color: var(--sd-theme-settings-modal-text-06);
}

.settings-system-page :deep(.sd-input),
.settings-system-page :deep(.sd-select),
.settings-system-page :deep(.sd-textarea) {
  border-color: var(--sd-theme-settings-modal-border-03);
  background: var(--sd-theme-settings-modal-surface-08);
  color: var(--sd-theme-settings-modal-text-05);
}

.settings-system-page :deep(.sd-input::placeholder),
.settings-system-page :deep(.sd-textarea::placeholder) {
  color: var(--sd-theme-settings-modal-text-10);
}

.settings-system-login-card {
  display: grid;
  gap: 0.875rem;
  width: min(26rem, 100%);
  justify-self: center;
  align-self: center;
  border: 1px solid var(--sd-theme-settings-modal-border-03);
  border-radius: 16px;
  background: var(--sd-theme-settings-modal-surface-07);
  padding: 1.25rem;
}

.settings-system-login-card h4 {
  margin: 0;
  color: var(--sd-theme-settings-modal-text-05);
  font-size: 1.25rem;
  font-weight: 800;
}

.settings-system-action-grid {
  display: grid;
  gap: 0.625rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.settings-system-mode-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.settings-system-mode-row > div {
  display: grid;
  min-width: 0;
  gap: 0.1875rem;
}

.settings-system-mode-row small {
  color: var(--sd-theme-settings-modal-text-11);
  font-size: 0.75rem;
  line-height: 1.35;
}

.settings-system-inline-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.625rem;
}

.settings-system-small-input {
  width: 8rem;
}

.settings-system-unit {
  color: var(--sd-theme-settings-modal-text-06);
  font-size: 0.75rem;
  font-weight: 800;
}

.settings-system-inline-form:has(.settings-system-unit) {
  grid-template-columns: minmax(6rem, 8rem) auto auto auto;
}

.settings-system-list {
  display: grid;
  gap: 0.5rem;
  max-height: 12rem;
  overflow-y: auto;
  padding-top: 0.75rem;
}

.settings-system-list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--sd-theme-settings-modal-border-04);
  border-radius: 12px;
  background: var(--sd-theme-settings-modal-surface-05);
  padding: 0.625rem 0.75rem;
}

.settings-system-list-row > div {
  display: grid;
  min-width: 0;
  gap: 0.125rem;
}

.settings-system-list-row strong {
  min-width: 0;
  overflow: hidden;
  color: var(--sd-theme-settings-modal-text-05);
  font-size: 0.875rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-system-list-row strong span,
.settings-system-list-row span,
.settings-system-empty {
  color: var(--sd-theme-settings-modal-text-12);
  font-size: 0.75rem;
  line-height: 1.25;
}

.settings-location-list {
  max-height: 15rem;
}

.settings-location-row.is-selected {
  border-color: var(--sd-theme-settings-modal-accent-border-02);
  background: var(--sd-theme-settings-modal-accent-surface-02);
}

.settings-location-row strong span {
  display: inline-flex;
  margin-left: 0.375rem;
  border-radius: 999px;
  background: var(--sd-theme-settings-modal-surface-06);
  padding: 0.0625rem 0.375rem;
}

.settings-system-empty {
  border: 1px dashed var(--sd-theme-settings-modal-border-05);
  border-radius: 12px;
  padding: 1rem;
  text-align: center;
}

.settings-system-row-actions,
.settings-system-list-row > button {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.375rem;
}

.settings-system-row-actions button,
.settings-system-list-row > button {
  min-height: 1.75rem;
  border: 1px solid var(--sd-theme-settings-modal-border-04);
  border-radius: 9px;
  background: var(--sd-theme-settings-modal-surface-06);
  color: var(--sd-theme-settings-modal-text-13);
  font-size: 0.75rem;
  font-weight: 800;
  padding: 0 0.625rem;
}

.settings-system-row-actions button:hover,
.settings-system-list-row > button:hover {
  border-color: var(--sd-theme-settings-modal-accent-border-02);
  color: var(--sd-theme-settings-modal-text-05);
}

.settings-system-danger-link {
  color: var(--sd-theme-settings-modal-accent-text-03) !important;
}

.settings-system-password-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.625rem;
}

.settings-system-password-input {
  position: relative;
  min-width: 0;
}

.settings-system-password-input .sd-input {
  padding-right: 2.5rem;
}

.settings-system-password-input button {
  position: absolute;
  top: 50%;
  right: 0.5rem;
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--sd-theme-settings-modal-text-06);
  transform: translateY(-50%);
}

.settings-system-password-input button:hover {
  background: var(--sd-theme-settings-modal-surface-06);
  color: var(--sd-theme-settings-modal-text-05);
}

.settings-system-password-input svg {
  width: 1.125rem;
  height: 1.125rem;
}

.settings-system-divider {
  height: 1px;
  background: var(--sd-theme-settings-modal-surface-08);
}

.settings-about-hero {
  min-height: 8.25rem;
}

.settings-about-feature-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.settings-about-feature-grid div {
  display: grid;
  gap: 0.25rem;
  border: 1px solid var(--sd-theme-settings-modal-border-04);
  border-radius: 12px;
  background: var(--sd-theme-settings-modal-surface-09);
  padding: 0.75rem;
}

.settings-about-feature-grid strong {
  color: var(--sd-theme-settings-modal-text-05);
  font-size: 0.8125rem;
  font-weight: 800;
}

.settings-about-feature-grid span {
  color: var(--sd-theme-settings-modal-text-14);
  font-size: 0.75rem;
  line-height: 1.35;
}

.settings-about-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.875rem;
}

.settings-about-chip-row span {
  display: inline-flex;
  min-height: 1.75rem;
  align-items: center;
  border: 1px solid var(--sd-theme-settings-modal-border-03);
  border-radius: 999px;
  background: var(--sd-theme-settings-modal-surface-06);
  color: var(--sd-theme-settings-modal-text-15);
  font-size: 0.75rem;
  font-weight: 800;
  padding: 0 0.625rem;
}

.settings-system-page :deep(.sd-status-banner) {
  border-color: var(--sd-theme-settings-modal-border-03);
  background: var(--sd-theme-settings-modal-surface-07);
}

.settings-top-switch-grid {
  display: grid;
  gap: 0.75rem;
}

.settings-search-engine-panel {
  display: grid;
  gap: 0.75rem;
}

.settings-search-engine-summary {
  display: grid;
  grid-template-columns: minmax(10rem, 0.85fr) minmax(12rem, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid var(--sd-color-border-subtle);
  border-radius: 14px;
  background: color-mix(
    in srgb,
    var(--sd-color-surface-muted) 58%,
    transparent
  );
  padding: 0.625rem;
}

.settings-search-engine-current {
  display: grid;
  min-width: 0;
  gap: 0.125rem;
}

.settings-search-engine-current span,
.settings-search-engine-default span,
.settings-search-engine-table-head {
  color: var(--sd-color-text-tertiary);
  font-size: 0.6875rem;
  font-weight: 800;
  line-height: 1;
}

.settings-search-engine-current strong {
  min-width: 0;
  overflow: hidden;
  color: var(--sd-color-text-primary);
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-search-engine-current small {
  color: var(--sd-color-text-secondary);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.15;
}

.settings-search-engine-default {
  display: grid;
  min-width: 0;
  gap: 0.375rem;
}

.settings-search-engine-global-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

.settings-search-engine-global-actions .settings-inline-switch {
  min-height: 2.5rem;
  padding: 0.5rem 0.625rem;
  border-radius: 12px;
}

.settings-search-engine-table {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--sd-color-border-subtle);
  border-radius: 14px;
  background: color-mix(in srgb, var(--sd-color-surface) 72%, transparent);
}

.settings-search-engine-table-head,
.settings-search-engine-row {
  display: grid;
  grid-template-columns: minmax(8rem, 0.68fr) minmax(14rem, 1.4fr) auto;
  align-items: center;
  gap: 0.625rem;
}

.settings-search-engine-table-head {
  padding: 0.625rem 0.75rem;
  background: color-mix(
    in srgb,
    var(--sd-color-surface-muted) 66%,
    transparent
  );
}

.settings-search-engine-row {
  padding: 0.625rem 0.75rem;
  border-top: 1px solid var(--sd-color-border-subtle);
}

.settings-search-engine-name-cell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  min-width: 0;
  gap: 0.5rem;
}

.settings-search-engine-badges {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
}

.settings-search-engine-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.125rem 0.4375rem;
  background: color-mix(
    in srgb,
    var(--sd-color-surface-floating) 74%,
    transparent
  );
  color: var(--sd-color-text-tertiary);
  font-size: 0.6875rem;
  font-weight: 800;
}

.settings-search-engine-badge.is-default {
  background: color-mix(
    in srgb,
    var(--sd-color-accent-primary) 14%,
    transparent
  );
  color: var(--sd-color-accent-primary);
}

.settings-search-engine-url-input {
  min-width: 0;
}

.settings-search-engine-actions {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  gap: 0.375rem;
}

.settings-search-icon-button,
.settings-search-engine-actions button,
.settings-search-add-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  border: 1px solid var(--sd-color-border-subtle);
  border-radius: 10px;
  background: var(--sd-color-surface);
  color: var(--sd-color-text-secondary);
  font-size: 0.8125rem;
  font-weight: 800;
  white-space: nowrap;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    color 160ms ease;
}

.settings-search-icon-button,
.settings-search-engine-actions button {
  width: 2rem;
  height: 2rem;
}

.settings-search-engine-add {
  display: grid;
  grid-template-columns: minmax(8rem, 0.68fr) minmax(14rem, 1.4fr) auto;
  gap: 0.625rem;
}

.settings-search-add-button {
  height: 2.5rem;
  min-width: 6.75rem;
  padding: 0 0.875rem;
}

.settings-search-icon-button:hover:not(:disabled),
.settings-search-engine-actions button:hover:not(:disabled),
.settings-search-add-button:hover:not(:disabled) {
  border-color: var(--sd-color-border-accent);
  background: var(--sd-color-surface-muted);
  color: var(--sd-color-text-primary);
}

.settings-search-icon-button:disabled,
.settings-search-engine-actions button:disabled,
.settings-search-add-button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
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
    height: 3.25rem;
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

  .settings-system-hero,
  .settings-system-mode-row,
  .settings-system-password-row {
    align-items: stretch;
    flex-direction: column;
  }

  .settings-system-grid,
  .settings-about-grid,
  .settings-about-feature-grid,
  .settings-system-action-grid,
  .settings-system-inline-form,
  .settings-system-inline-form:has(.settings-system-unit) {
    grid-template-columns: minmax(0, 1fr);
  }

  .settings-system-metric {
    width: 100%;
    justify-items: start;
  }

  .settings-system-list-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .settings-system-row-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .settings-search-engine-summary,
  .settings-search-engine-name-cell,
  .settings-search-engine-row,
  .settings-search-engine-add {
    grid-template-columns: minmax(0, 1fr);
  }

  .settings-search-engine-table-head {
    display: none;
  }

  .settings-search-engine-global-actions,
  .settings-search-engine-badges,
  .settings-search-engine-actions {
    justify-content: flex-start;
  }

  .settings-search-add-button {
    width: 100%;
  }
}

@media (min-width: 768px) {
  .settings-search-engine-field {
    grid-template-columns: minmax(0, 1fr);
  }

  .settings-search-engine-field :deep(.sd-field-copy) {
    max-width: 32rem;
  }

  .settings-layout-pair-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
