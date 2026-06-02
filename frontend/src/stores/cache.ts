import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { useAuthStore } from "./auth";
import { useWidgetsStore } from "./widgets";
import { useGroupsStore } from "./groups";
import { useConfigStore } from "./config";
import {
  stripWidgetUiState,
  stripForceNetworkMode,
  normalizeVersion,
} from "@/utils/storeHelpers";
import type { AppConfig, WidgetConfig } from "@/types";
import { sessionFetch } from "@/utils/sessionFetch";
import { sanitizeSnapshotIcons } from "@/utils/iconAssets";

const LEGACY_CACHE_KEY = "start-deck-data-cache";
const CACHE_KEY_PREFIX = "start-deck-data-cache";
const GUEST_CACHE_KEY = `${CACHE_KEY_PREFIX}:guest`;
const GUEST_CACHE_USER = "__guest__";
const CACHE_WRITE_GUARD_MS = 15000;
const SERVER_SNAPSHOT_TIMEOUT_MS = 60000;

export const useCacheStore = defineStore("cache", () => {
  const auth = useAuthStore();
  const widgetsStore = useWidgetsStore();
  const groupsStore = useGroupsStore();
  const configStore = useConfigStore();

  const cacheLoadedAt = ref<number | null>(null);
  const hasServerSnapshot = ref(false);
  const deferredSaveRequested = ref(false);
  const isFetchingData = ref(false);
  let isLoadingSnapshot = false;
  const serverSnapshotRetryTimer = ref<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const getHeaders = (): Record<string, string> => {
    return {
      "Content-Type": "application/json",
    };
  };

  const authCacheKey = (username: string) =>
    `${CACHE_KEY_PREFIX}:auth:${encodeURIComponent(username || "admin")}`;

  const currentAuthUsername = () => auth.username || "admin";

  const getCurrentCacheKey = () =>
    auth.isLogged ? authCacheKey(currentAuthUsername()) : GUEST_CACHE_KEY;

  const getCacheScopeForData = (data: Record<string, unknown>) => {
    if (!auth.isLogged) {
      return { key: GUEST_CACHE_KEY, username: GUEST_CACHE_USER };
    }
    const username =
      typeof data.username === "string" && data.username.trim()
        ? data.username.trim()
        : currentAuthUsername();
    return { key: authCacheKey(username), username };
  };

  const saveToCache = (data: Record<string, unknown>) => {
    try {
      if (!auth.isLogged && data.isGuest !== true) {
        return;
      }
      const cacheWidgets = Array.isArray(data.widgets)
        ? (data.widgets as WidgetConfig[]).map((widget) =>
            stripWidgetUiState(widget),
          )
        : data.widgets;
      const { key, username } = getCacheScopeForData(data);
      const sanitized = sanitizeSnapshotIcons(data);
      const cacheData = {
        groups: sanitized.groups,
        widgets: cacheWidgets,
        appConfig: stripForceNetworkMode(
          (data.appConfig || undefined) as Record<string, unknown> | undefined,
        ),
        systemConfig: data.systemConfig,
        username,
        isGuest: data.isGuest === true,
        version: data.version,
        layoutSchemaVersion: data.layoutSchemaVersion,
        lastOperationAt: data.lastOperationAt,
        timestamp: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(cacheData));
      localStorage.removeItem(LEGACY_CACHE_KEY);
    } catch (e) {
      console.warn("Cache save failed", e);
    }
  };

  const removeCacheForCurrentUser = () => {
    try {
      localStorage.removeItem(getCurrentCacheKey());
      localStorage.removeItem(LEGACY_CACHE_KEY);
    } catch (e) {
      console.warn("Cache remove failed", e);
    }
  };

  const removeAuthCaches = () => {
    try {
      const authPrefix = `${CACHE_KEY_PREFIX}:auth:`;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith(authPrefix)) {
          localStorage.removeItem(key);
        }
      }
      localStorage.removeItem(LEGACY_CACHE_KEY);
    } catch (e) {
      console.warn("Auth cache remove failed", e);
    }
  };

  const loadFromCache = (
    dataVersionRef: ReturnType<typeof ref<number>>,
  ): boolean => {
    try {
      const json = localStorage.getItem(getCurrentCacheKey());
      if (!json) return false;
      const cache = JSON.parse(json);

      const cachedUser = cache.username || "";
      const currentUser = auth.isLogged
        ? currentAuthUsername()
        : GUEST_CACHE_USER;
      const isMatch = auth.isLogged
        ? cachedUser === currentUser ||
          (currentUser === "admin" && cachedUser === "admin")
        : cachedUser === GUEST_CACHE_USER && cache.isGuest === true;
      if (!isMatch) return false;

      const sanitizedCache = sanitizeSnapshotIcons(cache);
      if (sanitizedCache.groups) groupsStore.groups = sanitizedCache.groups;
      if (cache.widgets) {
        widgetsStore.applyServerWidgets(
          widgetsStore.normalizeIncomingWidgets(
            cache.widgets as WidgetConfig[],
            auth.isLogged,
          ),
          auth.isLogged,
          widgetsStore.layoutEditInProgress,
        );
      }
      if (cache.appConfig) {
        const mergedConfig = {
          ...configStore.appConfig,
          ...cache.appConfig,
        } as AppConfig & {
          fixedWallpaper?: boolean;
          forceNetworkMode?: unknown;
        };
        if (mergedConfig.fixedWallpaper === true) {
          mergedConfig.pcRotation = false;
          mergedConfig.mobileRotation = false;
        }
        delete mergedConfig.fixedWallpaper;
        configStore.appConfig = stripForceNetworkMode(
          mergedConfig as unknown as Record<string, unknown>,
        ) as unknown as AppConfig;
      }
      if (cache.systemConfig)
        configStore.systemConfig =
          cache.systemConfig as typeof configStore.systemConfig;
      if (typeof cache.version !== "undefined") {
        dataVersionRef.value = normalizeVersion(cache.version);
      }
      return true;
    } catch (e) {
      console.warn("Cache load failed", e);
      return false;
    }
  };

  const isCacheWriteGuardActive = () => {
    if (hasServerSnapshot.value) return false;
    if (cacheLoadedAt.value === null) return false;
    return Date.now() - cacheLoadedAt.value < CACHE_WRITE_GUARD_MS;
  };

  const markServerSnapshotReady = () => {
    hasServerSnapshot.value = true;
    cacheLoadedAt.value = null;
  };

  const isServerSnapshotReady = computed(() => hasServerSnapshot.value);
  const isClientReady = computed(
    () => hasServerSnapshot.value || cacheLoadedAt.value !== null,
  );

  const fetchWithTimeout = async (
    input: RequestInfo | URL,
    init: RequestInit = {},
    timeoutMs = SERVER_SNAPSHOT_TIMEOUT_MS,
  ) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await sessionFetch(input, { ...init, signal: controller.signal });
    } finally {
      window.clearTimeout(timer);
    }
  };

  const loadServerSnapshot = async (
    handleDataUpdate: (data: Record<string, unknown>) => void,
    updateLayout: () => void,
  ) => {
    if (isLoadingSnapshot) return;
    isLoadingSnapshot = true;
    try {
      if (!auth.sessionReady) return;
      const res = await fetchWithTimeout("/api/data", {
        headers: getHeaders(),
      });
      if (res.status === 401) {
        auth.clearLocalSession();
        throw new Error("Init unauthorized with stored token");
      }
      if (res.status === 304) {
        if (!isClientReady.value) {
          const reloadRes = await fetchWithTimeout("/api/data", {
            headers: getHeaders(),
            cache: "reload",
          });
          if (reloadRes.status === 401) {
            auth.clearLocalSession();
            throw new Error("Init reload unauthorized with stored token");
          }
          if (!reloadRes.ok)
            throw new Error(
              `Init reload failed with status ${reloadRes.status}`,
            );
          const reloadData = await reloadRes.json();
          if (reloadData.systemConfig)
            configStore.systemConfig =
              reloadData.systemConfig as typeof configStore.systemConfig;
          handleDataUpdate(reloadData);
        }
        updateLayout();
        markServerSnapshotReady();
        return;
      }
      if (!res.ok) throw new Error(`Init failed with status ${res.status}`);
      const data = await res.json();
      if (data.systemConfig)
        configStore.systemConfig =
          data.systemConfig as typeof configStore.systemConfig;
      handleDataUpdate(data);
      updateLayout();
      markServerSnapshotReady();
    } finally {
      isLoadingSnapshot = false;
    }
  };

  return {
    cacheLoadedAt,
    hasServerSnapshot,
    deferredSaveRequested,
    isFetchingData,
    isLoadingSnapshot,
    serverSnapshotRetryTimer,
    saveToCache,
    removeCacheForCurrentUser,
    removeAuthCaches,
    loadFromCache,
    isCacheWriteGuardActive,
    markServerSnapshotReady,
    isServerSnapshotReady,
    isClientReady,
    loadServerSnapshot,
    fetchWithTimeout,
    getHeaders,
  };
});
