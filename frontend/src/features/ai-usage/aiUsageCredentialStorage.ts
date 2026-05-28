import type {
  AiUsageCredentialStorage,
  AiUsageCredentialType,
} from "./aiUsageTypes";

export interface BrowserAiUsageCredential {
  credentialType: AiUsageCredentialType;
  credential: string;
  accountId?: string;
  savedAt: string;
}

const STORAGE_PREFIX = "startdeck:ai-usage:credential";

const scopePart = (value: string) => encodeURIComponent(value || "guest");

export const aiUsageBrowserCredentialKey = (
  scope: string,
  widgetId: string,
  providerId: string,
) =>
  `${STORAGE_PREFIX}:${scopePart(scope)}:${scopePart(widgetId)}:${scopePart(providerId)}`;

export const loadBrowserAiUsageCredential = (
  scope: string,
  widgetId: string,
  providerId: string,
): BrowserAiUsageCredential | null => {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(
    aiUsageBrowserCredentialKey(scope, widgetId, providerId),
  );
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BrowserAiUsageCredential>;
    if (
      parsed.credentialType !== "access_token" &&
      parsed.credentialType !== "session_cookie"
    ) {
      return null;
    }
    if (typeof parsed.credential !== "string" || !parsed.credential.trim()) {
      return null;
    }
    return {
      credentialType: parsed.credentialType,
      credential: parsed.credential,
      accountId:
        typeof parsed.accountId === "string" && parsed.accountId.trim()
          ? parsed.accountId
          : undefined,
      savedAt:
        typeof parsed.savedAt === "string"
          ? parsed.savedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

export const saveBrowserAiUsageCredential = (
  scope: string,
  widgetId: string,
  providerId: string,
  credential: BrowserAiUsageCredential,
) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    aiUsageBrowserCredentialKey(scope, widgetId, providerId),
    JSON.stringify(credential),
  );
};

export const clearBrowserAiUsageCredential = (
  scope: string,
  widgetId: string,
  providerId: string,
) => {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(
    aiUsageBrowserCredentialKey(scope, widgetId, providerId),
  );
};

export const credentialStorageLabel = (storage: AiUsageCredentialStorage) => {
  if (storage === "once") return "仅本次使用";
  if (storage === "server") return "保存到服务端";
  return "保存到当前浏览器";
};
