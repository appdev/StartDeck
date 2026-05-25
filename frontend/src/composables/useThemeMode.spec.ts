import { describe, expect, it } from "vitest";
import {
  applyThemeAttributes,
  normalizeThemeMode,
  resolveThemeScheme,
} from "./useThemeMode";

describe("theme mode semantics", () => {
  it("normalizes unknown stored values to auto", () => {
    expect(normalizeThemeMode("light")).toBe("light");
    expect(normalizeThemeMode("dark")).toBe("dark");
    expect(normalizeThemeMode("auto")).toBe("auto");
    expect(normalizeThemeMode("night")).toBe("auto");
    expect(normalizeThemeMode(undefined)).toBe("auto");
  });

  it("resolves auto from system preference and keeps explicit modes", () => {
    expect(resolveThemeScheme("auto", false)).toBe("light");
    expect(resolveThemeScheme("auto", true)).toBe("dark");
    expect(resolveThemeScheme("light", true)).toBe("light");
    expect(resolveThemeScheme("dark", false)).toBe("dark");
  });

  it("writes the root attributes used by semantic CSS tokens", () => {
    const root = document.createElement("html");
    applyThemeAttributes(root, "dark", "dark");
    expect(root.dataset.sdThemeMode).toBe("dark");
    expect(root.dataset.sdTheme).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");

    applyThemeAttributes(root, "invalid", "light");
    expect(root.dataset.sdThemeMode).toBe("auto");
    expect(root.dataset.sdTheme).toBe("light");
    expect(root.style.colorScheme).toBe("light");
  });
});
