import { ref, computed, watch } from "vue";
import { defineStore } from "pinia";
import { useWebSocket } from "@vueuse/core";
import { normalizeVersion, stripForceNetworkMode } from "@/utils/storeHelpers";
import type { LuckyStunData, NavGroup, WidgetConfig } from "@/types";
import { useAuthStore } from "./auth";
import { useWidgetsStore } from "./widgets";
import { useGroupsStore } from "./groups";
import { useConfigStore } from "./config";
import { useCacheStore } from "./cache";
import { useSaveStore } from "./save";
import { useNetworkStore } from "./network";
import { onStartDeckSessionInvalid, sessionFetch } from "@/utils/sessionFetch";
import { sanitizeSnapshotIcons } from "@/utils/iconAssets";

type ActiveSnapshotRole = "auth" | "guest" | null;

export const useSyncStore = defineStore("sync", () => {
  const auth = useAuthStore();
  const widgetsStore = useWidgetsStore();
  const groupsStore = useGroupsStore();
  const configStore = useConfigStore();
  const cacheStore = useCacheStore();
  const saveStore = useSaveStore();
  const networkStore = useNetworkStore();

  // ---- WebSocket ----
  const lastWsUrl = ref("");
  const wsUrl = computed(() => {
    if (typeof window === "undefined") return "";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
  });

  const trackWsUrlChange = (url: string) => {
    if (url && url !== lastWsUrl.value) {
      lastWsUrl.value = url;
    }
  };

  const {
    status,
    data: wsRawData,
    send: wsSendRaw,
    open: wsOpen,
    close: wsClose,
  } = useWebSocket(() => wsUrl.value, {
    autoReconnect: {
      retries: Infinity,
      delay: (attempt: number) => {
        if (attempt <= 3) return 500 * (attempt + 1);
        const base = Math.min(1000 * Math.pow(2, Math.min(attempt, 15)), 30000);
        const jitter = base * 0.2 * (Math.random() * 2 - 1);
        return base + jitter;
      },
      onFailed: () => {
        console.warn("[WS] Auto-reconnect exhausted, marking network as stale");
        networkStore.markStale();
      },
    },
    immediate: false,
    heartbeat: {
      message: JSON.stringify({ type: "ping" }),
      interval: 15000,
      pongTimeout: 8000,
    },
    onConnected: (ws) => {
      if (ws?.url) trackWsUrlChange(ws.url);
      wsContinuousFailures = 0;
      networkStore.markFresh();
    },
    onDisconnected: () => {
      networkStore.markStale();
    },
  });

  let wsHealthCheckTimer: ReturnType<typeof setInterval> | null = null;

  const startWsHealthCheck = () => {
    if (wsHealthCheckTimer) return;
    wsHealthCheckTimer = setInterval(() => {
      if (!auth.sessionReady || !auth.isLogged || status.value !== "OPEN") return;
      if (networkStore.isStale(30000)) {
        const elapsed = Date.now() - networkStore.lastPingAt;
        console.warn(
          `[WS] Health check: pong stale for ${elapsed}ms, forcing reconnect`,
        );
        forceWsReconnect();
      }
    }, 10000);
  };

  const stopWsHealthCheck = () => {
    if (wsHealthCheckTimer) {
      clearInterval(wsHealthCheckTimer);
      wsHealthCheckTimer = null;
    }
  };

  const forceWsReconnect = () => {
    if (!auth.sessionReady || !auth.isLogged) return;
    const currentUrl = wsUrl.value;
    if (!currentUrl) return;
    lastWsUrl.value = currentUrl;
    stopWsHealthCheck();
    networkStore.markStale();
    wsClose();
    setTimeout(() => {
      if (auth.sessionReady && auth.isLogged) {
        wsOpen();
        startWsHealthCheck();
      }
    }, 2000);
  };

  const wsSend = (message: Record<string, unknown>) => {
    if (status.value === "OPEN") wsSendRaw(JSON.stringify(message));
  };

  const isConnected = computed(() => status.value === "OPEN");
  const getWsStatus = () => status.value;

  // ---- Data state ----
  const dataVersion = ref(0);
  const pendingServerVersion = ref(0);
  const luckyStunData = ref<LuckyStunData | null>(null);
  const activeSnapshotRole = ref<ActiveSnapshotRole>(null);

  // ---- State flags ----
  let wsMessageHandlerBound = false;
  let visibilityVersionCheckBound = false;
  let isInitializing = false;
  let isFirstConnect = true;
  let wsWasConnectedBefore = false;
  let wsContinuousFailures = 0;
  let isApplyingServerData = false;
  const initCompleted = ref(false);
  const WS_FALLBACK_THRESHOLD = 5;
  const WS_FALLBACK_SYNC_MIN_INTERVAL_MS = 30000;
  let wsFallbackSyncTimer: ReturnType<typeof setTimeout> | null = null;
  let wsFallbackSyncInProgress = false;
  let lastWsFallbackSyncAt = 0;
  let isHttpPollingActive = false;
  const isHttpPollingActiveRef = computed(() => isHttpPollingActive);
  let httpPollTimer: ReturnType<typeof setInterval> | null = null;
  let activePollAbortController: AbortController | null = null;
  let hadAuthenticatedSession = false;
  let guestTransitionInProgress = false;

  let logoutInProgress = false;

  const detectResponseRole = (
    data: Record<string, unknown>,
  ): "auth" | "guest" => {
    if (data.isGuest === true) return "guest";
    if (
      data.authenticated === true &&
      typeof data.sessionGeneration === "string"
    )
      return "auth";
    if (data.isGuest === false) return "auth";
    if (auth.isLogged) return "auth";
    if (data.username && data.version !== undefined) return "auth";
    return "auth";
  };

  const restoreAuthFromSnapshot = (data: Record<string, unknown>) => {
    if (auth.isLogged) return;
    if (data.authenticated !== true) return;
    const username =
      typeof data.username === "string" ? data.username.trim() : "";
    const sessionGeneration =
      typeof data.sessionGeneration === "string"
        ? data.sessionGeneration.trim()
        : "";
    if (!username || !sessionGeneration) return;
    auth.applyServerSession(username, sessionGeneration);
  };

  const snapshotRoleForCurrentAuth = (): ActiveSnapshotRole =>
    auth.isLogged ? "auth" : "guest";

  const hasLoadedSnapshotState = () =>
    activeSnapshotRole.value !== null &&
    (cacheStore.isClientReady ||
      groupsStore.groups.length > 0 ||
      widgetsStore.widgets.length > 0 ||
      dataVersion.value > 0);

  const canPreserveCurrentSnapshotForInit = () =>
    activeSnapshotRole.value === snapshotRoleForCurrentAuth() &&
    hasLoadedSnapshotState();

  const markProvisionalGuestSnapshotReady = () => {
    if (auth.isLogged || cacheStore.isClientReady) return;
    activeSnapshotRole.value = "guest";
    if (cacheStore.cacheLoadedAt === null) {
      cacheStore.cacheLoadedAt = Date.now();
    }
  };

  const syncUsernameFromServer = (
    data: Record<string, unknown>,
    responseRole: "auth" | "guest",
  ) => {
    if (!auth.isLogged || responseRole !== "auth") return;
    const nextUsername =
      typeof data.username === "string" ? data.username.trim() : "";
    if (!nextUsername || nextUsername === auth.username) return;
    auth.username = nextUsername;
    localStorage.setItem("start-deck-username", nextUsername);
  };

  const revalidateSession = async () => {
    const wasLogged = auth.isLogged;
    await auth.bootstrapSession();
    if (wasLogged && !auth.isLogged) {
      stopOfflineQueueReplayTimer();
      networkStore.stopNetworkHeartbeat();
      stopHttpPolling();
      stopPingCheck();
      resetActiveStateForGuest();
      await init();
      return false;
    }
    return auth.isLogged;
  };

  // ---- HTTP Polling ----
  const fetchVersionOnly = async (): Promise<number> => {
    if (!auth.sessionReady || !auth.isLogged) return dataVersion.value;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      activePollAbortController = controller;
      const res = await sessionFetch("/api/version", {
        method: "GET",
        headers: networkStore.getHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        return normalizeVersion(data?.version);
      }
    } catch {
      /* ignore */
    }
    return dataVersion.value;
  };

  const fetchGuestSnapshotWithoutCredentials = async () => {
    const res = await fetch("/api/data", {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Guest snapshot failed with status ${res.status}`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    const applied = handleDataUpdate({
      ...data,
      isGuest: true,
      username: "__guest__",
    });
    if (!applied) {
      throw new Error("Guest snapshot dropped by role guard");
    }
    widgetsStore.updateLastSavedLayout();
    if (!cacheStore.hasServerSnapshot) {
      cacheStore.markServerSnapshotReady();
    }
  };

  const stopHttpPolling = () => {
    if (!isHttpPollingActive) return;
    isHttpPollingActive = false;
    if (httpPollTimer) {
      clearInterval(httpPollTimer);
      httpPollTimer = null;
    }
    if (activePollAbortController) {
      activePollAbortController.abort();
      activePollAbortController = null;
    }
  };

  const buildCacheSnapshot = (data: Record<string, unknown>) => ({
    ...data,
    groups: groupsStore.groups,
    widgets: widgetsStore.widgets,
    appConfig: configStore.appConfig,
    systemConfig: data.systemConfig ?? configStore.systemConfig,
    username: typeof data.username === "string" ? data.username : auth.username,
    version:
      typeof data.version !== "undefined" ? data.version : dataVersion.value,
  });

  const resetActiveStateForGuest = () => {
    isApplyingServerData = true;
    activeSnapshotRole.value = null;
    groupsStore.groups = [];
    widgetsStore.widgets = [];
    widgetsStore.uiStateMap = {};
    widgetsStore.serverLayoutMap = {};
    widgetsStore.serverLayoutSignature = "";
    luckyStunData.value = null;
    dataVersion.value = 0;
    pendingServerVersion.value = 0;
    cacheStore.removeAuthCaches();
    widgetsStore.updateLastSavedLayout();
    saveStore.hasUnsavedChanges = false;
    saveStore.hasPendingSave = false;
    saveStore.conflictState = {
      show: false,
      serverVersion: 0,
      clientVersion: 0,
    };
    saveStore.syncConfirmModal = { show: false, serverVersion: 0 };
    saveStore.offlineQueueConflictState = {
      show: false,
      item: null,
      serverVersion: 0,
    };
    cacheStore.hasServerSnapshot = false;
    cacheStore.cacheLoadedAt = null;
    cacheStore.deferredSaveRequested = false;
    isApplyingServerData = false;
  };

  const startHttpPolling = () => {
    if (isHttpPollingActive || status.value === "OPEN") return;
    isHttpPollingActive = true;
    httpPollTimer = setInterval(async () => {
      if (!isHttpPollingActive || document.visibilityState === "hidden") return;
      try {
        const version = await fetchVersionOnly();
        if (version > dataVersion.value) await fetchAndProcessData();
      } catch (e) {
        console.warn("[HTTP polling] Poll failed:", e);
      }
    }, 15000);
  };

  // ---- handleDataUpdate ----
  const handleDataUpdate = (data: Record<string, unknown>): boolean => {
    isApplyingServerData = true;
    data = sanitizeSnapshotIcons(data);
    // Route by role: guest responses must never overwrite auth state layout
    const responseRole = detectResponseRole(data);
    if (auth.isLogged && responseRole === "guest") {
      stopAuthenticatedRuntime();
      hadAuthenticatedSession = false;
      auth.clearLocalSession();
      resetActiveStateForGuest();
    }
    if (responseRole === "auth") {
      restoreAuthFromSnapshot(data);
    }
    const shouldApply =
      responseRole === "auth" ? auth.isLogged : !auth.isLogged; // guest data must not overwrite an authenticated session

    if (!shouldApply) {
      if (responseRole === "guest") {
        console.warn(
          "[DualState] Dropping guest data while auth state is active",
        );
      }
      isApplyingServerData = false;
      return false;
    }

    if (data.systemConfig) {
      configStore.systemConfig = {
        ...configStore.systemConfig,
        ...(data.systemConfig as typeof configStore.systemConfig),
      };
    }
    syncUsernameFromServer(data, responseRole);
    if (typeof data.version !== "undefined")
      dataVersion.value = normalizeVersion(data.version);

    if (data.groups) groupsStore.groups = data.groups as NavGroup[];
    else groupsStore.groups = [];

    const normalizedWidgets = widgetsStore.normalizeIncomingWidgets(
      data.widgets as WidgetConfig[] | undefined,
      auth.isLogged,
    );
    widgetsStore.applyServerWidgets(
      normalizedWidgets,
      auth.isLogged,
      widgetsStore.layoutEditInProgress,
    );

    if (data.appConfig) {
      const incomingConfig = data.appConfig as Record<string, unknown>;
      const mergedConfig = {
        ...configStore.appConfig,
        ...incomingConfig,
      } as Record<string, unknown>;
      configStore.appConfig = stripForceNetworkMode(
        mergedConfig,
      ) as typeof configStore.appConfig;
    }
    // Migrations
    const ac = configStore.appConfig;
    if (ac.customCss && !ac.customCssList?.length)
      ac.customCssList = [
        {
          id: "default-css",
          name: "默认自定义 CSS",
          content: ac.customCss,
          enable: true,
        },
      ];
    if (!ac.customCssList) ac.customCssList = [];
    if (ac.customJs && !ac.customJsList?.length)
      ac.customJsList = [
        {
          id: "default-js",
          name: "默认自定义 JS",
          content: ac.customJs,
          enable: true,
        },
      ];
    if (!ac.customJsList) ac.customJsList = [];
    const stripTransientWallpaperParams = (value: unknown) => {
      if (typeof value !== "string" || !value) return value;
      if (value.startsWith("blob:") || value.startsWith("data:")) return value;
      try {
        const parsed = new URL(value, window.location.origin);
        parsed.searchParams.delete("t");
        parsed.searchParams.delete("v");
        if (/^https?:\/\//.test(value)) {
          return `${parsed.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      } catch {
        return value.replace(/([?&])(t|v)=\d+/g, "$1").replace(/[?&]$/, "");
      }
    };
    configStore.appConfig.background =
      (stripTransientWallpaperParams(
        configStore.appConfig.background,
      ) as string) || "/default-wallpaper.svg";
    if (configStore.appConfig.mobileBackground) {
      configStore.appConfig.mobileBackground = stripTransientWallpaperParams(
        configStore.appConfig.mobileBackground,
      ) as string;
    }
    networkStore.fetchCustomScripts();
    widgetsStore.updateLastSavedLayout();
    cacheStore.saveToCache({
      ...buildCacheSnapshot(data),
      widgets: normalizedWidgets,
    });
    activeSnapshotRole.value = responseRole;
    saveStore.hasUnsavedChanges = false;
    isApplyingServerData = false;
    return true;
  };

  // ---- fetchAndProcessData ----
  const fetchAndProcessData = async () => {
    if (!auth.sessionReady) return;
    if (cacheStore.isFetchingData) return;
    cacheStore.isFetchingData = true;
    try {
      const res = await sessionFetch(`/api/data`);
      if (res.status === 401 && auth.isLogged) {
        resetActiveStateForGuest();
        void init();
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (
        saveStore.hasUnsavedChanges ||
        saveStore.saveTimer !== null ||
        saveStore.isSaving ||
        widgetsStore.layoutDirty
      ) {
        return;
      }
      const applied = handleDataUpdate(data);
      if (!applied) {
        if (!auth.isLogged) {
          await fetchGuestSnapshotWithoutCredentials();
        }
        return;
      }
      widgetsStore.updateLastSavedLayout();
      if (!cacheStore.hasServerSnapshot) {
        cacheStore.markServerSnapshotReady();
      }
    } catch (e) {
      console.error("Fetch data failed", e);
    } finally {
      cacheStore.isFetchingData = false;
    }
  };

  const clearWsFallbackSyncSchedule = (resetTimestamp = false) => {
    if (wsFallbackSyncTimer) {
      clearTimeout(wsFallbackSyncTimer);
      wsFallbackSyncTimer = null;
    }
    if (resetTimestamp) lastWsFallbackSyncAt = 0;
  };

  const scheduleWsFallbackSync = () => {
    if (!auth.sessionReady || !auth.isLogged) return;
    if (getWsStatus() === "OPEN") return;
    if (wsFallbackSyncTimer || wsFallbackSyncInProgress) return;

    const now = Date.now();
    const delay = Math.max(
      0,
      WS_FALLBACK_SYNC_MIN_INTERVAL_MS - (now - lastWsFallbackSyncAt),
    );
    console.warn(
      `[WS] ${wsContinuousFailures} consecutive disconnections, using HTTP fallback sync`,
    );
    wsFallbackSyncTimer = setTimeout(async () => {
      wsFallbackSyncTimer = null;
      if (!auth.sessionReady || !auth.isLogged || getWsStatus() === "OPEN")
        return;
      wsFallbackSyncInProgress = true;
      lastWsFallbackSyncAt = Date.now();
      try {
        const serverVersion = await fetchVersionOnly();
        if (getWsStatus() !== "OPEN" && serverVersion > dataVersion.value)
          await fetchAndProcessData();
      } catch (e) {
        console.warn("[WS] HTTP fallback sync failed", e);
      } finally {
        wsFallbackSyncInProgress = false;
      }
    }, delay);
  };

  const OFFLINE_QUEUE_REPLAY_INTERVAL_MS = 30000;
  let offlineQueueReplayTimer: ReturnType<typeof setInterval> | null = null;
  let offlineQueueReplayInProgress = false;

  const replayOfflineQueueIfNeeded = async () => {
    if (!auth.sessionReady || !auth.isLogged) return;
    if (!auth.username || !auth.sessionGeneration) return;
    if (saveStore.isSaving || offlineQueueReplayInProgress) return;
    if (saveStore.offlineQueueConflictState.show) return;
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    )
      return;

    offlineQueueReplayInProgress = true;
    try {
      await saveStore.triggerOfflineQueueReplay(
        fetchVersionOnly,
        dataVersion,
        networkStore.getHeaders,
        {
          username: auth.username,
          sessionGeneration: auth.sessionGeneration,
        },
      );
    } catch (error) {
      console.warn("[OfflineQueue] Periodic replay failed", error);
    } finally {
      offlineQueueReplayInProgress = false;
    }
  };

  const startOfflineQueueReplayTimer = () => {
    if (offlineQueueReplayTimer) return;
    offlineQueueReplayTimer = setInterval(() => {
      void replayOfflineQueueIfNeeded();
    }, OFFLINE_QUEUE_REPLAY_INTERVAL_MS);
  };

  const stopOfflineQueueReplayTimer = () => {
    if (!offlineQueueReplayTimer) return;
    clearInterval(offlineQueueReplayTimer);
    offlineQueueReplayTimer = null;
  };

  // ---- WebSocket connect watch ----
  watch(status, async (newStatus) => {
    if (newStatus === "OPEN") {
      stopHttpPolling();
      clearWsFallbackSyncSchedule(true);
      wsContinuousFailures = 0;
      const isReconnect = wsWasConnectedBefore;
      if (!isReconnect) isFirstConnect = false;
      wsWasConnectedBefore = true;
      networkStore.startNetworkHeartbeat(wsSend);
      startWsHealthCheck();
      if (isFirstConnect) return;
      try {
        const serverVersion = await fetchVersionOnly();
        if (serverVersion > dataVersion.value) await fetchAndProcessData();
        if (saveStore.hasUnsavedChanges) {
          saveStore.hasPendingSave = true;
          setTimeout(() => saveData(), 2000);
        }
        try {
          import("@/utils/offlineQueue").then(async (oq) => {
            const qSize = await oq.size();
            if (qSize > 0) {
              saveStore.offlineQueueCount = qSize;
              setTimeout(
                () =>
                  saveStore.triggerOfflineQueueReplay(
                    fetchVersionOnly,
                    dataVersion,
                    networkStore.getHeaders,
                    {
                      username: auth.username,
                      sessionGeneration: auth.sessionGeneration,
                    },
                  ),
                3000,
              );
            }
          });
        } catch {
          /* ignore */
        }
      } catch (e) {
        console.warn("[WS reconnect] Failed to check server version:", e);
      }
      await networkStore.fetchSystemConfig();
    } else if (newStatus === "CLOSED") {
      wsContinuousFailures++;
      networkStore.stopNetworkHeartbeat();
      if (auth.sessionReady && auth.isLogged) {
        void revalidateSession();
      }
      // Only trigger HTTP polling fallback when authenticated; guests use HTTP-only mode
      if (
        auth.sessionReady &&
        auth.isLogged &&
        wsContinuousFailures >= WS_FALLBACK_THRESHOLD
      ) {
        const shouldStartHttpPolling = !isHttpPollingActive;
        if (shouldStartHttpPolling) {
          startHttpPolling();
          scheduleWsFallbackSync();
        }
      }
    }
  });

  // ---- WebSocket message watch ----
  watch(wsRawData, (rawMsg) => {
    if (!rawMsg || !wsMessageHandlerBound) return;
    let msg: { type?: string; payload?: Record<string, unknown> };
    try {
      msg = JSON.parse(rawMsg);
    } catch {
      return;
    }
    if (!msg?.type) return;
    switch (msg.type) {
      case "auth_success":
        break;
      case "memo_updated":
      case "todo_updated": {
        const p = msg.payload || {};
        const username = typeof p.username === "string" ? p.username : "";
        if (username && username !== auth.username) return;
        if (p.widgetId) {
          const w = widgetsStore.widgets.find((x) => x.id === p.widgetId);
          if (w) {
            if (
              (msg.type === "todo_updated" || msg.type === "memo_updated") &&
              w.data &&
              typeof w.data === "object" &&
              p.content &&
              typeof p.content === "object"
            ) {
              const currentSizeKey = (w.data as Record<string, unknown>)
                .sizeKey;
              w.data = {
                ...(p.content as Record<string, unknown>),
                ...(typeof currentSizeKey === "string"
                  ? { sizeKey: currentSizeKey }
                  : {}),
              };
            } else {
              w.data = p.content;
            }
          }
        }
        break;
      }
      case "data_updated": {
        const p = msg.payload || {};
        if (p.username !== auth.username) return;
        const sv =
          typeof p.version !== "undefined" ? normalizeVersion(p.version) : 0;
        if (
          saveStore.hasUnsavedChanges ||
          saveStore.saveTimer !== null ||
          saveStore.isSaving
        ) {
          if (sv > pendingServerVersion.value) pendingServerVersion.value = sv;
          return;
        }
        if (typeof p.version !== "undefined")
          dataVersion.value = normalizeVersion(p.version);
        fetchAndProcessData();
        break;
      }
      case "network_heartbeat":
        networkStore.lastNetworkHeartbeatAt = Date.now();
        networkStore.isNetworkSyncActive = true;
        break;
      case "lucky:stun":
        luckyStunData.value = (msg.payload || {}) as LuckyStunData;
        break;
      case "ping":
        networkStore.lastPingAt = Date.now();
        break;
    }
  });

  // ---- init ----
  const init = async () => {
    if (isInitializing) return;
    isInitializing = true;
    const preservedSnapshotRole = activeSnapshotRole.value;
    const preserveCurrentSnapshot = canPreserveCurrentSnapshotForInit();
    if (!preserveCurrentSnapshot) {
      initCompleted.value = false;
    }
    await auth.bootstrapSession({
      preserveExistingSession:
        preserveCurrentSnapshot && preservedSnapshotRole === "auth",
    });
    // Only open WS when authenticated; avoid meaningless guest reconnect loops
    if (
      typeof window !== "undefined" &&
      auth.sessionReady &&
      auth.isLogged &&
      status.value !== "OPEN"
    )
      wsOpen();
    const canKeepPreservedSnapshot =
      preserveCurrentSnapshot &&
      preservedSnapshotRole === snapshotRoleForCurrentAuth();
    if (!canKeepPreservedSnapshot) {
      cacheStore.hasServerSnapshot = false;
      cacheStore.cacheLoadedAt = null;
      activeSnapshotRole.value = null;
    }
    cacheStore.deferredSaveRequested = false;

    if (!canKeepPreservedSnapshot) {
      const cacheLoaded = cacheStore.loadFromCache(dataVersion);
      if (cacheLoaded) {
        cacheStore.cacheLoadedAt = Date.now();
        activeSnapshotRole.value = snapshotRoleForCurrentAuth();
      } else if (!auth.isLogged) {
        markProvisionalGuestSnapshotReady();
      }
    }

    try {
      let serverSnapshotLoaded = false;
      let lastError: unknown = null;
      const loadSnap = () =>
        cacheStore.loadServerSnapshot(
          handleDataUpdate,
          widgetsStore.updateLastSavedLayout,
        );
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await loadSnap();
          serverSnapshotLoaded = true;
          setTimeout(() => {
            networkStore.fetchLuckyStunData();
          }, 2000);
          break;
        } catch (e) {
          lastError = e;
        }
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1000));
      }
      if (!serverSnapshotLoaded && !auth.isLogged) {
        try {
          await fetchGuestSnapshotWithoutCredentials();
          serverSnapshotLoaded = true;
          setTimeout(() => {
            networkStore.fetchLuckyStunData();
          }, 2000);
        } catch (e) {
          lastError = e;
        }
      }
      if (!serverSnapshotLoaded) {
        if (lastError) console.error("Init failed", lastError);
        const fallbackCacheLoaded = cacheStore.loadFromCache(dataVersion);
        if (fallbackCacheLoaded) {
          activeSnapshotRole.value = auth.isLogged ? "auth" : "guest";
        }
        if (cacheStore.cacheLoadedAt === null)
          cacheStore.cacheLoadedAt = Date.now();
        if (!cacheStore.serverSnapshotRetryTimer) {
          cacheStore.serverSnapshotRetryTimer = setTimeout(async () => {
            cacheStore.serverSnapshotRetryTimer = null;
            if (cacheStore.hasServerSnapshot) return;
            try {
              await loadSnap();
              setTimeout(() => {
                networkStore.fetchLuckyStunData();
              }, 2000);
            } catch (e) {
              console.error("Init retry failed", e);
            }
          }, 3000);
        }
      }
    } finally {
      isInitializing = false;
      initCompleted.value = true;
      if (!wsMessageHandlerBound) {
        wsMessageHandlerBound = true;
        if (typeof document !== "undefined" && !visibilityVersionCheckBound) {
          visibilityVersionCheckBound = true;
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
              saveStore.checkVersionAfterActivation(auth.isLogged);
              void replayOfflineQueueIfNeeded();
            }
          });
        }
      }
      if (auth.sessionReady && auth.isLogged) startOfflineQueueReplayTimer();
    }
  };

  // ---- Logout ----
  const logout = async () => {
    if (logoutInProgress) return;
    logoutInProgress = true;
    // Explicitly close WS to stop reconnect storms
    try {
      if (
        auth.isLogged &&
        (saveStore.hasUnsavedChanges ||
          saveStore.hasPendingSave ||
          saveStore.saveTimer !== null ||
          widgetsStore.layoutDirty)
      ) {
        try {
          await saveStore.saveData(
            true,
            false,
            dataVersion,
            fetchAndProcessData,
          );
        } catch (error) {
          console.warn("[Logout] Pre-logout save failed", error);
        }
      }
      stopOfflineQueueReplayTimer();
      if (status.value === "OPEN") wsClose();
      networkStore.stopNetworkHeartbeat();
      stopHttpPolling();
      clearWsFallbackSyncSchedule(true);
      stopPingCheck();
      cacheStore.removeCacheForCurrentUser();
      await auth.logout();
      resetActiveStateForGuest();
      await init();
    } finally {
      logoutInProgress = false;
    }
  };

  // ---- saveData wrapper ----
  const saveData = (immediate = false, force = false) =>
    saveStore.saveData(immediate, force, dataVersion, fetchAndProcessData);

  const resolveConflict = (action: "remote" | "local") =>
    saveStore.resolveConflict(action, fetchAndProcessData, saveData);

  const confirmSyncFromServer = () =>
    saveStore.confirmSyncFromServer(fetchAndProcessData);
  const dismissSyncConfirm = () => saveStore.dismissSyncConfirm();
  const discardOfflineQueue = () =>
    saveStore.discardOfflineQueue(fetchAndProcessData);
  const resolveOfflineQueueConflict = (action: "force_save" | "discard") =>
    saveStore.resolveOfflineQueueConflict(action, fetchAndProcessData);

  // ---- Init event bindings ----
  if (typeof window !== "undefined") {
    networkStore.initEventBindings(
      () => {
        if (auth.sessionReady && auth.isLogged) wsOpen();
      },
      () => status.value,
      () =>
        saveStore.triggerOfflineQueueReplay(
          fetchVersionOnly,
          dataVersion,
          networkStore.getHeaders,
          {
            username: auth.username,
            sessionGeneration: auth.sessionGeneration,
          },
        ),
    );
    onStartDeckSessionInvalid(() => {
      void transitionToGuestState();
    });
  }

  // ---- Ping Timeout Detection ----
  const WS_PING_TIMEOUT_MS = 25000;
  let pingCheckTimer: ReturnType<typeof setInterval> | null = null;
  const startPingCheck = () => {
    if (pingCheckTimer) clearInterval(pingCheckTimer);
    pingCheckTimer = setInterval(() => {
      if (status.value !== "OPEN") return;
      const elapsed = Date.now() - networkStore.lastPingAt;
      if (networkStore.lastPingAt > 0 && elapsed > WS_PING_TIMEOUT_MS) {
        console.warn(
          `[Ping timeout] No server ping for ${elapsed}ms, reconnecting...`,
        );
        wsContinuousFailures++;
        wsClose();
      }
    }, 5000);
  };
  const stopPingCheck = () => {
    if (pingCheckTimer) clearInterval(pingCheckTimer);
    pingCheckTimer = null;
  };

  const stopAuthenticatedRuntime = () => {
    stopOfflineQueueReplayTimer();
    if (status.value === "OPEN") wsClose();
    networkStore.stopNetworkHeartbeat();
    stopHttpPolling();
    clearWsFallbackSyncSchedule(true);
    stopPingCheck();
  };

  const transitionToGuestState = async (guestData?: Record<string, unknown>) => {
    if (guestTransitionInProgress) return;
    guestTransitionInProgress = true;
    try {
      stopAuthenticatedRuntime();
      hadAuthenticatedSession = false;
      auth.clearLocalSession();
      resetActiveStateForGuest();
      if (guestData) {
        const applied = handleDataUpdate(guestData);
        if (!applied) return;
        widgetsStore.updateLastSavedLayout();
        cacheStore.markServerSnapshotReady();
        initCompleted.value = true;
        return;
      }
      await init();
    } finally {
      guestTransitionInProgress = false;
    }
  };

  // ---- Watches ----
  watch(
    () => configStore.forceNetworkMode,
    (mode, prev) => {
      if (!mode || mode === prev) return;
      const ok = ["auto", "lan", "wan", "latency"].includes(mode);
      if (!ok) return;
      if (isConnected.value) {
        networkStore.stopNetworkHeartbeat();
        networkStore.startNetworkHeartbeat(wsSend);
      }
    },
  );

  // Gate WS lifecycle on auth state changes to prevent guest reconnect storms
  watch(
    () => [auth.sessionReady, auth.isLogged, auth.sessionGeneration] as const,
    async ([ready, logged], previous) => {
      const previousGeneration = previous?.[2] || "";
      if (ready && logged) {
        hadAuthenticatedSession = true;
        if (typeof window !== "undefined" && status.value !== "OPEN") wsOpen();
        stopHttpPolling();
        startOfflineQueueReplayTimer();
        if (previousGeneration && previousGeneration !== auth.sessionGeneration) {
          await saveStore.quarantineMismatchedOfflineQueue({
            username: auth.username,
            sessionGeneration: auth.sessionGeneration,
          });
        }
        void replayOfflineQueueIfNeeded();
      } else {
        // Guest mode: stop WS, polling, and ping checks to avoid reconnect storms
        stopOfflineQueueReplayTimer();
        if (status.value === "OPEN") wsClose();
        stopHttpPolling();
        clearWsFallbackSyncSchedule(true);
        stopPingCheck();
        const shouldResetAuthenticatedState =
          ready &&
          !logoutInProgress &&
          (hadAuthenticatedSession || activeSnapshotRole.value === "auth");
        if (ready) {
          hadAuthenticatedSession = false;
        }
        if (shouldResetAuthenticatedState) {
          resetActiveStateForGuest();
          void init();
        }
      }
    },
  );
  const markDirtyIfActive = () => {
    if (!isInitializing && !isApplyingServerData) saveStore.markDirty();
  };
  watch(configStore.appConfig, markDirtyIfActive, { deep: true });
  watch(groupsStore.groups, markDirtyIfActive, { deep: true });
  watch(widgetsStore.widgets, markDirtyIfActive, { deep: true });
  watch(status, (newStatus) => {
    if (newStatus === "OPEN") {
      networkStore.lastPingAt = Date.now();
      startPingCheck();
      void replayOfflineQueueIfNeeded();
    } else {
      stopPingCheck();
      stopWsHealthCheck();
    }
  });

  watch(wsUrl, (newUrl, oldUrl) => {
    if (!newUrl || !oldUrl || newUrl === oldUrl) return;
    if (!auth.isLogged) return;
    const wasConnected = status.value === "OPEN";
    if (wasConnected) {
      forceWsReconnect();
    }
  });

  return {
    status,
    wsRawData,
    wsSend,
    wsSendRaw,
    wsOpen,
    isConnected,
    forceWsReconnect,
    dataVersion,
    pendingServerVersion,
    luckyStunData,
    activeSnapshotRole,
    isSaving: saveStore.isSaving,
    hasPendingSave: saveStore.hasPendingSave,
    hasUnsavedChanges: saveStore.hasUnsavedChanges,
    markDirty: saveStore.markDirty,
    saveData,
    resolveConflict,
    logout,
    conflictState: saveStore.conflictState,
    isServerSnapshotReady: cacheStore.isServerSnapshotReady,
    isClientReady: computed(
      () => cacheStore.isClientReady || initCompleted.value,
    ),
    cacheLoadedAt: cacheStore.cacheLoadedAt,
    hasServerSnapshot: computed(() => cacheStore.hasServerSnapshot),
    offlineQueueCount: saveStore.offlineQueueCount,
    offlineQueueConflictState: saveStore.offlineQueueConflictState,
    resolveOfflineQueueConflict,
    discardOfflineQueue,
    init,
    fetchData: fetchAndProcessData,
    fetchVersionOnly,
    syncConfirmModal: saveStore.syncConfirmModal,
    confirmSyncFromServer,
    dismissSyncConfirm,
    lastPingAt: networkStore.lastPingAt,
    isNetworkSyncActive: networkStore.isNetworkSyncActive,
    startNetworkHeartbeat: () => networkStore.startNetworkHeartbeat(wsSend),
    stopNetworkHeartbeat: networkStore.stopNetworkHeartbeat,
    registerDashboardPulse: networkStore.registerDashboardPulse,
    unregisterDashboardPulse: networkStore.unregisterDashboardPulse,
    startDashboardPulse: networkStore.startDashboardPulse,
    stopDashboardPulse: networkStore.stopDashboardPulse,
    lockServerSync: configStore.lockServerSync,
    unlockServerSync: configStore.unlockServerSync,
    isServerSyncLocked: configStore.isServerSyncLocked,
    wallpaperListPc: networkStore.wallpaperListPc,
    wallpaperListMobile: networkStore.wallpaperListMobile,
    fetchWallpaperLists: networkStore.fetchWallpaperLists,
    globalDrag: networkStore.globalDrag,
    initGlobalDrag: networkStore.initGlobalDrag,
    fetchSystemConfig: networkStore.fetchSystemConfig,
    fetchLuckyStunData: networkStore.fetchLuckyStunData,
    layoutDirty: widgetsStore.layoutDirty,
    layoutEditInProgress: widgetsStore.layoutEditInProgress,
    lastSavedLayoutSignature: widgetsStore.lastSavedLayoutSignature,
    undoLayout: () => widgetsStore.undoLayout(saveData),
    isHttpPollingActive: isHttpPollingActiveRef,
  };
});
