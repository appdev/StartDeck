import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type ComputedRef,
} from "vue";
import { useDebounceFn } from "@vueuse/core";
import type { WidgetConfig } from "@/types";
import { useResumeRefresh } from "@/composables/useResumeRefresh";
import { useMainStore } from "@/stores/main";
import { canWriteResource } from "@/utils/permissions";
import { fetchItabMemoWidgetData } from "./itabMemoApi";
import { normalizeItabMemoWidgetData } from "./itabMemoModel";
import type { ItabMemoNote, ItabMemoWidgetData } from "./itabMemoTypes";

const MEMO_POLL_INTERVAL_MS = 10000;
const MEMO_POLL_TIMEOUT_MS = 8000;
const MEMO_LOCAL_CHANGE_GRACE_MS = 8000;

export interface ItabMemoRuntimeOptions {
  remoteSync?: boolean;
  authRequired?: boolean;
}

const nowStamp = () => new Date().toISOString();

export const MEMO_SVG_PATHS = {
  add: "M8.5 2.75a.75.75 0 0 0-1.5 0V7H2.75a.75.75 0 0 0 0 1.5H7v4.25a.75.75 0 0 0 1.5 0V8.5h4.25a.75.75 0 0 0 0-1.5H8.5V2.75z",
  delete:
    "M6.5 7v4a.5.5 0 0 0 1 0V7a.5.5 0 0 0-1 0zM9 6.5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V7a.5.5 0 0 1 .5-.5zM10 4h3a.5.5 0 0 1 0 1h-.553l-.752 6.776A2.5 2.5 0 0 1 9.21 14H6.79a2.5 2.5 0 0 1-2.485-2.224L3.552 5H3a.5.5 0 0 1 0-1h3a2 2 0 1 1 4 0zM8 3a1 1 0 0 0-1 1h2a1 1 0 0 0-1-1zM4.559 5l.74 6.666A1.5 1.5 0 0 0 6.79 13h2.42a1.5 1.5 0 0 0 1.49-1.334L11.442 5H4.56z",
  pin: "M10.059 2.445a1.5 1.5 0 0 0-2.386.354l-2.02 3.79l-2.811.937a.5.5 0 0 0-.196.828L4.793 10.5l-2.647 2.647L2 14l.854-.146L5.5 11.207l2.146 2.147a.5.5 0 0 0 .828-.196l.937-2.81l3.779-2.024a1.5 1.5 0 0 0 .354-2.38L10.06 2.444zm-1.504.824a.5.5 0 0 1 .796-.118l3.485 3.498a.5.5 0 0 1-.118.794L8.764 9.559a.5.5 0 0 0-.238.283l-.744 2.233l-3.856-3.856l2.232-.744a.5.5 0 0 0 .283-.24L8.555 3.27z",
  unpin:
    "M9.56 10.267l4.586 4.587a.5.5 0 0 0 .708-.708l-13-13a.5.5 0 1 0-.708.708l4.586 4.585l-.08.15l-2.81.937a.5.5 0 0 0-.196.828L4.793 10.5l-2.647 2.646L2 14l.854-.146L5.5 11.207l2.146 2.147a.5.5 0 0 0 .828-.196l.937-2.811l.15-.08zm-.739-.739l-.057.031a.5.5 0 0 0-.238.283l-.744 2.232L3.926 8.22l2.232-.745a.5.5 0 0 0 .283-.239l.03-.056l2.35 2.35zm3.897-2.085l-2.054 1.1l.738.738l1.788-.957a1.5 1.5 0 0 0 .354-2.381L10.06 2.445a1.5 1.5 0 0 0-2.386.353l-.957 1.796l.739.74l1.1-2.065a.5.5 0 0 1 .796-.118l3.485 3.498a.5.5 0 0 1-.118.794z",
};

export const formatItabMemoTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export const useItabMemoRuntime = (
  widget: ComputedRef<WidgetConfig>,
  emitUpdate: (data: ItabMemoWidgetData) => void,
  options: ItabMemoRuntimeOptions = {},
) => {
  const store = useMainStore();
  const searchText = ref("");
  const remoteSync = options.remoteSync ?? false;
  const authRequired = options.authRequired ?? true;
  const shouldUseSocket = computed(
    () => store.isLanModeInited && store.effectiveIsLan && store.isConnected,
  );
  const canReadMemo = computed(() => !authRequired || store.isLogged);
  const canWriteMemo = computed(
    () => !authRequired || canWriteResource(store.isLogged),
  );
  const normalizedData = computed(() =>
    normalizeItabMemoWidgetData(widget.value.data),
  );
  const notes = computed(() =>
    canReadMemo.value ? normalizedData.value.notes : [],
  );
  const activeNoteId = ref(normalizedData.value.activeNoteId || "");
  const orderedNotes = computed(() =>
    [...notes.value].sort((left, right) => {
      if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
      return right.updatedAt.localeCompare(left.updatedAt);
    }),
  );
  const filteredNotes = computed(() => {
    const query = searchText.value.trim().toLowerCase();
    if (!query) return orderedNotes.value;
    return orderedNotes.value.filter(
      (note) =>
        note.title.toLowerCase().includes(query) ||
        note.body.toLowerCase().includes(query),
    );
  });
  const activeNote = computed(
    () =>
      notes.value.find((note) => note.id === activeNoteId.value) ||
      notes.value[0],
  );
  const outerRows = computed(() =>
    orderedNotes.value.slice(0, 3).map((note) => note.title || "未命名备忘录"),
  );
  const fixedNotes = computed(() =>
    orderedNotes.value.filter((note) => note.pinned),
  );

  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let pollController: AbortController | null = null;
  let lastLocalMutationAt = 0;

  const memoBackupKey = () => {
    const scope = store.isLogged
      ? `auth:${encodeURIComponent(store.username || "admin")}`
      : "guest";
    return `startdeck-itab-memo-backup-${scope}-${widget.value.id}`;
  };

  const readLocalBackup = () => {
    if (!store.isLogged || typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(memoBackupKey());
      if (!raw) return [];
      return normalizeItabMemoWidgetData({ notes: JSON.parse(raw) }).notes;
    } catch {
      return [];
    }
  };

  const writeLocalBackup = (items: ItabMemoNote[]) => {
    if (!store.isLogged || typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(memoBackupKey(), JSON.stringify(items));
    } catch {
      // Server state is still authoritative when local storage is unavailable.
    }
  };

  const pushSocketUpdate = useDebounceFn((data: ItabMemoWidgetData) => {
    if (!store.isLogged || !shouldUseSocket.value) return;
    store.wsSend({
      type: "memo_update",
      payload: {
        token: store.token || localStorage.getItem("start-deck-token"),
        widgetId: widget.value.id,
        content: data,
      },
    });
  }, 100);

  const emitData = (data: ItabMemoWidgetData, localMutation = false) => {
    if (localMutation) {
      lastLocalMutationAt = Date.now();
      writeLocalBackup(data.notes);
      pushSocketUpdate(data);
    }
    emitUpdate(data);
  };

  const commitNotes = (
    items: ItabMemoNote[],
    nextActiveNoteId = activeNoteId.value,
    localMutation = true,
  ) => {
    if (localMutation && !canWriteMemo.value) return;
    const resolvedActive =
      items.find((note) => note.id === nextActiveNoteId)?.id || items[0]?.id;
    activeNoteId.value = resolvedActive || "";
    emitData(
      {
        ...normalizedData.value,
        notes: items,
        ...(resolvedActive ? { activeNoteId: resolvedActive } : {}),
      },
      localMutation,
    );
  };

  const selectNote = (noteId: string) => {
    if (!notes.value.some((note) => note.id === noteId)) return;
    activeNoteId.value = noteId;
    emitData(
      {
        ...normalizedData.value,
        activeNoteId: noteId,
      },
      false,
    );
  };

  const createNote = () => {
    if (!canWriteMemo.value) return;
    const createdAt = nowStamp();
    const note: ItabMemoNote = {
      id: `memo-${Date.now()}`,
      title: "",
      body: "",
      pinned: false,
      createdAt,
      updatedAt: createdAt,
    };
    searchText.value = "";
    commitNotes([note, ...notes.value], note.id);
  };

  const updateNote = (
    noteId: string,
    patch: Partial<Pick<ItabMemoNote, "title" | "body">>,
  ) => {
    commitNotes(
      notes.value.map((note) =>
        note.id === noteId
          ? {
              ...note,
              ...patch,
              updatedAt: nowStamp(),
            }
          : note,
      ),
      noteId,
    );
  };

  const removeNote = (noteId: string) => {
    const index = notes.value.findIndex((note) => note.id === noteId);
    if (index === -1) return;
    const remaining = notes.value.filter((note) => note.id !== noteId);
    const nextActive =
      activeNoteId.value === noteId
        ? remaining[Math.max(0, index - 1)]?.id || remaining[0]?.id
        : activeNoteId.value;
    commitNotes(remaining, nextActive);
  };

  const togglePin = (noteId: string) => {
    commitNotes(
      notes.value.map((note) =>
        note.id === noteId
          ? { ...note, pinned: !note.pinned, updatedAt: nowStamp() }
          : note,
      ),
      noteId,
    );
  };

  const stopPolling = () => {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    if (pollController) {
      pollController.abort();
      pollController = null;
    }
  };

  const scheduleNextPoll = () => {
    if (!remoteSync) return;
    if (pollTimer) clearTimeout(pollTimer);
    if (
      !store.isLogged ||
      shouldUseSocket.value ||
      document.visibilityState === "hidden"
    )
      return;
    pollTimer = setTimeout(() => {
      void pollRemote();
    }, MEMO_POLL_INTERVAL_MS);
  };

  const pollRemote = async (force = false) => {
    if (!remoteSync || !store.isLogged) return;
    if (shouldUseSocket.value && !force) {
      stopPolling();
      return;
    }
    if (
      !force &&
      Date.now() - lastLocalMutationAt < MEMO_LOCAL_CHANGE_GRACE_MS
    ) {
      scheduleNextPoll();
      return;
    }

    pollController?.abort();
    const controller = new AbortController();
    pollController = controller;
    const timeoutTimer = setTimeout(
      () => controller.abort(),
      MEMO_POLL_TIMEOUT_MS,
    );

    try {
      const raw = await fetchItabMemoWidgetData(widget.value.id, {
        headers: store.getHeaders(),
        signal: controller.signal,
      });
      const nextData = normalizeItabMemoWidgetData(raw);
      const currentData = normalizedData.value;
      if (
        JSON.stringify(currentData.notes) !== JSON.stringify(nextData.notes)
      ) {
        emitData(
          {
            ...currentData,
            notes: nextData.notes,
            activeNoteId: nextData.activeNoteId,
          },
          false,
        );
      }
    } catch {
      // Ignore transient polling failures and retry on the next cycle.
    } finally {
      clearTimeout(timeoutTimer);
      if (pollController === controller) {
        pollController = null;
      }
      scheduleNextPoll();
    }
  };

  const ensureLoaded = () => {
    if (!remoteSync || !store.isLogged) return;
    const backup = readLocalBackup();
    if (notes.value.length === 0 && backup.length > 0) {
      commitNotes(backup, backup[0]?.id, false);
    }
    if (!shouldUseSocket.value) {
      void pollRemote(true);
    }
  };

  watch(
    () => normalizedData.value.activeNoteId,
    (noteId) => {
      if (noteId && noteId !== activeNoteId.value) {
        activeNoteId.value = noteId;
      }
    },
  );

  watch(
    notes,
    (items) => {
      if (!items.length) {
        activeNoteId.value = "";
        return;
      }
      if (!items.some((note) => note.id === activeNoteId.value)) {
        activeNoteId.value = items[0]!.id;
      }
    },
    { immediate: true },
  );

  if (remoteSync) {
    onMounted(ensureLoaded);
    onUnmounted(stopPolling);

    useResumeRefresh({
      enabled: () => store.isLogged,
      onHidden: stopPolling,
      onVisible: () => {
        if (!shouldUseSocket.value) void pollRemote(true);
      },
      onOnline: () => {
        if (!shouldUseSocket.value) void pollRemote(true);
      },
    });

    watch([() => store.isLogged, shouldUseSocket], ([isLogged, useSocket]) => {
      if (!isLogged) {
        stopPolling();
        return;
      }
      if (useSocket) {
        stopPolling();
        return;
      }
      void pollRemote(true);
    });

    watch(
      () => normalizedData.value.notes,
      (items) => writeLocalBackup(items),
      { deep: true },
    );
  }

  return {
    canReadMemo,
    canWriteMemo,
    searchText,
    notes,
    orderedNotes,
    filteredNotes,
    activeNote,
    outerRows,
    fixedNotes,
    activeNoteId,
    selectNote,
    createNote,
    updateNote,
    removeNote,
    togglePin,
    pollRemote,
  };
};
