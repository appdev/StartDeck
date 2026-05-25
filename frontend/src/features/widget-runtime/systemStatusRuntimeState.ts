import { ref, type Ref } from "vue";

export type SharedSystemStatusRuntimeState = {
  systemStats: Ref<unknown | null>;
  errorCount: Ref<number>;
  pollInterval: Ref<number>;
  retain: () => void;
  release: () => void;
  hasPollingTimer: () => boolean;
  setPollingTimer: (timer: ReturnType<typeof setInterval> | null) => void;
  clearPollingTimer: () => void;
};

type InternalSystemStatusRuntimeState = Omit<
  SharedSystemStatusRuntimeState,
  | "retain"
  | "release"
  | "hasPollingTimer"
  | "setPollingTimer"
  | "clearPollingTimer"
> & {
  consumers: number;
  pollTimer: ReturnType<typeof setInterval> | null;
};

const systemStatusRuntimeStates = new Map<
  string,
  InternalSystemStatusRuntimeState
>();

const createState = (): InternalSystemStatusRuntimeState => ({
  systemStats: ref(null),
  errorCount: ref(0),
  pollInterval: ref(60000),
  consumers: 0,
  pollTimer: null,
});

export const useSharedSystemStatusRuntimeState = (
  widgetId?: string,
): SharedSystemStatusRuntimeState => {
  const key = widgetId || "system-status";
  let state = systemStatusRuntimeStates.get(key);
  if (!state) {
    state = createState();
    systemStatusRuntimeStates.set(key, state);
  }

  const clearPollingTimer = () => {
    if (state?.pollTimer) clearInterval(state.pollTimer);
    if (state) state.pollTimer = null;
  };

  return {
    systemStats: state.systemStats,
    errorCount: state.errorCount,
    pollInterval: state.pollInterval,
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
