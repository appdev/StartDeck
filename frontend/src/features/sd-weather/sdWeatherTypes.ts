import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";

export const SD_WEATHER_WIDGET_TYPE = "sd-weather-00";
export const SD_WEATHER_CATALOG_ID = "weather";
export const SD_WEATHER_RUNTIME = "sd-weather";
export const SD_WEATHER_DATA_VERSION = 1;
export const SD_WEATHER_DEFAULT_SIZE: SdWidgetSizeKey = "1x2";

export interface SdWeatherLocation {
  id: string;
  city: string;
  province?: string;
  adm2?: string;
  type: "city" | string;
  country?: string;
  location?: string;
}

export interface SdWeatherWidgetData {
  runtime: typeof SD_WEATHER_RUNTIME;
  layoutSystem?: string;
  version: typeof SD_WEATHER_DATA_VERSION;
  sizeKey: SdWidgetSizeKey;
  location?: SdWeatherLocation;
}

export interface SdWeatherLocationResponse {
  id: string;
  name: string;
  adm1?: string;
  adm2?: string;
  country?: string;
  type?: string;
  location?: string;
  ip?: string;
}

export type SdWeatherCitySearchItem = SdWeatherLocationResponse;

export interface SdWeatherNow {
  cond_code?: string | number;
  cond_txt?: string;
  hum?: string;
  pcpn?: string;
  pres?: string;
  tmp?: string | number;
  wind_dir?: string;
  wind_sc?: string;
}

export interface SdWeatherDailyForecast {
  date: string;
  cond_txt_d?: string;
  cond_code_d?: string | number;
  wind_sc?: string;
  tmp_max?: string;
  tmp_min?: string;
}

export interface SdWeatherCurrent {
  status: string;
  rain?: {
    txt?: string;
  };
  now?: SdWeatherNow;
  air_now_city?: {
    qlty?: string;
    aqi?: string;
  };
  sun?: {
    rise?: string;
    set?: string;
  };
  daily_forecast?: SdWeatherDailyForecast[];
}

export interface SdWeatherHourly {
  updateTime?: string;
  hourly?: Array<{
    fxTime: string;
    icon?: string;
    temp?: string;
  }>;
}

export interface SdWeatherCurrentBundle {
  current: SdWeatherCurrent;
  hourly: SdWeatherHourly;
  sourceStatus?: "ok" | "stale" | "error" | string;
}

export interface WeatherHour {
  time: string;
  temp: string;
  icon: string;
  text: string;
}

export interface WeatherDay {
  day: string;
  date: string;
  text: string;
  wind: string;
  low: string;
  high: string;
  icon: string;
  active?: boolean;
}

export interface WeatherSample {
  code: string;
  province: string;
  city: string;
  condition: string;
  temp: string;
  airQuality: string;
  high: string;
  low: string;
  wind: string;
  reportTime: string;
  humidity: string;
  pressure: string;
  precipitation: string;
  sunrise: string;
  sunset: string;
  description: string;
  icon: string;
}

export interface WeatherLifeIndex {
  name: string;
  value: string;
  detail: string;
  iconPath: string;
}

export type WeatherCityPickerTarget = "header" | "list" | "";
