import { ref } from "vue";
import { defineStore } from "pinia";
import pako from "pako";
import * as offlineQueue from "@/utils/offlineQueue";
import {
  stripWidgetUiState,
  stripForceNetworkMode,
  normalizeVersion,
} from "@/utils/storeHelpers";
import { useAuthStore } from "./auth";
import { useWidgetsStore } from "./widgets";
import { useGroupsStore } from "./groups";
import { useConfigStore } from "./config";
import { useCacheStore } from "./cache";
import { sessionFetch } from "@/utils/sessionFetch";
import { sanitizeSnapshotIcons } from "@/utils/iconAssets";

export const SAVE_OPERATION_TIMESTAMP_HEADER =
  "X-StartDeck-Operation-Timestamp";
export const HOME_GRID_LAYOUT_SCHEMA_VERSION = "gridstack-home/2026-05-24";

const withOperationTimestampHeader = (
  headers: Record<string, string>,
  operationTimestamp: number,
) => ({
  ...headers,
  [SAVE_OPERATION_TIMESTAMP_HEADER]: String(operationTimestamp),
});

const hasSnapshotData = (
  value: unknown,
): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export const useSaveStore = defineStore("save", () => {
  const auth = useAuthStore();
  const widgetsStore = useWidgetsStore();
  const groupsStore = useGroupsStore();
  const configStore = useConfigStore();
  const cacheStore = useCacheStore();

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const isSaving = ref(false);
  const hasPendingSave = ref(false);
  let lastSavedJson = "";
  const hasUnsavedChanges = ref(false);

  const conflictState = ref({
    show: false,
    serverVersion: 0,
    clientVersion: 0,
  });
  const conflictResolving = ref(false);

  const offlineQueueCount = ref(0);
  const offlineQueueConflictState = ref<{
    show: boolean;
    item: { baseVersion: number; data: Record<string, unknown> } | null;
    serverVersion: number;
  }>({ show: false, item: null, serverVersion: 0 });

  const syncConfirmModal = ref({ show: false, serverVersion: 0 });
  let heartbeatLostSinceLastVisible = false;

  const markDirty = () => {
    if (auth.isLogged) hasUnsavedChanges.value = true;
  };

  const saveCustomScripts = async () => {
    try {
      if (!auth.isLogged) return;
      const res = await sessionFetch("/api/custom-scripts", {
        method: "POST",
        headers: cacheStore.getHeaders(),
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

  const saveData = async (
    immediate = false,
    force = false,
    dataVersion: { value: number },
    fetchData: () => Promise<void>,
  ): Promise<
    "saved" | "no_change" | "conflict" | "unauthorized" | "queued"
  > => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (conflictResolving.value && !force) {
      hasPendingSave.value = true;
      return "no_change";
    }

    const doSave = async () => {
      if (conflictState.value.show && !force) {
        hasPendingSave.value = false;
        return "conflict";
      }
      if (configStore.isPageUnloading) return "no_change";
      if (cacheStore.isCacheWriteGuardActive()) {
        cacheStore.deferredSaveRequested = true;
        return "no_change";
      }
      if (isSaving.value) {
        hasPendingSave.value = true;
        return "no_change";
      }

      isSaving.value = true;
      hasPendingSave.value = false;
      let operationTimestamp = 0;

      try {
        if (
          !auth.sessionReady ||
          !auth.isLogged ||
          !auth.username ||
          !auth.sessionGeneration
        )
          return "unauthorized";
        if (force && conflictState.value.show) {
          dataVersion.value = normalizeVersion(
            conflictState.value.serverVersion,
          );
        }

        const businessBody: Record<string, unknown> = sanitizeSnapshotIcons({
          groups: groupsStore.groups,
          widgets: widgetsStore.widgets.map((w) => stripWidgetUiState(w)),
          appConfig: stripForceNetworkMode(
            configStore.appConfig as unknown as Record<string, unknown>,
          ),
          version: dataVersion.value,
        });
        if (typeof auth.password === "string" && auth.password.length > 0) {
          businessBody.password = auth.password;
        }
        const json = JSON.stringify(businessBody);
        if (json === lastSavedJson) return "no_change";

        operationTimestamp = Date.now();
        const body: Record<string, unknown> = {
          ...businessBody,
          layoutSchemaVersion: HOME_GRID_LAYOUT_SCHEMA_VERSION,
          lastOperationAt: operationTimestamp,
        };
        const payloadJson = JSON.stringify(body);
        cacheStore.saveToCache(body);
        const compressed = pako.gzip(payloadJson);

        const getSaveTimeout = () => {
          if (configStore.effectiveIsLan) return 15000;
          if (configStore.forceNetworkMode === "latency") return 120000;
          return 60000;
        };

        const MAX_SAVE_RETRIES = 3;
        const SAVE_TIMEOUT_MS = getSaveTimeout();
        let saveAttempt = 0;
        let res: Response | null = null;

        while (saveAttempt < MAX_SAVE_RETRIES) {
          saveAttempt++;
          try {
            const controller = new AbortController();
            const timeout = window.setTimeout(
              () => controller.abort(),
              SAVE_TIMEOUT_MS,
            );
            res = await sessionFetch("/api/save", {
              method: "POST",
              headers: {
                ...withOperationTimestampHeader(
                  cacheStore.getHeaders(),
                  operationTimestamp,
                ),
                "Content-Encoding": "gzip",
              },
              body: compressed,
              signal: controller.signal,
            }).finally(() => window.clearTimeout(timeout));
            if (res.ok || res.status === 401) break;
            if (saveAttempt < MAX_SAVE_RETRIES) {
              const delay = Math.min(1000 * Math.pow(2, saveAttempt - 1), 5000);
              await new Promise((r) => setTimeout(r, delay));
            }
          } catch (e) {
            if (
              e instanceof DOMException &&
              e.name === "AbortError" &&
              saveAttempt < MAX_SAVE_RETRIES
            ) {
              const delay = Math.min(1000 * Math.pow(2, saveAttempt - 1), 5000);
              await new Promise((r) => setTimeout(r, delay));
              continue;
            }
            throw e;
          }
        }

        if (!res)
          throw new Error(`Save failed after ${MAX_SAVE_RETRIES} retries`);

        if (res.ok) {
          conflictState.value.show = false;
          hasUnsavedChanges.value = false;
          const result = await res.json().catch(() => null);
          if ((result as { ignored?: boolean } | null)?.ignored) {
            const normalizedData = hasSnapshotData(
              (result as { data?: unknown } | null)?.data,
            )
              ? ((result as { data: Record<string, unknown> }).data)
              : null;
            if (normalizedData) {
              groupsStore.groups = normalizedData.groups as typeof groupsStore.groups;
              const normalizedWidgets = widgetsStore.normalizeIncomingWidgets(
                normalizedData.widgets as never,
                auth.isLogged,
              );
              widgetsStore.applyServerWidgets(
                normalizedWidgets,
                auth.isLogged,
                widgetsStore.layoutEditInProgress,
              );
              cacheStore.saveToCache(normalizedData);
            }
            if (
              result &&
              typeof (result as { version?: number }).version !== "undefined"
            ) {
              dataVersion.value = normalizeVersion(
                (result as { version?: number }).version,
              );
            }
            await fetchData();
            widgetsStore.updateLastSavedLayout();
            lastSavedJson = JSON.stringify({
              ...businessBody,
              version: dataVersion.value,
            });
            return "saved";
          }
          if (
            result &&
            typeof (result as { version?: number }).version !== "undefined"
          ) {
            dataVersion.value = normalizeVersion(
              (result as { version?: number }).version,
            );
          }
          const normalizedData = hasSnapshotData(
            (result as { data?: unknown } | null)?.data,
          )
            ? ((result as { data: Record<string, unknown> }).data)
            : null;
          if (normalizedData) {
            groupsStore.groups = normalizedData.groups as typeof groupsStore.groups;
            const normalizedWidgets = widgetsStore.normalizeIncomingWidgets(
              normalizedData.widgets as never,
              auth.isLogged,
            );
            widgetsStore.applyServerWidgets(
              normalizedWidgets,
              auth.isLogged,
              widgetsStore.layoutEditInProgress,
            );
            cacheStore.saveToCache(normalizedData);
          }
          lastSavedJson = JSON.stringify({
            ...businessBody,
            version: dataVersion.value,
          });
          widgetsStore.updateLastSavedLayout();
          if (businessBody.password) auth.password = "";
          saveCustomScripts();
          return "saved";
        }

        if (res.status === 401) {
          auth.clearLocalSession();
          return "unauthorized";
        }

        throw new Error("Save failed");
      } catch (e) {
        if (configStore.isPageUnloading) return "no_change";
        console.error("Save failed, enqueueing to offline queue", e);
        try {
          const fallbackBody: Record<string, unknown> = sanitizeSnapshotIcons({
            groups: groupsStore.groups,
            widgets: widgetsStore.widgets.map((w) => stripWidgetUiState(w)),
            appConfig: stripForceNetworkMode(
              configStore.appConfig as unknown as Record<string, unknown>,
            ),
            version: dataVersion.value,
            layoutSchemaVersion: HOME_GRID_LAYOUT_SCHEMA_VERSION,
            lastOperationAt: operationTimestamp || Date.now(),
          });
          if (
            auth.sessionReady &&
            auth.isLogged &&
            auth.username &&
            auth.sessionGeneration
          ) {
            await offlineQueue.enqueue(
              fallbackBody,
              dataVersion.value,
              operationTimestamp || Date.now(),
              {
                username: auth.username,
                sessionGeneration: auth.sessionGeneration,
              },
            );
          } else {
            return "unauthorized";
          }
          offlineQueueCount.value = await offlineQueue.size();
          hasPendingSave.value = true;
          return "queued";
        } catch (queueErr) {
          console.error("Failed to enqueue to offline queue", queueErr);
        }
        throw e;
      } finally {
        isSaving.value = false;
        if (hasPendingSave.value) doSave();
      }
    };

    if (immediate) return doSave();
    return new Promise((resolve, reject) => {
      saveTimer = setTimeout(() => {
        saveTimer = null;
        doSave().then(resolve).catch(reject);
      }, 500);
    });
  };

  const resolveConflict = async (
    action: "remote" | "local",
    fetchData: () => Promise<void>,
    saveDataFn: (immediate: boolean, force: boolean) => Promise<string>,
  ) => {
    conflictState.value.show = false;
    conflictResolving.value = true;
    try {
      if (action === "remote") await fetchData();
      else await saveDataFn(true, true);
    } finally {
      conflictResolving.value = false;
    }
  };

  const checkVersionAfterActivation = async (isLogged: boolean) => {
    if (!isLogged || !heartbeatLostSinceLastVisible) return;
    heartbeatLostSinceLastVisible = false;
    syncConfirmModal.value = { show: false, serverVersion: 0 };
  };

  const confirmSyncFromServer = async (fetchData: () => Promise<void>) => {
    syncConfirmModal.value = { show: false, serverVersion: 0 };
    await fetchData();
  };

  const dismissSyncConfirm = () => {
    syncConfirmModal.value = { show: false, serverVersion: 0 };
  };

  const resolveOfflineQueueConflict = async (
    action: "force_save" | "discard",
    fetchData: () => Promise<void>,
  ) => {
    if (action === "discard") {
      await offlineQueue.clear();
      offlineQueueCount.value = 0;
      offlineQueueConflictState.value = {
        show: false,
        item: null,
        serverVersion: 0,
      };
      await fetchData();
      return;
    }
    if (!auth.username || !auth.sessionGeneration) {
      await offlineQueue.quarantineMismatched({
        username: "",
        sessionGeneration: "",
      });
      offlineQueueCount.value = await offlineQueue.size();
      return;
    }
    await offlineQueue.quarantineMismatched({
      username: auth.username,
      sessionGeneration: auth.sessionGeneration,
    });
    const items = await offlineQueue.getAll();
    if (items.length === 0) {
      offlineQueueConflictState.value.show = false;
      return;
    }
    const latestItem = items[items.length - 1];
    await offlineQueue.clear();
    offlineQueueConflictState.value.show = false;
    const body = sanitizeSnapshotIcons(latestItem.data as Record<string, unknown>);
    const json = JSON.stringify(body);
    const compressed = pako.gzip(json);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);
      const res = await sessionFetch("/api/save", {
        method: "POST",
        headers: {
          ...withOperationTimestampHeader(
            cacheStore.getHeaders(),
            latestItem.timestamp,
          ),
          "Content-Encoding": "gzip",
        },
        body: compressed,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      if (res.ok) {
        const result = await res.json().catch(() => null);
        if (
          result &&
          typeof (result as { version?: number }).version !== "undefined"
        ) {
          // dataVersion updated by caller
        }
        hasUnsavedChanges.value = false;
      }
    } catch (e) {
      console.error("[OfflineQueue] Force save failed:", e);
    }
  };

  const triggerOfflineQueueReplay = async (
    _fetchVersionOnly: () => Promise<number>,
    dataVersion: { value: number },
    getHeaders: () => Record<string, string>,
    owner: { username: string; sessionGeneration: string },
  ) => {
    const qSize = await offlineQueue.size();
    if (qSize === 0) return;
    await offlineQueue.quarantineMismatched(owner);
    await offlineQueue.replay(
      owner,
      async (data, operationTimestamp) => {
        try {
          const sanitized = sanitizeSnapshotIcons(data);
          const compressed = pako.gzip(JSON.stringify(sanitized));
          const c = new AbortController();
          const t = setTimeout(() => c.abort(), 5000);
          const res = await sessionFetch("/api/save", {
            method: "POST",
            headers: {
              ...withOperationTimestampHeader(getHeaders(), operationTimestamp),
              "Content-Encoding": "gzip",
            },
            body: compressed,
            signal: c.signal,
          }).finally(() => clearTimeout(t));
          if (res.ok) {
            const r = await res.json().catch(() => null);
            if (r && typeof (r as { version?: number }).version !== "undefined")
              dataVersion.value = normalizeVersion(
                (r as { version?: number }).version,
              );
            const normalizedData = hasSnapshotData((r as { data?: unknown })?.data)
              ? ((r as { data: Record<string, unknown> }).data)
              : null;
            if (normalizedData) {
              groupsStore.groups =
                normalizedData.groups as typeof groupsStore.groups;
              cacheStore.saveToCache(normalizedData);
            }
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
      async (widgetId, data, operationTimestamp, widgetVersion) => {
        try {
          const body = { ...data, version: dataVersion.value, widgetVersion };
          const c = new AbortController();
          const t = setTimeout(() => c.abort(), 5000);
          const res = await sessionFetch(
            `/api/widgets/${encodeURIComponent(widgetId)}`,
            {
              method: "PUT",
              headers: {
                ...withOperationTimestampHeader(
                  getHeaders(),
                  operationTimestamp,
                ),
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
              signal: c.signal,
            },
          ).finally(() => clearTimeout(t));
          if (res.ok) {
            const r = await res.json().catch(() => null);
            if (r && typeof (r as { version?: number }).version !== "undefined")
              dataVersion.value = normalizeVersion(
                (r as { version?: number }).version,
              );
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
      (item, error) => {
        console.error(
          `[OfflineQueue] Non-recoverable error for ${item.id}:`,
          error,
        );
        offlineQueueConflictState.value = {
          show: true,
          item,
          serverVersion: 0,
        };
      },
    );
    offlineQueueCount.value = await offlineQueue.size();
  };

  const quarantineMismatchedOfflineQueue = async (owner: {
    username: string;
    sessionGeneration: string;
  }) => {
    await offlineQueue.quarantineMismatched(owner);
    offlineQueueCount.value = await offlineQueue.size();
  };

  const discardOfflineQueue = async (fetchData: () => Promise<void>) => {
    await offlineQueue.clear();
    offlineQueueCount.value = 0;
    offlineQueueConflictState.value = {
      show: false,
      item: null,
      serverVersion: 0,
    };
    await fetchData();
  };

  return {
    saveTimer,
    isSaving,
    hasPendingSave,
    hasUnsavedChanges,
    conflictState,
    conflictResolving,
    offlineQueueCount,
    offlineQueueConflictState,
    syncConfirmModal,
    heartbeatLostSinceLastVisible,
    markDirty,
    saveData,
    resolveConflict,
    checkVersionAfterActivation,
    confirmSyncFromServer,
    dismissSyncConfirm,
    resolveOfflineQueueConflict,
    triggerOfflineQueueReplay,
    quarantineMismatchedOfflineQueue,
    discardOfflineQueue,
    saveCustomScripts,
  };
});
