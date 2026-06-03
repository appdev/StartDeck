import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { notifySessionExpired } from "@/utils/sessionExpiredFeedback";

type SessionResponse = {
  success?: boolean;
  authenticated?: boolean;
  username?: string | null;
  sessionGeneration?: string;
  error?: string;
};

type BootstrapSessionOptions = {
  preserveExistingSession?: boolean;
};

const LEGACY_TOKEN_KEY = "start-deck-token";
const USERNAME_KEY = "start-deck-username";

const deleteLegacyToken = () => {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    /* ignore storage failures */
  }
};

export const useAuthStore = defineStore("auth", () => {
  const sessionReady = ref(false);
  const username = ref("");
  const sessionGeneration = ref("");
  const isLogged = computed(
    () => sessionReady.value && !!username.value && !!sessionGeneration.value,
  );
  const password = ref("");

  const getHeaders = (): Record<string, string> => ({
    "Content-Type": "application/json",
  });

  const hasLocalSessionHint = () => {
    try {
      return !!localStorage.getItem(USERNAME_KEY) || !!username.value;
    } catch {
      return !!username.value;
    }
  };

  const clearServerSessionCookie = async () => {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    }).catch(() => undefined);
  };

  const clearLocalSession = () => {
    username.value = "";
    sessionGeneration.value = "";
    password.value = "";
    deleteLegacyToken();
    localStorage.removeItem(USERNAME_KEY);
  };

  const applyServerSession = (usr: string, generation: string) => {
    const nextUsername = usr.trim();
    const nextGeneration = generation.trim();
    if (!nextUsername || !nextGeneration) return false;
    username.value = nextUsername;
    sessionGeneration.value = nextGeneration;
    sessionReady.value = true;
    localStorage.setItem(USERNAME_KEY, nextUsername);
    deleteLegacyToken();
    return true;
  };

  const applySession = (data: SessionResponse) => {
    if (data.authenticated && data.username && data.sessionGeneration) {
      applyServerSession(data.username, data.sessionGeneration);
      return;
    }
    clearLocalSession();
  };

  const bootstrapSession = async (options: BootstrapSessionOptions = {}) => {
    const preserveCurrentSession =
      options.preserveExistingSession === true && isLogged.value;
    if (!preserveCurrentSession) {
      sessionReady.value = false;
    }
    deleteLegacyToken();
    try {
      const res = await fetch("/api/session", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as SessionResponse;
      if (res.ok) {
        applySession(data);
      } else {
        const shouldNotifyExpired =
          res.status === 401 &&
          data.error === "invalid_token" &&
          hasLocalSessionHint();
        clearLocalSession();
        if (res.status === 401 && data.error === "invalid_token") {
          await clearServerSessionCookie();
        }
        if (shouldNotifyExpired) {
          notifySessionExpired();
        }
      }
    } catch (e) {
      console.warn("[Auth] Session bootstrap failed", e);
      if (!preserveCurrentSession) {
        clearLocalSession();
      }
    } finally {
      sessionReady.value = true;
    }
  };

  const login = async (usr: string, pwd: string): Promise<boolean> => {
    const res = await fetch("/api/login", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: usr, password: pwd }),
    });
    const data = (await res.json().catch(() => ({}))) as SessionResponse;
    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }
    username.value = String(data.username || usr);
    sessionGeneration.value = String(data.sessionGeneration || "");
    sessionReady.value = true;
    localStorage.setItem(USERNAME_KEY, username.value);
    deleteLegacyToken();
    return true;
  };

  const logout = async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch {
      /* local session cleanup still happens */
    } finally {
      clearLocalSession();
      sessionReady.value = true;
    }
  };

  const changePassword = (newPwd: string) => {
    password.value = newPwd;
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return data.users;
      }
      return [];
    } catch {
      return [];
    }
  };

  const addUser = async (usr: string, pwd: string): Promise<boolean> => {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      credentials: "same-origin",
      headers: getHeaders(),
      body: JSON.stringify({ username: usr, password: pwd }),
    });
    if (res.ok) return true;
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Add user failed");
  };

  const deleteUser = async (usr: string): Promise<boolean> => {
    const res = await fetch(`/api/admin/users/${usr}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (res.ok) return true;
    throw new Error("Delete failed");
  };

  const uploadLicense = async (key: string): Promise<boolean> => {
    const res = await fetch("/api/admin/license", {
      method: "POST",
      credentials: "same-origin",
      headers: getHeaders(),
      body: JSON.stringify({ key }),
    });
    if (res.ok) return true;
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Upload license failed");
  };

  return {
    sessionReady,
    username,
    sessionGeneration,
    isLogged,
    password,
    getHeaders,
    clearLocalSession,
    applyServerSession,
    bootstrapSession,
    login,
    logout,
    changePassword,
    fetchUsers,
    addUser,
    deleteUser,
    uploadLicense,
  };
});
