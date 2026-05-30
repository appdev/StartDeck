import { computed, ref, watch, type Ref } from "vue";
import type { WidgetConfig } from "@/types";
import { fetchItabPoem } from "./itabPoemApi";
import { normalizeItabPoemWidgetData } from "./itabPoemModel";
import type {
  ItabPoemApiData,
  ItabPoemEntry,
  ItabPoemPalette,
  ItabPoemWidgetData,
} from "./itabPoemTypes";

export const ITAB_POEM_ICON_URL = "/itab-live-assets/today-shici.svg";

const EMPTY_POEM: ItabPoemApiData = {
  sentence: "",
  poemTitle: "",
  author: "",
  dynasty: "",
  fullText: [],
  translation: [],
  annotations: [],
  preface: [],
  sourceStatus: "empty",
};

export const ITAB_POEM_PALETTES: ItabPoemPalette[] = [
  {
    background: "#eeeeee",
    waveBack: "rgba(207, 198, 169, 0.64)",
    waveMiddle: "rgba(190, 171, 108, 0.54)",
    waveFront: "rgba(168, 151, 92, 0.68)",
  },
  {
    background: "#eeeeee",
    waveBack: "rgba(142, 194, 198, 0.45)",
    waveMiddle: "rgba(116, 170, 164, 0.48)",
    waveFront: "rgba(84, 144, 135, 0.58)",
  },
  {
    background: "#eeeeee",
    waveBack: "rgba(183, 186, 214, 0.48)",
    waveMiddle: "rgba(139, 154, 196, 0.44)",
    waveFront: "rgba(106, 124, 169, 0.54)",
  },
  {
    background: "#eeeeee",
    waveBack: "rgba(206, 177, 161, 0.48)",
    waveMiddle: "rgba(190, 141, 110, 0.42)",
    waveFront: "rgba(156, 111, 83, 0.52)",
  },
];

let lastRandomPaletteIndex = -1;

interface ItabPoemRuntimeOptions {
  allowDailyPaletteRefresh?: boolean;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.map(normalizeString).filter((item) => item.length > 0)
    : [];

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getItabPoemDailyPaletteIndex = (
  dateKey: string,
  paletteCount = ITAB_POEM_PALETTES.length,
) => {
  if (paletteCount <= 1) return 0;
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return 0;
  const utcDays = Math.floor(
    Date.UTC(year, month - 1, day) / (24 * 60 * 60 * 1000),
  );
  return utcDays % paletteCount;
};

export const normalizeItabPoemApiResponse = (
  payload: unknown,
): ItabPoemApiData | null => {
  if (!isObject(payload)) return null;
  const sentence = normalizeString(payload.sentence);
  const poemTitle = normalizeString(payload.poemTitle);
  const author = normalizeString(payload.author);
  const dynasty = normalizeString(payload.dynasty);
  if (!sentence || !poemTitle || !author || !dynasty) return null;

  const fullText = normalizeStringArray(payload.fullText);
  return {
    id: normalizeString(payload.id) || undefined,
    sentence,
    poemTitle,
    author,
    dynasty,
    fullText: fullText.length ? fullText : [sentence],
    translation: normalizeStringArray(payload.translation),
    annotations: normalizeStringArray(payload.annotations),
    preface: normalizeStringArray(payload.preface),
    popularity:
      typeof payload.popularity === "number" &&
      Number.isFinite(payload.popularity)
        ? payload.popularity
        : undefined,
    cacheAt: normalizeString(payload.cacheAt) || undefined,
    sourceStatus: normalizeString(payload.sourceStatus) || undefined,
  };
};

export const useItabPoemRuntime = (
  widget: Ref<WidgetConfig>,
  emitUpdate?: (data: ItabPoemWidgetData) => void,
  options: ItabPoemRuntimeOptions = {},
) => {
  const didInitialLoad = ref(false);
  const loading = ref(false);
  const error = ref("");
  const sourceStatus = ref("loading");
  const remotePoem = ref<ItabPoemApiData | null>(null);
  const normalizedData = computed(() =>
    normalizeItabPoemWidgetData(widget.value.data),
  );
  const paletteIndex = ref(normalizedData.value.paletteIndex ?? 0);
  const paletteDate = ref(normalizedData.value.paletteDate);
  let requestSequence = 0;
  let abortController: AbortController | null = null;

  const syncedPoem = computed(() => normalizedData.value.currentPoem);
  const activePoem = computed(
    () => remotePoem.value || syncedPoem.value || EMPTY_POEM,
  );
  const hasContent = computed(() =>
    Boolean(
      activePoem.value.sentence ||
        activePoem.value.poemTitle ||
        activePoem.value.author ||
        activePoem.value.dynasty ||
        activePoem.value.fullText.length,
    ),
  );
  const activePalette = computed(
    () => ITAB_POEM_PALETTES[paletteIndex.value % ITAB_POEM_PALETTES.length]!,
  );
  const paletteStyle = computed(() => ({
    "--poem-bg": activePalette.value.background,
    "--poem-wave-base": activePalette.value.waveFront,
    "--poem-wave-back": activePalette.value.waveBack,
    "--poem-wave-middle": activePalette.value.waveMiddle,
    "--poem-wave-front": activePalette.value.waveFront,
  }));

  const toSyncedPoemData = (
    poem: ItabPoemEntry | ItabPoemApiData,
  ): ItabPoemApiData => ({
    id: "id" in poem ? poem.id : undefined,
    sentence: poem.sentence,
    poemTitle: poem.poemTitle,
    author: poem.author,
    dynasty: poem.dynasty,
    fullText: poem.fullText.length ? [...poem.fullText] : [poem.sentence],
    translation: [...poem.translation],
    annotations: [...poem.annotations],
    preface: [...poem.preface],
    popularity: "popularity" in poem ? poem.popularity : undefined,
    cacheAt: "cacheAt" in poem ? poem.cacheAt : undefined,
    sourceStatus:
      "sourceStatus" in poem && poem.sourceStatus
        ? poem.sourceStatus
        : sourceStatus.value,
  });

  const isSamePoem = (
    left: ItabPoemApiData | null | undefined,
    right: ItabPoemApiData | null | undefined,
  ) =>
    Boolean(left && right) &&
    left.sentence === right.sentence &&
    left.poemTitle === right.poemTitle &&
    left.author === right.author &&
    left.dynasty === right.dynasty &&
    left.cacheAt === right.cacheAt;

  watch(
    syncedPoem,
    (poem) => {
      if (!poem || isSamePoem(remotePoem.value, poem)) return;
      remotePoem.value = poem;
      sourceStatus.value = poem.sourceStatus || "ok";
    },
    { immediate: true },
  );

  watch(
    () => normalizedData.value.paletteIndex,
    (index) => {
      const nextIndex = index ?? 0;
      if (nextIndex !== paletteIndex.value) {
        paletteIndex.value = nextIndex;
      }
    },
    { immediate: true },
  );

  watch(
    () => normalizedData.value.paletteDate,
    (date) => {
      paletteDate.value = date;
    },
    { immediate: true },
  );

  const emitNormalizedData = (poem: ItabPoemEntry | ItabPoemApiData) => {
    emitUpdate?.({
      ...normalizedData.value,
      currentPoem: toSyncedPoemData(poem),
      paletteIndex: paletteIndex.value,
      ...(paletteDate.value ? { paletteDate: paletteDate.value } : {}),
    });
  };

  const randomizePalette = () => {
    if (ITAB_POEM_PALETTES.length <= 1) return;
    const candidates = ITAB_POEM_PALETTES.map((_, index) => index).filter(
      (index) =>
        index !== paletteIndex.value && index !== lastRandomPaletteIndex,
    );
    const nextCandidates = candidates.length
      ? candidates
      : ITAB_POEM_PALETTES.map((_, index) => index).filter(
          (index) => index !== paletteIndex.value,
        );
    const nextIndex =
      nextCandidates[Math.floor(Math.random() * nextCandidates.length)] ??
      paletteIndex.value;
    paletteIndex.value = nextIndex;
    lastRandomPaletteIndex = nextIndex;
  };

  const applyDailyPaletteRefresh = () => {
    if (options.allowDailyPaletteRefresh === false) return false;
    const today = getLocalDateKey();
    if (paletteDate.value === today) return false;
    paletteIndex.value = getItabPoemDailyPaletteIndex(today);
    lastRandomPaletteIndex = paletteIndex.value;
    paletteDate.value = today;
    return true;
  };

  const loadPoem = async (refresh = false) => {
    const sequence = ++requestSequence;
    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;
    loading.value = true;
    error.value = "";

    try {
      const data = await fetchItabPoem(refresh, controller.signal);
      if (sequence !== requestSequence) return false;
      const normalized = normalizeItabPoemApiResponse(data);
      if (!normalized) throw new Error("invalid poem response");
      remotePoem.value = normalized;
      sourceStatus.value = normalized.sourceStatus || "ok";
      if (refresh) {
        randomizePalette();
      }
      emitNormalizedData(normalized);
      return true;
    } catch (err) {
      if (sequence !== requestSequence || controller.signal.aborted) {
        return false;
      }
      error.value = err instanceof Error ? err.message : "诗词加载失败";
      sourceStatus.value = "error";
      return false;
    } finally {
      if (sequence === requestSequence) {
        loading.value = false;
      }
      if (abortController === controller) {
        abortController = null;
      }
    }
  };

  const ensureLoaded = () => {
    if (didInitialLoad.value) return;
    didInitialLoad.value = true;
    applyDailyPaletteRefresh();
    void loadPoem(false);
  };

  const refreshPoem = async () => {
    await loadPoem(true);
  };

  const dispose = () => {
    abortController?.abort();
    abortController = null;
  };

  return {
    normalizedData,
    activePoem,
    hasContent,
    paletteStyle,
    loading,
    error,
    sourceStatus,
    ensureLoaded,
    loadPoem,
    refreshPoem,
    randomizePalette,
    dispose,
  };
};
