import { ref, type Ref } from "vue";

export type SharedDockerRuntimeState = {
  dockerInfo: Ref<unknown | null>;
  containers: Ref<unknown[]>;
  error: Ref<string>;
  dockerState: Ref<"disabled" | "unavailable" | "ready">;
  errorCount: Ref<number>;
  updateStatus: Ref<unknown | null>;
  isCheckingUpdate: Ref<boolean>;
  isLoading: Ref<boolean>;
  retryDeadline: Ref<number>;
  inspectCache: Ref<Record<string, { ts: number; data: unknown }>>;
  inflightInspect: Set<string>;
  retain: () => void;
  release: () => void;
  hasPollingTimer: () => boolean;
  setPollingTimer: (timer: ReturnType<typeof setTimeout> | null) => void;
  clearPollingTimer: () => void;
};

type InternalDockerRuntimeState = Omit<
  SharedDockerRuntimeState,
  | "retain"
  | "release"
  | "hasPollingTimer"
  | "setPollingTimer"
  | "clearPollingTimer"
> & {
  consumers: number;
  pollTimer: ReturnType<typeof setTimeout> | null;
};

const dockerRuntimeStates = new Map<string, InternalDockerRuntimeState>();

const createState = (): InternalDockerRuntimeState => ({
  dockerInfo: ref(null),
  containers: ref([]),
  error: ref(""),
  dockerState: ref("unavailable"),
  errorCount: ref(0),
  updateStatus: ref(null),
  isCheckingUpdate: ref(false),
  isLoading: ref(false),
  retryDeadline: ref(0),
  inspectCache: ref({}),
  inflightInspect: new Set<string>(),
  consumers: 0,
  pollTimer: null,
});

export const useSharedDockerWidgetRuntimeState = (
  widgetId?: string,
): SharedDockerRuntimeState => {
  const key = widgetId || "docker";
  let state = dockerRuntimeStates.get(key);
  if (!state) {
    state = createState();
    dockerRuntimeStates.set(key, state);
  }

  const clearPollingTimer = () => {
    if (state?.pollTimer) clearTimeout(state.pollTimer);
    if (state) state.pollTimer = null;
  };

  return {
    dockerInfo: state.dockerInfo,
    containers: state.containers,
    error: state.error,
    dockerState: state.dockerState,
    errorCount: state.errorCount,
    updateStatus: state.updateStatus,
    isCheckingUpdate: state.isCheckingUpdate,
    isLoading: state.isLoading,
    retryDeadline: state.retryDeadline,
    inspectCache: state.inspectCache,
    inflightInspect: state.inflightInspect,
    retain: () => {
      if (state) state.consumers += 1;
    },
    release: () => {
      if (!state) return;
      state.consumers = Math.max(0, state.consumers - 1);
      if (state.consumers === 0) clearPollingTimer();
    },
    hasPollingTimer: () => Boolean(state?.pollTimer),
    setPollingTimer: (timer) => {
      if (state) state.pollTimer = timer;
    },
    clearPollingTimer,
  };
};
