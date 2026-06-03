import type {
  TapdConnectorCredentialPayload,
  TapdCredentialStorage,
} from "./tapdDefectTypes";

export interface BrowserTapdCredential extends TapdConnectorCredentialPayload {
  savedAt: string;
}

const STORAGE_PREFIX = "startdeck:tapd-defects:credential";

const scopePart = (value: string) => encodeURIComponent(value || "guest");

export const tapdBrowserCredentialKey = (scope: string, widgetId: string) =>
  `${STORAGE_PREFIX}:${scopePart(scope)}:${scopePart(widgetId)}`;

export const loadBrowserTapdCredential = (
  scope: string,
  widgetId: string,
): BrowserTapdCredential | null => {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(tapdBrowserCredentialKey(scope, widgetId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BrowserTapdCredential>;
    if (
      parsed.credentialType !== "basic" &&
      parsed.credentialType !== "bearer"
    ) {
      return null;
    }
    if (parsed.credentialType === "basic") {
      if (
        typeof parsed.apiUser !== "string" ||
        !parsed.apiUser.trim() ||
        typeof parsed.apiPassword !== "string" ||
        !parsed.apiPassword.trim()
      ) {
        return null;
      }
      return {
        credentialType: "basic",
        apiUser: parsed.apiUser.trim(),
        apiPassword: parsed.apiPassword,
        savedAt:
          typeof parsed.savedAt === "string"
            ? parsed.savedAt
            : new Date().toISOString(),
      };
    }
    if (typeof parsed.accessToken !== "string" || !parsed.accessToken.trim()) {
      return null;
    }
    return {
      credentialType: "bearer",
      accessToken: parsed.accessToken.trim(),
      savedAt:
        typeof parsed.savedAt === "string"
          ? parsed.savedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

export const saveBrowserTapdCredential = (
  scope: string,
  widgetId: string,
  credential: BrowserTapdCredential,
) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    tapdBrowserCredentialKey(scope, widgetId),
    JSON.stringify(credential),
  );
};

export const clearBrowserTapdCredential = (scope: string, widgetId: string) => {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(tapdBrowserCredentialKey(scope, widgetId));
};

export const tapdCredentialStorageLabel = (storage: TapdCredentialStorage) => {
  if (storage === "once") return "仅本次使用";
  return "保存到当前浏览器";
};
