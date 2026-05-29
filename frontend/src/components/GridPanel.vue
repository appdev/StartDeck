<script setup lang="ts">
import {
  ref,
  onMounted,
  onUnmounted,
  computed,
  watch,
  nextTick,
  toRef,
  defineAsyncComponent,
  type Component,
  type AsyncComponentLoader,
} from "vue";
import { VueDraggable } from "vue-draggable-plus";
import { GridStack } from "gridstack";
import type {
  GridItemHTMLElement,
  GridStackNode,
  GridStackOptions,
  GridStackWidget,
} from "gridstack";
import { useStorage, useWindowSize, useIntervalFn } from "@vueuse/core";
import { SolarDay } from "tyme4ts";
import { useMainStore } from "../stores/main";
import { canReadResource } from "@/utils/permissions";
import { useWallpaperRotation } from "../composables/useWallpaperRotation";
import { useDevice } from "../composables/useDevice";
import { useLoginRequiredToast } from "@/composables/useRequireLogin";
import { resolveWidgetDisplaySize } from "@/composables/useWidgetDisplaySize";
import {
  generateLayout,
  resolveResizeLayout,
  type GridLayoutItem,
} from "../utils/gridLayout";
import type { NavItem, SearchEngine, WidgetConfig, NavGroup } from "@/types";
import ConfirmDialog from "@/components/base/ConfirmDialog.vue";
import ContextMenuSurface from "@/components/base/ContextMenuSurface.vue";
import HomeActionBar from "@/components/home/HomeActionBar.vue";
import HomeTopActions from "@/components/home/HomeTopActions.vue";
import WidgetEditFrame from "@/components/home/WidgetEditFrame.vue";
import { toCatalogWidgetSizeKey } from "@/utils/widgetSizePresets";
import WidgetRuntimeFrame from "@/features/widget-runtime/WidgetRuntimeFrame.vue";
import WidgetRuntimeMenu from "@/features/widget-runtime/WidgetRuntimeMenu.vue";
import WidgetOpenedPanelHost from "@/features/widget-runtime/WidgetOpenedPanelHost.vue";
import {
  applyRuntimeWidgetSize,
  isRuntimeWidget,
  normalizeWidgetRuntimeData,
  resolveWidgetRuntimeSizeKey,
  type WidgetRuntimeData,
} from "@/features/widget-runtime/widgetRuntimeRegistry";
import {
  toRuntimeWidgetSizeKey,
  type RuntimeWidgetSizeKey,
} from "@/features/widget-runtime/widgetRuntimeSizes";
import {
  toItabWidgetSizeKey,
  type ItabWidgetSizeKey,
} from "@/features/itab-widgets/itabSizePresets";
import {
  ITAB_GRID_GAP,
  ITAB_GRID_MAX_COLUMNS,
  ITAB_GRID_PITCH,
  resolveItabGridColumns,
  resolveItabGridContainerWidth,
  resolveItabGridTrackColumns,
  withItabGridData,
} from "@/features/itab-widgets/itabGrid";
import { ITAB_TODO_WIDGET_TYPE } from "@/features/itab-todo/itabTodoTypes";
import {
  ITAB_MEMO_CATALOG_ID,
  ITAB_MEMO_WIDGET_TYPE,
} from "@/features/itab-memo/itabMemoTypes";
import { ITAB_CLOCK_WIDGET_TYPE } from "@/features/itab-clock/itabClockTypes";
import { ITAB_DAILY_ENGLISH_WIDGET_TYPE } from "@/features/itab-daily-english/itabDailyEnglishTypes";
import { ITAB_POEM_WIDGET_TYPE } from "@/features/itab-poem/itabPoemTypes";
import { ITAB_POMODORO_WIDGET_TYPE } from "@/features/itab-pomodoro/itabPomodoroTypes";
import {
  ITAB_ANNIVERSARY_CATALOG_ID,
  ITAB_ANNIVERSARY_WIDGET_TYPE,
} from "@/features/itab-anniversary/itabAnniversaryTypes";
import { ITAB_WALLPAPER_WIDGET_TYPE } from "@/features/itab-wallpaper/itabWallpaperTypes";
import { ITAB_MOVIE_CALENDAR_WIDGET_TYPE } from "@/features/itab-movie-calendar/itabMovieCalendarTypes";
import { ITAB_CALENDAR_WIDGET_TYPE } from "@/features/itab-calendar/itabCalendarTypes";
import { ITAB_IP_WIDGET_TYPE } from "@/features/itab-ip/itabIpTypes";
import { useItabIpRuntime } from "@/features/itab-ip/useItabIpRuntime";
import { ITAB_FOOD_PICKER_WIDGET_TYPE } from "@/features/itab-food-picker/itabFoodPickerTypes";
import { ITAB_NUMBER_UPPERCASE_WIDGET_TYPE } from "@/features/itab-number-uppercase/itabNumberUppercaseTypes";
import { createDefaultItabAnniversaryWidget } from "@/features/itab-anniversary/itabAnniversaryModel";
import {
  AI_USAGE_CATALOG_ID,
  AI_USAGE_WIDGET_TYPE,
} from "@/features/ai-usage/aiUsageTypes";
import { createDefaultAiUsageWidget } from "@/features/ai-usage/aiUsageModel";
import {
  TAPD_DEFECTS_CATALOG_ID,
  TAPD_DEFECTS_WIDGET_TYPE,
} from "@/features/tapd-defects/tapdDefectTypes";
import { createDefaultTapdDefectWidget } from "@/features/tapd-defects/tapdDefectModel";
import ItabMemoFixedLayer from "@/features/itab-memo/ItabMemoFixedLayer.vue";
import { useUiFeedbackStore } from "@/stores/uiFeedback";
import {
  isInternalNetwork,
  getNetworkConfig,
  computeEffectiveNetworkMode,
} from "@/utils/network";
import { resolveIconBackground } from "@/utils/iconAppearance";
import {
  buildSearchEngineUrl,
  normalizeDefaultSearchEngine,
  normalizeSearchEngines,
} from "@/utils/searchEngines";
import {
  createWidgetFromCatalog,
  findExistingCatalogWidget,
  getWidgetCatalogAction,
  getWidgetCatalogItem,
} from "@/utils/widgetCatalog";
import { blurActiveElementMatching } from "@/utils/focus";
import {
  DEFAULT_GROUP_GAP,
  DEFAULT_NAV_CARD_SIZE,
  DEFAULT_NAV_GRID_GAP,
  DEFAULT_NAV_ICON_SIZE,
  DEFAULT_WIDGET_AREA_COLS,
} from "@/utils/layoutDefaults";
import type {
  AddComponentPayload,
  AddComponentResult,
} from "@/utils/addComponentTypes";
import { cacheNavItemIconToLocal } from "@/utils/navItemAdapter";
import { isDuplicateSiteShortcut } from "@/utils/siteShortcutCatalog";
import DOMPurify from "dompurify";
const uiFeedback = useUiFeedbackStore();
const { notifyLoginRequired } = useLoginRequiredToast();
const CHUNK_RELOAD_KEY = "startdeck:chunk-reload-at";
const loadAsync = <T extends Component>(loader: AsyncComponentLoader<T>) =>
  defineAsyncComponent({
    loader,
    onError(error, retry, fail, attempts) {
      const msg = error instanceof Error ? error.message : String(error ?? "");
      const chunkFailed =
        /Failed to fetch dynamically imported module/i.test(msg) ||
        /Importing a module script failed/i.test(msg) ||
        /ChunkLoadError/i.test(msg) ||
        /Loading chunk [\w-]+ failed/i.test(msg);
      if (chunkFailed && typeof window !== "undefined") {
        const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || "0");
        const now = Date.now();
        if (!Number.isFinite(last) || now - last > 30000) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
          const url = new URL(window.location.href);
          url.searchParams.set("_r", String(now));
          window.location.replace(url.toString());
          return;
        }
      }
      if (attempts <= 1) {
        retry();
      } else {
        fail();
      }
    },
  });
const EditModal = loadAsync(() => import("./EditModal.vue"));
const SettingsModal = loadAsync(() => import("./SettingsModal.vue"));
const GroupSettingsModal = loadAsync(() => import("./GroupSettingsModal.vue"));
const AddWidgetModal = loadAsync(() => import("./AddWidgetModal.vue"));
/** 同步导入，避免生产/Docker 下动态 chunk 请求失败导致登录框无法弹出。 */
import LoginModal from "./LoginModal.vue";
const IconShape = loadAsync(() => import("./IconShape.vue"));

const store = useMainStore();
const requireStoreLogin = (message?: string) => {
  if (store.isLogged) return true;
  return notifyLoginRequired(message);
};
useWallpaperRotation();
const { deviceKey, isMobile } = useDevice(toRef(store.appConfig, "deviceMode"));
const { width } = useWindowSize();
const isHeaderRowLayout = computed(() => width.value >= 1280);
const gridWidgetTypes = new Set([
  ITAB_CLOCK_WIDGET_TYPE,
  "itab-weather-00",
  ITAB_TODO_WIDGET_TYPE,
  ITAB_MEMO_WIDGET_TYPE,
  ITAB_POEM_WIDGET_TYPE,
  ITAB_DAILY_ENGLISH_WIDGET_TYPE,
  ITAB_POMODORO_WIDGET_TYPE,
  ITAB_ANNIVERSARY_WIDGET_TYPE,
  ITAB_WALLPAPER_WIDGET_TYPE,
  ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
  ITAB_CALENDAR_WIDGET_TYPE,
  ITAB_IP_WIDGET_TYPE,
  ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
  ITAB_FOOD_PICKER_WIDGET_TYPE,
  AI_USAGE_WIDGET_TYPE,
  TAPD_DEFECTS_WIDGET_TYPE,
  "docker",
  "system-status",
  "custom-css",
]);

const currentHour = ref(new Date().getHours());
let daylightTimer: ReturnType<typeof setInterval> | null = null;
const updateHour = () => {
  currentHour.value = new Date().getHours();
};
const isNightTime = computed(
  () => currentHour.value >= 18 || currentHour.value < 6,
);
const effectiveBackgroundMask = computed(() => {
  const base = store.appConfig.backgroundMask ?? 0;
  const daylightMask = store.appConfig.daylightMask ?? 0.5;
  if (store.appConfig.daylightModeEnabled && isNightTime.value)
    return daylightMask;
  return base;
});
const effectiveMobileBackgroundMask = computed(() => {
  const base = store.appConfig.mobileBackgroundMask ?? 0;
  const daylightMask = store.appConfig.daylightMask ?? 0.5;
  if (store.appConfig.daylightModeEnabled && isNightTime.value)
    return daylightMask;
  return base;
});

const empireBackgroundUrl = `data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4af37' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E`;

const showEditModal = ref(false);
const showSettingsModal = ref(false);
const showGroupSettingsModal = ref(false);
const showAddWidgetModal = ref(false);

const showLoginModal = ref(false);
const isEditMode = ref(false);
const isHomeEditChromeVisible = computed(
  () => isEditMode.value && !showAddWidgetModal.value,
);
const HOME_WIDGET_OPEN_SUPPRESS_MS = 350;
const homeWidgetDragIgnoreFrom = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "[contenteditable=true]",
  "[data-grid-drag-ignore]",
  ".widget-resize-grip",
  ".widget-size-strip",
  "[data-itab-inner-control]",
  "[data-context-menu]",
  "[data-grid-context-menu]",
  "[data-runtime-context-menu]",
  ".sd-modal-surface",
  ".sd-context-menu-surface",
].join(",");
const isHomeWidgetDragging = ref(false);
const suppressWidgetOpenUntil = ref(0);
let homeWidgetDragIdleTimer: number | null = null;
let homeWidgetDragTrackingCleanupTimer: number | null = null;
let homeWidgetDragStartLayout: Map<
  string,
  Pick<GridLayoutItem, "x" | "y" | "w" | "h">
> | null = null;

const shouldSuppressHomeWidgetOpen = () =>
  isHomeWidgetDragging.value || Date.now() < suppressWidgetOpenUntil.value;

const clearHomeWidgetDragIdleTimer = () => {
  if (homeWidgetDragIdleTimer === null) return;
  window.clearTimeout(homeWidgetDragIdleTimer);
  homeWidgetDragIdleTimer = null;
};

const clearHomeWidgetDragTrackingCleanupTimer = () => {
  if (homeWidgetDragTrackingCleanupTimer === null) return;
  window.clearTimeout(homeWidgetDragTrackingCleanupTimer);
  homeWidgetDragTrackingCleanupTimer = null;
};

const resetHomeWidgetDragTracking = () => {
  clearHomeWidgetDragTrackingCleanupTimer();
  homeWidgetDragStartLayout = null;
};

const scheduleHomeWidgetDragTrackingCleanup = () => {
  clearHomeWidgetDragTrackingCleanupTimer();
  homeWidgetDragTrackingCleanupTimer = window.setTimeout(() => {
    resetHomeWidgetDragTracking();
  }, HOME_WIDGET_OPEN_SUPPRESS_MS + 100);
};

const captureHomeWidgetDragStartLayout = () => {
  if (homeWidgetDragStartLayout) return;
  homeWidgetDragStartLayout = new Map(
    layoutData.value.map((item) => [
      item.i,
      { x: item.x, y: item.y, w: item.w, h: item.h },
    ]),
  );
};

const hasHomeWidgetDragLayoutChanged = (nextLayout: GridLayoutItem[]) => {
  if (!homeWidgetDragStartLayout) return false;
  if (homeWidgetDragStartLayout.size !== nextLayout.length) return true;
  return nextLayout.some((item) => {
    const origin = homeWidgetDragStartLayout?.get(item.i);
    if (!origin) return true;
    return (
      origin.x !== item.x ||
      origin.y !== item.y ||
      origin.w !== item.w ||
      origin.h !== item.h
    );
  });
};

const saveHomeWidgetDragLayout = () => {
  if (!store.isLogged) return;
  void store.saveData(true).catch((error) => {
    console.error("Failed to save home widget drag layout", error);
  });
};

const finishHomeWidgetDrag = () => {
  clearHomeWidgetDragIdleTimer();
  scheduleHomeWidgetDragTrackingCleanup();
  if (!isHomeWidgetDragging.value) return;
  isHomeWidgetDragging.value = false;
  suppressWidgetOpenUntil.value = Date.now() + HOME_WIDGET_OPEN_SUPPRESS_MS;
};

const beginHomeWidgetDrag = () => {
  if (!store.isLogged) return;
  const isNewDrag = !isHomeWidgetDragging.value;
  closeContextMenu();
  closeBlankContextMenu();
  closeRuntimeContextMenu();
  if (isNewDrag) {
    resetHomeWidgetDragTracking();
    captureHomeWidgetDragStartLayout();
  }
  isHomeWidgetDragging.value = true;
  clearHomeWidgetDragIdleTimer();
  homeWidgetDragIdleTimer = window.setTimeout(() => {
    finishHomeWidgetDrag();
  }, HOME_WIDGET_OPEN_SUPPRESS_MS + 500);
};
const enterEditMode = () => {
  store.layoutEditInProgress = true;
  isEditMode.value = true;
};

const leaveEditMode = async () => {
  isEditMode.value = false;
  try {
    await store.saveData(true);
  } finally {
    store.layoutEditInProgress = false;
  }
};

/** 切换编辑模式；进入编辑时设 layoutEditInProgress，退出时 await 保存后再清空，避免外网竞态导致布局被覆盖 */
const toggleEditMode = async () => {
  if (!requireStoreLogin("请先登录后再编辑首页。")) {
    isEditMode.value = false;
    store.layoutEditInProgress = false;
    return;
  }
  if (isEditMode.value) {
    await leaveEditMode();
  } else {
    enterEditMode();
  }
};

const isEditableKeyboardTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
};

const hasActiveOverlayMotion = () =>
  document.querySelector("[data-overlay-motion-id]") !== null;

const onGlobalHomeKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Escape" || !isEditMode.value) return;
  if (hasActiveOverlayMotion() || isEditableKeyboardTarget(event.target))
    return;
  event.preventDefault();
  event.stopPropagation();
  void leaveEditMode().catch((error) => {
    console.error("Failed to leave edit mode with Escape", error);
  });
};

const handleHomeActionSave = async () => {
  try {
    const result = await store.saveData(true);
    if (result === "saved") {
      uiFeedback.notify({
        title: "已保存",
        message: "首页布局和配置已保存。",
        tone: "success",
      });
      return;
    }
    if (result === "no_change") {
      uiFeedback.notify({
        title: "无需保存",
        message: "当前没有新的修改。",
        tone: "info",
      });
      return;
    }
    if (result === "queued") {
      uiFeedback.notify({
        title: "已加入离线队列",
        message: "网络恢复后会继续同步。",
        tone: "warning",
      });
      return;
    }
    if (result === "conflict" || result === "unauthorized") {
      void uiFeedback.alert({
        title: "保存失败",
        message:
          result === "conflict"
            ? "数据版本发生冲突，请刷新后再试。"
            : "登录状态已失效，请重新登录。",
        tone: "danger",
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    void uiFeedback.alert({
      title: "保存失败",
      message,
      tone: "danger",
    });
  }
};

const selectedWidgetId = ref<string | null>(null);
const currentEditItem = ref<NavItem | null>(null);
const currentGroupId = ref<string>("");

const isGridAlive = ref(true);

watch(showGroupSettingsModal, (val) => {
  if (val && !store.isLogged) {
    notifyLoginRequired("请先登录后再修改分组设置。");
    showGroupSettingsModal.value = false;
    isEditMode.value = false;
    store.layoutEditInProgress = false;
    return;
  }
  const wasEditing = isEditMode.value;
  isEditMode.value = val;
  if (val) {
    store.layoutEditInProgress = true;
  } else if (wasEditing) {
    store.markDirty();
    store.layoutEditInProgress = false;
  }
});
const isLanMode = ref(false);
const latency = ref(0);
const isChecking = ref(false);
const ipRuntime = useItabIpRuntime();
const networkConfig = computed(() =>
  getNetworkConfig(store.appConfig, store.forceNetworkMode),
);
const forceMode = computed({
  get: () => store.forceNetworkMode,
  set: (val) => {
    store.forceNetworkMode = val;
  },
});
const latencyThresholdMs = computed(
  () => networkConfig.value.latencyThresholdMs,
);
const currentNetworkLocation = computed(() => ipRuntime.result.value);
const resolveEffectiveNetworkMode = (measuredLatencyMs = latency.value) => {
  const cfg = networkConfig.value;
  return computeEffectiveNetworkMode(
    window.location.hostname,
    "",
    "",
    measuredLatencyMs,
    {
      currentLocation: currentNetworkLocation.value,
      internalDomains: cfg.internalDomains,
      internalLocation: cfg.internalLocation,
      networkRules: cfg.networkRules,
      whitelistLatencyMode: cfg.whitelistLatencyMode,
      forceNetworkMode: cfg.forceNetworkMode,
      latencyThresholdMs: cfg.latencyThresholdMs,
    },
  );
};

const effectiveIsLan = computed(() => {
  if (!store.isLanModeInited) return false;
  return resolveEffectiveNetworkMode().isLan;
});
const homeStatusLabel = computed(() => {
  if (isEditMode.value) return "编辑模式";
  return "";
});

watch(
  [isLanMode, latency, effectiveIsLan],
  ([lan, nextLatency, effective]) => {
    store.isLanMode = lan;
    store.networkLatency = nextLatency;
    store.effectiveIsLan = effective;
  },
  { immediate: true },
);

const toggleForceMode = () => {
  if (forceMode.value === "auto") forceMode.value = "lan";
  else if (forceMode.value === "lan") forceMode.value = "wan";
  else forceMode.value = "auto";
};

const homeTopNow = ref(new Date());
const homeSearchText = ref("");
const homeSearchInputRef = ref<HTMLInputElement | null>(null);
const storedHomeSearchEngine = useStorage("start-deck-engine", "so");
const sessionHomeSearchEngine = ref<string | null>(null);
let homeTopClockTimer: ReturnType<typeof setInterval> | null = null;

const weekNames = ["日", "一", "二", "三", "四", "五", "六"];
const padClock = (value: number) => String(value).padStart(2, "0");

const showHomeTopTime = computed(() => store.appConfig.showHomeTime !== false);
const showHomeTopSearch = computed(
  () => store.appConfig.showHomeSearch !== false,
);
const homeSearchEngines = computed(() =>
  normalizeSearchEngines(store.appConfig.searchEngines),
);
const homeSearchEngineKey = computed({
  get: () => {
    const configured = store.appConfig.rememberLastEngine
      ? storedHomeSearchEngine.value
      : store.appConfig.defaultSearchEngine;
    return normalizeDefaultSearchEngine(
      sessionHomeSearchEngine.value || configured,
      homeSearchEngines.value,
    );
  },
  set: (value: string) => {
    sessionHomeSearchEngine.value = value;
    if (store.appConfig.rememberLastEngine !== false) {
      storedHomeSearchEngine.value = value;
    }
  },
});
const activeHomeSearchEngine = computed<SearchEngine | undefined>(() =>
  homeSearchEngines.value.find(
    (engine) => engine.key === homeSearchEngineKey.value,
  ),
);
const homeTopHourText = computed(() => padClock(homeTopNow.value.getHours()));
const homeTopMinuteText = computed(() =>
  padClock(homeTopNow.value.getMinutes()),
);
const homeTopDateText = computed(() => {
  const value = homeTopNow.value;
  const month = value.getMonth() + 1;
  const day = value.getDate();
  const weekday = weekNames[value.getDay()] || "";
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

const refreshHomeTopTime = () => {
  homeTopNow.value = new Date();
};

const selectHomeSearchEngine = (key: string) => {
  homeSearchEngineKey.value = key;
  nextTick(() => homeSearchInputRef.value?.focus());
};

const submitHomeSearch = () => {
  const query = homeSearchText.value.trim();
  if (!query) {
    homeSearchInputRef.value?.focus();
    return;
  }
  window.open(
    buildSearchEngineUrl(activeHomeSearchEngine.value, query),
    "_blank",
    "noopener",
  );
  homeSearchText.value = "";
};

const openHomeSearchSettings = () => {
  showSettingsModal.value = true;
};

// --- 核心修复逻辑开始 ---
// 用于清洗 SVG 代码中的无效颜色类名，强制转为白色
const processIcon = (iconStr: string) => {
  if (!iconStr) return "";
  if (!iconStr.trim().startsWith("<svg")) return iconStr;
  let fixed = iconStr;
  const badColorRegex = /fill-[a-z]+-(50|100|200)/g;
  if (badColorRegex.test(fixed)) {
    fixed = fixed.replace(
      /class="([^"]*)\bfill-[a-z]+-(50|100|200)\b([^"]*)"/g,
      'class="$1 $3" style="fill: var(--sd-component-on-strong);"',
    );
  }
  return fixed;
};
// --- 核心修复逻辑结束 ---

type IconBackgroundInput = Parameters<typeof resolveIconBackground>[0];

const getIconBackground = (item: IconBackgroundInput, shape?: string) =>
  resolveIconBackground(item, {
    fallback: "bg-gray-100",
    shape,
  }).color;

// --- Wallpaper Preload Logic ---
const isPcBgLoaded = ref(false);
const isMobileBgLoaded = ref(false);

const pcBgUrl = computed(() =>
  store.appConfig.background
    ? store.getAssetUrl(store.appConfig.background)
    : "",
);
const mobileBgUrl = computed(() =>
  store.appConfig.mobileBackground
    ? store.getAssetUrl(store.appConfig.mobileBackground)
    : "",
);

watch(
  pcBgUrl,
  (url) => {
    if (!url) {
      isPcBgLoaded.value = false;
      return;
    }
    const img = new Image();
    img.src = url;
    if (img.complete) {
      isPcBgLoaded.value = true;
    } else {
      isPcBgLoaded.value = false;
      img.onload = () => {
        isPcBgLoaded.value = true;
      };
      img.onerror = () => {
        isPcBgLoaded.value = true;
      };
    }
  },
  { immediate: true },
);

watch(
  mobileBgUrl,
  (url) => {
    if (!url) {
      isMobileBgLoaded.value = false;
      return;
    }
    const img = new Image();
    img.src = url;
    if (img.complete) {
      isMobileBgLoaded.value = true;
    } else {
      isMobileBgLoaded.value = false;
      img.onload = () => {
        isMobileBgLoaded.value = true;
      };
      img.onerror = () => {
        isMobileBgLoaded.value = true;
      };
    }
  },
  { immediate: true },
);
// ------------------------------

const layoutData = ref<GridLayoutItem[]>([]);
let skipNextLayoutSave = false;
let isInternalUpdate = false;
const checkVisible = (obj?: WidgetConfig | NavItem) => {
  if (!obj) return false;
  if ("enable" in obj && !obj.enable) return false;
  if ("hideOnMobile" in obj && obj.hideOnMobile && isMobile.value) return false;
  return canReadResource(obj, store.isLogged);
};
const isGridWidget = (widget: WidgetConfig) => gridWidgetTypes.has(widget.type);
const isMainShellManagedWidget = (widget: WidgetConfig) =>
  isRuntimeWidget(widget);
const widgetFrameSize = (widget: WidgetConfig) =>
  isRuntimeWidget(widget)
    ? resolveWidgetRuntimeSizeKey(widget) ||
      resolveWidgetDisplaySize(widget).sizeKey
    : toCatalogWidgetSizeKey(widget.type, {
        colSpan: widget.w ?? widget.colSpan ?? 1,
        rowSpan: widget.h ?? widget.rowSpan ?? 1,
      }) || resolveWidgetDisplaySize(widget).sizeKey;
const widgetFrameMetadataSize = (widget: WidgetConfig) =>
  isMainShellManagedWidget(widget) ? "" : widgetFrameSize(widget);
const desktopWidgetAreaCols = computed(() => {
  const clamped = DEFAULT_WIDGET_AREA_COLS;
  if (store.isExpandedMode) return Math.min(16, Math.max(8, clamped));
  return clamped;
});
const isWideLayout = computed(
  () => deviceKey.value === "desktop" && desktopWidgetAreaCols.value > 4,
);
const mainContentMaxWidthPx = computed(() => {
  if (deviceKey.value !== "desktop") {
    return Math.max(
      resolveItabGridContainerWidth(1),
      Math.round(width.value - 32),
    );
  }
  const base = 1280;
  const maxAllowed = Math.round(width.value * 0.89);
  if (!Number.isFinite(maxAllowed) || maxAllowed <= 0) return base;

  if (desktopWidgetAreaCols.value <= 4) {
    return Math.min(base, maxAllowed);
  }

  const baseColWidth = base / 4;
  const required = Math.round(baseColWidth * desktopWidgetAreaCols.value);
  const target = Math.min(required, maxAllowed);
  return Math.max(0, target);
});
const mainContentMaxWidth = computed(() => `${mainContentMaxWidthPx.value}px`);
const showHomeTitle = computed(() => store.appConfig.showHomeTitle !== false);
const headerTitleText = computed(() => store.appConfig.customTitle || "");
const headerTitleMaxWidth = computed(() => {
  if (!isHeaderRowLayout.value) {
    const available = Math.max(160, width.value - 64);
    return Math.min(448, available);
  }

  const base = 1280;
  const contentWidth =
    desktopWidgetAreaCols.value <= 4
      ? Math.min(base, Math.round(width.value * 0.89))
      : Math.min(
          Math.round((base / 4) * desktopWidgetAreaCols.value),
          Math.round(width.value * 0.89),
        );
  const searchWidth = isWideLayout.value ? 576 : 448;
  const sideControlsReserve = 188;
  const sideSlot = (contentWidth - searchWidth) / 2 - sideControlsReserve;
  return Math.max(144, Math.min(360, Math.floor(sideSlot)));
});
const headerTitleFontSize = computed(() => {
  const configured = Math.max(
    20,
    Math.min(80, store.appConfig.titleSize || 48),
  );
  const maxByLayout = isMobile.value ? 30 : isHeaderRowLayout.value ? 38 : 40;
  const textLength = Math.max(
    1,
    Array.from(headerTitleText.value.trim() || "StartDeck").length,
  );
  const fitByWidth = Math.floor(
    (headerTitleMaxWidth.value / textLength) * 1.62,
  );
  return Math.max(20, Math.min(configured, maxByLayout, fitByWidth));
});
const widgetColNum = computed(() => {
  const resolveColumns =
    deviceKey.value === "desktop"
      ? resolveItabGridTrackColumns
      : resolveItabGridColumns;
  return Math.max(
    4,
    resolveColumns(mainContentMaxWidthPx.value, ITAB_GRID_MAX_COLUMNS),
  );
});
const itabGridLayoutWidth = computed(
  () => widgetColNum.value * ITAB_GRID_PITCH,
);
const widgetAreaContainerWidth = computed(() =>
  deviceKey.value === "desktop"
    ? mainContentMaxWidth.value
    : `${itabGridLayoutWidth.value}px`,
);
const lastDeviceKey = ref(deviceKey.value);
const lastWidgetColNum = ref(widgetColNum.value);
const lastAuthState = ref(store.isLogged);
const resizeStepHeight = computed(() => ITAB_GRID_PITCH);

const compactVertical = (layout: GridLayoutItem[]) => {
  const step = 1;
  const collides = (a: GridLayoutItem, b: GridLayoutItem) =>
    a.i !== b.i &&
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y;

  const canPlace = (item: GridLayoutItem, placed: GridLayoutItem[]) =>
    !placed.some((p) => collides(item, p));

  const sorted = [...layout].sort(
    (a, b) => (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0),
  );
  const placed: GridLayoutItem[] = [];
  const compacted: GridLayoutItem[] = [];

  for (const item of sorted) {
    const originalY = Math.max(0, item.y || 0);
    let next = { ...item, y: originalY };

    // 1. Try to move UP to fill gaps (vertical compaction)
    let found = false;
    // 使用 iTab 单元步进检查，确保布局吸附到固定网格。
    for (let y = 0; y < originalY; y += step) {
      const candidate = { ...next, y };
      if (canPlace(candidate, placed)) {
        next = candidate;
        found = true;
        break;
      }
    }

    // 2. If not moved up, check if originalY is valid. If not, push DOWN.
    if (!found) {
      let y = originalY;
      while (true) {
        const candidate = { ...next, y };
        if (canPlace(candidate, placed)) {
          next = candidate;
          break;
        }
        y += step;
        if (y > 10000) break; // Safety break
      }
    }

    placed.push(next);
    compacted.push(next);
  }

  const byId = new Map(compacted.map((it) => [it.i, it] as const));
  return layout.map((it) => byId.get(it.i) || it);
};

watch(
  () => [
    store.mergedWidgets,
    widgetColNum.value,
    deviceKey.value,
    store.isLogged,
  ],
  () => {
    const nextDeviceKey = deviceKey.value;
    const nextColNum = widgetColNum.value;
    const nextAuthState = store.isLogged;
    const authStateChanged = nextAuthState !== lastAuthState.value;
    const shouldRemount =
      nextDeviceKey !== lastDeviceKey.value ||
      nextColNum !== lastWidgetColNum.value ||
      authStateChanged;
    lastDeviceKey.value = nextDeviceKey;
    lastWidgetColNum.value = nextColNum;
    lastAuthState.value = nextAuthState;

    if (authStateChanged) {
      isEditMode.value = false;
      selectedWidgetId.value = null;
      store.layoutEditInProgress = false;
    }

    if (isInternalUpdate && !authStateChanged) return;

    // 防止编辑时因服务端推送导致的布局回弹 (Rebound)
    // 处于编辑模式(活跃)时，忽略外部更新，以本地拖拽状态为准
    if (isEditMode.value && !authStateChanged) return;

    const visibleWidgets = store.mergedWidgets
      .filter(
        (w) =>
          checkVisible(w) &&
          isGridWidget(w) &&
          !(deviceKey.value === "mobile" && w.hideOnMobile),
      )
      .sort((a, b) => {
        // Sort by visual position (Row-major) to ensure correct reflow order
        const ay = a.y ?? 0;
        const by = b.y ?? 0;
        if (ay !== by) return ay - by;
        return (a.x ?? 0) - (b.x ?? 0);
      });

    const colNum = widgetColNum.value;

    const widgetsToLayout = visibleWidgets.map((w) => {
      const newW: WidgetConfig = { ...w };
      if (deviceKey.value === "mobile") {
        // iTab 网格不读取旧 layouts；移动端重新按当前可见顺序自动排布。
        newW.x = undefined;
        newW.y = undefined;
      }

      // Safety: Ensure widget width does not exceed total columns
      // This is critical when switching from wider to narrower layouts (e.g. desktop -> tablet)
      if ((newW.w || 1) > colNum) newW.w = colNum;

      return newW;
    });

    // 标记为程序化布局更新，避免触发保存循环
    skipNextLayoutSave = true;
    layoutData.value = compactVertical(generateLayout(widgetsToLayout, colNum));

    // 如果 deviceKey 发生变化，强制重新挂载 GridStack 容器
    // 这可以解决从窄屏切换回宽屏时布局错乱的问题，同时避免 :key 导致的死循环
    if (shouldRemount && !isInternalUpdate && !isEditMode.value) {
      destroyGridStack();
      isGridAlive.value = false;
      nextTick(() => {
        isGridAlive.value = true;
        nextTick(() => {
          void initializeGridStack();
        });
      });
    }
  },
  { deep: true, immediate: true },
);

const handleLayoutUpdated = (newLayout: GridLayoutItem[]) => {
  // 如果是程序化更新导致的事件，跳过保存
  if (skipNextLayoutSave) {
    skipNextLayoutSave = false;
    return;
  }

  // 如果布局与当前 store.widgets 相同，跳过保存
  let changed = false;
  for (const l of newLayout) {
    const w = store.widgets.find((sw) => sw.id === l.i);
    const curX = w?.x;
    const curY = w?.y;
    const curW = w?.w ?? w?.colSpan ?? 1;
    const curH = w?.h ?? w?.rowSpan ?? 1;

    const specMismatch =
      !w || curX !== l.x || curY !== l.y || curW !== l.w || curH !== l.h;

    if (specMismatch) {
      changed = true;
      break;
    }
  }
  if (!changed) return;

  isInternalUpdate = true;

  newLayout.forEach((l) => {
    const w = store.widgets.find((sw) => sw.id === l.i);
    if (w) {
      delete w.layouts;
      w.x = l.x;
      w.y = l.y;
      w.w = l.w;
      w.h = l.h;
      w.colSpan = l.w;
      w.rowSpan = l.h;
    }
  });
  store.markDirty();
  nextTick(() => {
    isInternalUpdate = false;
  });
};

const displayGroups = computed(() => {
  // ✨ 性能优化：在编辑模式时，直接返回 store.groups 引用
  // 这样 VueDraggable 就能直接操作 store 中的数组，确保拖拽状态实时同步
  if (isEditMode.value) {
    return store.groups;
  }

  return store.groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => checkVisible(item)),
    }))
    .filter((g) => {
      if (store.isLogged) return true;
      return g.items.length > 0 || !!g.preset;
    });
});
const sanitizedFooterHtml = computed(() => {
  return DOMPurify.sanitize(store.appConfig.footerHtml || "");
});

onUnmounted(() => {
  clearHomeWidgetDragIdleTimer();
  resetHomeWidgetDragTracking();
  destroyGridStack();
});

const gridLayoutRootRef = ref<HTMLElement | null>(null);
const openedRuntimeWidgetId = ref("");
const isHomeWidgetDragEnabled = computed(
  () =>
    store.isLogged &&
    !showAddWidgetModal.value &&
    !showSettingsModal.value &&
    !showGroupSettingsModal.value &&
    !showLoginModal.value &&
    !showEditModal.value &&
    !openedRuntimeWidgetId.value,
);

const gridStackRef = ref<GridStack | null>(null);
const isGridStackReady = ref(false);
let syncingGridStack = false;

const gridStackOptions = (): GridStackOptions => ({
  auto: false,
  column: widgetColNum.value,
  cellHeight: resizeStepHeight.value,
  margin: ITAB_GRID_GAP / 2,
  float: false,
  animate: false,
  disableResize: true,
  disableDrag: !isHomeWidgetDragEnabled.value,
  draggable: {
    handle: ".grid-stack-item-content",
    cancel: homeWidgetDragIgnoreFrom,
    appendTo: "body",
    scroll: true,
  },
});

const toGridStackWidget = (item: GridLayoutItem): GridStackWidget => ({
  id: item.i,
  x: Math.max(0, Math.round(item.x || 0)),
  y: Math.max(0, Math.round(item.y || 0)),
  w: Math.max(1, Math.round(item.w || item.colSpan || 1)),
  h: Math.max(1, Math.round(item.h || item.rowSpan || 1)),
  noResize: true,
});

const getGridStackItemId = (node: GridStackNode | undefined, el: Element) =>
  String(node?.id || el.getAttribute("gs-id") || "");

const readGridStackLayout = () => {
  const grid = gridStackRef.value;
  if (!grid) return layoutData.value;
  const currentById = new Map(layoutData.value.map((item) => [item.i, item]));
  const next = grid.getGridItems().flatMap((el) => {
    const node = el.gridstackNode;
    const id = getGridStackItemId(node, el);
    const base = currentById.get(id);
    if (!id || !base) return [];
    const x = Math.max(0, Math.round(node?.x ?? base.x ?? 0));
    const y = Math.max(0, Math.round(node?.y ?? base.y ?? 0));
    const w = Math.max(1, Math.round(node?.w ?? base.w ?? 1));
    const h = Math.max(1, Math.round(node?.h ?? base.h ?? 1));
    return [{ ...base, x, y, w, h, colSpan: w, rowSpan: h }];
  });

  const byId = new Map(next.map((item) => [item.i, item]));
  return layoutData.value.map((item) => byId.get(item.i) || item);
};

const syncGridStackMoveState = () => {
  const grid = gridStackRef.value;
  if (!grid) return;
  grid.enableMove(isHomeWidgetDragEnabled.value);
  grid.enableResize(false);
};

const syncGridStackWidgets = async () => {
  await nextTick();
  const grid = gridStackRef.value;
  const root = gridLayoutRootRef.value;
  if (!grid || !root) return;

  isGridStackReady.value = false;
  syncingGridStack = true;
  try {
    grid.batchUpdate();
    grid.removeAll(false, false);

    layoutData.value.forEach((item) => {
      const el = Array.from(
        root.querySelectorAll<HTMLElement>(".grid-stack-item"),
      ).find((candidate) => candidate.dataset.widgetGridItem === item.id);
      if (!el) return;
      const options = toGridStackWidget(item);
      if ((el as GridItemHTMLElement).gridstackNode) {
        grid.update(el, options);
      } else {
        grid.makeWidget(el, options);
      }
    });
    grid.batchUpdate(false);
    syncGridStackMoveState();
  } finally {
    syncingGridStack = false;
    await nextTick();
    isGridStackReady.value = true;
  }
};

const initializeGridStack = async () => {
  await nextTick();
  const root = gridLayoutRootRef.value;
  if (!root || gridStackRef.value) return;
  const grid = GridStack.init(gridStackOptions(), root);
  grid.on("dragstart", () => {
    beginHomeWidgetDrag();
  });
  grid.on("dragstop", () => {
    if (syncingGridStack) return;
    const nextLayout = readGridStackLayout();
    const changed = homeWidgetDragStartLayout
      ? hasHomeWidgetDragLayoutChanged(nextLayout)
      : nextLayout.some((item) => {
          const current = layoutData.value.find((entry) => entry.i === item.i);
          return (
            !current ||
            current.x !== item.x ||
            current.y !== item.y ||
            current.w !== item.w ||
            current.h !== item.h
          );
        });

    if (changed) {
      layoutData.value = nextLayout;
      skipNextLayoutSave = false;
      handleLayoutUpdated(nextLayout);
    }
    finishHomeWidgetDrag();
    resetHomeWidgetDragTracking();
    if (store.isLogged && changed) {
      saveHomeWidgetDragLayout();
    }
  });
  gridStackRef.value = grid;
  await syncGridStackWidgets();
};

const destroyGridStack = () => {
  gridStackRef.value?.destroy(false);
  gridStackRef.value = null;
  isGridStackReady.value = false;
};

watch(
  [layoutData, widgetColNum, isHomeWidgetDragEnabled],
  async () => {
    if (!gridStackRef.value) {
      await initializeGridStack();
      return;
    }
    const grid = gridStackRef.value;
    grid.column(widgetColNum.value, "move");
    grid.cellHeight(resizeStepHeight.value);
    grid.margin(ITAB_GRID_GAP / 2);
    await syncGridStackWidgets();
  },
  { deep: true },
);

onMounted(() => {
  void initializeGridStack();
});

const selectWidgetForEdit = (widgetId: string) => {
  if (!isHomeEditChromeVisible.value) return;
  selectedWidgetId.value = widgetId;
};

watch(isEditMode, (val) => {
  if (val) return;
  selectedWidgetId.value = null;
});

const isEmpireCloudWidget = (type: string) => {
  return [ITAB_TODO_WIDGET_TYPE].includes(type);
};

const fetchWithTimeout = (
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 500,
) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    window.clearTimeout(timer);
  });
};

const checkLatency = async () => {
  try {
    if (isChecking.value) return;
    isChecking.value = true;
    const samples: number[] = [];
    for (let i = 0; i < 2; i++) {
      const start = performance.now();
      try {
        const res = await fetchWithTimeout(
          `/api/rtt?ts=${Date.now()}`,
          { method: "GET", cache: "no-store" },
          500,
        );
        await res.json().catch(() => null);
        samples.push(Math.round(performance.now() - start));
      } catch {
        if (forceMode.value === "latency") {
          forceMode.value = "auto";
        }
      }
      if (i === 0) {
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
    }
    latency.value = samples.length > 0 ? Math.min(...samples) : 0;

    if (latency.value > 0) {
      const result = resolveEffectiveNetworkMode(latency.value);
      isLanMode.value = result.isLan;
    }
  } finally {
    isChecking.value = false;
  }
};

watch(forceMode, (val) => {
  if (val === "latency") {
    checkLatency();
  }
  if (store.isLanModeInited) {
    const result = resolveEffectiveNetworkMode();
    isLanMode.value = result.isLan;
  }
});
watch(latencyThresholdMs, () => {
  if (forceMode.value === "latency") {
    checkLatency();
  } else if (store.isLanModeInited) {
    const result = resolveEffectiveNetworkMode();
    isLanMode.value = result.isLan;
  }
});

onMounted(() => {
  void ipRuntime.ensureLoaded();
  const initialResult = resolveEffectiveNetworkMode(0);
  isLanMode.value = initialResult.isLan;
  store.isLanModeInited = true;
  setTimeout(() => checkLatency(), 2000);
});

let gridPostInitReady = false;
watch(
  () => store.isClientReady,
  (ready) => {
    if (!ready || gridPostInitReady) return;
    gridPostInitReady = true;
    store.cleanInvalidGroups();
  },
  { immediate: true },
);

const openAddModal = (groupId: string) => {
  if (!requireStoreLogin("请先登录后再添加图标。")) return;
  currentEditItem.value = null;
  currentGroupId.value = groupId;
  showEditModal.value = true;
};
const openEditModal = (item: NavItem, groupId?: string) => {
  if (!requireStoreLogin("请先登录后再编辑图标。")) return;
  currentEditItem.value = item;
  if (groupId) {
    currentGroupId.value = groupId;
  }
  showEditModal.value = true;
};
const handleSave = async (payload: { item: NavItem; groupId?: string }) => {
  if (!requireStoreLogin("请先登录后再编辑图标。")) {
    throw new Error("请先登录后再编辑");
  }

  if (payload.item.id) {
    // Check for group move
    const targetGroupId = payload.groupId;
    let moved = false;

    if (targetGroupId) {
      const currentGroup = store.groups.find((g) =>
        g.items.some((i) => i.id === payload.item.id),
      );
      if (currentGroup && currentGroup.id !== targetGroupId) {
        // Move item: remove from old group, add to new group
        store.deleteItem(payload.item.id);
        store.addItem(payload.item, targetGroupId);
        moved = true;
      }
    }

    if (!moved) {
      store.updateItem(payload.item);
    }
  } else if (payload.groupId) {
    store.addItem(
      { ...payload.item, id: Date.now().toString() },
      payload.groupId,
    );
  }

  const result = await store.saveData(true);
  if (result === "conflict" || result === "unauthorized") {
    throw new Error(
      `保存失败：${result === "conflict" ? "发生版本冲突" : "未授权或登录已过期"}`,
    );
  }
};
function normalizeGridSpan(value: number) {
  return Math.max(1, Math.round(value));
}
const openAddWidgetModal = () => {
  if (!requireStoreLogin("请先登录后再添加组件。")) return;
  closeBlankContextMenu();
  selectedWidgetId.value = null;
  showAddWidgetModal.value = true;
};

const syncCatalogWidgetLayout = (widget: WidgetConfig) => {
  if (!isGridWidget(widget)) return;
  const maxCols = widgetColNum.value;
  const width = Math.max(
    1,
    Math.min(maxCols, normalizeGridSpan(widget.w ?? widget.colSpan ?? 1)),
  );
  const height = Math.max(
    1,
    normalizeGridSpan(widget.h ?? widget.rowSpan ?? 1),
  );
  widget.w = width;
  widget.h = height;
  widget.colSpan = width;
  widget.rowSpan = height;
  if (isRuntimeWidget(widget)) {
    const runtimeSizeKey = toRuntimeWidgetSizeKey(widget.type, {
      colSpan: width,
      rowSpan: height,
    });
    if (runtimeSizeKey) {
      applyRuntimeWidgetSize(widget, runtimeSizeKey);
    }
  } else {
    Object.assign(
      widget,
      withItabGridData(
        { ...widget },
        toItabWidgetSizeKey({ colSpan: width, rowSpan: height }),
      ),
    );
  }

  // The layout watcher ignores external updates during edit mode, so new/enabled widgets
  // must be placed into layoutData immediately.
  const currentLayout = layoutData.value.filter((item) => item.i !== widget.id);
  const hasFinitePosition =
    Number.isFinite(widget.x) && Number.isFinite(widget.y);
  const newLayoutItem: WidgetConfig = {
    ...widget,
    w: widget.w ?? width,
    h: widget.h ?? height,
    colSpan: widget.colSpan ?? width,
    rowSpan: widget.rowSpan ?? height,
    ...(hasFinitePosition
      ? {
          x: widget.x,
          y: widget.y,
        }
      : {
          x: undefined,
          y: undefined,
        }),
  };
  const updatedLayout = compactVertical(
    generateLayout([...currentLayout, newLayoutItem], widgetColNum.value),
  );
  layoutData.value = updatedLayout;
  handleLayoutUpdated(updatedLayout);
};

const applyWidgetSizeFromPayload = (
  widget: WidgetConfig,
  item: NonNullable<ReturnType<typeof getWidgetCatalogItem>>,
  sizeKey?: string,
) => {
  if (isRuntimeWidget(widget)) {
    const selected = item.supportedSizes.find((size) => size.key === sizeKey);
    const current = resolveWidgetRuntimeSizeKey(widget);
    const target =
      selected?.key ||
      current ||
      item.supportedSizes.find((size) => size.default)?.key ||
      item.supportedSizes[0]?.key;
    if (target) {
      applyRuntimeWidgetSize(widget, target as RuntimeWidgetSizeKey);
    }
    return;
  }

  const selected = item.sizeFamily.supported.find(
    (size) => size.key === sizeKey,
  );
  const current = item.sizeFamily.supported.find(
    (size) =>
      size.colSpan === normalizeGridSpan(widget.w ?? widget.colSpan ?? 0) &&
      size.rowSpan === normalizeGridSpan(widget.h ?? widget.rowSpan ?? 0),
  );
  const target =
    selected ||
    current ||
    item.sizeFamily.supported.find((size) => size.default) ||
    item.sizeFamily.supported[0];
  if (!target) return;
  widget.w = target.colSpan;
  widget.h = target.rowSpan;
  widget.colSpan = target.colSpan;
  widget.rowSpan = target.rowSpan;
  Object.assign(
    widget,
    withItabGridData(widget, target.key as ItabWidgetSizeKey),
  );
};

const addWidgetPayload = (
  payload: Extract<AddComponentPayload, { kind: "widget" }>,
): AddComponentResult => {
  if (!requireStoreLogin("请先登录后再添加组件。")) {
    return { status: "unauthorized", message: "请先登录后再添加组件" };
  }
  const item = getWidgetCatalogItem(payload.catalogItemId);
  if (!item) return { status: "validation-error", message: "组件不存在" };

  const existingWidget = findExistingCatalogWidget(store.widgets, item);
  const action = getWidgetCatalogAction(store.widgets, item);
  if (existingWidget && action === "enabled") {
    return {
      status: "duplicate",
      id: existingWidget.id,
      groupId: payload.destinationGroupId,
      message: "组件已启用",
    };
  }
  if (existingWidget && action === "enable") {
    existingWidget.enable = true;
    existingWidget.isPublic = existingWidget.isPublic ?? true;
    existingWidget.hideOnMobile = false;
    applyWidgetSizeFromPayload(existingWidget, item, payload.sizeKey);
    syncCatalogWidgetLayout(existingWidget);
    store.markDirty();
    return {
      status: "success",
      id: existingWidget.id,
      groupId: payload.destinationGroupId,
      message: "组件已启用",
    };
  }

  const newWidget = createWidgetFromCatalog(item);
  applyWidgetSizeFromPayload(newWidget, item, payload.sizeKey);
  store.widgets.push(newWidget);
  syncCatalogWidgetLayout(newWidget);
  store.markDirty();
  return {
    status: "success",
    id: newWidget.id,
    groupId: payload.destinationGroupId,
    message: "组件已添加",
  };
};

const cloneGroups = () =>
  JSON.parse(JSON.stringify(store.groups)) as NavGroup[];

const addNavItemPayload = async (
  payload: Extract<
    AddComponentPayload,
    { kind: "site-shortcut" | "custom-icon" }
  >,
): Promise<AddComponentResult> => {
  if (!requireStoreLogin("请先登录后再添加图标。")) {
    return { status: "unauthorized", message: "请先登录后再添加图标" };
  }
  if (!payload.destinationGroupId) {
    return { status: "validation-error", message: "请选择添加位置" };
  }
  const targetGroup = store.groups.find(
    (group) => group.id === payload.destinationGroupId,
  );
  if (!targetGroup) {
    return { status: "validation-error", message: "目标分组不存在" };
  }
  if (
    isDuplicateSiteShortcut(
      store.items.map((item) => item.url),
      payload.navItem.url,
    )
  ) {
    return {
      status: "duplicate",
      id: payload.navItem.id || "",
      groupId: payload.destinationGroupId,
      message: "该网址已存在",
    };
  }

  const beforeGroups = cloneGroups();
  const createdId = payload.navItem.id || Date.now().toString();
  const navItem: NavItem = {
    ...payload.navItem,
    id: createdId,
    isPublic: payload.navItem.isPublic ?? true,
  };

  if (payload.kind === "custom-icon" && navItem.icon) {
    const cached = await cacheNavItemIconToLocal(navItem.icon);
    if (cached.path) {
      navItem.icon = cached.path;
    } else if (cached.error) {
      uiFeedback.notify({
        title: "图标缓存失败",
        message: "已保留当前图标继续保存。",
        tone: "warning",
      });
    }
  }

  store.addItem(navItem, payload.destinationGroupId);

  try {
    const result = await store.saveData(true);
    if (result === "conflict" || result === "unauthorized") {
      store.groups = beforeGroups;
      if (result === "unauthorized") {
        return { status: "unauthorized", message: "登录已失效，已回滚添加。" };
      }
      return {
        status: "save-error",
        message: "保存冲突，已回滚添加。",
        rolledBack: true,
      };
    }
    return {
      status: "success",
      id: createdId,
      groupId: payload.destinationGroupId,
      message:
        payload.saveMode === "save-and-continue"
          ? "已保存，可继续添加"
          : "已保存",
    };
  } catch (error) {
    store.groups = beforeGroups;
    const message = error instanceof Error ? error.message : "保存失败";
    return { status: "save-error", message, rolledBack: true };
  }
};

const addComponent = async (
  payload: AddComponentPayload,
): Promise<AddComponentResult> => {
  if (payload.kind === "widget") return addWidgetPayload(payload);
  return addNavItemPayload(payload);
};

const disableWidgetFromGrid = (id: string) => {
  if (!requireStoreLogin("请先登录后再修改组件。")) return;
  const widget = store.widgets.find((w) => w.id === id);
  if (!widget) return;
  widget.enable = false;
  layoutData.value = layoutData.value.filter((w) => w.i !== id && w.id !== id);
  if (selectedWidgetId.value === id) selectedWidgetId.value = null;
  const newLayout = compactVertical(layoutData.value);
  layoutData.value = newLayout;
  handleLayoutUpdated(newLayout);
  store.markDirty();
};
const closeWidgetFromGrid = (widget: WidgetConfig) => {
  disableWidgetFromGrid(widget.id);
};

const saveAfterDelete = async () => {
  try {
    const result = await store.saveData(true);
    if (result === "conflict" || result === "unauthorized") {
      void uiFeedback.alert({
        title: "删除已执行，但保存失败",
        message:
          result === "conflict" ? "发生版本冲突。" : "未授权或登录已过期。",
        tone: "warning",
      });
    }
  } catch {
    void uiFeedback.alert({
      title: "删除已执行，但保存失败",
      message: "请重试。",
      tone: "warning",
    });
  }
};

const deleteWidgetFromGridImmediately = async (widget: WidgetConfig) => {
  if (!requireStoreLogin("请先登录后再删除组件。")) return;
  closeWidgetFromGrid(widget);
  await saveAfterDelete();
};

// --- Heartbeat / Polling Mechanism for Layout ---
// Active (Edit Mode): Stop polling to prevent interference.
// Inactive (View Mode): Poll to keep in sync.
const { pause: pausePolling, resume: resumePolling } = useIntervalFn(
  async () => {
    if (
      store.isLogged &&
      !isEditMode.value &&
      !showSettingsModal.value &&
      !showGroupSettingsModal.value &&
      !showAddWidgetModal.value &&
      !showEditModal.value &&
      !showLoginModal.value
    ) {
      await store.fetchData();
    }
  },
  30000,
  { immediate: false },
);

const shouldPausePolling = computed(
  () =>
    isEditMode.value ||
    showSettingsModal.value ||
    showGroupSettingsModal.value ||
    showAddWidgetModal.value ||
    showEditModal.value ||
    showLoginModal.value,
);

watch(
  shouldPausePolling,
  (active) => {
    if (active) pausePolling();
    else resumePolling();
  },
  { immediate: true },
);

// const deleteItem = (id: string) => {
//   openDeleteConfirm(id)
// }
let skipNextCardClickId: string | null = null;
const handleCardClick = (item: NavItem) => {
  if (skipNextCardClickId === item.id) {
    skipNextCardClickId = null;
    return;
  }
  if (isEditMode.value) return;

  // 逻辑优化：
  // 1. 默认使用外网链接 (item.url)
  // 2. 只有在【已登录】且【处于内网环境】且【配置了内网链接】时，才优先使用内网链接
  // 3. 支持强制切换模式
  // 4. 修复：统一使用 effectiveIsLan 判断，确保 UI 显示与跳转行为一致

  let targetUrl = item.url;

  // effectiveIsLan 已经封装了 forceMode (LAN/WAN/Latency/Auto) 的所有判断逻辑
  // 直接使用它可以保证 UI 状态（是否显示内网标识）与实际跳转逻辑的一致性
  if (store.isLogged && effectiveIsLan.value && item.lanUrl) {
    targetUrl = item.lanUrl;
  }

  // 特殊情况：如果解析出的 targetUrl 为空（说明没有外网链接），
  // 但存在内网链接（说明是因为未登录被降级了，或者是压根没配外网链接）
  // 此时如果用户未登录，则拦截并提示登录。
  if (!targetUrl && item.lanUrl && !store.isLogged) {
    notifyLoginRequired("请先登录后再访问内网地址。");
    return;
  }

  // 如果确实没有链接可跳，则不做反应
  if (!targetUrl) return;

  // Lucky STUN Port Replacement
  // 当配置了 Lucky STUN 且当前访问域名与卡片链接域名一致时，自动替换端口
  // 逻辑升级 V2：
  // 1. 默认行为：只要域名一致，就认为是“同一台机器”，默认尝试替换端口（为了解决从 STUN 端口访问时，卡片仍是内网端口的问题）。
  // 2. 例外处理：如果用户显式勾选了 skipLuckyStun（禁止替换），则保持原样（用于 Plex 等其他服务）。
  const stunData = store.luckyStunData?.data;
  if (stunData?.stun === "success" && stunData?.port) {
    try {
      const urlObj = new URL(targetUrl);
      if (urlObj.hostname === window.location.hostname) {
        // 只要当前不是内网 IP 访问，就自动替换端口
        // (防止在局域网用 IP 访问时，被错误替换成公网端口导致无法访问)
        if (!isInternalNetwork(window.location.hostname)) {
          urlObj.port = String(stunData.port);
          targetUrl = urlObj.toString();
        }
      }
    } catch {
      // Ignore relative or invalid URLs
    }
  }

  window.open(targetUrl, "_blank");
};

const handleDockerAction = async (item: NavItem, action: string) => {
  if (!store.systemConfig.enableDocker) {
    return;
  }

  let containerId = item.containerId;

  // Resolve ID from name if needed
  if (
    (!containerId || !containerStatuses.value[containerId]) &&
    item.containerName
  ) {
    const resolvedId = liveContainerNamesMap.value[item.containerName];
    if (resolvedId) {
      containerId = resolvedId;
    }
  }

  if (!containerId) return;

  if (action === "update") {
    isUpdating.value.add(containerId);
  }

  try {
    const headers = store.getHeaders();
    await fetch(`/api/docker/container/${containerId}/${action}`, {
      method: "POST",
      headers,
    });
    // Optimistic update or wait for poll? For now just wait for poll or refresh if needed.
    // Ideally we should refresh status here, but status is on the card?
    // We need to fetch container status to update the card UI if we display it.
    // Let's implement status fetching for cards.
    fetchContainerStatuses();
  } catch (e) {
    console.error(`Failed to ${action} container`, e);
  } finally {
    if (action === "update") {
      isUpdating.value.delete(containerId);
      // Force refresh status after update (single delayed refresh)
      setTimeout(fetchContainerStatuses, 15000);
    }
  }
};

const containerStatuses = ref<
  Record<
    string,
    {
      state: string;
      hasUpdate?: boolean;
      stats?: {
        cpuPercent: number;
        memPercent: number;
        memUsage: number;
        netIO?: { rx: number; tx: number };
        blockIO?: { read: number; write: number };
      };
    }
  >
>({});

// Track updating containers
const isUpdating = ref<Set<string>>(new Set());

const isItemUpdating = (item: NavItem) => {
  if (!item) return false;
  // Check explicit ID
  if (item.containerId && isUpdating.value.has(item.containerId)) return true;

  // Check resolved ID
  if (item.containerName) {
    const id = liveContainerNamesMap.value[item.containerName];
    if (id && isUpdating.value.has(id)) return true;
  }
  return false;
};

const formatBytes = (bytes: number, decimals = 1) => {
  if (!bytes) return "0B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const index = Math.min(i, sizes.length - 1);
  return (
    parseFloat((bytes / Math.pow(k, index)).toFixed(dm)) + (sizes[index] || "B")
  );
};

interface ContainerStatus {
  state: string;
  hasUpdate?: boolean;
  stats?: {
    cpuPercent: number;
    memPercent: number;
    memUsage: number;
    netIO?: { rx: number; tx: number };
    blockIO?: { read: number; write: number };
  };
}

interface DockerContainer {
  Id: string;
  Names: string[];
  State: string;
  hasUpdate?: boolean;
  stats?: {
    cpuPercent: number;
    memPercent: number;
    memUsage: number;
    netIO?: { rx: number; tx: number };
    blockIO?: { read: number; write: number };
  };
  [key: string]: unknown;
}

const previousStatsMap = ref<
  Record<
    string,
    {
      time: number;
      netIO?: { rx: number; tx: number };
      blockIO?: { read: number; write: number };
    }
  >
>({});

const liveContainerNamesMap = ref<Record<string, string>>({});

const getContainerStatus = (item: NavItem) => {
  if (!item) return undefined;

  // 1. Try by ID (Fastest)
  if (item.containerId && containerStatuses.value[item.containerId]) {
    return containerStatuses.value[item.containerId];
  }

  // 2. Try by Name (Fallback / No-ID case)
  if (item.containerName) {
    const id = liveContainerNamesMap.value[item.containerName];
    if (id && containerStatuses.value[id]) {
      return containerStatuses.value[id];
    }
  }

  return undefined;
};

const fetchContainerStatuses = async () => {
  if (
    typeof document !== "undefined" &&
    document.visibilityState === "hidden"
  ) {
    return;
  }

  const dockerSystemEnabled = Boolean(store.systemConfig.enableDocker);

  const hasAnyContainerItems = store.groups.some((g) =>
    g.items.some((item) => !!item.containerId || !!item.containerName),
  );
  if (!hasAnyContainerItems) {
    if (Object.keys(containerStatuses.value).length)
      containerStatuses.value = {};
    if (Object.keys(previousStatsMap.value).length) previousStatsMap.value = {};
    return;
  }

  const statusMap: Record<string, ContainerStatus> = {};
  const now = Date.now();

  // 0. Ensure every docker-bound item has at least a placeholder status
  store.groups.forEach((g) => {
    g.items.forEach((item) => {
      if (!item.containerId && !item.containerName) return;

      // If we only have name, we can't key by ID yet, but we will fix this in step 2
      if (item.containerId) {
        const existing = containerStatuses.value[item.containerId];
        statusMap[item.containerId] = {
          state: existing?.state || "unknown",
          stats: existing?.stats,
        };
      }
    });
  });

  if (!dockerSystemEnabled) {
    if (Object.keys(containerStatuses.value).length)
      containerStatuses.value = {};
    if (Object.keys(previousStatsMap.value).length) previousStatsMap.value = {};
    if (Object.keys(liveContainerNamesMap.value).length)
      liveContainerNamesMap.value = {};
    return;
  }

  const hasRealDockerItems = store.groups.some((g) =>
    g.items.some((item) => item.containerId || item.containerName),
  );

  if (hasRealDockerItems) {
    try {
      const headers = store.getHeaders();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch("/api/docker/containers", {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.success) {
        const liveContainers = (data.data || []) as DockerContainer[];

        // Build Name -> ID map for fallback lookups
        const newNameMap: Record<string, string> = {};
        liveContainers.forEach((c) => {
          if (c.Names && c.Names.length) {
            c.Names.forEach((n) => {
              const cleanName = n.replace(/^\//, "");
              newNameMap[cleanName] = c.Id;
            });
          }
        });
        liveContainerNamesMap.value = newNameMap;

        let needsSave = false;
        store.groups.forEach((g) => {
          g.items.forEach((item) => {
            // Case 1: Has ID. Check if valid, or fix if invalid.
            if (item.containerId) {
              const foundById = liveContainers.find(
                (c) => c.Id === item.containerId,
              );
              if (!foundById) {
                // Try to find by name (handle ID change after container recreation)
                let foundByName: DockerContainer | undefined;

                // 1. Try strict match by containerName (if set)
                if (item.containerName) {
                  foundByName = liveContainers.find((c) =>
                    (c.Names || []).some(
                      (n) => n.replace(/^\//, "") === item.containerName,
                    ),
                  );
                }

                // 2. Fallback to match by item.title (legacy support or if name matches title)
                if (!foundByName && item.title) {
                  foundByName = liveContainers.find((c) =>
                    (c.Names || []).some(
                      (n) => n.replace(/^\//, "") === item.title,
                    ),
                  );
                }

                if (foundByName) {
                  item.containerId = foundByName.Id;

                  // Ensure containerName is synced to the real container name
                  // This ensures future updates work even if user renames the card title
                  const realName = (foundByName.Names?.[0] || "").replace(
                    /^\//,
                    "",
                  );
                  if (realName && item.containerName !== realName) {
                    item.containerName = realName;
                  }

                  needsSave = true;
                }
              }
            }
            // Case 2: No ID, but has Name. Try to bind.
            else if (item.containerName) {
              const foundByName = liveContainers.find((c) =>
                (c.Names || []).some(
                  (n) => n.replace(/^\//, "") === item.containerName,
                ),
              );

              if (foundByName) {
                item.containerId = foundByName.Id;
                needsSave = true;
              }
            }
          });
        });

        if (needsSave) {
          store.markDirty();
        }

        liveContainers.forEach((c) => {
          let stats = c.stats;

          if (stats && stats.netIO && stats.blockIO) {
            const prev = previousStatsMap.value[c.Id];
            const currentNetRx = stats.netIO.rx || 0;
            const currentNetTx = stats.netIO.tx || 0;
            const currentBlockRead = stats.blockIO.read || 0;
            const currentBlockWrite = stats.blockIO.write || 0;

            let rxRate = 0;
            let txRate = 0;
            let readRate = 0;
            let writeRate = 0;

            if (prev) {
              const dt = (now - prev.time) / 1000;
              if (dt > 0) {
                rxRate = Math.max(
                  0,
                  (currentNetRx - (prev.netIO?.rx || 0)) / dt,
                );
                txRate = Math.max(
                  0,
                  (currentNetTx - (prev.netIO?.tx || 0)) / dt,
                );
                readRate = Math.max(
                  0,
                  (currentBlockRead - (prev.blockIO?.read || 0)) / dt,
                );
                writeRate = Math.max(
                  0,
                  (currentBlockWrite - (prev.blockIO?.write || 0)) / dt,
                );
              }
            }

            previousStatsMap.value[c.Id] = {
              time: now,
              netIO: { rx: currentNetRx, tx: currentNetTx },
              blockIO: { read: currentBlockRead, write: currentBlockWrite },
            };

            stats = {
              ...stats,
              netIO: { rx: rxRate, tx: txRate },
              blockIO: { read: readRate, write: writeRate },
            };
          }

          statusMap[c.Id] = {
            state: c.State,
            hasUpdate: c.hasUpdate,
            stats: stats,
          };
        });
      }
    } catch {
      // ignore
    } finally {
      // ignore
    }
  }

  // 3. Update State
  containerStatuses.value = { ...containerStatuses.value, ...statusMap };
  // Next poll is driven by dashboard pulse (store), no self-scheduling here.
};

const isMounted = ref(false);

const handleContainerVisibilityChange = () => {
  if (!isMounted.value) return;
  if (document.visibilityState === "hidden") return;
  fetchContainerStatuses();
};

onMounted(() => {
  isMounted.value = true;
  store.registerDashboardPulse(fetchContainerStatuses);
  fetchContainerStatuses();
  document.addEventListener(
    "visibilitychange",
    handleContainerVisibilityChange,
  );
});

onUnmounted(() => {
  isMounted.value = false;
  store.unregisterDashboardPulse(fetchContainerStatuses);
  document.removeEventListener(
    "visibilitychange",
    handleContainerVisibilityChange,
  );
});

// 监听 store.groups 变化，一旦出现容器组件，立即拉一次状态（之后由脉冲每 15s 驱动）
watch(
  () => store.groups,
  () => {
    const hasAny = store.groups.some((g) =>
      g.items.some((item) => !!item.containerId || !!item.containerName),
    );
    if (hasAny && isMounted.value && document.visibilityState !== "hidden") {
      fetchContainerStatuses();
    }
  },
  { deep: true },
);

const openLogin = () => {
  showLoginModal.value = true;
};
const openSettings = () => {
  if (!requireStoreLogin("请先登录后再修改设置。")) return;
  showSettingsModal.value = true;
};
const logoutFromHome = () => {
  void store.logout();
};
// const updateGroupName = (id: string, e: Event) => {
//   const val = (e.target as HTMLElement).innerText
//   store.updateGroupTitle(id, val)
// }

const onGroupItemsChange = (groupId: string, newItems: NavItem[]) => {
  const group = store.groups.find((g) => g.id === groupId);
  if (group) {
    group.items = newItems;
  }
};

const openBackupUrl = (url: string | { url: string }) => {
  const target = typeof url === "string" ? url : url.url;
  if (!target) return;
  window.open(target, "_blank");
};

// --- Context Menu Logic ---
const showContextMenu = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
const contextMenuItem = ref<NavItem | null>(null);
const contextMenuGroupId = ref<string | undefined>(undefined);
const showBlankContextMenu = ref(false);
const blankContextMenuPosition = ref({ x: 0, y: 0 });
const blankContextActiveIndex = ref(0);
const runtimeContextMenu = ref<{
  widgetId: string;
  x: number;
  y: number;
} | null>(null);
const runtimeRefreshTokens = ref<Record<string, number>>({});

const openContextMenuAt = (
  x: number,
  y: number,
  item: NavItem,
  groupId?: string,
) => {
  if (!store.isLogged) return;
  contextMenuItem.value = item;
  contextMenuGroupId.value = groupId;

  // Prevent menu from going off-screen (basic logic)
  const menuWidth = 150;
  const menuHeight = 100;
  let finalX = x;
  let finalY = y;

  if (finalX + menuWidth > window.innerWidth) finalX -= menuWidth;
  if (finalY + menuHeight > window.innerHeight) finalY -= menuHeight;

  contextMenuPosition.value = { x: finalX, y: finalY };
  showBlankContextMenu.value = false;
  runtimeContextMenu.value = null;
  showContextMenu.value = true;
};

const openContextMenu = (e: MouseEvent, item: NavItem, groupId?: string) => {
  if (!store.isLogged) return;
  e.preventDefault();
  openContextMenuAt(e.clientX, e.clientY, item, groupId);
};

const hasTouch = computed(() => {
  if (typeof navigator === "undefined") return false;
  const n = navigator as Navigator & { msMaxTouchPoints?: number };
  const maxPoints = Math.max(0, n.maxTouchPoints || 0, n.msMaxTouchPoints || 0);
  if (maxPoints > 0) return true;
  return typeof window !== "undefined" && "ontouchstart" in window;
});
const enableLongPressContextMenu = computed(() => hasTouch.value);
let cardLongPressTimer: number | null = null;
let cardLongPressStartX = 0;
let cardLongPressStartY = 0;
let cardLongPressItem: NavItem | null = null;
let cardLongPressGroupId: string | undefined;
let cardLongPressSource: "touch" | "pointer" | null = null;

const clearCardLongPress = () => {
  if (cardLongPressTimer) window.clearTimeout(cardLongPressTimer);
  cardLongPressTimer = null;
  cardLongPressItem = null;
  cardLongPressGroupId = undefined;
  cardLongPressSource = null;
};

const onCardTouchStart = (e: TouchEvent, item: NavItem, groupId?: string) => {
  if (!store.isLogged) return;
  if (!enableLongPressContextMenu.value) return;
  if (showContextMenu.value) return;
  if (cardLongPressSource === "pointer") return;

  const t = e.touches && e.touches[0];
  if (!t) return;

  clearCardLongPress();
  cardLongPressSource = "touch";
  cardLongPressStartX = t.clientX;
  cardLongPressStartY = t.clientY;
  cardLongPressItem = item;
  cardLongPressGroupId = groupId;
  cardLongPressTimer = window.setTimeout(() => {
    if (!cardLongPressItem) return;
    skipNextCardClickId = cardLongPressItem.id;
    openContextMenuAt(
      cardLongPressStartX,
      cardLongPressStartY,
      cardLongPressItem,
      cardLongPressGroupId,
    );
    clearCardLongPress();
  }, 520);
};

const onCardTouchMove = (e: TouchEvent) => {
  if (!cardLongPressTimer) return;
  if (cardLongPressSource !== "touch") return;
  const t = e.touches && e.touches[0];
  if (!t) return;
  const dx = t.clientX - cardLongPressStartX;
  const dy = t.clientY - cardLongPressStartY;
  if (dx * dx + dy * dy > 256) clearCardLongPress();
};

const onCardTouchEnd = () => {
  clearCardLongPress();
};

const onCardPointerDown = (
  e: PointerEvent,
  item: NavItem,
  groupId?: string,
) => {
  if (!store.isLogged) return;
  if (!enableLongPressContextMenu.value) return;
  if (showContextMenu.value) return;
  if (e.pointerType !== "touch") return;

  clearCardLongPress();
  cardLongPressSource = "pointer";
  cardLongPressStartX = e.clientX;
  cardLongPressStartY = e.clientY;
  cardLongPressItem = item;
  cardLongPressGroupId = groupId;
  cardLongPressTimer = window.setTimeout(() => {
    if (!cardLongPressItem) return;
    skipNextCardClickId = cardLongPressItem.id;
    openContextMenuAt(
      cardLongPressStartX,
      cardLongPressStartY,
      cardLongPressItem,
      cardLongPressGroupId,
    );
    clearCardLongPress();
  }, 520);
};

const onCardPointerMove = (e: PointerEvent) => {
  if (!cardLongPressTimer) return;
  if (cardLongPressSource !== "pointer") return;
  if (e.pointerType !== "touch") return;
  const dx = e.clientX - cardLongPressStartX;
  const dy = e.clientY - cardLongPressStartY;
  if (dx * dx + dy * dy > 256) clearCardLongPress();
};

const onCardPointerUp = () => {
  clearCardLongPress();
};

const handleContextMenu = (e: MouseEvent, item: NavItem, groupId?: string) => {
  if (!store.isLogged) return;
  openContextMenu(e, item, groupId);
};

const closeContextMenu = () => {
  showContextMenu.value = false;
};

const closeBlankContextMenu = () => {
  showBlankContextMenu.value = false;
};

const runtimeMenuWidget = computed(() => {
  const widgetId = runtimeContextMenu.value?.widgetId;
  if (!widgetId) return null;
  return store.widgets.find((widget) => widget.id === widgetId) || null;
});

const openedRuntimeWidget = computed(() => {
  if (!openedRuntimeWidgetId.value) return null;
  const widget =
    store.widgets.find((item) => item.id === openedRuntimeWidgetId.value) ||
    null;
  return widget && isRuntimeWidget(widget) ? widget : null;
});
const runtimeMemoWidget = computed(
  () =>
    store.widgets.find(
      (widget) =>
        widget.id === ITAB_MEMO_CATALOG_ID &&
        widget.type === ITAB_MEMO_WIDGET_TYPE &&
        widget.enable !== false,
    ) || null,
);

const closeRuntimeContextMenu = () => {
  runtimeContextMenu.value = null;
};

const openRuntimeContextMenu = (widget: WidgetConfig, event: MouseEvent) => {
  if (!store.isLogged || !isRuntimeWidget(widget)) return;
  event.preventDefault();
  event.stopPropagation();
  const menuWidth = 140;
  const menuHeight = 232;
  let finalX = event.clientX;
  let finalY = event.clientY;
  if (finalX + menuWidth > window.innerWidth) {
    finalX = Math.max(8, window.innerWidth - menuWidth - 8);
  }
  if (finalY + menuHeight > window.innerHeight) {
    finalY = Math.max(8, window.innerHeight - menuHeight - 8);
  }
  closeContextMenu();
  closeBlankContextMenu();
  runtimeContextMenu.value = {
    widgetId: widget.id,
    x: finalX,
    y: finalY,
  };
};

const openRuntimeWidget = (widget: WidgetConfig) => {
  if (
    !isRuntimeWidget(widget) ||
    isHomeEditChromeVisible.value ||
    shouldSuppressHomeWidgetOpen()
  )
    return;
  closeRuntimeContextMenu();
  openedRuntimeWidgetId.value = widget.id;
};

const closeRuntimeWidget = () => {
  blurActiveElementMatching("[data-runtime-widget]");
  openedRuntimeWidgetId.value = "";
};

const editRuntimeWidgetIcon = (widget: WidgetConfig) => {
  if (!requireStoreLogin("请先登录后再编辑组件。")) return;
  closeRuntimeContextMenu();
  store.layoutEditInProgress = true;
  isEditMode.value = true;
  selectedWidgetId.value = widget.id;
};

const editRuntimeWidgetHome = () => {
  if (!requireStoreLogin("请先登录后再编辑首页。")) return;
  closeRuntimeContextMenu();
  store.layoutEditInProgress = true;
  isEditMode.value = true;
};

const deleteRuntimeWidget = async (widget: WidgetConfig) => {
  if (!requireStoreLogin("请先登录后再删除组件。")) return;
  closeRuntimeContextMenu();
  await deleteWidgetFromGridImmediately(widget);
};

const refreshRuntimeWidget = (widget: WidgetConfig) => {
  if (!isRuntimeWidget(widget)) return;
  closeRuntimeContextMenu();
  runtimeRefreshTokens.value = {
    ...runtimeRefreshTokens.value,
    [widget.id]: (runtimeRefreshTokens.value[widget.id] || 0) + 1,
  };
};

const updateRuntimeWidgetData = (
  widget: WidgetConfig,
  data: WidgetRuntimeData,
) => {
  if (!requireStoreLogin("请先登录后再修改组件内容。")) return;
  const storeWidget = store.widgets.find((item) => item.id === widget.id);
  const currentSizeKey =
    (storeWidget && resolveWidgetRuntimeSizeKey(storeWidget)) ||
    resolveWidgetRuntimeSizeKey(widget);
  const normalizedBase = normalizeWidgetRuntimeData(widget.type, data);
  if (!normalizedBase) return;
  const normalized = {
    ...normalizedBase,
    ...(currentSizeKey ? { sizeKey: currentSizeKey } : {}),
  };
  if (storeWidget) {
    storeWidget.data = normalized;
  }
  const layoutWidget = layoutData.value.find(
    (item) => item.id === widget.id || item.i === widget.id,
  );
  if (layoutWidget) {
    layoutWidget.data = normalized;
  }
  store.markDirty();
  if (store.isLogged && storeWidget) {
    void store.saveData(
      widget.type !== ITAB_TODO_WIDGET_TYPE &&
        widget.type !== ITAB_MEMO_WIDGET_TYPE &&
        widget.type !== ITAB_POMODORO_WIDGET_TYPE,
    );
  }
};

const createRuntimeWidgetInstanceId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const addRuntimeWidgetData = (
  widget: WidgetConfig,
  data: WidgetRuntimeData,
) => {
  if (!requireStoreLogin("请先登录后再添加组件。")) return;
  const normalized = normalizeWidgetRuntimeData(widget.type, data);
  if (!normalized) return;
  const newWidget =
    widget.type === ITAB_ANNIVERSARY_WIDGET_TYPE
      ? createDefaultItabAnniversaryWidget()
      : widget.type === AI_USAGE_WIDGET_TYPE
        ? createDefaultAiUsageWidget()
        : widget.type === TAPD_DEFECTS_WIDGET_TYPE
          ? createDefaultTapdDefectWidget()
          : null;
  if (!newWidget) return;
  newWidget.id = createRuntimeWidgetInstanceId(
    widget.type === AI_USAGE_WIDGET_TYPE
      ? AI_USAGE_CATALOG_ID
      : widget.type === TAPD_DEFECTS_WIDGET_TYPE
        ? TAPD_DEFECTS_CATALOG_ID
        : ITAB_ANNIVERSARY_CATALOG_ID,
  );
  newWidget.data = normalized;
  applyRuntimeWidgetSize(newWidget, normalized.sizeKey);
  store.widgets.push(newWidget);
  syncCatalogWidgetLayout(newWidget);
  closeRuntimeWidget();
  store.markDirty();
  if (store.isLogged) {
    void store.saveData(true);
  }
};

const selectRuntimeWidgetSize = (
  widget: WidgetConfig,
  sizeKey: RuntimeWidgetSizeKey,
) => {
  if (!isRuntimeWidget(widget)) return;
  if (!requireStoreLogin("请先登录后再调整组件尺寸。")) return;
  const storeWidget = store.widgets.find((item) => item.id === widget.id);
  if (!storeWidget) return;
  applyRuntimeWidgetSize(storeWidget, sizeKey);
  const layoutWidget = layoutData.value.find(
    (item) => item.id === widget.id || item.i === widget.id,
  );
  if (layoutWidget) {
    layoutWidget.w = storeWidget.w;
    layoutWidget.h = storeWidget.h;
    layoutWidget.colSpan = storeWidget.colSpan;
    layoutWidget.rowSpan = storeWidget.rowSpan;
    layoutWidget.data = storeWidget.data;
    const newLayout = resolveResizeLayout(
      layoutData.value,
      layoutWidget.i || layoutWidget.id,
      {
        colSpan: layoutWidget.w || layoutWidget.colSpan || 1,
        rowSpan: layoutWidget.h || layoutWidget.rowSpan || 1,
      },
      widgetColNum.value,
    );
    layoutData.value = newLayout;
    handleLayoutUpdated(newLayout);
  }
  store.markDirty();
  void store.saveData(true);
};

const blankContextMenuExclusionSelector = [
  "[data-widget-grid-item]",
  "[data-card-item]",
  ".vue-grid-item",
  ".widget-move-handle",
  ".widget-resize-grip",
  ".widget-size-strip",
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "[contenteditable=true]",
  "[role=dialog]",
  ".sd-modal-surface",
  ".sd-context-menu-surface",
  "[data-grid-context-menu]",
].join(",");

const shouldOpenBlankContextMenu = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return !target.closest(blankContextMenuExclusionSelector);
};

const openBlankContextMenuAt = (x: number, y: number) => {
  if (!store.isLogged) return;
  const menuWidth = 140;
  const menuHeight = 184;
  let finalX = x;
  let finalY = y;
  if (finalX + menuWidth > window.innerWidth) {
    finalX = Math.max(0, window.innerWidth - menuWidth);
  }
  if (finalY + menuHeight > window.innerHeight) {
    finalY = Math.max(0, window.innerHeight - menuHeight);
  }
  blankContextMenuPosition.value = { x: finalX, y: finalY };
  blankContextActiveIndex.value = 0;
  showContextMenu.value = false;
  runtimeContextMenu.value = null;
  showBlankContextMenu.value = true;
};

const handleBlankContextMenu = (e: MouseEvent) => {
  if (!store.isLogged) return;
  if (!shouldOpenBlankContextMenu(e.target)) return;
  e.preventDefault();
  openBlankContextMenuAt(e.clientX, e.clientY);
};

type BlankContextAction = "add" | "wallpaper" | "backup" | "settings";

const blankContextRows: {
  action: BlankContextAction;
  label: string;
  shortcut?: string;
  disabled?: () => boolean;
  testId?: string;
}[] = [
  { action: "add", label: "添加图标", testId: "itab-add-context-row-add" },
  { action: "wallpaper", label: "换壁纸" },
  { action: "backup", label: "立即备份" },
  { action: "settings", label: "设置" },
];

const handleBlankContextAction = async (action: BlankContextAction) => {
  closeBlankContextMenu();
  if (action === "add") {
    openAddWidgetModal();
    return;
  }
  if (action === "wallpaper" || action === "settings") {
    openSettings();
    return;
  }
  if (action === "backup") {
    await handleHomeActionSave();
  }
};

const onBlankContextMenuKeydown = (event: KeyboardEvent) => {
  if (!showBlankContextMenu.value) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeBlankContextMenu();
    return;
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    blankContextActiveIndex.value =
      (blankContextActiveIndex.value + direction + blankContextRows.length) %
      blankContextRows.length;
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    const row = blankContextRows[blankContextActiveIndex.value];
    if (row) void handleBlankContextAction(row.action);
  }
};

const onDocPointerDownCapture = (e: PointerEvent) => {
  if (
    !showContextMenu.value &&
    !showBlankContextMenu.value &&
    !runtimeContextMenu.value
  )
    return;
  if (e.button !== 0) return;
  const target = e.target as HTMLElement | null;
  if (target?.closest?.("[data-grid-context-menu]")) return;
  if (target?.closest?.("[data-runtime-context-menu]")) return;
  if (target?.closest?.("[data-testid='itab-add-context-menu']")) return;
  closeContextMenu();
  closeBlankContextMenu();
  closeRuntimeContextMenu();
};

defineExpose({
  addComponent,
  shouldOpenBlankContextMenu,
});

const handleMenuLanOpen = () => {
  const item = contextMenuItem.value;
  closeContextMenu();

  if (!item || !item.lanUrl) return;

  // 内网访问依然需要登录权限
  if (!requireStoreLogin("请先登录后再访问内网地址。")) return;

  window.open(item.lanUrl, "_blank");
};

const handleMenuWanOpen = () => {
  const item = contextMenuItem.value;
  closeContextMenu();
  if (!item || !item.url) return;
  window.open(item.url, "_blank");
};

const handleMenuOpen = (url: string | { url: string }) => {
  closeContextMenu();
  const target = typeof url === "string" ? url : url.url;
  if (!target) return;
  window.open(target, "_blank");
};

const handleMenuEdit = () => {
  const item = contextMenuItem.value;
  const groupId = contextMenuGroupId.value;
  closeContextMenu();
  if (!requireStoreLogin("请先登录后再编辑图标。")) return;
  if (item) {
    openEditModal(item, groupId);
  }
};

const handleMenuDelete = async () => {
  if (!requireStoreLogin("请先登录后再删除内容。")) {
    closeContextMenu();
    return;
  }
  const item = contextMenuItem.value;
  closeContextMenu();
  if (item) {
    const widget = store.widgets.find((w) => w.id === item.id);
    if (widget) {
      await deleteWidgetFromGridImmediately(widget);
      return;
    }
    openDeleteConfirm(item.id);
  }
};

// --- Delete Confirmation Logic ---
const showDeleteConfirm = ref(false);
const deleteType = ref<"item" | "group">("item");
const itemToDelete = ref<string | null>(null);
const groupToDelete = ref<string | null>(null);

const cancelDelete = () => {
  showDeleteConfirm.value = false;
  itemToDelete.value = null;
  groupToDelete.value = null;
};

const openDeleteConfirm = (id: string) => {
  if (!requireStoreLogin("请先登录后再删除图标。")) return;
  deleteType.value = "item";
  itemToDelete.value = id;
  showDeleteConfirm.value = true;
};

const openGroupDeleteConfirm = (id: string) => {
  if (!requireStoreLogin("请先登录后再删除分组。")) return;
  deleteType.value = "group";
  groupToDelete.value = id;
  showDeleteConfirm.value = true;
};

const confirmDelete = async () => {
  if (!requireStoreLogin("请先登录后再删除内容。")) {
    cancelDelete();
    return;
  }
  if (deleteType.value === "item" && itemToDelete.value) {
    const widget = store.widgets.find((w) => w.id === itemToDelete.value);
    if (widget) {
      closeWidgetFromGrid(widget);
    } else {
      store.deleteItem(itemToDelete.value);
    }
  } else if (deleteType.value === "group" && groupToDelete.value) {
    store.deleteGroup(groupToDelete.value, true);
  }
  cancelDelete();
  await saveAfterDelete();
};

watch(
  () => store.isLogged,
  (logged) => {
    if (logged) return;
    isEditMode.value = false;
    showEditModal.value = false;
    showGroupSettingsModal.value = false;
    showDeleteConfirm.value = false;
    store.layoutEditInProgress = false;
  },
);

onMounted(() => {
  document.addEventListener("pointerdown", onDocPointerDownCapture, true);
  document.addEventListener("keydown", onGlobalHomeKeydown, true);
  document.addEventListener("scroll", closeContextMenu, true);
  document.addEventListener("scroll", closeRuntimeContextMenu, true);
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", onDocPointerDownCapture, true);
  document.removeEventListener("keydown", onGlobalHomeKeydown, true);
  document.removeEventListener("scroll", closeContextMenu, true);
  document.removeEventListener("scroll", closeRuntimeContextMenu, true);
  clearHomeWidgetDragIdleTimer();
});

// --- Group Settings ---
const activeGroupId = ref<string | null>(null);

const toggleGroupSettings = (id: string) => {
  if (!requireStoreLogin("请先登录后再修改分组设置。")) return;
  activeGroupId.value = id;
  showGroupSettingsModal.value = true;
};

const checkMove = () => {
  return true;
};

const getLayoutConfig = (group: NavGroup) => {
  const showBg = group.showCardBackground ?? store.appConfig.showCardBackground;
  const layout = group.cardLayout || store.appConfig.cardLayout;
  const isHorizontal = layout === "horizontal";
  const isNoBg = showBg === false;

  const baseGap = group.gridGap || DEFAULT_NAV_GRID_GAP;
  const gap = isNoBg ? Math.max(4, Math.round(baseGap * 0.6)) : baseGap;

  const baseSize = group.cardSize || DEFAULT_NAV_CARD_SIZE;
  const ratio = baseSize / 120;

  const modeScale = isNoBg ? 0.6 : 1.0;
  const finalScale = ratio * modeScale;
  const h_w = 220 * finalScale;
  const h_h = 80 * finalScale;
  const horizontalIconMax = Math.max(20, h_h - 18);

  // Icon Size Logic
  const customIconSize = group.iconSize || DEFAULT_NAV_ICON_SIZE;
  let v_icon, h_icon;

  if (customIconSize) {
    // If explicit icon size is set, use it as base
    // Optimization: In vertical mode without card background, use the custom size directly
    if (isNoBg && !isHorizontal) {
      v_icon = customIconSize;
    } else {
      v_icon = customIconSize * modeScale;
    }
    h_icon = Math.min(
      customIconSize * (40 / 48) * modeScale,
      horizontalIconMax,
    );
  } else {
    // Legacy behavior: scale with card size
    v_icon = 48 * finalScale;
    h_icon = Math.min(40 * finalScale, horizontalIconMax);
  }

  let v_w = 120 * finalScale;
  let v_h = 128 * finalScale;

  // Optimization: Ensure container fits the icon in vertical no-bg mode
  if (isNoBg && !isHorizontal) {
    if (v_icon > v_w) v_w = v_icon + 8;
    const titleSize = group.cardTitleSize || 13;
    const titleBlockHeight = Math.max(36, titleSize * 2.5);
    const minH = v_icon + titleBlockHeight + 8;
    if (minH > v_h) v_h = minH;
  }

  return {
    minWidth: isHorizontal ? h_w : v_w,
    height: isHorizontal ? h_h : v_h,
    iconSize: isHorizontal ? h_icon : v_icon,
    gap,
  };
};

// Close settings when clicking outside
// Note: In a real app we might use onClickOutside from @vueuse/core on the menu ref,
// but here we can just rely on the fact that clicking elsewhere (if not stopped) handles it?
// Actually, a global click listener or backdrop is safer.
// For now, let's use a simple window click listener or just rely on the toggle.
// Better: Use a transparent fixed inset div when menu is open to catch clicks.

// Visitor Stats
const onlineDuration = ref("00:00:00");
const totalVisitors = ref(0);
const todayVisitors = ref(0);
let onlineTimer: ReturnType<typeof setInterval> | null = null;
let onlineStartTime = 0;
let onlineElapsedMs = 0;

const updateOnlineDuration = () => {
  const elapsed =
    onlineElapsedMs + (onlineStartTime ? Date.now() - onlineStartTime : 0);
  const diff = Math.floor(elapsed / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  onlineDuration.value = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const startOnlineTimer = () => {
  if (onlineTimer) clearInterval(onlineTimer);
  onlineStartTime = Date.now();
  updateOnlineDuration();
  onlineTimer = setInterval(() => {
    updateOnlineDuration();
  }, 5000);
};

const stopOnlineTimer = () => {
  if (onlineStartTime) {
    onlineElapsedMs += Date.now() - onlineStartTime;
    onlineStartTime = 0;
  }
  if (onlineTimer) clearInterval(onlineTimer);
  onlineTimer = null;
};

const handleFooterVisibilityChange = () => {
  if (!store.appConfig.showFooterStats) return;
  if (document.visibilityState === "hidden") stopOnlineTimer();
  else startOnlineTimer();
};

const recordVisit = async () => {
  try {
    const res = await fetch("/api/visitor/track", { method: "POST" });
    const data = await res.json();
    if (data.success) {
      totalVisitors.value = data.totalVisitors;
      todayVisitors.value = data.todayVisitors;
    }
  } catch (e) {
    console.error("Failed to record visit", e);
  }
};

watch(
  () => store.appConfig.showFooterStats,
  (val) => {
    if (val) {
      onlineElapsedMs = 0;
      startOnlineTimer();
      document.addEventListener(
        "visibilitychange",
        handleFooterVisibilityChange,
      );
      recordVisit();
    } else {
      stopOnlineTimer();
      document.removeEventListener(
        "visibilitychange",
        handleFooterVisibilityChange,
      );
    }
  },
  { immediate: true },
);

onMounted(() => {
  updateHour();
  if (daylightTimer) clearInterval(daylightTimer);
  daylightTimer = setInterval(updateHour, 60 * 1000);
  refreshHomeTopTime();
  if (homeTopClockTimer) clearInterval(homeTopClockTimer);
  homeTopClockTimer = setInterval(refreshHomeTopTime, 30 * 1000);
});

onUnmounted(() => {
  if (daylightTimer) clearInterval(daylightTimer);
  if (homeTopClockTimer) clearInterval(homeTopClockTimer);
});
</script>

<template>
  <div
    class="startdeck-handshake-signal"
    style="display: none !important"
  ></div>
  <div
    class="min-h-dvh relative overflow-hidden flex flex-col pt-[env(safe-area-inset-top)]"
    :class="{ 'empire-theme': store.appConfig.empireMode }"
  >
    <!-- ✨ Global Background Layer -->
    <div class="fixed inset-0 z-0 pointer-events-none select-none">
      <!-- Default Background (Gradient Clouds) -->
      <div
        v-if="
          !store.appConfig.empireMode && store.appConfig.solidBackgroundColor
        "
        class="absolute inset-0 transition-all duration-500"
        :style="{ backgroundColor: store.appConfig.solidBackgroundColor }"
      ></div>
      <div
        v-else-if="!store.appConfig.empireMode"
        class="absolute inset-0 transition-all duration-500"
        style="background-image: var(--sd-home-preview-default-background)"
      ></div>

      <!-- Empire Mode Background -->
      <div
        v-if="store.appConfig.empireMode"
        class="absolute inset-0 z-20"
        style="background: var(--sd-home-preview-empire-background)"
      >
        <div
          class="absolute inset-0 opacity-30"
          :style="{
            backgroundImage: `url('${store.getAssetUrl(empireBackgroundUrl)}')`,
          }"
        ></div>
      </div>

      <!-- Desktop Image Layer -->
      <div
        class="absolute inset-[-20px] bg-cover bg-center bg-no-repeat"
        :class="
          (store.appConfig.enableMobileWallpaper ?? true)
            ? 'hidden md:block'
            : 'block'
        "
        v-if="store.appConfig.background"
        :style="{
          backgroundImage: `url('${store.getAssetUrl(store.appConfig.background)}')`,
          filter: `blur(${store.appConfig.backgroundBlur ?? 0}px)`,
          opacity: isPcBgLoaded ? 1 : 0,
          transition: 'opacity 0.5s ease-in-out, filter 0.3s ease-in-out',
        }"
      ></div>

      <!-- Mobile Image Layer -->
      <div
        class="absolute inset-[-20px] bg-cover bg-center bg-no-repeat md:hidden"
        v-if="
          (store.appConfig.enableMobileWallpaper ?? true) &&
          store.appConfig.mobileBackground
        "
        :style="{
          backgroundImage: `url('${store.getAssetUrl(store.appConfig.mobileBackground)}')`,
          filter: `blur(${store.appConfig.mobileBackgroundBlur ?? 0}px)`,
          opacity: isMobileBgLoaded ? 1 : 0,
          transition: 'opacity 0.5s ease-in-out, filter 0.3s ease-in-out',
        }"
      ></div>

      <!-- Desktop Mask Layer -->
      <div
        class="absolute inset-0 transition-all duration-300"
        :class="
          (store.appConfig.enableMobileWallpaper ?? true)
            ? 'hidden md:block'
            : 'block'
        "
        :style="{
          backgroundColor: `rgba(0,0,0,${effectiveBackgroundMask})`,
        }"
      ></div>

      <!-- Mobile Mask Layer -->
      <div
        class="absolute inset-0 transition-all duration-300 md:hidden"
        v-if="store.appConfig.enableMobileWallpaper ?? true"
        :style="{
          backgroundColor: `rgba(0,0,0,${effectiveMobileBackgroundMask})`,
        }"
      ></div>
    </div>

    <div
      class="flex-1 w-full p-4 md:p-8 transition-all pb-[calc(2rem+env(safe-area-inset-bottom))] md:pb-[calc(2.5rem+env(safe-area-inset-bottom))] relative z-10"
      @contextmenu="handleBlankContextMenu"
      :style="{
        backgroundColor:
          store.appConfig.background || store.appConfig.solidBackgroundColor
            ? 'transparent'
            : 'var(--sd-home-background-fallback)',
        '--group-title-color':
          store.appConfig.groupTitleColor ||
          'var(--sd-home-card-title-on-media)',
        '--card-bg-color': store.appConfig.cardBgColor || 'transparent',
        '--card-border-color': store.appConfig.cardBorderColor || 'transparent',
        '--card-border-hover-color':
          store.appConfig.cardBorderColor &&
          store.appConfig.cardBorderColor !== 'transparent'
            ? store.appConfig.cardBorderColor
            : store.appConfig.background || store.appConfig.solidBackgroundColor
              ? 'var(--sd-home-card-outline-on-media)'
              : 'var(--sd-home-card-outline-default)',
      }"
    >
      <div
        class="mx-auto transition-all duration-300"
        :style="{ maxWidth: mainContentMaxWidth }"
      >
        <div
          class="startdeck-header-container sd-home-header-frame"
          :class="{ 'is-editing': isHomeEditChromeVisible }"
        >
          <div
            class="sd-home-brandline"
            :style="{
              order:
                isHeaderRowLayout && store.appConfig.titleAlign === 'right'
                  ? 2
                  : 0,
            }"
          >
            <h1
              v-if="showHomeTitle"
              class="sd-home-brand-title transition-all duration-300 whitespace-nowrap overflow-hidden text-ellipsis max-w-full"
              :style="{
                fontSize: headerTitleFontSize + 'px',
                lineHeight: '1.05',
                maxWidth: headerTitleMaxWidth + 'px',
                color: store.appConfig.titleColor,
                textShadow: store.appConfig.background
                  ? 'var(--sd-home-title-text-shadow-on-media)'
                  : 'none',
              }"
            >
              {{ store.appConfig.customTitle }}
            </h1>
            <span
              class="sd-home-brand-meta"
              :class="{ 'is-empty': !homeStatusLabel }"
              :aria-hidden="homeStatusLabel ? undefined : 'true'"
              :style="{
                color: store.appConfig.titleColor,
                textShadow: store.appConfig.background
                  ? 'var(--sd-home-title-text-shadow-on-media)'
                  : 'none',
              }"
            >
              {{ homeStatusLabel }}
            </span>
          </div>

          <div
            class="startdeck-handshake-signal sd-home-top-slot"
            :class="{ 'is-editing': isHomeEditChromeVisible }"
          >
            <HomeActionBar
              v-if="store.isLogged && isHomeEditChromeVisible"
              class="pointer-events-auto"
              :is-saving="store.isSaving"
              :has-unsaved-changes="store.hasUnsavedChanges"
              @save="toggleEditMode"
              @add-widget="openAddWidgetModal"
              @add-group="store.addGroup"
            />
            <HomeTopActions
              v-else-if="!showAddWidgetModal"
              :force-mode="forceMode"
              :is-lan="effectiveIsLan"
              :latency="latency"
              :is-checking="isChecking"
              :is-logged="store.isLogged"
              @toggle-force-mode="toggleForceMode"
              @settings="openSettings"
              @edit="toggleEditMode"
              @login="openLogin"
              @logout="logoutFromHome"
            />
          </div>
        </div>

        <section
          v-if="showHomeTopTime || showHomeTopSearch"
          class="sd-itab-home-top"
          data-home-source-top
          :class="{
            'has-time': showHomeTopTime,
            'has-search': showHomeTopSearch,
          }"
        >
          <header
            v-if="showHomeTopTime"
            class="sd-itab-home-clock"
            :style="{
              color: store.appConfig.titleColor,
              textShadow: store.appConfig.background
                ? 'var(--sd-home-card-search-shadow-on-media)'
                : 'var(--sd-home-card-search-shadow-default)',
            }"
          >
            <div class="sd-itab-home-clock-digits">
              <time>{{ homeTopHourText }}</time>
              <span>:</span>
              <time>{{ homeTopMinuteText }}</time>
            </div>
            <p>{{ homeTopDateText }}</p>
          </header>

          <div v-if="showHomeTopSearch" class="sd-itab-home-search-wrap">
            <form
              class="sd-itab-home-search"
              role="search"
              action="."
              @submit.prevent="submitHomeSearch"
            >
              <button
                class="sd-itab-home-search-icon"
                type="button"
                :title="activeHomeSearchEngine?.label || '搜索引擎'"
                @click="homeSearchInputRef?.focus()"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m16 16 4 4" />
                </svg>
              </button>
              <input
                ref="homeSearchInputRef"
                v-model="homeSearchText"
                type="search"
                autocomplete="off"
                aria-label="输入搜索内容"
                placeholder="输入搜索内容"
              />
              <button
                class="sd-itab-home-search-submit"
                type="submit"
                aria-label="搜索"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12h13" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </button>
            </form>

            <nav class="sd-itab-home-search-engines" aria-label="搜索引擎">
              <button
                v-for="engine in homeSearchEngines"
                :key="engine.key"
                type="button"
                :class="{
                  'is-active': engine.key === activeHomeSearchEngine?.key,
                }"
                :aria-pressed="engine.key === activeHomeSearchEngine?.key"
                @click="selectHomeSearchEngine(engine.key)"
              >
                {{ engine.label }}
              </button>
              <button
                type="button"
                class="is-add"
                @click="openHomeSearchSettings"
              >
                添加
              </button>
            </nav>
          </div>
        </section>

        <div
          v-if="layoutData.length > 0"
          class="group-container transition-all"
          :style="{
            width: widgetAreaContainerWidth,
            maxWidth: 'none',
            marginLeft: 'auto',
            marginRight: 'auto',
            marginBottom: DEFAULT_GROUP_GAP + 'px',
          }"
        >
          <div
            v-if="isGridAlive"
            ref="gridLayoutRootRef"
            :style="{
              width: itabGridLayoutWidth + 'px',
              maxWidth: 'none',
              marginLeft: 'auto',
              marginRight: 'auto',
            }"
            :class="['grid-stack sd-home-grid-stack text-white select-none']"
          >
            <div
              v-for="widget in layoutData"
              :key="widget.i"
              class="grid-stack-item relative"
              :gs-id="widget.i"
              :gs-x="widget.x"
              :gs-y="widget.y"
              :gs-w="widget.w"
              :gs-h="widget.h"
              :data-widget-grid-item="widget.id"
              :class="[
                isHomeEditChromeVisible ? 'rounded-2xl overflow-visible' : '',
                widget.hideOnMobile ? 'hidden md:block' : '',
                store.appConfig.empireMode && isEmpireCloudWidget(widget.type)
                  ? 'empire-cloud-widget'
                  : '',
              ]"
            >
              <div class="grid-stack-item-content">
                <WidgetEditFrame
                  :editing="isHomeEditChromeVisible"
                  :selected="
                    isHomeEditChromeVisible && selectedWidgetId === widget.id
                  "
                  :widget-type="widget.type"
                  :widget-size="widgetFrameMetadataSize(widget)"
                  delete-label="禁用组件"
                  @select="selectWidgetForEdit(widget.id)"
                  @delete="closeWidgetFromGrid(widget)"
                >
                  <WidgetRuntimeFrame
                    v-if="isRuntimeWidget(widget)"
                    :widget="widget"
                    :editing="isHomeEditChromeVisible"
                    :is-dragging="isHomeWidgetDragging"
                    :validate-contract="isGridStackReady"
                    :refresh-token="runtimeRefreshTokens[widget.id] || 0"
                    @open="openRuntimeWidget"
                    @contextmenu="openRuntimeContextMenu"
                    @update-data="updateRuntimeWidgetData"
                  />
                </WidgetEditFrame>
              </div>
            </div>
          </div>
        </div>

        <VueDraggable
          v-model="store.groups"
          handle=".group-handle"
          :move="checkMove"
          :animation="300"
          :forceFallback="true"
          :disabled="!isHomeEditChromeVisible"
          @end="() => store.markDirty()"
          class="pb-20 flex flex-col transition-all"
          :style="{ gap: DEFAULT_GROUP_GAP + 'px' }"
        >
          <div
            v-for="group in displayGroups"
            :key="group.id"
            class="group-container"
            :id="'group-' + group.id"
          >
            <div
              class="flex items-center gap-3 mb-2 group-header relative transition-opacity duration-200"
              :class="{ 'opacity-0 hover:opacity-100': group.autoHideTitle }"
            >
              <div
                v-if="isHomeEditChromeVisible"
                class="group-handle cursor-move text-white/50 hover:text-white p-1 select-none text-xl"
              >
                ⋮⋮
              </div>
              <h2
                class="text-xl font-bold shadow-text px-2 rounded transition-colors outline-none"
                :style="{
                  color:
                    group.titleColor ||
                    store.appConfig.groupTitleColor ||
                    'var(--group-title-color)',
                }"
              >
                {{ group.title }}
              </h2>

              <div class="flex items-center gap-2">
                <button
                  v-if="store.isLogged && !showAddWidgetModal"
                  @click="openAddModal(group.id)"
                  class="w-7 h-7 rounded-full bg-white/10 hover:bg-white/30 text-white flex items-center justify-center transition-all shadow-sm border border-white/10"
                  title="添加卡片"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </button>

                <button
                  v-if="store.isLogged && !showAddWidgetModal"
                  @click.stop="toggleGroupSettings(group.id)"
                  class="w-7 h-7 rounded-full bg-white/10 hover:bg-white/30 text-white flex items-center justify-center transition-all shadow-sm border border-white/10"
                  title="分组设置"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </button>

                <button
                  v-if="store.isLogged && isHomeEditChromeVisible"
                  @click="openGroupDeleteConfirm(group.id)"
                  class="w-7 h-7 rounded-full bg-white/10 hover:bg-red-500 hover:text-white text-white/50 flex items-center justify-center transition-all shadow-sm border border-white/10"
                  title="删除分组"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </button>
              </div>

              <span
                v-if="group.preset"
                class="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded border border-yellow-200"
              >
                预设
              </span>
            </div>

            <VueDraggable
              :model-value="group.items"
              @update:model-value="
                (newItems: NavItem[]) => onGroupItemsChange(group.id, newItems)
              "
              @end="() => store.markDirty()"
              group="apps"
              :animation="200"
              :forceFallback="true"
              :disabled="!isHomeEditChromeVisible"
              class="grid transition-all duration-300 min-h-[100px] rounded-xl"
              :class="
                isHomeEditChromeVisible
                  ? 'bg-white/5 border-2 border-dashed border-white/20 p-2 md:p-4'
                  : ''
              "
              :style="{
                gap: getLayoutConfig(group).gap + 'px',
                gridTemplateColumns: `repeat(auto-fill, minmax(${getLayoutConfig(group).minWidth}px, 1fr))`,
              }"
              ghostClass="ghost"
            >
              <div
                v-for="item in group.items"
                :key="item.id"
                @click="handleCardClick(item)"
                @contextmenu.prevent.stop="
                  handleContextMenu($event, item, group.id)
                "
                @pointerdown="(e) => onCardPointerDown(e, item, group.id)"
                @pointermove="onCardPointerMove"
                @pointerup="onCardPointerUp"
                @pointercancel="onCardPointerUp"
                @touchstart="(e) => onCardTouchStart(e, item, group.id)"
                @touchmove="onCardTouchMove"
                @touchend="onCardTouchEnd"
                @touchcancel="onCardTouchEnd"
                :data-card-item="item.id"
                class="card-item flex items-center cursor-pointer transition-all select-none relative group hover:z-[999] overflow-hidden"
                :class="[
                  item.containerId && isUpdating.has(item.containerId)
                    ? 'opacity-50 pointer-events-none !cursor-not-allowed animate-pulse ring-2 ring-yellow-400'
                    : '',
                  isHomeEditChromeVisible
                    ? 'animate-pulse cursor-move ring-2 ring-blue-400'
                    : '',
                  (group.cardLayout || store.appConfig.cardLayout) ===
                  'horizontal'
                    ? 'flex-row px-4 py-2 gap-3 justify-start'
                    : 'flex-col gap-1.5 justify-start',
                  (group.iconShape || store.appConfig.iconShape) === 'circle'
                    ? 'rounded-2xl'
                    : (group.iconShape || store.appConfig.iconShape) ===
                        'rounded'
                      ? 'rounded-2xl'
                      : (group.iconShape || store.appConfig.iconShape) ===
                          'leaf'
                        ? 'rounded-tl-3xl rounded-br-3xl rounded-tr-md rounded-bl-md'
                        : 'rounded-lg',
                  (group.showCardBackground ??
                    store.appConfig.showCardBackground) === false
                    ? ''
                    : 'border backdrop-blur-sm',
                  store.appConfig.mouseHoverEffect === 'lift'
                    ? 'hover:-translate-y-1 hover:shadow-lg'
                    : store.appConfig.mouseHoverEffect === 'glow'
                      ? 'hover:shadow-[var(--sd-home-card-hover-glow-shadow)]'
                      : store.appConfig.mouseHoverEffect === 'none'
                        ? ''
                        : 'hover:scale-105 active:scale-95',
                ]"
                :style="{
                  height: getLayoutConfig(group).height + 'px',
                  backgroundColor:
                    (group.showCardBackground ??
                      store.appConfig.showCardBackground) === false
                      ? 'transparent'
                      : group.cardBgColor ||
                        store.appConfig.cardBgColor ||
                        'var(--card-bg-color)',
                  borderColor:
                    (group.showCardBackground ??
                      store.appConfig.showCardBackground) === false
                      ? 'transparent'
                      : 'var(--card-border-color)',
                }"
              >
                <!-- ✨ 背景图层 (高斯模糊 + 遮罩) -->
                <div
                  v-if="item.backgroundImage || group.backgroundImage"
                  class="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-[inherit]"
                >
                  <div
                    class="absolute inset-0 bg-cover bg-center transition-all duration-300"
                    :style="{
                      backgroundImage: `url('${store.getAssetUrl(item.backgroundImage || group.backgroundImage)}')`,
                      filter: `blur(${item.backgroundImage ? (item.backgroundBlur ?? 6) : (group.backgroundBlur ?? 6)}px)`,
                      transform: 'scale(1.1)',
                    }"
                  ></div>
                  <div
                    class="absolute inset-0"
                    :style="{
                      backgroundColor: `rgba(0,0,0,${item.backgroundImage ? (item.backgroundMask ?? 0.3) : (group.backgroundMask ?? 0.3)})`,
                    }"
                  ></div>
                </div>

                <!-- Docker Stats Background Bars -->
                <div
                  v-if="getContainerStatus(item)"
                  class="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-[inherit]"
                >
                  <!-- Update Dot (Top Left) -->
                  <div
                    v-if="
                      getContainerStatus(item)?.hasUpdate &&
                      (!item.containerId || !isUpdating.has(item.containerId))
                    "
                    class="absolute top-1.5 left-1.5 w-2.5 h-2.5 rounded-full z-50 border animate-pulse"
                    :style="{
                      backgroundColor: 'var(--sd-home-card-update-dot-bg)',
                      borderColor: 'var(--sd-home-card-update-dot-border)',
                      boxShadow: 'var(--sd-home-card-update-dot-shadow)',
                    }"
                    title="Container Image Update Available"
                  ></div>

                  <!-- Updating Indicator -->
                  <div
                    v-if="item.containerId && isUpdating.has(item.containerId)"
                    class="absolute inset-0 z-[60] flex items-center justify-center bg-black/10 backdrop-blur-[1px]"
                  >
                    <div
                      class="animate-spin w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full"
                    ></div>
                  </div>

                  <!-- CPU Bar (Top, Right to Left) -->
                  <div
                    class="absolute top-0 right-0 w-full h-1/2 bg-transparent opacity-20"
                  >
                    <div
                      class="absolute top-0 right-0 h-full bg-blue-500 transition-all duration-1000 ease-out"
                      :style="{
                        width:
                          Math.min(
                            100,
                            Math.max(
                              0,
                              getContainerStatus(item)?.stats?.cpuPercent || 0,
                            ),
                          ) + '%',
                      }"
                    ></div>
                  </div>
                  <!-- CPU Label -->
                  <div
                    class="absolute top-1 right-4 opacity-40 select-none z-10"
                  >
                    <svg
                      class="w-8 h-8"
                      viewBox="0 0 1024 1024"
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      p-id="8931"
                    >
                      <path
                        d="M719.768116 237.449275H304.231884a59.362319 59.362319 0 0 0-59.362319 59.362319v415.536232a59.362319 59.362319 0 0 0 59.362319 59.362319h415.536232a59.362319 59.362319 0 0 0 59.362319-59.362319V296.811594a59.362319 59.362319 0 0 0-59.362319-59.362319z m0 474.898551H304.231884V296.811594h415.536232v415.536232z m267.130435-237.449275a29.681159 29.681159 0 0 0 0-59.362319h-103.884058v-89.043478h103.884058a29.681159 29.681159 0 0 0 0-59.362319h-103.884058v-50.265044A78.313739 78.313739 0 0 0 801.391304 133.565217H764.289855V29.681159a29.681159 29.681159 0 0 0-59.362319 0v103.884058h-89.043478V29.681159a29.681159 29.681159 0 0 0-59.362319 0v103.884058h-89.043478V29.681159a29.681159 29.681159 0 0 0-59.362319 0v103.884058h-37.101449C173.516058 133.565217 126.144928 167.698551 126.144928 216.865391V267.130435H37.101449a29.681159 29.681159 0 0 0 0 59.362319h89.043479v89.043478H37.101449a29.681159 29.681159 0 0 0 0 59.362319h89.043479v89.043478H37.101449a29.681159 29.681159 0 0 0 0 59.362319h89.043479v89.043478H37.101449a29.681159 29.681159 0 0 0 0 59.362319h89.043479v23.937855A100.826899 100.826899 0 0 0 222.608696 890.434783H259.710145v103.884058a29.681159 29.681159 0 0 0 59.362319 0v-103.884058h89.043478v103.884058a29.681159 29.681159 0 0 0 59.362319 0v-103.884058h89.043478v103.884058a29.681159 29.681159 0 0 0 59.362319 0v-103.884058h37.101449c49.092638 0 81.623188-45.694145 81.623189-94.786783V771.710145h103.884058a29.681159 29.681159 0 0 0 0-59.362319h-103.884058v-89.043478h103.884058a29.681159 29.681159 0 0 0 0-59.362319h-103.884058v-89.043478h103.884058zM823.652174 801.391304a29.681159 29.681159 0 0 1-29.68116 29.68116H215.188406a29.681159 29.681159 0 0 1-29.68116-29.68116V222.608696a29.681159 29.681159 0 0 1 29.68116-29.68116h578.782608a29.681159 29.681159 0 0 1 29.68116 29.68116v578.782608z"
                        fill="var(--sd-home-card-icon-fill)"
                        p-id="8932"
                      ></path>
                    </svg>
                  </div>

                  <!-- Memory Bar (Bottom, Left to Right) -->
                  <div
                    class="absolute bottom-0 left-0 w-full h-1/2 bg-transparent opacity-20"
                  >
                    <div
                      class="absolute top-0 left-0 h-full bg-green-500 transition-all duration-1000 ease-out"
                      :style="{
                        width:
                          Math.min(
                            100,
                            Math.max(
                              0,
                              getContainerStatus(item)?.stats?.memPercent || 0,
                            ),
                          ) + '%',
                      }"
                    ></div>
                  </div>
                  <!-- MEM Label -->
                  <div
                    class="absolute bottom-1 left-1/2 -translate-x-1/2 opacity-40 select-none z-10"
                  >
                    <svg
                      class="w-8 h-8"
                      viewBox="0 0 1024 1024"
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      p-id="4800"
                    >
                      <path
                        d="M85.333333 213.333333a42.666667 42.666667 0 0 0-42.666666 42.666667v384a42.666667 42.666667 0 0 0 42.666666 42.666667v85.333333a42.666667 42.666667 0 0 0 42.666667 42.666667h316.330667l42.666666-42.666667h50.005334l42.666666 42.666667H896a42.666667 42.666667 0 0 0 42.666667-42.666667v-85.333333a42.666667 42.666667 0 0 0 42.666666-42.666667V256a42.666667 42.666667 0 0 0-42.666666-42.666667H85.333333z m768 469.333334v42.666666h-238.336l-42.666666-42.666666H853.333333z m-401.664 0l-42.666666 42.666666H170.666667v-42.666666h281.002666zM128 597.333333V298.666667h768v298.666666H128z m85.333333-213.333333h85.333334v128H213.333333V384z m256 0H384v128h85.333333V384z m85.333334 0h85.333333v128h-85.333333V384z m256 0h-85.333334v128h85.333334V384z"
                        fill="var(--sd-home-card-icon-fill)"
                        p-id="4801"
                      ></path>
                    </svg>
                  </div>
                </div>

                <div
                  v-if="isHomeEditChromeVisible && item.isPublic"
                  class="absolute bottom-1 right-1 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200 z-20"
                >
                  公开
                </div>

                <div
                  class="relative flex items-center justify-center flex-shrink-0 transition-all duration-300 relative z-10"
                  v-if="
                    (group.iconShape || store.appConfig.iconShape) !== 'hidden'
                  "
                  :style="{
                    width: getLayoutConfig(group).iconSize + 'px',
                    height: getLayoutConfig(group).iconSize + 'px',
                  }"
                >
                  <div
                    class="absolute inset-0 overflow-hidden flex items-center justify-center rounded-[inherit]"
                  >
                    <IconShape
                      :shape="group.iconShape || store.appConfig.iconShape"
                      :size="getLayoutConfig(group).iconSize"
                      :imgScale="item.iconSize"
                      :bgClass="
                        getIconBackground(
                          item,
                          group.iconShape || store.appConfig.iconShape,
                        )
                      "
                      :icon="processIcon(item.icon || '')"
                      class="transition-all duration-300 relative z-10 w-full h-full"
                      :class="
                        item.backgroundImage || group.backgroundImage
                          ? 'drop-shadow-lg'
                          : ''
                      "
                    />
                  </div>

                  <!-- Container Status Indicator -->
                  <div
                    v-if="getContainerStatus(item)"
                    class="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white z-20"
                    :class="
                      getContainerStatus(item)?.state === 'running'
                        ? 'bg-green-500'
                        : 'bg-gray-400'
                    "
                    :title="getContainerStatus(item)?.state"
                  ></div>

                  <!-- Backup Url Badges -->
                  <!-- 外网备用地址 (左上角, 蓝色) -->
                  <div
                    v-if="item.backupUrls && item.backupUrls.length > 0"
                    class="absolute -top-1 -left-1 z-20 flex flex-col gap-0.5 pointer-events-auto"
                  >
                    <div
                      v-for="(url, idx) in item.backupUrls"
                      :key="'wan-' + idx"
                      @click.stop="openBackupUrl(url)"
                      class="flex items-center justify-center rounded-full bg-blue-600 text-white font-sans font-bold cursor-pointer hover:scale-110 hover:bg-blue-500 transition-all shadow-sm border border-white/50"
                      :style="{
                        width:
                          Math.max(16, getLayoutConfig(group).iconSize * 0.22) +
                          'px',
                        height:
                          Math.max(16, getLayoutConfig(group).iconSize * 0.22) +
                          'px',
                        fontSize:
                          Math.max(10, getLayoutConfig(group).iconSize * 0.14) +
                          'px',
                        lineHeight: 1,
                      }"
                      :title="
                        typeof url === 'string'
                          ? '外网: ' + url
                          : url.name || '外网: ' + url.url
                      "
                    >
                      {{ idx + 1 }}
                    </div>
                  </div>

                  <!-- 内网备用地址 (右上角, 绿色) -->
                  <div
                    v-if="item.backupLanUrls && item.backupLanUrls.length > 0"
                    class="absolute -top-1 -right-1 z-20 flex flex-col gap-0.5 pointer-events-auto"
                  >
                    <div
                      v-for="(url, idx) in item.backupLanUrls"
                      :key="'lan-' + idx"
                      @click.stop="openBackupUrl(url)"
                      class="flex items-center justify-center rounded-full bg-green-600 text-white font-sans font-bold cursor-pointer hover:scale-110 hover:bg-green-500 transition-all shadow-sm border border-white/50"
                      :style="{
                        width:
                          Math.max(16, getLayoutConfig(group).iconSize * 0.22) +
                          'px',
                        height:
                          Math.max(16, getLayoutConfig(group).iconSize * 0.22) +
                          'px',
                        fontSize:
                          Math.max(10, getLayoutConfig(group).iconSize * 0.14) +
                          'px',
                        lineHeight: 1,
                      }"
                      :title="
                        typeof url === 'string'
                          ? '内网: ' + url
                          : url.name || '内网: ' + url.url
                      "
                    >
                      {{ idx + 1 }}
                    </div>
                  </div>
                </div>

                <!-- Horizontal Mode: 3-Line Custom Text -->
                <div
                  v-if="
                    (group.cardLayout || store.appConfig.cardLayout) ===
                    'horizontal'
                  "
                  class="flex-1 flex flex-col h-full justify-center gap-0.5 overflow-hidden relative z-10"
                >
                  <!-- Line 1 (Top) -->
                  <div
                    :class="[
                      !item.description1 &&
                      !item.description2 &&
                      !item.description3
                        ? 'text-left'
                        : 'text-xs',
                      'truncate font-medium leading-tight flex justify-between items-center',
                    ]"
                    :style="{
                      color:
                        item.backgroundImage || group.backgroundImage
                          ? 'var(--sd-home-card-title-on-media)'
                          : group.cardTitleColor ||
                            store.appConfig.cardTitleColor ||
                            'var(--sd-home-card-title-primary)',
                      fontSize: group.cardTitleSize
                        ? group.cardTitleSize + 'px'
                        : undefined,
                      textShadow:
                        item.backgroundImage || group.backgroundImage
                          ? 'var(--sd-home-card-text-shadow-on-media)'
                          : 'none',
                      opacity:
                        item.description1 ||
                        (!item.description2 && !item.description3)
                          ? 1
                          : 0.5,
                    }"
                  >
                    <span class="truncate flex-1">{{
                      item.description1 || item.title
                    }}</span>
                  </div>

                  <!-- Docker Stats Info -->
                  <div
                    v-if="getContainerStatus(item)"
                    class="flex flex-col gap-0.5 text-[10px] mt-0.5 w-full opacity-90 leading-none font-mono"
                    :style="{
                      color:
                        item.backgroundImage || group.backgroundImage
                          ? 'var(--sd-home-card-title-on-media)'
                          : group.cardTitleColor ||
                            store.appConfig.cardTitleColor ||
                            'var(--sd-home-card-title-secondary)',
                      textShadow:
                        item.backgroundImage || group.backgroundImage
                          ? 'var(--sd-home-card-text-shadow-on-media)'
                          : 'none',
                    }"
                  >
                    <div
                      class="flex justify-between items-center"
                      title="Network I/O (RX/TX)"
                    >
                      <span class="font-bold opacity-70">NET</span>
                      <span class="font-mono truncate ml-1">
                        <template v-if="getContainerStatus(item)?.stats">
                          ↓{{
                            formatBytes(
                              getContainerStatus(item)?.stats?.netIO?.rx || 0,
                              0,
                            )
                          }}/s
                        </template>
                        <template v-else>--</template>
                      </span>
                    </div>
                    <div
                      class="flex justify-between items-center"
                      title="Block I/O (Read/Write)"
                    >
                      <span class="font-bold opacity-70">IO</span>
                      <span class="font-mono truncate ml-1">
                        <template v-if="getContainerStatus(item)?.stats">
                          R{{
                            formatBytes(
                              getContainerStatus(item)?.stats?.blockIO?.read ||
                                0,
                              0,
                            )
                          }}/s
                        </template>
                        <template v-else>--</template>
                      </span>
                    </div>
                  </div>

                  <!-- Line 2 (Middle) -->
                  <div
                    class="text-[10px] truncate leading-tight opacity-80"
                    :style="{
                      color:
                        item.backgroundImage || group.backgroundImage
                          ? 'var(--sd-home-card-description-on-media)'
                          : group.cardTitleColor ||
                            store.appConfig.cardTitleColor ||
                            'var(--sd-home-card-title-tertiary)',
                      textShadow:
                        item.backgroundImage || group.backgroundImage
                          ? 'var(--sd-home-card-text-shadow-on-media)'
                          : 'none',
                    }"
                  >
                    {{ item.description2 || "" }}
                  </div>

                  <!-- Line 3 (Bottom) -->
                  <div
                    class="text-[10px] truncate leading-tight opacity-70"
                    :style="{
                      color:
                        item.backgroundImage || group.backgroundImage
                          ? 'var(--sd-home-card-description-muted-on-media)'
                          : group.cardTitleColor ||
                            store.appConfig.cardTitleColor ||
                            'var(--sd-home-card-title-quaternary)',
                      textShadow:
                        item.backgroundImage || group.backgroundImage
                          ? 'var(--sd-home-card-text-shadow-on-media)'
                          : 'none',
                    }"
                  >
                    {{ item.description3 || "" }}
                  </div>
                </div>

                <!-- Vertical Mode: Standard Title -->
                <span
                  v-else
                  class="font-medium line-clamp-2 leading-tight relative z-10 h-[2.5em] overflow-hidden"
                  :class="'text-center px-2 w-full'"
                  :style="{
                    color:
                      item.backgroundImage || group.backgroundImage
                        ? 'var(--sd-home-card-title-on-media)'
                        : group.cardTitleColor ||
                          store.appConfig.cardTitleColor ||
                          'var(--sd-home-card-title-primary)',
                    fontSize: (group.cardTitleSize ?? 13) + 'px',
                    textShadow:
                      item.backgroundImage || group.backgroundImage
                        ? 'var(--sd-home-card-text-shadow-strong)'
                        : 'none',
                  }"
                >
                  {{ item.title }}
                </span>
              </div>
            </VueDraggable>
          </div>
        </VueDraggable>
      </div>
    </div>

    <!-- Footer -->
    <footer
      class="w-full z-10 relative shrink-0 px-8 transition-all flex items-center pb-[env(safe-area-inset-bottom)]"
      :class="[
        !store.appConfig.footerHeight ? 'pt-6' : '',
        isMobile
          ? 'pb-[calc(6rem+env(safe-area-inset-bottom))]'
          : !store.appConfig.footerHeight
            ? 'pb-[calc(1.5rem+env(safe-area-inset-bottom))]'
            : '',
      ]"
      :style="{
        height: store.appConfig.footerHeight
          ? store.appConfig.footerHeight + 'px'
          : 'auto',
        marginBottom: (store.appConfig.footerMarginBottom || 0) + 'px',
      }"
    >
      <div
        class="mx-auto flex justify-between items-center w-full"
        :class="{ 'flex-col gap-6': isMobile }"
        :style="{
          maxWidth: (store.appConfig.footerWidth || 1280) + 'px',
          fontSize: (store.appConfig.footerFontSize || 12) + 'px',
        }"
      >
        <!-- Left: Visitor Stats -->
        <div
          class="flex-1 flex items-center justify-start gap-4"
          :class="{ '!justify-center order-last': isMobile }"
        >
          <!-- Connection Status -->
          <div
            v-if="false"
            class="flex items-center gap-2 opacity-80 select-none"
            :title="store.isConnected ? '已连接到服务器' : '与服务器断开连接'"
          >
            <div
              class="w-2 h-2 rounded-full transition-colors duration-300"
              :class="store.isConnected ? '' : 'animate-pulse'"
              :style="
                store.isConnected
                  ? {
                      backgroundColor: 'var(--sd-home-live-dot-bg)',
                      boxShadow: 'var(--sd-home-live-dot-shadow)',
                    }
                  : {
                      backgroundColor: 'var(--sd-home-offline-dot-bg)',
                    }
              "
            ></div>
            <span
              class="text-xs font-mono font-bold"
              :class="
                store.appConfig.background
                  ? 'text-white shadow-text'
                  : 'text-gray-500'
              "
              >{{ store.isConnected ? "LIVE" : "OFFLINE" }}</span
            >
          </div>

          <div
            v-if="store.appConfig.showFooterStats"
            class="flex gap-4 opacity-60 select-none"
            :class="
              store.appConfig.background
                ? 'text-white shadow-text'
                : 'text-gray-500'
            "
          >
            <div class="flex flex-col gap-1">
              <span>访客记录</span>
              <span class="font-mono">{{ totalVisitors }}</span>
            </div>
            <div class="w-px bg-current opacity-30"></div>
            <div class="flex flex-col gap-1">
              <span>今日访客</span>
              <span class="font-mono">{{ todayVisitors }}</span>
            </div>
            <div class="w-px bg-current opacity-30"></div>
            <div class="flex flex-col gap-1">
              <span>在线时长</span>
              <span class="font-mono">{{ onlineDuration }}</span>
            </div>
          </div>
        </div>

        <!-- Center: Custom HTML -->
        <div class="flex-1 flex justify-center px-4">
          <div
            v-if="store.appConfig.footerHtml"
            v-html="sanitizedFooterHtml"
            class="text-center opacity-60"
            :class="
              store.appConfig.background
                ? 'text-white shadow-text'
                : 'text-gray-500'
            "
          ></div>
        </div>
      </div>
    </footer>

    <!-- Group Settings Overlay -->
    <GroupSettingsModal
      v-if="showGroupSettingsModal"
      v-model:show="showGroupSettingsModal"
      :groupId="activeGroupId"
    />

    <EditModal
      v-if="showEditModal"
      v-model:show="showEditModal"
      :data="currentEditItem"
      :groupId="currentGroupId"
      :onSave="handleSave"
    />
    <SettingsModal v-if="showSettingsModal" v-model:show="showSettingsModal" />
    <AddWidgetModal
      v-if="showAddWidgetModal"
      v-model:show="showAddWidgetModal"
      :widgets="store.widgets"
      :groups="store.groups"
      :active-group-id="activeGroupId"
      :on-add-component="addComponent"
    />
    <LoginModal v-if="showLoginModal" v-model:show="showLoginModal" />

    <WidgetRuntimeMenu
      :show="!!runtimeContextMenu"
      :x="runtimeContextMenu?.x || 0"
      :y="runtimeContextMenu?.y || 0"
      :widget="runtimeMenuWidget"
      @close="closeRuntimeContextMenu"
      @refresh="refreshRuntimeWidget"
      @edit-icon="editRuntimeWidgetIcon"
      @edit-home="editRuntimeWidgetHome"
      @delete="deleteRuntimeWidget"
      @select-size="selectRuntimeWidgetSize"
    />

    <WidgetOpenedPanelHost
      :widget="openedRuntimeWidget"
      @add-data="addRuntimeWidgetData"
      @close="closeRuntimeWidget"
      @update-data="updateRuntimeWidgetData"
    />

    <ItabMemoFixedLayer
      :widget="runtimeMemoWidget"
      @update-data="updateRuntimeWidgetData"
    />

    <ContextMenuSurface
      :show="showBlankContextMenu"
      :z-index="50"
      overlay-class="sd-runtime-menu-overlay"
      panel-class="sd-runtime-menu-panel"
      surface-class="sd-runtime-menu-surface itab-add-blank-context-surface"
      scheme="dark"
      :panel-style="{
        top: blankContextMenuPosition.y + 'px',
        left: blankContextMenuPosition.x + 'px',
      }"
      @close="closeBlankContextMenu"
      @update:show="showBlankContextMenu = $event"
    >
      <div
        data-testid="itab-add-context-menu"
        data-grid-context-menu
        role="menu"
        class="itab-add-blank-context-list"
        tabindex="-1"
        @keydown="onBlankContextMenuKeydown"
      >
        <button
          v-for="(row, index) in blankContextRows"
          :key="row.action"
          type="button"
          class="itab-add-blank-context-row"
          :class="{ 'is-active': blankContextActiveIndex === index }"
          role="menuitem"
          :tabindex="blankContextActiveIndex === index ? 0 : -1"
          :data-testid="row.testId"
          @mouseenter="blankContextActiveIndex = index"
          @click="handleBlankContextAction(row.action)"
        >
          <span>{{ row.label }}</span>
          <span v-if="row.shortcut" class="itab-add-blank-context-shortcut">
            {{ row.shortcut }}
          </span>
        </button>
      </div>
    </ContextMenuSurface>

    <!-- Context Menu -->
    <ContextMenuSurface
      :show="showContextMenu"
      :z-index="50"
      panel-class="fixed"
      surface-class="min-w-[160px]"
      :panel-style="{
        top: contextMenuPosition.y + 'px',
        left: contextMenuPosition.x + 'px',
      }"
      @close="closeContextMenu"
      @update:show="showContextMenu = $event"
    >
      <div
        ref="contextMenuRef"
        data-grid-context-menu
        role="menu"
        class="sd-context-menu-list"
        @contextmenu.prevent.stop
      >
        <div
          v-if="contextMenuItem?.lanUrl"
          @click="handleMenuLanOpen"
          class="sd-context-menu-item is-success cursor-pointer truncate"
          role="menuitem"
          :aria-label="'内网访问 ' + (contextMenuItem.title || '')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
            />
          </svg>
          <span class="text-[14px] truncate">内网访问</span>
        </div>
        <!-- Backup LAN URLs -->
        <template
          v-if="
            contextMenuItem?.backupLanUrls &&
            contextMenuItem.backupLanUrls.length > 0
          "
        >
          <div
            v-for="(url, index) in contextMenuItem.backupLanUrls"
            :key="'backup-lan-' + index"
            @click="handleMenuOpen(url)"
            class="sd-context-menu-item is-success cursor-pointer truncate"
            role="menuitem"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
              />
            </svg>
            <span class="text-[14px] truncate">{{
              typeof url === "string"
                ? "备用内网 " + (index + 1)
                : url.name || "备用内网 " + (index + 1)
            }}</span>
          </div>
        </template>

        <div
          v-if="contextMenuItem?.url"
          @click="handleMenuWanOpen"
          class="sd-context-menu-item is-accent cursor-pointer truncate"
          role="menuitem"
          :aria-label="'外网访问 ' + (contextMenuItem.title || '')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <span class="text-[14px] truncate">外网访问</span>
        </div>
        <!-- Backup WAN URLs -->
        <template
          v-if="
            contextMenuItem?.backupUrls && contextMenuItem.backupUrls.length > 0
          "
        >
          <div
            v-for="(url, index) in contextMenuItem.backupUrls"
            :key="'backup-wan-' + index"
            @click="handleMenuOpen(url)"
            class="sd-context-menu-item is-accent cursor-pointer truncate"
            role="menuitem"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <span class="text-[14px] truncate">{{
              typeof url === "string"
                ? "备用外网 " + (index + 1)
                : url.name || "备用外网 " + (index + 1)
            }}</span>
          </div>
        </template>

        <!-- Docker Actions -->
        <template
          v-if="contextMenuItem?.containerId || contextMenuItem?.containerName"
        >
          <div
            v-if="
              getContainerStatus(contextMenuItem)?.hasUpdate &&
              !isItemUpdating(contextMenuItem)
            "
            @click="
              handleDockerAction(contextMenuItem, 'update');
              closeContextMenu();
            "
            class="sd-context-menu-item is-warning cursor-pointer truncate"
            role="menuitem"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span class="text-[14px] truncate">升级镜像</span>
          </div>

          <div
            v-if="getContainerStatus(contextMenuItem)?.state === 'running'"
            @click="
              handleDockerAction(contextMenuItem, 'stop');
              closeContextMenu();
            "
            class="sd-context-menu-item is-danger cursor-pointer truncate"
            role="menuitem"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
              />
            </svg>
            <span class="text-[14px] truncate">停止容器</span>
          </div>
          <div
            v-else
            @click="
              handleDockerAction(contextMenuItem, 'start');
              closeContextMenu();
            "
            class="sd-context-menu-item is-success cursor-pointer truncate"
            role="menuitem"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span class="text-[14px] truncate">启动容器</span>
          </div>

          <div
            @click="
              handleDockerAction(contextMenuItem, 'restart');
              closeContextMenu();
            "
            class="sd-context-menu-item is-accent cursor-pointer truncate"
            role="menuitem"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span class="text-[14px] truncate">重启容器</span>
          </div>
        </template>

        <div
          @click="handleMenuEdit"
          class="sd-context-menu-item cursor-pointer"
          role="menuitem"
          aria-label="编辑卡片"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          <span class="text-[14px] truncate">编辑卡片</span>
        </div>
        <div
          @click="handleMenuDelete"
          class="sd-context-menu-item is-danger cursor-pointer"
          role="menuitem"
          aria-label="删除卡片"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4 shrink-0"
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
          <span class="text-[14px] truncate">删除卡片</span>
        </div>
      </div>
    </ContextMenuSurface>

    <ConfirmDialog
      v-model:show="showDeleteConfirm"
      title="删除确认"
      :message="`确定要删除这个${deleteType === 'group' ? '分组' : '卡片'}吗？此操作无法撤销。`"
      confirm-label="删除"
      cancel-label="取消"
      tone="danger"
      :z-index="90"
      @cancel="cancelDelete"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.ghost {
  opacity: 0.4;
  background: var(--sd-theme-grid-panel-surface-01);
  border: 2px dashed var(--sd-theme-grid-panel-border-01);
}
.shadow-text {
  text-shadow: 0 2px 4px var(--sd-theme-grid-panel-shadow-01);
}

.sd-itab-home-top {
  display: grid;
  justify-items: center;
  gap: 18px;
  margin: 4px auto 28px;
}

.sd-itab-home-top.has-time.has-search {
  margin-top: -2px;
}

.sd-itab-home-clock {
  width: min(330px, 100%);
  text-align: center;
}

.sd-itab-home-clock-digits {
  display: flex;
  justify-content: center;
  font-family:
    "SF Pro Display",
    "SF Pro Icons",
    -apple-system,
    BlinkMacSystemFont,
    "Helvetica Neue",
    sans-serif;
  font-size: clamp(52px, 6vw, 72px);
  font-weight: 300;
  line-height: 1;
  letter-spacing: 0;
}

.sd-itab-home-clock p {
  margin: 4px 0 0;
  color: color-mix(in srgb, currentColor 86%, transparent);
  font-size: 14px;
  font-weight: 650;
  line-height: 20px;
  letter-spacing: 0;
}

.sd-itab-home-search-wrap {
  display: grid;
  width: min(600px, calc(100vw - 88px));
  justify-items: center;
  gap: 8px;
  --sd-itab-home-search-engine-selected-bg: color-mix(
    in srgb,
    var(--sd-theme-grid-panel-surface-02) 42%,
    transparent
  );
  --sd-itab-home-search-engine-selected-border: color-mix(
    in srgb,
    var(--sd-theme-grid-panel-border-02) 48%,
    transparent
  );
  --sd-itab-home-search-engine-text: color-mix(
    in srgb,
    var(--sd-theme-grid-panel-text-06) 90%,
    transparent
  );
  --sd-itab-home-search-engine-muted-text: color-mix(
    in srgb,
    var(--sd-theme-grid-panel-text-06) 72%,
    transparent
  );
  --sd-itab-home-search-engine-selected-text: var(
    --sd-itab-home-search-engine-text
  );
  --sd-itab-home-search-engine-text-shadow:
    0 1px 8px var(--sd-theme-grid-panel-shadow-03),
    0 0 2px var(--sd-theme-grid-panel-shadow-03);
}

.sd-itab-home-search {
  display: flex;
  width: 100%;
  height: 46px;
  align-items: center;
  overflow: hidden;
  border: 1px solid var(--sd-theme-grid-panel-border-02);
  border-radius: 999px;
  background: var(--sd-theme-grid-panel-surface-02);
  color: var(--sd-theme-grid-panel-text-01);
  box-shadow: 0 12px 34px var(--sd-theme-grid-panel-shadow-02);
  backdrop-filter: blur(18px) saturate(130%);
}

.sd-itab-home-search-icon,
.sd-itab-home-search-submit {
  display: grid;
  width: 50px;
  height: 46px;
  flex: none;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--sd-theme-grid-panel-text-02);
  cursor: pointer;
}

.sd-itab-home-search-icon svg,
.sd-itab-home-search-submit svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.sd-itab-home-search input {
  min-width: 0;
  height: 100%;
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--sd-theme-grid-panel-text-01);
  font-size: 14px;
  line-height: 20px;
}

.sd-itab-home-search input::placeholder {
  color: var(--sd-theme-grid-panel-text-03);
}

.sd-itab-home-search-engines {
  display: flex;
  max-width: 100%;
  min-height: 24px;
  align-items: center;
  justify-content: center;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
}

.sd-itab-home-search-engines::-webkit-scrollbar {
  display: none;
}

.sd-itab-home-search-engines button {
  width: 64px;
  height: 24px;
  flex: 0 0 auto;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--sd-itab-home-search-engine-text);
  font-size: 12px;
  font-weight: 700;
  line-height: 22px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: var(--sd-itab-home-search-engine-text-shadow);
  cursor: pointer;
}

.sd-itab-home-search-engines button:hover,
.sd-itab-home-search-engines button:focus-visible {
  outline: none;
}

.sd-itab-home-search-engines button.is-active {
  border-color: var(--sd-itab-home-search-engine-selected-border);
  background: var(--sd-itab-home-search-engine-selected-bg);
  color: var(--sd-itab-home-search-engine-selected-text);
}

.sd-itab-home-search-engines button.is-add {
  color: var(--sd-itab-home-search-engine-muted-text);
}

@media (max-width: 767px) {
  .sd-itab-home-top {
    gap: 14px;
    margin-bottom: 20px;
  }

  .sd-itab-home-clock-digits {
    font-size: 48px;
  }

  .sd-itab-home-search-wrap {
    width: min(100%, calc(100vw - 40px));
  }

  .sd-itab-home-search-engines {
    justify-content: flex-start;
  }
}
.itab-add-blank-context-list {
  display: grid;
  width: 140px;
  min-height: 184px;
  gap: 4px;
  padding: 9px 5px;
  border-radius: 12px;
  color: var(--sd-theme-grid-panel-text-06);
}

.itab-add-blank-context-row {
  display: flex;
  width: 130px;
  height: 30px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  line-height: 30px;
  padding: 0 4px;
  text-align: left;
}

.itab-add-blank-context-row:hover,
.itab-add-blank-context-row:focus-visible,
.itab-add-blank-context-row.is-active {
  background: var(--sd-theme-grid-panel-surface-05);
  outline: none;
}

.itab-add-blank-context-shortcut {
  color: var(--sd-theme-grid-panel-text-07);
  font-size: 11px;
}
.card-item {
  border-color: var(--card-border-color);
  transition:
    border-color 200ms ease,
    box-shadow 200ms ease,
    transform 200ms ease;
}
.card-item:hover {
  border-color: var(--card-border-hover-color);
}
[contenteditable]:focus {
  background-color: var(--sd-theme-grid-panel-surface-06);
}
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

:deep(path[class*="fill-sky-100"]),
:deep(path[class*="fill-blue-100"]),
:deep(path[class*="fill-blue-50"]),
:deep(path[class*="fill-gray-100"]),
:deep(path[class*="fill-purple-100"]),
:deep(path[class*="fill-green-100"]),
:deep(path[class*="fill-red-100"]),
:deep(path[class*="fill-yellow-100"]),
:deep(path[class*="fill-orange-100"]) {
  fill: var(--sd-theme-grid-panel-fill-01) !important;
}

.empire-theme {
  --group-title-color: var(--sd-theme-grid-panel-accent-text-01) !important;
  --card-title-color: var(--sd-theme-grid-panel-accent-text-01) !important;
  color: var(--sd-theme-grid-panel-accent-text-01) !important;
}

.empire-theme :deep(.text-gray-900),
.empire-theme :deep(.text-gray-800),
.empire-theme :deep(.text-gray-700),
.empire-theme :deep(.text-gray-600),
.empire-theme :deep(.text-gray-500),
.empire-theme :deep(.text-gray-400) {
  color: var(--sd-theme-grid-panel-accent-text-01) !important;
}

.empire-theme :deep(.bg-white) {
  backdrop-filter: blur(10px);
}

.empire-theme :deep(.bg-gray-50) {
  background-color: var(--sd-theme-grid-panel-surface-07) !important;
}

.empire-theme :deep(svg) {
  color: var(--sd-theme-grid-panel-accent-text-01) !important;
  fill: currentColor;
}

.empire-theme :deep(.border-gray-200),
.empire-theme :deep(.border-gray-100) {
  border-color: var(--sd-theme-grid-panel-accent-border-01) !important;
}

/* Force background override for ALL widget root elements */
.empire-theme .grid-stack-item > * {
  background-color: var(--sd-theme-grid-panel-surface-08) !important;
  background-image:
    url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4af37' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"),
    radial-gradient(
      circle at 50% 50%,
      var(--sd-theme-grid-panel-text-08),
      var(--sd-theme-grid-panel-text-09)
    ) !important;
  border: 1px solid var(--sd-theme-grid-panel-accent-border-02) !important;
  box-shadow:
    inset 0 0 20px var(--sd-theme-grid-panel-shadow-05),
    0 0 10px var(--sd-theme-grid-panel-shadow-06) !important;
}

/* Hide original backgrounds of inner elements */
.empire-theme .grid-stack-item > * > [class*="bg-"],
.empire-theme .grid-stack-item > * > [class*="bg-gradient-"],
.empire-theme :deep(.bg-white),
.empire-theme :deep(.bg-white\/80),
.empire-theme :deep(.bg-yellow-100\/90),
.empire-theme :deep(.bg-gradient-to-br) {
  background: transparent !important;
  box-shadow: none !important;
  border: none !important;
}

/* Ensure backdrop-blur doesn't make things white */
.empire-theme :deep(.backdrop-blur),
.empire-theme :deep(.backdrop-blur-md),
.empire-theme :deep(.backdrop-blur-sm) {
  backdrop-filter: none !important;
}

/* Specific fix for Calendar, Todo, Bookmarks which use specific classes */
.empire-theme .grid-stack-item :deep(.bg-white\/90),
.empire-theme .grid-stack-item :deep(.bg-white\/50),
.empire-theme .grid-stack-item :deep(.hover\:bg-white:hover) {
  background-color: transparent !important;
}

/* Fix for Memo Widget */
.empire-theme :deep(.bg-yellow-100\/90) {
  background-color: transparent !important;
  border-color: transparent !important;
}

/* Ensure text visibility on the dark background */
.empire-theme :deep(.text-gray-900),
.empire-theme :deep(.text-gray-800),
.empire-theme :deep(.text-gray-700),
.empire-theme :deep(.text-gray-600),
.empire-theme :deep(.text-gray-500),
.empire-theme :deep(.text-gray-400),
.empire-theme :deep(.text-gray-300) {
  color: var(--sd-theme-grid-panel-accent-text-01) !important;
}

/* Fix for Todo Widget input area */
.empire-theme :deep(.bg-gray-50),
.empire-theme :deep(.focus\:bg-white:focus),
.empire-theme :deep(input),
.empire-theme :deep(textarea) {
  background-color: var(--sd-theme-grid-panel-surface-09) !important;
  color: var(--sd-theme-grid-panel-accent-text-01) !important;
  border-color: var(--sd-theme-grid-panel-accent-border-03) !important;
}

/* Fix for buttons and active states */
.empire-theme :deep(.bg-blue-50),
.empire-theme :deep(.bg-blue-100),
.empire-theme :deep(.bg-red-50),
.empire-theme :deep(.bg-red-100),
.empire-theme :deep(.bg-orange-50),
.empire-theme :deep(.bg-green-100),
.empire-theme :deep(.hover\:bg-gray-100:hover),
.empire-theme :deep(.hover\:bg-gray-200:hover) {
  background-color: var(--sd-theme-grid-panel-accent-surface-01) !important;
  color: var(--sd-theme-grid-panel-accent-text-01) !important;
  border-color: var(--sd-theme-grid-panel-accent-border-01) !important;
}

/* Fix for specific text colors (Blue/Red/Green usually used for links/status) */
.empire-theme :deep(.text-blue-600),
.empire-theme :deep(.text-blue-500),
.empire-theme :deep(.text-blue-400),
.empire-theme :deep(.text-red-600),
.empire-theme :deep(.text-red-500),
.empire-theme :deep(.text-green-600),
.empire-theme :deep(.text-orange-600) {
  color: var(--sd-theme-grid-panel-accent-text-01) !important;
  text-shadow: 0 0 5px var(--sd-theme-grid-panel-shadow-07);
}

/* Calendar Today Highlight */
.empire-theme :deep(.text-red-600.font-bold) {
  color: var(--sd-theme-grid-panel-accent-text-02) !important;
  text-shadow: 0 0 10px var(--sd-theme-grid-panel-shadow-08);
}

/* Docker Status Bars */
.empire-theme :deep(.bg-gray-200) {
  background-color: var(--sd-theme-grid-panel-surface-10) !important;
}
</style>
