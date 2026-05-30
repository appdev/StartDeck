import { computed, ref } from "vue";
import { fetchItabDailyEnglish } from "./itabDailyEnglishApi";
import type { ItabDailyEnglishEntry } from "./itabDailyEnglishTypes";

export const ITAB_DAILY_ENGLISH_API_REFERENCE =
  "https://api.timelessq.com/english-sentence";
export const ITAB_DAILY_ENGLISH_PROVIDER_REFERENCE =
  "https://api.timelessq.com";

export const createEmptyItabDailyEnglishEntry = (
  sourceStatus: ItabDailyEnglishEntry["sourceStatus"] = "loading",
): ItabDailyEnglishEntry => ({
  mode: "",
  sentence: "",
  translation: "",
  progressLabel: "",
  imageUrl: "",
  audioUrl: "",
  dateline: "",
  sourceStatus,
});

const entry = ref<ItabDailyEnglishEntry>(createEmptyItabDailyEnglishEntry());
const loading = ref(false);
const error = ref("");
let abortController: AbortController | null = null;
let requestSerial = 0;

export const useItabDailyEnglishRuntime = () => {
  const load = async (refresh = false) => {
    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;
    const serial = ++requestSerial;
    loading.value = true;
    error.value = "";

    try {
      const next = await fetchItabDailyEnglish(refresh, controller.signal);
      if (serial === requestSerial) {
        entry.value = {
          ...next,
          progressLabel: next.progressLabel || "00:00",
        };
      }
      return true;
    } catch (loadError) {
      if (!controller.signal.aborted && serial === requestSerial) {
        entry.value = createEmptyItabDailyEnglishEntry("error");
        error.value =
          loadError instanceof Error
            ? loadError.message
            : "daily English request failed";
      }
      return false;
    } finally {
      if (abortController === controller) {
        abortController = null;
      }
      if (serial === requestSerial) {
        loading.value = false;
      }
    }
  };

  const entryStyle = computed<Record<string, string>>(() => ({
    "--daily-english-image": entry.value.imageUrl
      ? `url("${entry.value.imageUrl}")`
      : "none",
  }));

  const hasContent = computed(() =>
    Boolean(
      entry.value.sentence ||
        entry.value.translation ||
        entry.value.imageUrl ||
        entry.value.audioUrl,
    ),
  );

  const sourceStatus = computed(
    () => entry.value.sourceStatus || (error.value ? "error" : "ok"),
  );

  return {
    entry,
    loading,
    error,
    sourceStatus,
    entryStyle,
    hasContent,
    load,
  };
};
