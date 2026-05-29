import { computed } from "vue";
import { defineStore } from "pinia";
import { useAuthStore } from "./auth";
import { useSyncStore } from "./sync";
import { useWidgetsStore } from "./widgets";
import { useGroupsStore } from "./groups";
import { useConfigStore } from "./config";

export const useMainStore = defineStore("main", () => {
  const auth = useAuthStore();
  const sync = useSyncStore();
  const widgetsStore = useWidgetsStore();
  const groupsStore = useGroupsStore();
  const configStore = useConfigStore();

  // ---- Auth ----
  const token = computed(() => auth.token);
  const username = computed(() => auth.username);
  const isLogged = computed(() => auth.isLogged);
  const password = computed(() => auth.password);
  const login = async (usr: string, pwd: string): Promise<boolean> => {
    const success = await auth.login(usr, pwd);
    if (success) {
      await sync.fetchData();
    }
    return success;
  };
  const register = auth.register;
  const changePassword = auth.changePassword;
  const fetchUsers = auth.fetchUsers;
  const addUser = auth.addUser;
  const deleteUser = auth.deleteUser;
  const uploadLicense = auth.uploadLicense;
  const getHeaders = auth.getHeaders;

  // ---- Config ----
  const appConfig = computed(() => configStore.appConfig);
  const systemConfig = computed(() => configStore.systemConfig);
  const forceNetworkMode = computed({
    get: () => configStore.forceNetworkMode,
    set: (v) => {
      configStore.forceNetworkMode = v;
    },
  });
  const isExpandedMode = computed({
    get: () => configStore.isExpandedMode,
    set: (v) => {
      configStore.isExpandedMode = v;
    },
  });
  const webPaginationActiveGroupId = computed({
    get: () => configStore.webPaginationActiveGroupId,
    set: (v) => {
      configStore.webPaginationActiveGroupId = v;
    },
  });
  const isLanModeInited = computed({
    get: () => configStore.isLanModeInited,
    set: (v) => {
      configStore.isLanModeInited = v;
    },
  });
  const isLanMode = computed({
    get: () => configStore.isLanMode,
    set: (v) => {
      configStore.isLanMode = v;
    },
  });
  const networkLatency = computed({
    get: () => configStore.networkLatency,
    set: (v) => {
      configStore.networkLatency = v;
    },
  });
  const effectiveIsLan = computed({
    get: () => configStore.effectiveIsLan,
    set: (v) => {
      configStore.effectiveIsLan = v;
    },
  });
  const currentVersion = computed(() => configStore.currentVersion);
  const latestVersion = computed(() => configStore.latestVersion);
  const hasUpdate = computed(() => configStore.hasUpdate);
  const checkUpdate = configStore.checkUpdate;
  const refreshResources = configStore.refreshResources;
  const getAssetUrl = configStore.getAssetUrl;
  const resourceVersion = computed(() => configStore.resourceVersion);
  const updateCustomScripts = (doSave = true) => {
    if (configStore.appConfig.customCssList) {
      configStore.appConfig.customCss = configStore.appConfig.customCssList
        .filter((item) => item.enable)
        .map((item) => `/* ${item.name} */\n${item.content}`)
        .join("\n\n");
    }
    if (configStore.appConfig.customJsList) {
      configStore.appConfig.customJs = configStore.appConfig.customJsList
        .filter((item) => item.enable)
        .map((item) => `// ${item.name}\n${item.content}`)
        .join("\n\n");
    }
    if (doSave) {
      sync.markDirty();
      saveCustomScripts();
    }
  };

  const saveCustomScripts = async () => {
    try {
      if (!isLogged.value) return;
      const res = await fetch("/api/custom-scripts", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          css: configStore.appConfig.customCssList || [],
          js: configStore.appConfig.customJsList || [],
        }),
      });
      if (!res.ok) console.error("Failed to save custom scripts");
    } catch (e) {
      console.error("Error saving custom scripts", e);
    }
  };

  // ---- Groups ----
  const groups = computed({
    get: () => groupsStore.groups,
    set: (v) => {
      groupsStore.groups = v;
    },
  });
  const items = computed(() => groupsStore.items);
  const addGroup = groupsStore.addGroup;
  const deleteGroup = groupsStore.deleteGroup;
  const updateGroupTitle = groupsStore.updateGroupTitle;
  const updateGroup = groupsStore.updateGroup;
  const addItem = groupsStore.addItem;
  const updateItem = groupsStore.updateItem;
  const deleteItem = groupsStore.deleteItem;
  const cleanInvalidGroups = groupsStore.cleanInvalidGroups;

  // ---- Widgets ----
  const widgets = computed({
    get: () => widgetsStore.widgets,
    set: (v) => {
      widgetsStore.widgets = v;
    },
  });
  const mergedWidgets = computed(() => widgetsStore.mergedWidgets);
  const setWidgetUiState = widgetsStore.setWidgetUiState;
  const saveWidget = async (id?: string, data?: unknown) => {
    const saved = await widgetsStore.saveWidget(id, data);
    if (saved) sync.markDirty();
  };
  const saveSingleWidget = (
    widgetId: string,
    payload: Record<string, unknown>,
  ) =>
    widgetsStore.saveSingleWidget(widgetId, payload, getHeaders, {
      get value() {
        return sync.dataVersion;
      },
      set value(v: number) {
        sync.dataVersion = v;
      },
    });
  // ---- Sync / WS ----
  const isConnected = computed(() => sync.isConnected);
  const wsSend = sync.wsSend;
  const wsSendRaw = sync.wsSendRaw;
  const wsOpen = sync.wsOpen;
  const status = computed(() => sync.status);
  const dataVersion = computed(() => sync.dataVersion);
  const pendingServerVersion = computed(() => sync.pendingServerVersion);
  const luckyStunData = computed(() => sync.luckyStunData);
  const fetchLuckyStunData = sync.fetchLuckyStunData;
  const init = sync.init;
  const fetchData = sync.fetchData;
  const logout = sync.logout;
  const saveData = sync.saveData;
  const markDirty = sync.markDirty;
  const resolveConflict = sync.resolveConflict;
  const isSaving = computed(() => sync.isSaving);
  const hasPendingSave = computed(() => sync.hasPendingSave);
  const hasUnsavedChanges = computed(() => sync.hasUnsavedChanges);
  const isServerSnapshotReady = computed(() => sync.isServerSnapshotReady);
  const isClientReady = computed(() => sync.isClientReady);
  const conflictState = computed(() => sync.conflictState);
  const syncConfirmModal = computed(() => sync.syncConfirmModal);
  const confirmSyncFromServer = sync.confirmSyncFromServer;
  const dismissSyncConfirm = sync.dismissSyncConfirm;
  const offlineQueueCount = computed(() => sync.offlineQueueCount);
  const offlineQueueConflictState = computed(
    () => sync.offlineQueueConflictState,
  );
  const resolveOfflineQueueConflict = sync.resolveOfflineQueueConflict;
  const discardOfflineQueue = sync.discardOfflineQueue;
  const lastPingAt = computed(() => sync.lastPingAt);
  const isNetworkSyncActive = computed(() => sync.isNetworkSyncActive);
  const startNetworkHeartbeat = sync.startNetworkHeartbeat;
  const stopNetworkHeartbeat = sync.stopNetworkHeartbeat;
  const registerDashboardPulse = sync.registerDashboardPulse;
  const unregisterDashboardPulse = sync.unregisterDashboardPulse;
  const startDashboardPulse = sync.startDashboardPulse;
  const stopDashboardPulse = sync.stopDashboardPulse;
  const lockServerSync = sync.lockServerSync;
  const unlockServerSync = sync.unlockServerSync;
  const isServerSyncLocked = computed(() => sync.isServerSyncLocked);
  const wallpaperListPc = computed({
    get: () => sync.wallpaperListPc,
    set: (v) => {
      sync.wallpaperListPc = v;
    },
  });
  const wallpaperListMobile = computed({
    get: () => sync.wallpaperListMobile,
    set: (v) => {
      sync.wallpaperListMobile = v;
    },
  });
  const fetchWallpaperLists = sync.fetchWallpaperLists;
  const globalDrag = computed(() => sync.globalDrag);
  const initGlobalDrag = sync.initGlobalDrag;
  const fetchSystemConfig = sync.fetchSystemConfig;
  const updateSystemConfig = async (payload: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/system-config", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) return false;
      configStore.systemConfig = await res.json();
      return true;
    } catch (e) {
      console.error("Failed to update system config", e);
      return false;
    }
  };
  const layoutDirty = computed(() => sync.layoutDirty);
  const layoutEditInProgress = computed({
    get: () => sync.layoutEditInProgress,
    set: (v) => {
      sync.layoutEditInProgress = v;
    },
  });
  const lastSavedLayoutSignature = computed(
    () => sync.lastSavedLayoutSignature,
  );
  const undoLayout = sync.undoLayout;
  const fetchVersionOnly = sync.fetchVersionOnly;
  const isHttpPollingActive = computed(() => sync.isHttpPollingActive);

  return {
    // Auth
    token,
    username,
    isLogged,
    password,
    login,
    register,
    logout,
    changePassword,
    fetchUsers,
    addUser,
    deleteUser,
    uploadLicense,
    getHeaders,
    // Config
    appConfig,
    systemConfig,
    forceNetworkMode,
    isExpandedMode,
    webPaginationActiveGroupId,
    isLanModeInited,
    isLanMode,
    networkLatency,
    effectiveIsLan,
    currentVersion,
    latestVersion,
    hasUpdate,
    checkUpdate,
    refreshResources,
    getAssetUrl,
    resourceVersion,
    updateCustomScripts,
    // Groups
    groups,
    items,
    addGroup,
    deleteGroup,
    updateGroupTitle,
    updateGroup,
    addItem,
    updateItem,
    deleteItem,
    cleanInvalidGroups,
    // Widgets
    widgets,
    mergedWidgets,
    setWidgetUiState,
    saveWidget,
    saveSingleWidget,
    // Sync / WS
    isConnected,
    wsSend,
    wsSendRaw,
    wsOpen,
    status,
    dataVersion,
    pendingServerVersion,
    luckyStunData,
    fetchLuckyStunData,
    init,
    fetchData,
    saveData,
    markDirty,
    resolveConflict,
    isSaving,
    hasPendingSave,
    hasUnsavedChanges,
    isServerSnapshotReady,
    isClientReady,
    conflictState,
    syncConfirmModal,
    confirmSyncFromServer,
    dismissSyncConfirm,
    offlineQueueCount,
    offlineQueueConflictState,
    resolveOfflineQueueConflict,
    discardOfflineQueue,
    lastPingAt,
    isNetworkSyncActive,
    startNetworkHeartbeat,
    stopNetworkHeartbeat,
    registerDashboardPulse,
    unregisterDashboardPulse,
    startDashboardPulse,
    stopDashboardPulse,
    lockServerSync,
    unlockServerSync,
    isServerSyncLocked,
    wallpaperListPc,
    wallpaperListMobile,
    fetchWallpaperLists,
    globalDrag,
    initGlobalDrag,
    fetchSystemConfig,
    updateSystemConfig,
    layoutDirty,
    layoutEditInProgress,
    lastSavedLayoutSignature,
    undoLayout,
    fetchVersionOnly,
    isHttpPollingActive,
  };
});
