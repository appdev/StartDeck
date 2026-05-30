import { computed, ref } from "vue";
import { fetchItabMovieCalendar } from "./itabMovieCalendarApi";
import type { ItabMovieCalendarEntry } from "./itabMovieCalendarTypes";

export const ITAB_MOVIE_CALENDAR_API_REFERENCE =
  "https://api.codelife.cc/itab/todayMovie?version=v2";

const normalizeColor = (value: string, fallback: string) => {
  const trimmed = value.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
};

const createLoadingEntry = (): ItabMovieCalendarEntry => ({
  date: "",
  day: "",
  monthLabel: "",
  weekday: "",
  movieTitle: "",
  rating: "",
  quote: "",
  posterUrl: "",
  coverUrl: "",
  sourceUrl: "",
  year: "",
  area: "",
  director: "",
  intro: "",
  genres: [],
  bgColor: "3a444c",
  textColor: "f4f7f9",
  sourceStatus: "loading",
});

const createErrorEntry = (): ItabMovieCalendarEntry => ({
  ...createLoadingEntry(),
  sourceStatus: "error",
});

const normalizeEntry = (
  entry: ItabMovieCalendarEntry,
): ItabMovieCalendarEntry => ({
  ...entry,
  movieTitle: entry.movieTitle || "",
  rating: entry.rating || "",
  quote: entry.quote || entry.intro || "",
  posterUrl: entry.posterUrl || "",
  coverUrl: entry.coverUrl || "",
  sourceUrl: entry.sourceUrl || "",
  genres: Array.isArray(entry.genres) ? entry.genres.filter(Boolean) : [],
  bgColor: normalizeColor(entry.bgColor || "", "3a444c"),
  textColor: normalizeColor(entry.textColor || "", "f4f7f9"),
  sourceStatus: entry.sourceStatus || "ok",
});

const entry = ref<ItabMovieCalendarEntry>(createLoadingEntry());
const loading = ref(false);
const error = ref("");
let abortController: AbortController | null = null;
let requestSerial = 0;

export const resetItabMovieCalendarRuntimeForTests = () => {
  abortController?.abort();
  abortController = null;
  requestSerial = 0;
  loading.value = false;
  error.value = "";
  entry.value = createLoadingEntry();
};

export const useItabMovieCalendarRuntime = () => {
  const load = async (refresh = false) => {
    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;
    const serial = ++requestSerial;
    loading.value = true;
    error.value = "";

    try {
      const next = normalizeEntry(
        await fetchItabMovieCalendar(refresh, controller.signal),
      );
      if (serial === requestSerial) {
        entry.value = next;
      }
      return true;
    } catch (loadError) {
      if (!controller.signal.aborted && serial === requestSerial) {
        entry.value = createErrorEntry();
        error.value =
          loadError instanceof Error
            ? loadError.message
            : "movie calendar request failed";
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
    "--movie-cover-image": entry.value.coverUrl
      ? `url("${entry.value.coverUrl}")`
      : "none",
    "--movie-poster-image": entry.value.posterUrl
      ? `url("${entry.value.posterUrl}")`
      : "none",
    "--movie-bg-color": `#${entry.value.bgColor || "3a444c"}`,
    "--movie-text-color": `#${entry.value.textColor || "f4f7f9"}`,
  }));

  const ratingText = computed(() =>
    entry.value.rating
      ? `豆瓣 ${entry.value.rating}`
      : "",
  );

  const metaText = computed(() =>
    [entry.value.genres.join("/"), entry.value.year, entry.value.area]
      .filter(Boolean)
      .join(" "),
  );

  const directorText = computed(() =>
    entry.value.director ? `导演：${entry.value.director}` : "",
  );

  const introText = computed(() => entry.value.intro || entry.value.quote);
  const hasContent = computed(() =>
    Boolean(
      entry.value.movieTitle ||
        entry.value.quote ||
        entry.value.intro ||
        entry.value.posterUrl ||
        entry.value.coverUrl,
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
    ratingText,
    metaText,
    directorText,
    introText,
    hasContent,
    load,
  };
};
