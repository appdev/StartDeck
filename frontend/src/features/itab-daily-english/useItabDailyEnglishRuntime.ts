import { computed, ref } from "vue";
import { fetchItabDailyEnglish } from "./itabDailyEnglishApi";
import type { ItabDailyEnglishEntry } from "./itabDailyEnglishTypes";

export const ITAB_DAILY_ENGLISH_API_REFERENCE =
  "https://api.timelessq.com/english-sentence";
export const ITAB_DAILY_ENGLISH_PROVIDER_REFERENCE =
  "https://api.timelessq.com";
export const ITAB_DAILY_ENGLISH_FALLBACK_IMAGE =
  "/api/itab-resources/itab-itab-daily-english-14-body-2x4-background-86acdbf74c";

export const fallbackItabDailyEnglishEntry = (): ItabDailyEnglishEntry => ({
  mode: "跟读",
  sentence: "Light stretches longer, painting walls gold.",
  translation: "日光拉得更长，把墙壁染成金色。",
  progressLabel: "00:00",
  imageUrl: ITAB_DAILY_ENGLISH_FALLBACK_IMAGE,
  audioUrl: "",
  dateline: "2026-05-20",
  sourceStatus: "fallback",
});

const entry = ref<ItabDailyEnglishEntry>(fallbackItabDailyEnglishEntry());
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
    "--daily-english-image": `url("${entry.value.imageUrl}")`,
  }));

  const sourceStatus = computed(
    () => entry.value.sourceStatus || (error.value ? "error" : "ok"),
  );

  return {
    entry,
    loading,
    error,
    sourceStatus,
    entryStyle,
    load,
  };
};
