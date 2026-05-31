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
import { fetchItabTodoWidgetData } from "./itabTodoApi";
import { normalizeItabTodoWidgetData } from "./itabTodoModel";
import type { ItabTodoTask, ItabTodoWidgetData } from "./itabTodoTypes";

const TODO_POLL_INTERVAL_MS = 10000;
const TODO_POLL_TIMEOUT_MS = 8000;
const TODO_LOCAL_CHANGE_GRACE_MS = 8000;

export interface ItabTodoRuntimeOptions {
  remoteSync?: boolean;
}

export const useItabTodoRuntime = (
  widget: ComputedRef<WidgetConfig>,
  emitUpdate: (data: ItabTodoWidgetData) => void,
  options: ItabTodoRuntimeOptions = {},
) => {
  const store = useMainStore();
  const draft = ref("");
  const remoteSync = options.remoteSync ?? false;
  const shouldUseSocket = computed(
    () => store.isLanModeInited && store.effectiveIsLan && store.isConnected,
  );
  const canReadTodo = computed(() => !!widget.value);
  const canWriteTodo = computed(() => canWriteResource(store.isLogged));
  const normalizedData = computed(() =>
    normalizeItabTodoWidgetData(widget.value.data),
  );
  const tasks = computed(() =>
    canReadTodo.value ? normalizedData.value.tasks : [],
  );
  const unfinishedTasks = computed(() =>
    tasks.value.filter((task) => !task.done),
  );
  const completedTasks = computed(() =>
    tasks.value.filter((task) => task.done),
  );
  const outerRows = computed(() => unfinishedTasks.value.slice(0, 4));

  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let pollController: AbortController | null = null;
  let lastLocalMutationAt = 0;

  const todoBackupKey = () => {
    const scope = store.isLogged
      ? `auth:${encodeURIComponent(store.username || "admin")}`
      : "guest";
    return `startdeck-itab-todo-backup-${scope}-${widget.value.id}`;
  };

  const readLocalBackup = () => {
    if (!store.isLogged || typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(todoBackupKey());
      if (!raw) return [];
      return normalizeItabTodoWidgetData({ tasks: JSON.parse(raw) }).tasks;
    } catch {
      return [];
    }
  };

  const writeLocalBackup = (items: ItabTodoTask[]) => {
    if (!store.isLogged || typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(todoBackupKey(), JSON.stringify(items));
    } catch {
      // The server remains the source of truth when local storage is unavailable.
    }
  };

  const pushSocketUpdate = useDebounceFn((data: ItabTodoWidgetData) => {
    if (!store.isLogged || !shouldUseSocket.value) return;
    store.wsSend({
      type: "todo_update",
      payload: {
        widgetId: widget.value.id,
        content: data,
      },
    });
  }, 100);

  const emitData = (data: ItabTodoWidgetData, localMutation = false) => {
    if (localMutation) {
      lastLocalMutationAt = Date.now();
      writeLocalBackup(data.tasks);
      pushSocketUpdate(data);
    }
    emitUpdate(data);
  };

  const commitTasks = (items: ItabTodoTask[], localMutation = true) => {
    if (localMutation && !canWriteTodo.value) return;
    emitData(
      {
        ...normalizedData.value,
        tasks: items,
      },
      localMutation,
    );
  };

  const createTask = () => {
    const text = draft.value.trim();
    if (!text) return;
    commitTasks([
      {
        id: `todo-${Date.now()}`,
        text,
        done: false,
      },
      ...tasks.value,
    ]);
    draft.value = "";
  };

  const toggleTask = (taskId: string) => {
    commitTasks(
      tasks.value.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task,
      ),
    );
  };

  const updateTaskText = (taskId: string, text: string) => {
    commitTasks(
      tasks.value.map((task) =>
        task.id === taskId ? { ...task, text } : task,
      ),
    );
  };

  const removeTask = (taskId: string) => {
    commitTasks(tasks.value.filter((task) => task.id !== taskId));
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
    }, TODO_POLL_INTERVAL_MS);
  };

  const pollRemote = async (force = false) => {
    if (!remoteSync || !store.isLogged) return;
    if (shouldUseSocket.value && !force) {
      stopPolling();
      return;
    }
    if (
      !force &&
      Date.now() - lastLocalMutationAt < TODO_LOCAL_CHANGE_GRACE_MS
    ) {
      scheduleNextPoll();
      return;
    }

    pollController?.abort();
    const controller = new AbortController();
    pollController = controller;
    const timeoutTimer = setTimeout(
      () => controller.abort(),
      TODO_POLL_TIMEOUT_MS,
    );

    try {
      const raw = await fetchItabTodoWidgetData(widget.value.id, {
        headers: store.getHeaders(),
        signal: controller.signal,
      });
      const nextData = normalizeItabTodoWidgetData(raw);
      const currentData = normalizedData.value;
      if (
        JSON.stringify(currentData.tasks) !== JSON.stringify(nextData.tasks)
      ) {
        emitData(
          {
            ...currentData,
            tasks: nextData.tasks,
          },
          false,
        );
      }
    } catch {
      // Ignore transient polling failures and try again next cycle.
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
    if (tasks.value.length === 0 && backup.length > 0) {
      commitTasks(backup, false);
    }
    if (!shouldUseSocket.value) {
      void pollRemote(true);
    }
  };

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
      () => normalizedData.value.tasks,
      (items) => writeLocalBackup(items),
      { deep: true },
    );
  }

  return {
    canReadTodo,
    canWriteTodo,
    draft,
    tasks,
    unfinishedTasks,
    completedTasks,
    outerRows,
    createTask,
    toggleTask,
    updateTaskText,
    removeTask,
    pollRemote,
  };
};
