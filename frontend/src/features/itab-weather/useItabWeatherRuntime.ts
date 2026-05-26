import { computed, reactive, ref, type Ref } from "vue";
import type { WidgetConfig } from "@/types";
import {
  fetchItabWeatherCurrent,
  fetchItabWeatherLocation,
  searchItabWeatherCities,
} from "./itabWeatherApi";
import {
  normalizeItabWeatherWidgetData,
  toItabWeatherLocation,
} from "./itabWeatherModel";
import type {
  ItabWeatherCurrent,
  ItabWeatherHourly,
  ItabWeatherLocation,
  ItabWeatherWidgetData,
  WeatherCityPickerTarget,
  WeatherDay,
  WeatherHour,
  WeatherLifeIndex,
  WeatherSample,
} from "./itabWeatherTypes";

export const weatherIcon = (code: string) =>
  `/itab/weather/icon/${code}-fill.svg`;
const WEATHER_RUNTIME_CACHE_TTL_MS = 5 * 60 * 1000;
const weatherIconFromCode = (code: string | number | undefined) =>
  weatherIcon(String(code || "104"));

const weatherConditionCategoryByCode = (rawCode?: string | number) => {
  const code = String(rawCode || "").trim();
  if (!code) return "";
  if (code === "100" || code === "900" || code === "901") return "sunny";
  if (["101", "102", "103", "150", "151", "152", "153"].includes(code)) {
    return "cloudy";
  }
  if (code === "104") return "yin";
  if (["302", "303", "304"].includes(code)) return "thunder";
  if (/^3/.test(code)) return "rain";
  if (/^4/.test(code)) return "snow";
  if (["500", "501", "509", "510", "514", "515"].includes(code)) {
    return "foggy";
  }
  if (["502", "503", "504", "507", "508", "511", "512", "513"].includes(code)) {
    return "haze";
  }
  return "";
};

const weatherConditionCategoryByText = (condition: string) => {
  if (/雷/.test(condition)) return "thunder";
  if (/雪/.test(condition)) return "snow";
  if (/雨/.test(condition)) return "rain";
  if (/雾/.test(condition)) return "foggy";
  if (/霾|沙|尘/.test(condition)) return "haze";
  if (/阴/.test(condition)) return "yin";
  if (/云/.test(condition)) return "cloudy";
  return "sunny";
};

const parseWeatherTimeMinutes = (value: string) => {
  const match = value.match(/^(\d{1,2}):(\d{1,2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
};

const resolveWeatherDayPart = (sample: WeatherSample) => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const sunriseMinutes = parseWeatherTimeMinutes(sample.sunrise);
  const sunsetMinutes = parseWeatherTimeMinutes(sample.sunset);
  if (sunriseMinutes === null || sunsetMinutes === null) {
    return now.getHours() >= 6 && now.getHours() < 18 ? "d" : "n";
  }
  return currentMinutes >= sunriseMinutes && currentMinutes < sunsetMinutes
    ? "d"
    : "n";
};

const fallbackSample = (): WeatherSample => ({
  code: "104",
  province: "广东省",
  city: "龙华",
  condition: "阴",
  temp: "27",
  airQuality: "优/34",
  high: "29",
  low: "25",
  wind: "北风 0级",
  reportTime: "05-21 21:35",
  humidity: "88%",
  pressure: "1003hPa",
  precipitation: "22.5mm",
  sunrise: "05:40",
  sunset: "18:59",
  description: "各类人群可多参加户外活动，多呼吸一下清新的空气。",
  icon: weatherIcon("104"),
});

const fallbackHours = (): WeatherHour[] => [
  { time: "22时", temp: "26°", icon: weatherIcon("151"), text: "" },
  { time: "23时", temp: "26°", icon: weatherIcon("302"), text: "" },
  { time: "0时", temp: "26°", icon: weatherIcon("302"), text: "" },
  { time: "1时", temp: "26°", icon: weatherIcon("302"), text: "" },
  { time: "2时", temp: "26°", icon: weatherIcon("302"), text: "" },
  { time: "3时", temp: "26°", icon: weatherIcon("104"), text: "" },
  { time: "4时", temp: "26°", icon: weatherIcon("302"), text: "" },
  { time: "5时", temp: "26°", icon: weatherIcon("302"), text: "" },
  { time: "6时", temp: "27°", icon: weatherIcon("101"), text: "" },
  { time: "7时", temp: "28°", icon: weatherIcon("101"), text: "" },
  { time: "8时", temp: "28°", icon: weatherIcon("302"), text: "" },
  { time: "9时", temp: "29°", icon: weatherIcon("101"), text: "" },
  { time: "10时", temp: "29°", icon: weatherIcon("101"), text: "" },
  { time: "11时", temp: "30°", icon: weatherIcon("100"), text: "" },
  { time: "12时", temp: "30°", icon: weatherIcon("100"), text: "" },
  { time: "13时", temp: "30°", icon: weatherIcon("100"), text: "" },
  { time: "14时", temp: "31°", icon: weatherIcon("100"), text: "" },
  { time: "15时", temp: "30°", icon: weatherIcon("100"), text: "" },
  { time: "16时", temp: "30°", icon: weatherIcon("100"), text: "" },
  { time: "17时", temp: "29°", icon: weatherIcon("100"), text: "" },
  { time: "18时", temp: "29°", icon: weatherIcon("100"), text: "" },
  { time: "19时", temp: "28°", icon: weatherIcon("100"), text: "" },
  { time: "20时", temp: "28°", icon: weatherIcon("150"), text: "" },
  { time: "21时", temp: "27°", icon: weatherIcon("150"), text: "" },
];

const fallbackDays = (): WeatherDay[] => [
  {
    day: "今天",
    date: "05-21",
    text: "阴",
    wind: "<3级",
    low: "25°",
    high: "29°",
    icon: weatherIcon("104"),
    active: true,
  },
  {
    day: "周五",
    date: "05-22",
    text: "晴",
    wind: "3-4级",
    low: "26°",
    high: "30°",
    icon: weatherIcon("100"),
  },
  {
    day: "周六",
    date: "05-23",
    text: "晴",
    wind: "3-4转<3级级",
    low: "26°",
    high: "30°",
    icon: weatherIcon("100"),
  },
  {
    day: "周日",
    date: "05-24",
    text: "多云",
    wind: "3-4转<3级级",
    low: "26°",
    high: "33°",
    icon: weatherIcon("104"),
  },
  {
    day: "周一",
    date: "05-25",
    text: "多云",
    wind: "3-4转<3级级",
    low: "27°",
    high: "33°",
    icon: weatherIcon("104"),
  },
  {
    day: "周二",
    date: "05-26",
    text: "多云",
    wind: "3-4转<3级级",
    low: "27°",
    high: "33°",
    icon: weatherIcon("104"),
  },
  {
    day: "周三",
    date: "05-27",
    text: "小雨转多云",
    wind: "<3级",
    low: "26°",
    high: "33°",
    icon: weatherIcon("104"),
  },
];

export const fallbackWeatherCityOptions: ItabWeatherLocation[] = [
  {
    id: "101280608",
    province: "广东省",
    city: "龙华",
    adm2: "深圳",
    type: "city",
  },
  {
    id: "101280601",
    province: "广东省",
    city: "深圳",
    adm2: "深圳",
    type: "city",
  },
  {
    id: "101280101",
    province: "广东省",
    city: "广州",
    adm2: "广州",
    type: "city",
  },
  {
    id: "101010100",
    province: "北京市",
    city: "北京",
    adm2: "北京",
    type: "city",
  },
  {
    id: "101020100",
    province: "上海市",
    city: "上海",
    adm2: "上海",
    type: "city",
  },
];

export const weatherLifeIndexes: WeatherLifeIndex[] = [
  {
    name: "空气污染扩散条件",
    value: "良",
    detail: "气象条件有利于污染物扩散。",
    iconPath:
      "M12 3a7 7 0 0 1 6.4 9.8A4.6 4.6 0 0 1 14 19H7a4 4 0 0 1-.7-7.9A6 6 0 0 1 12 3z",
  },
  {
    name: "舒适度",
    value: "较舒适",
    detail: "白天体感偏暖，晚间较舒适。",
    iconPath: "M12 4a4 4 0 0 1 4 4v5.2a5 5 0 1 1-8 0V8a4 4 0 0 1 4-4z",
  },
  {
    name: "穿衣",
    value: "短袖",
    detail: "建议穿短裙、短裤、薄 T 恤。",
    iconPath: "M8 5l4 2 4-2 3 4-2 1.5V20H7V10.5L5 9l3-4z",
  },
  {
    name: "感冒",
    value: "少发",
    detail: "天气温暖，感冒概率较低。",
    iconPath: "M7 6h10v4h4v8H3v-8h4V6zm2 2v2h6V8H9z",
  },
  {
    name: "运动",
    value: "适宜",
    detail: "空气较好，适合户外活动。",
    iconPath:
      "M13 4a2 2 0 1 1-2 2 2 2 0 0 1 2-2zm-1 5l4 2-1 3 3 4-2 2-4-5-2 5H7l2-7-3-1 1-2 3 1 2-2z",
  },
  {
    name: "紫外线",
    value: "弱",
    detail: "辐射较弱，外出可适当防护。",
    iconPath:
      "M12 5l1.5 4.5H18l-3.6 2.7 1.4 4.8L12 14.2 8.2 17l1.4-4.8L6 9.5h4.5L12 5z",
  },
];

interface RuntimeState {
  initialized: boolean;
  sample: WeatherSample;
  hours: Ref<WeatherHour[]>;
  days: Ref<WeatherDay[]>;
  activeDayIndex: Ref<number>;
  cityOptions: Ref<
    Array<ItabWeatherLocation & { condition?: string; temp?: string }>
  >;
  activeLocation: Ref<ItabWeatherLocation>;
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

export const resetItabWeatherRuntimeForTests = () => {
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
  const sample = reactive(fallbackSample()) as WeatherSample;
  const active = fallbackWeatherCityOptions[0]!;
  return {
    initialized: false,
    sample,
    hours: ref(fallbackHours()),
    days: ref(fallbackDays()),
    activeDayIndex: ref(0),
    cityOptions: ref([...fallbackWeatherCityOptions]),
    activeLocation: ref(active),
    loading: ref(false),
    error: ref(""),
    sourceStatus: ref("fallback"),
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

const weatherLocationCacheKey = (location?: ItabWeatherLocation) => {
  if (!location?.id) return "";
  return `${location.type || "city"}:${location.id}`;
};

const formatItabWindScale = (value?: string) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "--";
  return `${trimmed}级`;
};

const formatItabReportTime = (value?: string) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(5, 16).replace("T", " ");
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatItabHour = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const match = value.match(/(?:T|\s)(\d{1,2})/);
    return match ? `${Number(match[1])}时` : value;
  }
  return `${date.getHours()}时`;
};

const formatItabDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(5);
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const formatItabWeekday = (value: string, index: number) => {
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
  location: ItabWeatherLocation,
  current: ItabWeatherCurrent,
  hourly: ItabWeatherHourly,
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
  state.sample.wind = `${nowData.wind_dir || "--"} ${formatItabWindScale(nowData.wind_sc)}`;
  state.sample.reportTime = formatItabReportTime(hourly.updateTime);
  state.sample.humidity = `${nowData.hum || "--"}%`;
  state.sample.pressure = `${nowData.pres || "--"}hPa`;
  state.sample.precipitation = `${nowData.pcpn || "--"}mm`;
  state.sample.sunrise = current.sun?.rise || "--";
  state.sample.sunset = current.sun?.set || "--";
  state.sample.description = current.rain?.txt || state.sample.description;
  state.sample.icon = weatherIconFromCode(conditionCode);

  state.hours.value =
    hourly.hourly?.map((hour) => ({
      time: formatItabHour(hour.fxTime),
      temp: `${hour.temp || "--"}°`,
      icon: weatherIconFromCode(hour.icon),
      text: "",
    })) || fallbackHours();

  state.activeDayIndex.value = 0;
  state.days.value = (
    current.daily_forecast?.map((day, index) => ({
      day: formatItabWeekday(day.date, index),
      date: formatItabDate(day.date),
      text: day.cond_txt_d || "--",
      wind: formatItabWindScale(day.wind_sc),
      low: `${day.tmp_min || "--"}°`,
      high: `${day.tmp_max || "--"}°`,
      icon: weatherIconFromCode(day.cond_code_d),
      active: index === 0,
    })) || fallbackDays()
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

export const useItabWeatherRuntime = (
  widget: Ref<WidgetConfig> | (() => WidgetConfig),
  commitData?: (data: ItabWeatherWidgetData) => void,
) => {
  const getWidget = () =>
    typeof widget === "function" ? widget() : widget.value;
  const state = getRuntimeState(getWidget().id);
  const normalizedData = () => normalizeItabWeatherWidgetData(getWidget().data);

  const commitLocation = (location: ItabWeatherLocation) => {
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
    locationInput?: ItabWeatherLocation,
    refresh = false,
  ) => {
    const seq = ++state.requestSeq;
    state.abortController?.abort();
    const controller = new AbortController();
    state.abortController = controller;
    state.loading.value = true;
    state.error.value = "";

    try {
      let location =
        locationInput ||
        normalizedData().location ||
        state.activeLocation.value;
      if (!locationInput && !normalizedData().location) {
        try {
          location = toItabWeatherLocation(
            await fetchItabWeatherLocation(controller.signal),
          );
        } catch {
          location = state.activeLocation.value;
        }
      }
      const bundle = await fetchItabWeatherCurrent(
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
            : "iTab weather request failed";
        state.sourceStatus.value = "fallback";
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
      state.lastLoadedKey !== weatherLocationCacheKey(state.activeLocation.value)
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

  const selectCity = (location: ItabWeatherLocation) => {
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
      const results = await searchItabWeatherCities(query, controller.signal);
      if (seq !== state.searchSeq || controller.signal.aborted) return;
      const currentOption = state.activeLocation.value;
      const nextOptions = [
        ...results.map(toItabWeatherLocation),
        currentOption,
        ...fallbackWeatherCityOptions,
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
        state.cityOptions.value = [
          state.activeLocation.value,
          ...fallbackWeatherCityOptions,
        ].slice(0, 8);
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

  const weatherOuterClass = computed(() => {
    const category =
      weatherConditionCategoryByCode(state.sample.code) ||
      weatherConditionCategoryByText(state.sample.condition);
    return `weather-${category}_${resolveWeatherDayPart(state.sample)}`;
  });

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
