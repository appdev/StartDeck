import { useAuthStore } from "@/stores/auth";
import type {
  TapdCredentialPayload,
  TapdCredentialStatus,
  TapdDefectsQueryRequest,
  TapdDefectSummary,
  TapdWorkspaceResponse,
} from "./tapdDefectTypes";

const parseJson = async <T>(response: Response): Promise<T> => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data && typeof data.error === "string" ? data.error : "request_failed";
    if (response.status === 401 && message === "invalid_token") {
      useAuthStore().logout();
      throw new Error("登录状态已失效，请重新登录");
    }
    throw new Error(message);
  }
  return data as T;
};

const authHeaders = () => useAuthStore().getHeaders();

export const queryTapdDefects = async (
  request: TapdDefectsQueryRequest,
): Promise<TapdDefectSummary> => {
  const response = await fetch("/api/tapd-defects/query", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(request),
  });
  return parseJson<TapdDefectSummary>(response);
};

export const resolveTapdWorkspace = async (
  widgetId: string,
  workspaceId: string,
): Promise<TapdWorkspaceResponse> => {
  const response = await fetch("/api/tapd-defects/workspace", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ widgetId, workspaceId }),
  });
  return parseJson<TapdWorkspaceResponse>(response);
};

export const getTapdCredentialStatus = async (
  widgetId: string,
): Promise<TapdCredentialStatus> => {
  const response = await fetch(
    `/api/tapd-defects/credentials/${encodeURIComponent(widgetId)}`,
    {
      headers: authHeaders(),
    },
  );
  return parseJson<TapdCredentialStatus>(response);
};

export const saveTapdServerCredential = async (
  widgetId: string,
  payload: TapdCredentialPayload,
): Promise<TapdCredentialStatus> => {
  const response = await fetch(
    `/api/tapd-defects/credentials/${encodeURIComponent(widgetId)}`,
    {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    },
  );
  return parseJson<TapdCredentialStatus>(response);
};

export const deleteTapdServerCredential = async (widgetId: string) => {
  const response = await fetch(
    `/api/tapd-defects/credentials/${encodeURIComponent(widgetId)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );
  await parseJson<{ success: boolean }>(response);
};
