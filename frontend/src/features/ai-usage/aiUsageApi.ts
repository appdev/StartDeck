import { useAuthStore } from "@/stores/auth";
import { sessionFetch } from "@/utils/sessionFetch";
import type {
  AiUsageCredentialPayload,
  AiUsageCredentialStatus,
  AiUsageProviderSummary,
  AiUsageQueryRequest,
} from "./aiUsageTypes";

const parseJson = async <T>(response: Response): Promise<T> => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data && typeof data.error === "string" ? data.error : "request_failed";
    throw new Error(message);
  }
  return data as T;
};

const authHeaders = () => useAuthStore().getHeaders();

export const queryAiUsage = async (
  request: AiUsageQueryRequest,
): Promise<AiUsageProviderSummary> => {
  const response = await sessionFetch("/api/ai-usage/query", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(request),
  });
  return parseJson<AiUsageProviderSummary>(response);
};

export const getAiUsageCredentialStatus = async (
  widgetId: string,
  providerId: string,
): Promise<AiUsageCredentialStatus> => {
  const response = await sessionFetch(
    `/api/ai-usage/credentials/${encodeURIComponent(widgetId)}/${encodeURIComponent(providerId)}`,
    {
      headers: authHeaders(),
    },
  );
  return parseJson<AiUsageCredentialStatus>(response);
};

export const saveAiUsageServerCredential = async (
  widgetId: string,
  providerId: string,
  payload: AiUsageCredentialPayload,
): Promise<AiUsageCredentialStatus> => {
  const response = await sessionFetch(
    `/api/ai-usage/credentials/${encodeURIComponent(widgetId)}/${encodeURIComponent(providerId)}`,
    {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    },
  );
  return parseJson<AiUsageCredentialStatus>(response);
};

export const deleteAiUsageServerCredential = async (
  widgetId: string,
  providerId: string,
) => {
  const response = await sessionFetch(
    `/api/ai-usage/credentials/${encodeURIComponent(widgetId)}/${encodeURIComponent(providerId)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );
  await parseJson<{ success: boolean }>(response);
};
