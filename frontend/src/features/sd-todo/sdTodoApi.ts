import { sessionFetch } from "@/utils/sessionFetch";

export interface SdTodoFetchOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export const fetchSdTodoWidgetData = async (
  widgetId: string,
  options: SdTodoFetchOptions = {},
) => {
  const res = await sessionFetch(`/api/widgets/${encodeURIComponent(widgetId)}`, {
    headers: options.headers,
    cache: "no-store",
    signal: options.signal,
  });
  if (!res.ok) throw new Error(res.statusText);
  const payload = (await res.json()) as { success?: boolean; data?: unknown };
  if (!payload.success) throw new Error("todo payload invalid");
  return payload.data;
};
