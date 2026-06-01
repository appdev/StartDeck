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

  const clearLocalSession = () => {
    username.value = "";
    sessionGeneration.value = "";
    password.value = "";
    deleteLegacyToken();
    localStorage.removeItem(USERNAME_KEY);
  };

  const applySession = (data: SessionResponse) => {
    if (data.authenticated && data.username && data.sessionGeneration) {
      username.value = data.username;
      sessionGeneration.value = data.sessionGeneration;
      localStorage.setItem(USERNAME_KEY, data.username);
      deleteLegacyToken();
      return;
    }
    clearLocalSession();
  };

  const bootstrapSession = async () => {
    sessionReady.value = false;
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
        clearLocalSession();
        if (res.status === 401 && data.error === "invalid_token") {
          notifySessionExpired();
        }
      }
    } catch (e) {
      console.warn("[Auth] Session bootstrap failed", e);
      clearLocalSession();
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
