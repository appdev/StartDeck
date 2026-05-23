import type {
  ItabWeatherCitySearchItem,
  ItabWeatherCurrentBundle,
  ItabWeatherLocationResponse,
} from "./itabWeatherTypes";

type ApiEnvelope<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
    };

const requestItabWeather = async <T>(
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
        : `iTab weather request failed: ${response.status}`,
    );
  }
  return payload.data;
};

export const fetchItabWeatherLocation = (signal?: AbortSignal) =>
  requestItabWeather<ItabWeatherLocationResponse>(
    "/api/itab/weather/location",
    {},
    signal,
  );

export const searchItabWeatherCities = (
  keyword: string,
  signal?: AbortSignal,
) =>
  requestItabWeather<ItabWeatherCitySearchItem[]>(
    "/api/itab/weather/search",
    { keyword },
    signal,
  );

export const fetchItabWeatherCurrent = (
  location: string,
  type = "city",
  refresh = false,
  signal?: AbortSignal,
) =>
  requestItabWeather<ItabWeatherCurrentBundle>(
    "/api/itab/weather/current",
    { location, type, refresh },
    signal,
  );
