import type { ItabPoemApiData } from "./itabPoemTypes";

type ApiEnvelope<T> =
  | {
      success: true;
      data: T;
      sourceStatus?: string;
    }
  | {
      success: false;
      error: string;
    };

const requestItabPoem = async <T>(
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
        : `iTab poem request failed: ${response.status}`,
    );
  }
  return payload.data;
};

export const fetchItabPoem = (refresh = false, signal?: AbortSignal) =>
  requestItabPoem<ItabPoemApiData>("/api/poem", { refresh }, signal);
