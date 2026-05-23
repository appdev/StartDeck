import { computed, onMounted, onUnmounted, ref, watch, type Ref } from "vue";
import type { WidgetConfig } from "@/types";
import { normalizeItabClockWidgetData } from "./itabClockModel";
import type { ItabClockWidgetData } from "./itabClockTypes";

const formatTwoDigits = (value: number) => String(value).padStart(2, "0");

export const useItabClockRuntime = (
  widgetRef: Ref<WidgetConfig>,
  updateData?: (data: ItabClockWidgetData) => void,
) => {
  const now = ref(new Date());
  const showSeconds = ref(
    normalizeItabClockWidgetData(widgetRef.value.data).showSeconds,
  );
  let timer: ReturnType<typeof setInterval> | null = null;

  const data = computed(() =>
    normalizeItabClockWidgetData(widgetRef.value.data),
  );

  const updateTime = () => {
    now.value = new Date();
  };

  const startTimer = () => {
    updateTime();
    if (timer) clearInterval(timer);
    timer = setInterval(updateTime, 1000);
  };

  const stopTimer = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  const handleVisibilityChange = () => {
    if (typeof document === "undefined") return;
    if (document.visibilityState === "hidden") stopTimer();
    else startTimer();
  };

  watch(
    () => data.value.showSeconds,
    (value) => {
      showSeconds.value = value;
    },
  );

  onMounted(() => {
    startTimer();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
  });

  onUnmounted(() => {
    stopTimer();
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  });

  const hourText = computed(() => formatTwoDigits(now.value.getHours()));
  const minuteText = computed(() => formatTwoDigits(now.value.getMinutes()));
  const secondText = computed(() => formatTwoDigits(now.value.getSeconds()));
  const shortDateText = computed(
    () =>
      `${formatTwoDigits(now.value.getMonth() + 1)}/${formatTwoDigits(
        now.value.getDate(),
      )}`,
  );
  const shortWeekdayText = computed(
    () =>
      ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][
        now.value.getDay()
      ] || "周日",
  );
  const outerDateText = computed(
    () => `${shortDateText.value} ${shortWeekdayText.value}`,
  );
  const digitText = computed(() =>
    showSeconds.value
      ? `${hourText.value}${minuteText.value}${secondText.value}`
      : `${hourText.value}${minuteText.value}`,
  );
  const flipDigits = computed(() => digitText.value.split(""));

  const setShowSeconds = (value: boolean) => {
    showSeconds.value = value;
    updateData?.({
      ...data.value,
      showSeconds: value,
    });
  };

  const toggleSeconds = () => setShowSeconds(!showSeconds.value);

  return {
    now,
    data,
    showSeconds,
    hourText,
    minuteText,
    secondText,
    shortDateText,
    shortWeekdayText,
    outerDateText,
    digitText,
    flipDigits,
    updateTime,
    setShowSeconds,
    toggleSeconds,
  };
};
