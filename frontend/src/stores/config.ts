import { ref, computed, watch } from "vue";
import { defineStore } from "pinia";
import { useStorage } from "@vueuse/core";
import type { AppConfig, SystemConfig } from "@/types";
import { resolveManagedUrl } from "@/utils/runtimeUrls";
import { createDefaultSearchEngines } from "@/utils/searchEngines";
import { useUiFeedbackStore } from "./uiFeedback";

const STARTDECK_CURRENT_VERSION = __STARTDECK_VERSION__;

type CheckUpdateOptions = {
  force?: boolean;
  notify?: boolean;
};

type AppVersionCheckResponse = {
  latestVersion?: unknown;
  hasUpdate?: unknown;
};

export const useConfigStore = defineStore("config", () => {
  // Pure client-only states (NOT synced to server)
  const forceNetworkMode = useStorage<"auto" | "lan" | "wan" | "latency">(
    "startdeck-force-network-mode",
    "auto",
  );
  const isExpandedMode = ref(false);
  const webPaginationActiveGroupId = ref("");
  const isLanModeInited = ref(false);
  const isLanMode = ref(false);
  const networkLatency = ref(0);
  const effectiveIsLan = ref(false);
  const isPageUnloading = ref(false);
  const serverSyncLockCount = ref(0);

  // Version / update checking
  const currentVersion = STARTDECK_CURRENT_VERSION;
  const latestVersion = ref("");
  const appUpdateAvailable = ref(false);
  const notifiedLatestVersion = ref("");
  const updateCheckLastAt = useStorage<number>(
    "start-deck-update-check-last-at",
    0,
  );
  const UPDATE_CHECK_TTL = 30 * 60 * 1000;

  // Resource version for cache busting
  const resourceVersion = useStorage("start-deck-resource-version", Date.now());

  const refreshResources = () => {
    resourceVersion.value = Date.now();
  };

  const getAssetUrl = (url?: string) => {
    if (!url) return "";
    if (url.startsWith("data:") || url.startsWith("blob:")) return url;
    const resolved = resolveManagedUrl(url);
    const connector = resolved.includes("?") ? "&" : "?";
    return `${resolved}${connector}t=${resourceVersion.value}`;
  };

  const appConfig = ref<AppConfig>({
    background: "/default-wallpaper.svg",
    mobileBackground: "/default-wallpaper.svg",
    solidBackgroundColor: "",
    enableMobileWallpaper: true,
    deviceMode: "auto",
    pcRotation: false,
    pcRotationInterval: 30,
    pcRotationMode: "random",
    mobileRotation: false,
    mobileRotationInterval: 30,
    mobileRotationMode: "random",
    backgroundBlur: 0,
    backgroundMask: 0,
    mobileBackgroundBlur: 0,
    mobileBackgroundMask: 0,
    themeMode: "auto",
    daylightModeEnabled: false,
    daylightMask: 0.5,
    customTitle: "我的导航",
    titleAlign: "left",
    titleSize: 48,
    titleColor: "#ffffff",
    cardLayout: "vertical",
    cardBgColor: "transparent",
    cardTitleColor: "#111827",
    cardBorderColor: "transparent",
    showCardBackground: true,
    iconShape: "rounded",
    showHomeTitle: true,
    showHomeTime: true,
    showHomeSearch: true,
    searchEngines: createDefaultSearchEngines(),
    defaultSearchEngine: "baidu",
    rememberLastEngine: true,
    groupTitleColor: "#ffffff",
    showFooterStats: false,
    footerHtml: "",
    footerHeight: 0,
    footerWidth: 1280,
    footerMarginBottom: 0,
    footerFontSize: 12,
    wallpaperApiPcList: "/api/backgrounds",
    wallpaperApiPcUpload: "/api/backgrounds/upload",
    wallpaperApiPcDeleteBase: "/api/backgrounds",
    wallpaperPcImageBase: "/backgrounds",
    wallpaperApiMobileList: "/api/mobile_backgrounds",
    wallpaperApiMobileUpload: "/api/mobile_backgrounds/upload",
    wallpaperApiMobileDeleteBase: "/api/mobile_backgrounds",
    wallpaperMobileImageBase: "/mobile_backgrounds",
    mobileWallpaperOrder: [],
    webGroupPagination: false,
    webGroupPaginationDisableFlip: false,
    empireMode: false,
    customCss: "",
    customJs: "",
    customJsList: [],
    mouseHoverEffect: "scale",
    autoUltrawide: false,
    networkRules: "",
    internalLocation: null,
    networkPresets: {
      tailscale: false,
      zerotier: false,
      frp: false,
      cloudflareTunnel: false,
      ngrok: false,
    },
    latencyThresholdMs: 200,
  });

  const systemConfig = ref<SystemConfig>({
    enableDocker: false,
    dockerHost: "",
  });

  const lockServerSync = () => {
    serverSyncLockCount.value += 1;
  };
  const unlockServerSync = () => {
    serverSyncLockCount.value = Math.max(0, serverSyncLockCount.value - 1);
  };
  const isServerSyncLocked = computed(() => serverSyncLockCount.value > 0);

  const notifyReleaseUpdate = () => {
    if (!appUpdateAvailable.value || !latestVersion.value) return;
    if (notifiedLatestVersion.value === latestVersion.value) return;

    notifiedLatestVersion.value = latestVersion.value;
    useUiFeedbackStore().notify({
      title: "发现新版本",
      message: `StartDeck ${latestVersion.value} 已发布，当前版本 ${currentVersion}。`,
      tone: "info",
      durationMs: 5000,
    });
  };

  const applyAppVersionCheck = (data: unknown) => {
    const payload = data as AppVersionCheckResponse | null;
    latestVersion.value =
      typeof payload?.latestVersion === "string" ? payload.latestVersion : "";
    appUpdateAvailable.value = payload?.hasUpdate === true;
  };

  const checkUpdate = async (options: CheckUpdateOptions = {}) => {
    try {
      const now = Date.now();
      const shouldCheckRemote =
        Boolean(options.force) ||
        !updateCheckLastAt.value ||
        now - updateCheckLastAt.value >= UPDATE_CHECK_TTL ||
        !latestVersion.value;

      if (shouldCheckRemote) {
        updateCheckLastAt.value = now;
        const res = await fetch("/api/app-version/check");
        if (res.ok) {
          applyAppVersionCheck(await res.json());
        }
      }
      if (options.notify) notifyReleaseUpdate();
    } catch (e) {
      console.error("Failed to check update", e);
    }
  };

  // localStorage persistence watches
  watch(
    () => appConfig.value.iconShape,
    (val) => {
      if (typeof val === "string")
        localStorage.setItem("start-deck-icon-shape", val);
    },
  );
  watch(
    () => appConfig.value.cardBgColor,
    (val) => {
      if (typeof val === "string")
        localStorage.setItem("start-deck-card-bg-color", val);
    },
  );

  return {
    appConfig,
    systemConfig,
    forceNetworkMode,
    isExpandedMode,
    webPaginationActiveGroupId,
    isLanModeInited,
    isLanMode,
    networkLatency,
    effectiveIsLan,
    isPageUnloading,
    currentVersion,
    resourceVersion,
    checkUpdate,
    refreshResources,
    getAssetUrl,
    lockServerSync,
    unlockServerSync,
    isServerSyncLocked,
  };
});
