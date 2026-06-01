import { computed, reactive, ref, type Ref } from "vue";
import type { WidgetConfig } from "@/types";
import { useSdIpRuntime } from "@/features/sd-ip/useSdIpRuntime";
import {
  fetchSdWeatherCurrent,
  fetchSdWeatherLocation,
  searchSdWeatherCities,
} from "./sdWeatherApi";
import {
  normalizeSdWeatherWidgetData,
  toSdWeatherLocationFromIpLookup,
  toSdWeatherLocation,
} from "./sdWeatherModel";
import type {
  SdWeatherCurrent,
  SdWeatherHourly,
  SdWeatherLocation,
  SdWeatherWidgetData,
  WeatherCityPickerTarget,
  WeatherDay,
  WeatherHour,
  WeatherLifeIndex,
  WeatherSample,
} from "./sdWeatherTypes";

export const weatherIcon = (code: string) =>
  `/sd/weather/icon/${code}-fill.svg`;
const WEATHER_RUNTIME_CACHE_TTL_MS = 5 * 60 * 1000;
const weatherIconFromCode = (code: string | number | undefined) =>
  weatherIcon(String(code || "104"));

type SdWeatherSkinCategory =
  | "sunny"
  | "cloudy"
  | "yin"
  | "thunder"
  | "rain"
  | "snow"
  | "foggy"
  | "haze";

type SdWeatherCodeCategory = SdWeatherSkinCategory | "other" | "";

const SOURCE_WEATHER_CODE_CATEGORIES: Record<string, SdWeatherSkinCategory> =
  {
    "100": "sunny",
    "150": "sunny",
    "101": "cloudy",
    "102": "cloudy",
    "103": "cloudy",
    "151": "cloudy",
    "152": "cloudy",
    "153": "cloudy",
    "104": "yin",
    "302": "thunder",
    "303": "thunder",
    "300": "rain",
    "301": "rain",
    "304": "rain",
    "305": "rain",
    "306": "rain",
    "307": "rain",
    "308": "rain",
    "309": "rain",
    "310": "rain",
    "311": "rain",
    "312": "rain",
    "313": "rain",
    "314": "rain",
    "315": "rain",
    "316": "rain",
    "317": "rain",
    "318": "rain",
    "350": "rain",
    "351": "rain",
    "399": "rain",
    "400": "snow",
    "401": "snow",
    "402": "snow",
    "403": "snow",
    "404": "snow",
    "405": "snow",
    "406": "snow",
    "407": "snow",
    "408": "snow",
    "409": "snow",
    "410": "snow",
    "500": "foggy",
    "501": "foggy",
    "509": "foggy",
    "510": "foggy",
    "514": "foggy",
    "515": "foggy",
    "502": "haze",
  };

const weatherConditionCategoryByCode = (
  rawCode?: string | number,
): SdWeatherCodeCategory => {
  const code = String(rawCode || "").trim();
  if (!code) return "";
  return SOURCE_WEATHER_CODE_CATEGORIES[code] || "other";
};

const weatherConditionCategoryByText = (
  condition: string,
): SdWeatherCodeCategory => {
  if (/雷/.test(condition)) return "thunder";
  if (/雪/.test(condition)) return "snow";
  if (/雨/.test(condition)) return "rain";
  if (/雾/.test(condition)) return "foggy";
  if (/霾|沙|尘/.test(condition)) return "haze";
  if (/阴/.test(condition)) return "yin";
  if (/云/.test(condition)) return "cloudy";
  if (/晴/.test(condition)) return "sunny";
  return "other";
};

const parseWeatherTimeMinutes = (value: string) => {
  const match = value.match(/^(\d{1,2}):(\d{1,2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
};

const resolveWeatherDayPart = (
  sample: Pick<WeatherSample, "sunrise" | "sunset">,
) => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const sunriseMinutes = parseWeatherTimeMinutes(sample.sunrise);
  const sunsetMinutes = parseWeatherTimeMinutes(sample.sunset);
  if (sunriseMinutes === null || sunsetMinutes === null) {
    return now.getHours() > 6 && now.getHours() < 19 ? "d" : "n";
  }
  return currentMinutes >= sunriseMinutes && currentMinutes < sunsetMinutes
    ? "d"
    : "n";
};

export const resolveSdWeatherSkinClass = (
  sample: Pick<WeatherSample, "code" | "condition" | "sunrise" | "sunset">,
) => {
  const codeCategory = weatherConditionCategoryByCode(sample.code);
  if (codeCategory === "other") return "weather-other";
  const category =
    codeCategory || weatherConditionCategoryByText(sample.condition || "");
  if (category === "other" || !category) return "weather-other";
  return `weather-${category}_${resolveWeatherDayPart(sample)}`;
};

const EMPTY_WEATHER_LOCATION: SdWeatherLocation = {
  id: "",
  city: "暂无位置",
  province: "",
  type: "city",
};

const emptySample = (): WeatherSample => ({
  code: "",
  province: "",
  city: "暂无位置",
  condition: "暂无天气",
  temp: "--",
  airQuality: "--/--",
  high: "--",
  low: "--",
  wind: "-- --",
  reportTime: "--",
  humidity: "--",
  pressure: "--",
  precipitation: "--",
  sunrise: "--",
  sunset: "--",
  description: "暂无可用天气数据。",
  icon: weatherIcon("104"),
});

const emptyHours = (): WeatherHour[] => [];

const emptyDays = (): WeatherDay[] => [];

export const weatherLifeIndexes: WeatherLifeIndex[] = [];

interface RuntimeState {
  initialized: boolean;
  sample: WeatherSample;
  hours: Ref<WeatherHour[]>;
  days: Ref<WeatherDay[]>;
  activeDayIndex: Ref<number>;
  cityOptions: Ref<
    Array<SdWeatherLocation & { condition?: string; temp?: string }>
  >;
  activeLocation: Ref<SdWeatherLocation>;
  loading: Ref<boolean>;
  error: Ref<string>;
  sourceStatus: Ref<string>;
  pickerTarget: Ref<WeatherCityPickerTarget>;
  searchText: {
    header: string;
    list: string;
  };
  requestSeq: number;
  searchSeq: number;
  abortController: AbortController | null;
  searchAbortController: AbortController | null;
  searchTimer: number | null;
  lastLoadedAt: number;
  lastLoadedKey: string;
}

const runtimeStates = new Map<string, RuntimeState>();

export const resetSdWeatherRuntimeForTests = () => {
  runtimeStates.forEach((state) => {
    state.abortController?.abort();
    state.searchAbortController?.abort();
    if (state.searchTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(state.searchTimer);
    }
  });
  runtimeStates.clear();
};

const createRuntimeState = (): RuntimeState => {
  const sample = reactive(emptySample()) as WeatherSample;
  return {
    initialized: false,
    sample,
    hours: ref(emptyHours()),
    days: ref(emptyDays()),
    activeDayIndex: ref(0),
    cityOptions: ref<
      Array<SdWeatherLocation & { condition?: string; temp?: string }>
    >([]),
    activeLocation: ref({ ...EMPTY_WEATHER_LOCATION }),
    loading: ref(false),
    error: ref(""),
    sourceStatus: ref("idle"),
    pickerTarget: ref(""),
    searchText: reactive({ header: "", list: "" }),
    requestSeq: 0,
    searchSeq: 0,
    abortController: null,
    searchAbortController: null,
    searchTimer: null,
    lastLoadedAt: 0,
    lastLoadedKey: "",
  };
};

const getRuntimeState = (widgetId: string) => {
  const existing = runtimeStates.get(widgetId);
  if (existing) return existing;
  const created = createRuntimeState();
  runtimeStates.set(widgetId, created);
  return created;
};

const stripDegree = (value: string) => value.replace(/°/g, "");
export const formatWeatherDegree = (value: string) => `${stripDegree(value)}°`;

const weatherLocationCacheKey = (location?: SdWeatherLocation) => {
  if (!location?.id) return "";
  return `${location.type || "city"}:${location.id}`;
};

const formatSdWindScale = (value?: string) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "--";
  return `${trimmed}级`;
};

const formatSdReportTime = (value?: string) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(5, 16).replace("T", " ");
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatSdHour = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const match = value.match(/(?:T|\s)(\d{1,2})/);
    return match ? `${Number(match[1])}时` : value;
  }
  return `${date.getHours()}时`;
};

const formatSdDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(5);
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const formatSdWeekday = (value: string, index: number) => {
  if (index === 0) return "今天";
  if (index === 1) return "明天";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return `周${index + 1}`;
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][
    date.getDay()
  ]!;
};

const applyWeatherData = (
  state: RuntimeState,
  location: SdWeatherLocation,
  current: SdWeatherCurrent,
  hourly: SdWeatherHourly,
) => {
  const nowData = current.now || {};
  const today = current.daily_forecast?.[0];
  const condition =
    nowData.cond_txt || today?.cond_txt_d || state.sample.condition;
  const conditionCode = String(
    nowData.cond_code || today?.cond_code_d || state.sample.code || "104",
  );
  const temp = String(nowData.tmp ?? state.sample.temp);
  const high = today?.tmp_max || state.sample.high;
  const low = today?.tmp_min || state.sample.low;

  state.sample.code = conditionCode;
  state.sample.province = location.province || state.sample.province;
  state.sample.city = location.city || state.sample.city;
  state.sample.condition = condition;
  state.sample.temp = temp;
  state.sample.airQuality = `${current.air_now_city?.qlty || "优"}/${current.air_now_city?.aqi || "--"}`;
  state.sample.high = high;
  state.sample.low = low;
  state.sample.wind = `${nowData.wind_dir || "--"} ${formatSdWindScale(nowData.wind_sc)}`;
  state.sample.reportTime = formatSdReportTime(hourly.updateTime);
  state.sample.humidity = `${nowData.hum || "--"}%`;
  state.sample.pressure = `${nowData.pres || "--"}hPa`;
  state.sample.precipitation = `${nowData.pcpn || "--"}mm`;
  state.sample.sunrise = current.sun?.rise || "--";
  state.sample.sunset = current.sun?.set || "--";
  state.sample.description = current.rain?.txt || state.sample.description;
  state.sample.icon = weatherIconFromCode(conditionCode);

  state.hours.value =
    hourly.hourly?.map((hour) => ({
      time: formatSdHour(hour.fxTime),
      temp: `${hour.temp || "--"}°`,
      icon: weatherIconFromCode(hour.icon),
      text: "",
    })) || emptyHours();

  state.activeDayIndex.value = 0;
  state.days.value = (
    current.daily_forecast?.map((day, index) => ({
      day: formatSdWeekday(day.date, index),
      date: formatSdDate(day.date),
      text: day.cond_txt_d || "--",
      wind: formatSdWindScale(day.wind_sc),
      low: `${day.tmp_min || "--"}°`,
      high: `${day.tmp_max || "--"}°`,
      icon: weatherIconFromCode(day.cond_code_d),
      active: index === 0,
    })) || emptyDays()
  ).map((day, index) => ({ ...day, active: index === 0 }));

  const nextOption = { ...location, condition, temp };
  const existingIndex = state.cityOptions.value.findIndex(
    (item) => item.id === location.id || item.city === location.city,
  );
  if (existingIndex >= 0) {
    state.cityOptions.value[existingIndex] = {
      ...state.cityOptions.value[existingIndex],
      ...nextOption,
    };
  } else {
    state.cityOptions.value = [nextOption, ...state.cityOptions.value].slice(
      0,
      8,
    );
  }
  state.activeLocation.value = location;
};

export const useSdWeatherRuntime = (
  widget: Ref<WidgetConfig> | (() => WidgetConfig),
  commitData?: (data: SdWeatherWidgetData) => void,
) => {
  const getWidget = () =>
    typeof widget === "function" ? widget() : widget.value;
  const state = getRuntimeState(getWidget().id);
  const ipRuntime = useSdIpRuntime();
  const normalizedData = () => normalizeSdWeatherWidgetData(getWidget().data);

  const commitLocation = (location: SdWeatherLocation) => {
    const current = normalizedData();
    commitData?.({
      ...current,
      location,
    });
  };

  const ensureLocationFromData = () => {
    const data = normalizedData();
    if (data.location) {
      state.activeLocation.value = data.location;
      if (
        !state.cityOptions.value.some((item) => item.id === data.location?.id)
      ) {
        state.cityOptions.value = [
          data.location,
          ...state.cityOptions.value,
        ].slice(0, 8);
      }
    }
  };

  const loadCurrent = async (
    locationInput?: SdWeatherLocation,
    refresh = false,
  ) => {
    const seq = ++state.requestSeq;
    state.abortController?.abort();
    const controller = new AbortController();
    state.abortController = controller;
    state.loading.value = true;
    state.error.value = "";

    try {
      const persistedLocation = normalizedData().location;
      let location =
        locationInput || persistedLocation || state.activeLocation.value;
      if (!locationInput && !persistedLocation) {
        try {
          const ipResult = await ipRuntime.ensureResult();
          if (seq !== state.requestSeq || controller.signal.aborted) return;
          const ipLocation = ipResult
            ? toSdWeatherLocationFromIpLookup(ipResult)
            : undefined;
          if (ipLocation) {
            location = ipLocation;
          } else {
            location = toSdWeatherLocation(
              await fetchSdWeatherLocation(controller.signal),
            );
          }
        } catch {
          location = state.activeLocation.value;
        }
      }
      const bundle = await fetchSdWeatherCurrent(
        location.id,
        location.type || "city",
        refresh,
        controller.signal,
      );
      if (seq !== state.requestSeq || controller.signal.aborted) return;
      applyWeatherData(state, location, bundle.current, bundle.hourly);
      state.sourceStatus.value = bundle.sourceStatus || "ok";
      state.lastLoadedAt = Date.now();
      state.lastLoadedKey = weatherLocationCacheKey(location);
    } catch (error) {
      if (!controller.signal.aborted && seq === state.requestSeq) {
        state.error.value =
          error instanceof Error
            ? error.message
            : "Weather request failed";
        state.sourceStatus.value = "error";
      }
    } finally {
      if (state.abortController === controller) {
        state.abortController = null;
        state.loading.value = false;
      }
    }
  };

  const isLoadedWeatherStale = () => {
    if (!state.lastLoadedAt) return true;
    if (
      state.lastLoadedKey &&
      state.lastLoadedKey !==
        weatherLocationCacheKey(state.activeLocation.value)
    ) {
      return true;
    }
    return Date.now() - state.lastLoadedAt >= WEATHER_RUNTIME_CACHE_TTL_MS;
  };

  const ensureLoaded = (options: { refreshIfStale?: boolean } = {}) => {
    ensureLocationFromData();
    if (state.initialized) {
      if (options.refreshIfStale && isLoadedWeatherStale()) {
        void loadCurrent(state.activeLocation.value, false);
      }
      return;
    }
    state.initialized = true;
    void loadCurrent(undefined, false);
  };

  const selectDay = (index: number) => {
    state.activeDayIndex.value = index;
    state.days.value = state.days.value.map((day, dayIndex) => ({
      ...day,
      active: dayIndex === index,
    }));
  };

  const selectCity = (location: SdWeatherLocation) => {
    state.pickerTarget.value = "";
    state.searchText.header = "";
    state.searchText.list = "";
    state.activeLocation.value = location;
    commitLocation(location);
    void loadCurrent(location, false);
  };

  const searchCities = async (keyword: string) => {
    const query = keyword.trim();
    if (!query) return;
    const seq = ++state.searchSeq;
    state.searchAbortController?.abort();
    const controller = new AbortController();
    state.searchAbortController = controller;
    try {
      const results = await searchSdWeatherCities(query, controller.signal);
      if (seq !== state.searchSeq || controller.signal.aborted) return;
      const currentOption = state.activeLocation.value.id
        ? [state.activeLocation.value]
        : [];
      const nextOptions = [
        ...results.map(toSdWeatherLocation),
        ...currentOption,
      ];
      const seenIds = new Set<string>();
      state.cityOptions.value = nextOptions
        .filter((item) => {
          if (seenIds.has(item.id)) return false;
          seenIds.add(item.id);
          return true;
        })
        .slice(0, 8);
    } catch {
      if (!controller.signal.aborted) {
        state.cityOptions.value = state.activeLocation.value.id
          ? [state.activeLocation.value]
          : [];
      }
    } finally {
      if (state.searchAbortController === controller) {
        state.searchAbortController = null;
      }
    }
  };

  const onCitySearchInput = (target: Exclude<WeatherCityPickerTarget, "">) => {
    const query = state.searchText[target].trim();
    if (state.searchTimer) {
      window.clearTimeout(state.searchTimer);
    }
    state.searchTimer = window.setTimeout(() => {
      void searchCities(query);
      state.searchTimer = null;
    }, 220);
  };

  const weatherOuterClass = computed(() =>
    resolveSdWeatherSkinClass(state.sample),
  );

  const weatherOuterDaily = computed(() =>
    state.days.value.slice(1, 7).map((day, index) => ({
      ...day,
      label: index === 0 ? "明天" : day.day,
      range: `${stripDegree(day.low)}~${stripDegree(day.high)}`,
    })),
  );

  const weatherMetrics = computed(() => [
    { label: "温度", value: `${state.sample.low}°~${state.sample.high}°` },
    { label: "湿度", value: state.sample.humidity },
    { label: "气压", value: state.sample.pressure },
    { label: "降水", value: state.sample.precipitation },
    { label: "日出", value: state.sample.sunrise },
    { label: "日落", value: state.sample.sunset },
  ]);

  const weatherTempPoints = computed(() => {
    const hours = state.hours.value.slice(0, 23);
    const temps = hours
      .map((hour) => Number.parseFloat(hour.temp))
      .filter((temp) => Number.isFinite(temp));
    const min = temps.length ? Math.min(...temps) : 0;
    const max = temps.length ? Math.max(...temps) : 1;
    const range = Math.max(1, max - min);
    return hours.map((hour, hourIndex) => {
      const temp = Number.parseFloat(hour.temp);
      const normalized = Number.isFinite(temp) ? (temp - min) / range : 0.5;
      return {
        key: `${hour.time}-${hourIndex}`,
        x: 18 + hourIndex * 38,
        y: 42 - normalized * 28,
      };
    });
  });

  const weatherTempLinePoints = computed(() =>
    weatherTempPoints.value.map((point) => `${point.x},${point.y}`).join(" "),
  );

  return {
    sample: state.sample,
    hours: state.hours,
    days: state.days,
    activeDayIndex: state.activeDayIndex,
    cityOptions: state.cityOptions,
    activeLocation: state.activeLocation,
    loading: state.loading,
    error: state.error,
    sourceStatus: state.sourceStatus,
    pickerTarget: state.pickerTarget,
    searchText: state.searchText,
    ensureLoaded,
    loadCurrent,
    selectDay,
    selectCity,
    onCitySearchInput,
    weatherOuterClass,
    weatherOuterDaily,
    weatherMetrics,
    weatherTempPoints,
    weatherTempLinePoints,
  };
};
