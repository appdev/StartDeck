import type { SdPoemApiData } from "./sdPoemTypes";

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

const requestSdPoem = async <T>(
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
        : `Poem request failed: ${response.status}`,
    );
  }
  return payload.data;
};

export const fetchSdPoem = (refresh = false, signal?: AbortSignal) =>
  requestSdPoem<SdPoemApiData>("/api/poem", { refresh }, signal);
