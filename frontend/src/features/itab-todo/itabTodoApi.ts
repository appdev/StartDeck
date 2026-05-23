export interface ItabTodoFetchOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export const fetchItabTodoWidgetData = async (
  widgetId: string,
  options: ItabTodoFetchOptions = {},
) => {
  const res = await fetch(`/api/widgets/${encodeURIComponent(widgetId)}`, {
    headers: options.headers,
    cache: "no-store",
    signal: options.signal,
  });
  if (!res.ok) throw new Error(res.statusText);
  const payload = (await res.json()) as { success?: boolean; data?: unknown };
  if (!payload.success) throw new Error("todo payload invalid");
  return payload.data;
};
