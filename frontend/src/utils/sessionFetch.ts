import { useAuthStore } from "@/stores/auth";

const LEGACY_TOKEN_KEY = "start-deck-token";
const SESSION_INVALID_EVENT = "startdeck:session-invalid";

let invalidationInProgress = false;

const sameOriginApiPath = (input: RequestInfo | URL): RequestInfo | URL => {
  if (typeof input !== "string") return input;
  if (!input.startsWith("/api/")) return input;
  return input;
};

const stripAuthorization = (headers: HeadersInit | undefined): Headers => {
  const next = new Headers(headers);
  next.delete("Authorization");
  next.delete("authorization");
  return next;
};

export const deleteLegacySessionToken = () => {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    /* ignore storage failures */
  }
};

export const isInvalidTokenResponse = async (response: Response) => {
  if (response.status !== 401) return false;
  const readableResponse =
    typeof response.clone === "function" ? response.clone() : response;
  const payload = await readableResponse.json().catch(() => null);
  return payload?.error === "invalid_token";
};

export const invalidateStartDeckSession = async () => {
  if (invalidationInProgress) return;
  invalidationInProgress = true;
  try {
    const auth = useAuthStore();
    auth.clearLocalSession();
    deleteLegacySessionToken();
    await fetch("/api/logout", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    }).catch(() => undefined);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(SESSION_INVALID_EVENT));
    }
  } finally {
    invalidationInProgress = false;
  }
};

export const onStartDeckSessionInvalid = (handler: () => void) => {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(SESSION_INVALID_EVENT, handler);
  return () => window.removeEventListener(SESSION_INVALID_EVENT, handler);
};

export const sessionFetch = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
) => {
  const response = await fetch(sameOriginApiPath(input), {
    ...init,
    credentials: "same-origin",
    headers: stripAuthorization(init.headers),
  });
  if (await isInvalidTokenResponse(response)) {
    await invalidateStartDeckSession();
  }
  return response;
};
