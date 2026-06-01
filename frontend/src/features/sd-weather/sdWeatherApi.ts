import type {
  SdWeatherCitySearchItem,
  SdWeatherCurrentBundle,
  SdWeatherLocationResponse,
} from "./sdWeatherTypes";

type ApiEnvelope<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
    };

const requestSdWeather = async <T>(
  path: string,
  params: Record<string, string | boolean | undefined>,
  signal?: AbortSignal,
): Promise<T> => {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  const response = await fetch(url.toString(), {
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: "application/json" },
    signal,
  });
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || payload.success === false) {
    throw new Error(
      payload.success === false
        ? payload.error
        : `Weather request failed: ${response.status}`,
    );
  }
  return payload.data;
};

export const fetchSdWeatherLocation = (signal?: AbortSignal) =>
  requestSdWeather<SdWeatherLocationResponse>(
    "/api/weather/location",
    {},
    signal,
  );

export const searchSdWeatherCities = (
  keyword: string,
  signal?: AbortSignal,
) =>
  requestSdWeather<SdWeatherCitySearchItem[]>(
    "/api/weather/search",
    { keyword },
    signal,
  );

export const fetchSdWeatherCurrent = (
  location: string,
  type = "city",
  refresh = false,
  signal?: AbortSignal,
) =>
  requestSdWeather<SdWeatherCurrentBundle>(
    "/api/weather/current",
    { location, type, refresh },
    signal,
  );
