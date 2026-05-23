import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type ComputedRef,
  type Ref,
} from "vue";
import type { WidgetConfig } from "@/types";
import { normalizeItabPomodoroWidgetData } from "./itabPomodoroModel";
import {
  ITAB_POMODORO_DEFAULT_DURATION_SECONDS,
  ITAB_POMODORO_RUNTIME,
  type ItabPomodoroPhase,
  type ItabPomodoroTheme,
  type ItabPomodoroWidgetData,
} from "./itabPomodoroTypes";

const POMODORO_AUDIO_BASE_PATH = "/itab-live-assets/tomato-audio";
const POMODORO_STORAGE_PREFIX = "startdeck:itab-pomodoro";

export const pomodoroThemes: ItabPomodoroTheme[] = [
  {
    name: "海浪",
    key: "hailang",
    path: "hailang.jpg",
    audio: `${POMODORO_AUDIO_BASE_PATH}/hailang_128.m4a`,
  },
  {
    name: "篝火",
    key: "bonfire",
    path: "bonfire.jpg",
    audio: `${POMODORO_AUDIO_BASE_PATH}/bonfire_128.m4a`,
  },
  {
    name: "冥想",
    key: "meditation",
    path: "meditation.jpg",
    audio: `${POMODORO_AUDIO_BASE_PATH}/meditation_128.m4a`,
  },
  {
    name: "森林",
    key: "senlin",
    path: "senlin.jpg",
    audio: `${POMODORO_AUDIO_BASE_PATH}/senlin_128.m4a`,
  },
  {
    name: "寺庙",
    key: "simiao",
    path: "simiao.jpg",
    audio: `${POMODORO_AUDIO_BASE_PATH}/simiao_128.m4a`,
  },
  {
    name: "夜晚",
    key: "night",
    path: "night.jpg",
    audio: `${POMODORO_AUDIO_BASE_PATH}/night_128.m4a`,
  },
  {
    name: "农场",
    key: "farm",
    path: "farm.jpg",
    audio: `${POMODORO_AUDIO_BASE_PATH}/farm_128.m4a`,
  },
  {
    name: "时钟",
    key: "clock",
    path: "clock.jpg",
    audio: `${POMODORO_AUDIO_BASE_PATH}/clock_128.m4a`,
  },
  {
    name: "雨声",
    key: "rain",
    path: "rain.jpg",
    audio: `${POMODORO_AUDIO_BASE_PATH}/rain_128.m4a`,
  },
  {
    name: "雷雨",
    key: "thunder",
    path: "thunder.jpg",
    audio: `${POMODORO_AUDIO_BASE_PATH}/thunder_128.m4a`,
  },
  {
    name: "风铃",
    key: "chime",
    path: "chime.jpg",
    audio: `${POMODORO_AUDIO_BASE_PATH}/chime_128.m4a`,
  },
  {
    name: "键盘",
    key: "keyboard",
    path: "keyboard.jpg",
    audio: `${POMODORO_AUDIO_BASE_PATH}/keyboard_128.m4a`,
  },
  {
    name: "猫咪",
    key: "cat",
    path: "cat.jpg",
    audio: `${POMODORO_AUDIO_BASE_PATH}/cat_128.m4a`,
  },
];

export const pomodoroProgressCenterX = 224.198;
export const pomodoroProgressCenterY = 224.772;
export const pomodoroProgressRadius = 213.005;
export const pomodoroProgressCircumference = 1338;
export const pomodoroProgressDashArray = `${pomodoroProgressCircumference}, ${pomodoroProgressCircumference}`;
export const pomodoroProgressTransform = `rotate(-90 ${pomodoroProgressCenterX} ${pomodoroProgressCenterY})`;

export const pomodoroTickPaths = [
  "M224.180 19.0649V51.1205",
  "M170.976 26.207L174.348 38.8209",
  "M121.418 46.8818L127.944 58.1905",
  "M78.8975 79.6802L88.1282 88.9109",
  "M46.3086 122.367L57.6173 128.893",
  "M25.8838 172.04L38.4977 175.413",
  "M19.0127 225.294H51.0683",
  "M26.1553 278.517L38.7692 275.144",
  "M46.8301 328.075L58.1387 321.548",
  "M79.6289 370.594L88.8596 361.363",
  "M122.315 403.184L128.842 391.875",
  "M171.987 423.608L175.36 410.994",
  "M224.72 434.717V402.661",
  "M278.465 423.337L275.092 410.723",
  "M328.022 402.661L321.496 391.353",
  "M370.541 369.863L361.311 360.632",
  "M403.132 327.176L391.823 320.65",
  "M423.556 277.504L410.942 274.131",
  "M433.328 224.772H401.272",
  "M423.285 171.027L410.671 174.4",
  "M402.609 121.469L391.301 127.995",
  "M369.811 78.9497L360.58 88.1804",
  "M327.124 46.3599L320.598 57.6685",
  "M277.452 25.9355L274.079 38.5495",
  "M201.789 20.3491L203.209 33.3181",
  "M149.663 33.2451L154.393 45.41",
  "M102.653 59.2041L110.37 69.7296",
  "M63.9561 96.4399L74.137 104.606",
  "M36.2207 142.416L48.1663 147.679",
  "M21.3213 194.01L34.2276 195.994",
  "M20.2979 247.702L33.2668 246.282",
  "M33.1934 299.829L45.3583 295.099",
  "M59.1514 346.839L69.6769 339.122",
  "M96.3877 385.536L104.553 375.355",
  "M142.364 413.27L147.627 401.325",
  "M193.958 428.171L195.942 415.265",
  "M247.651 429.195L246.23 416.226",
  "M299.777 416.298L295.047 404.133",
  "M346.787 390.339L339.07 379.814",
  "M385.485 353.104L375.304 344.938",
  "M413.219 307.128L401.273 301.865",
  "M428.119 255.534L415.213 253.55",
  "M429.143 201.841L416.174 203.261",
  "M416.247 149.715L404.082 154.445",
  "M390.288 102.705L379.763 110.422",
  "M353.052 64.0068L344.887 74.1878",
  "M307.076 36.2734L301.813 48.2191",
  "M255.482 21.3726L253.498 34.2788",
];

export const formatPomodoroTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
};

export const pomodoroImageUrl = (
  path: string,
  size: "1x1" | "1x2" | "2x1" | "2x2" | "2x4" | "opened",
) => {
  const dimensions =
    size === "opened"
      ? "w_1366,h_768"
      : {
          "1x1": "w_60,h_60",
          "1x2": "w_150,h_60",
          "2x1": "w_60,h_150",
          "2x2": "w_150,h_150",
          "2x4": "w_330,h_150",
        }[size];

  return `/itab/widget/tomato/${path}?x-oss-process=image/resize,limit_0,m_fill,${dimensions}/format,jpg`;
};

type RuntimeUpdateListener = (data: ItabPomodoroWidgetData) => void;

interface PomodoroRuntimeState {
  hydrated: boolean;
  durationSeconds: Ref<number>;
  elapsedBaseSeconds: Ref<number>;
  startedAtMs: Ref<number | null>;
  tickNowMs: Ref<number>;
  phase: Ref<ItabPomodoroPhase>;
  running: Ref<boolean>;
  sessions: Ref<number>;
  themeIndex: Ref<number>;
  audioEnabled: Ref<boolean>;
  audioBlocked: Ref<boolean>;
  listeners: Set<RuntimeUpdateListener>;
  timer: number | null;
  audioElement: HTMLAudioElement | null;
  audioPlayToken: number;
}

const runtimeStateByWidgetId = new Map<string, PomodoroRuntimeState>();

const createState = (): PomodoroRuntimeState => ({
  hydrated: false,
  durationSeconds: ref(ITAB_POMODORO_DEFAULT_DURATION_SECONDS),
  elapsedBaseSeconds: ref(0),
  startedAtMs: ref(null),
  tickNowMs: ref(Date.now()),
  phase: ref("idle"),
  running: ref(false),
  sessions: ref(0),
  themeIndex: ref(0),
  audioEnabled: ref(true),
  audioBlocked: ref(false),
  listeners: new Set(),
  timer: null,
  audioElement: null,
  audioPlayToken: 0,
});

const getState = (widgetId: string) => {
  const existing = runtimeStateByWidgetId.get(widgetId);
  if (existing) return existing;
  const state = createState();
  runtimeStateByWidgetId.set(widgetId, state);
  return state;
};

const storageKey = (widgetId: string) =>
  `${POMODORO_STORAGE_PREFIX}:${encodeURIComponent(widgetId)}`;

const readLocalData = (widgetId: string) => {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(storageKey(widgetId));
    if (!raw) return undefined;
    return normalizeItabPomodoroWidgetData(JSON.parse(raw));
  } catch {
    return undefined;
  }
};

const writeLocalData = (widgetId: string, data: ItabPomodoroWidgetData) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(widgetId), JSON.stringify(data));
  } catch {
    // The timer remains usable even when local storage is unavailable.
  }
};

const chooseNewestData = (
  widgetData: ItabPomodoroWidgetData,
  localData?: ItabPomodoroWidgetData,
) => {
  if (!localData) return widgetData;
  return (localData.updatedAt || 0) >= (widgetData.updatedAt || 0)
    ? localData
    : widgetData;
};

const clampElapsedSeconds = (seconds: number, duration: number) =>
  Math.min(duration, Math.max(0, Math.floor(seconds)));

const audioAbsoluteUrl = (url: string) => {
  if (typeof window === "undefined") return url;
  return new URL(url, window.location.origin).href;
};

export const useItabPomodoroRuntime = (
  widget: ComputedRef<WidgetConfig>,
  emitUpdate: (data: ItabPomodoroWidgetData) => void,
) => {
  const state = computed(() => getState(widget.value.id));
  const normalizedData = computed(() =>
    normalizeItabPomodoroWidgetData(widget.value.data),
  );
  const activeTheme = computed(
    () => pomodoroThemes[state.value.themeIndex.value] || pomodoroThemes[0]!,
  );
  const phase = computed(() => state.value.phase.value);
  const running = computed(() => state.value.running.value);
  const sessions = computed(() => state.value.sessions.value);
  const audioEnabled = computed(() => state.value.audioEnabled.value);
  const audioBlocked = computed(() => state.value.audioBlocked.value);
  const activeAudioUrl = computed(() => activeTheme.value.audio);
  const elapsedSeconds = computed(() => {
    const current = state.value;
    if (!current.running.value || current.startedAtMs.value === null) {
      return current.elapsedBaseSeconds.value;
    }
    const liveElapsed = Math.floor(
      (current.tickNowMs.value - current.startedAtMs.value) / 1000,
    );
    return clampElapsedSeconds(
      current.elapsedBaseSeconds.value + Math.max(0, liveElapsed),
      current.durationSeconds.value,
    );
  });
  const remainingSeconds = computed(() =>
    Math.max(0, state.value.durationSeconds.value - elapsedSeconds.value),
  );
  const displayText = computed(() =>
    formatPomodoroTime(remainingSeconds.value),
  );
  const progressRatio = computed(() =>
    state.value.durationSeconds.value > 0 && state.value.phase.value === "focus"
      ? Math.min(1, elapsedSeconds.value / state.value.durationSeconds.value)
      : 0,
  );
  const progressDashOffset = computed(() =>
    String(
      (pomodoroProgressCircumference * (1 - progressRatio.value)).toFixed(3),
    ),
  );
  const progressValue = computed(() => progressRatio.value.toFixed(4));
  const primaryControlState = computed(() =>
    state.value.running.value ? "pause" : "play",
  );
  const primaryControlLabel = computed(() =>
    state.value.running.value
      ? "暂停"
      : state.value.phase.value === "focus" && elapsedSeconds.value > 0
        ? "继续"
        : "开始",
  );
  const secondaryControlVisible = computed(
    () => state.value.running.value || state.value.phase.value === "focus",
  );
  const audioIconState = computed(() =>
    state.value.audioEnabled.value ? "sound" : "muted",
  );

  const toWidgetData = (): ItabPomodoroWidgetData => ({
    ...normalizedData.value,
    runtime: ITAB_POMODORO_RUNTIME,
    duration: state.value.durationSeconds.value,
    remainingSeconds: remainingSeconds.value,
    phase: state.value.phase.value,
    isRunning: state.value.running.value,
    sessions: state.value.sessions.value,
    themeIndex: state.value.themeIndex.value,
    audioEnabled: state.value.audioEnabled.value,
    updatedAt: Date.now(),
  });

  const persist = () => {
    writeLocalData(widget.value.id, toWidgetData());
  };

  const notify = () => {
    const data = toWidgetData();
    writeLocalData(widget.value.id, data);
    state.value.listeners.forEach((listener) => listener(data));
  };

  const clearTimer = () => {
    const current = state.value;
    if (current.timer !== null) {
      window.clearInterval(current.timer);
      current.timer = null;
    }
  };

  const pauseAudio = (reset = false) => {
    const current = state.value;
    current.audioPlayToken += 1;
    if (!current.audioElement) return;
    current.audioElement.pause();
    if (reset) {
      try {
        current.audioElement.currentTime = 0;
      } catch {
        // Some browsers prevent seeking before metadata is ready.
      }
    }
  };

  const ensureAudio = () => {
    const current = state.value;
    if (typeof Audio === "undefined") return null;
    if (!current.audioElement) {
      current.audioElement = new Audio();
      current.audioElement.loop = true;
      current.audioElement.preload = "auto";
      current.audioElement.volume = 0.72;
    }
    return current.audioElement;
  };

  const syncAudioSource = () => {
    const audio = ensureAudio();
    if (!audio) return null;
    const nextSrc = activeAudioUrl.value;
    if (audio.src !== audioAbsoluteUrl(nextSrc)) {
      audio.pause();
      audio.src = nextSrc;
      audio.loop = true;
      audio.preload = "auto";
      audio.load();
    }
    return audio;
  };

  const playAudio = async () => {
    const current = state.value;
    if (!current.audioEnabled.value || !current.running.value) {
      pauseAudio();
      return;
    }
    const audio = syncAudioSource();
    if (!audio) return;
    const token = (current.audioPlayToken += 1);
    try {
      await audio.play();
      if (token === current.audioPlayToken) {
        current.audioBlocked.value = false;
      }
    } catch {
      if (token === current.audioPlayToken) {
        current.audioBlocked.value = true;
      }
    }
  };

  const completeSession = () => {
    const current = state.value;
    current.elapsedBaseSeconds.value = current.durationSeconds.value;
    current.startedAtMs.value = null;
    current.running.value = false;
    current.phase.value = "completed";
    current.sessions.value += 1;
    clearTimer();
    pauseAudio(true);
    notify();
  };

  const syncTick = () => {
    state.value.tickNowMs.value = Date.now();
    if (
      state.value.running.value &&
      elapsedSeconds.value >= state.value.durationSeconds.value
    ) {
      completeSession();
      return;
    }
    persist();
  };

  const startTicker = () => {
    if (typeof window === "undefined") return;
    clearTimer();
    state.value.timer = window.setInterval(syncTick, 1000);
  };

  const applyDataToState = (data: ItabPomodoroWidgetData) => {
    const current = state.value;
    const now = Date.now();
    const elapsedAtSave = data.duration - data.remainingSeconds;
    const elapsedSinceSave =
      data.isRunning && typeof data.updatedAt === "number"
        ? Math.max(0, Math.floor((now - data.updatedAt) / 1000))
        : 0;
    const adjustedElapsed = clampElapsedSeconds(
      elapsedAtSave + elapsedSinceSave,
      data.duration,
    );

    current.durationSeconds.value = data.duration;
    current.elapsedBaseSeconds.value = adjustedElapsed;
    current.tickNowMs.value = now;
    current.sessions.value = data.sessions;
    current.themeIndex.value = data.themeIndex;
    current.audioEnabled.value = data.audioEnabled;
    current.audioBlocked.value = false;

    if (data.isRunning && adjustedElapsed < data.duration) {
      current.startedAtMs.value = now;
      current.running.value = true;
      current.phase.value = "focus";
      startTicker();
      void playAudio();
      return;
    }

    current.startedAtMs.value = null;
    current.running.value = false;
    current.phase.value =
      data.isRunning && adjustedElapsed >= data.duration
        ? "completed"
        : data.phase;
    if (data.isRunning && adjustedElapsed >= data.duration) {
      current.sessions.value += 1;
    }
    clearTimer();
    pauseAudio(true);
    persist();
  };

  const ensureHydrated = (force = false) => {
    if (state.value.hydrated && !force) return;
    const localData = readLocalData(widget.value.id);
    const data = chooseNewestData(normalizedData.value, localData);
    applyDataToState(data);
    state.value.hydrated = true;
  };

  const start = () => {
    const current = state.value;
    current.elapsedBaseSeconds.value =
      elapsedSeconds.value >= current.durationSeconds.value
        ? 0
        : elapsedSeconds.value;
    current.tickNowMs.value = Date.now();
    current.startedAtMs.value = current.tickNowMs.value;
    current.phase.value = "focus";
    current.running.value = true;
    current.audioBlocked.value = false;
    startTicker();
    notify();
    void playAudio();
  };

  const pause = () => {
    const current = state.value;
    current.elapsedBaseSeconds.value = elapsedSeconds.value;
    current.startedAtMs.value = null;
    current.running.value = false;
    clearTimer();
    pauseAudio();
    notify();
  };

  const toggle = () => {
    if (state.value.running.value) {
      pause();
      return;
    }
    start();
  };

  const stop = () => {
    const current = state.value;
    current.elapsedBaseSeconds.value = 0;
    current.startedAtMs.value = null;
    current.tickNowMs.value = Date.now();
    current.running.value = false;
    current.phase.value = "idle";
    current.audioBlocked.value = false;
    clearTimer();
    pauseAudio(true);
    notify();
  };

  const switchTheme = (direction: -1 | 1) => {
    const current = state.value;
    current.themeIndex.value =
      (current.themeIndex.value + direction + pomodoroThemes.length) %
      pomodoroThemes.length;
    if (current.running.value && current.audioEnabled.value) {
      void playAudio();
    } else {
      syncAudioSource();
    }
    notify();
  };

  const toggleAudio = () => {
    const current = state.value;
    current.audioEnabled.value = !current.audioEnabled.value;
    current.audioBlocked.value = false;
    if (current.audioEnabled.value) {
      void playAudio();
    } else {
      pauseAudio();
    }
    notify();
  };

  const listener: RuntimeUpdateListener = (data) => emitUpdate(data);

  onMounted(() => {
    state.value.listeners.add(listener);
    ensureHydrated();
  });

  onUnmounted(() => {
    state.value.listeners.delete(listener);
    if (state.value.listeners.size === 0) {
      persist();
      clearTimer();
      pauseAudio();
    }
  });

  watch(
    () => widget.value.id,
    () => ensureHydrated(true),
  );

  return {
    activeTheme,
    activeAudioUrl,
    audioBlocked,
    audioEnabled,
    audioIconState,
    displayText,
    elapsedSeconds,
    phase,
    remainingSeconds,
    progressDashOffset,
    progressValue,
    primaryControlLabel,
    primaryControlState,
    running,
    secondaryControlVisible,
    sessions,
    state,
    ensureHydrated,
    start,
    pause,
    toggle,
    stop,
    switchTheme,
    toggleAudio,
  };
};
