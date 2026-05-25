import { computed, onMounted, onUnmounted, ref, watchEffect } from "vue";
import type { StartDeckThemeMode } from "@/types";

export type StartDeckThemeScheme = "light" | "dark";

const themeModes = new Set<StartDeckThemeMode>(["auto", "light", "dark"]);

export const normalizeThemeMode = (value: unknown): StartDeckThemeMode =>
  typeof value === "string" && themeModes.has(value as StartDeckThemeMode)
    ? (value as StartDeckThemeMode)
    : "auto";

export const resolveThemeScheme = (
  mode: unknown,
  prefersDark: boolean,
): StartDeckThemeScheme => {
  const normalized = normalizeThemeMode(mode);
  if (normalized === "auto") return prefersDark ? "dark" : "light";
  return normalized;
};

export const applyThemeAttributes = (
  root: HTMLElement,
  mode: unknown,
  scheme: StartDeckThemeScheme,
) => {
  const normalized = normalizeThemeMode(mode);
  root.dataset.sdThemeMode = normalized;
  root.dataset.sdTheme = scheme;
  root.style.colorScheme = scheme;
};

const readSystemPrefersDark = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

export const useThemeMode = (source: () => unknown) => {
  const systemPrefersDark = ref(readSystemPrefersDark());
  const mode = computed(() => normalizeThemeMode(source()));
  const scheme = computed(() =>
    resolveThemeScheme(mode.value, systemPrefersDark.value),
  );
  let media: MediaQueryList | null = null;

  const syncSystemPreference = () => {
    systemPrefersDark.value = Boolean(media?.matches);
  };

  onMounted(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    media = window.matchMedia("(prefers-color-scheme: dark)");
    syncSystemPreference();
    media.addEventListener?.("change", syncSystemPreference);
  });

  onUnmounted(() => {
    media?.removeEventListener?.("change", syncSystemPreference);
    media = null;
  });

  watchEffect(() => {
    if (typeof document === "undefined") return;
    applyThemeAttributes(document.documentElement, mode.value, scheme.value);
  });

  return {
    mode,
    scheme,
    systemPrefersDark,
  };
};
