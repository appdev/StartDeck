import type { IconBackgroundMode } from "@/types";

export type IconAppearanceInput = {
  iconBackgroundMode?: IconBackgroundMode | null;
  iconAutoBackgroundColor?: string | null;
  iconCustomBackgroundColor?: string | null;
  color?: string | null;
};

export type IconBackgroundSource = "custom" | "auto" | "legacy" | "fallback";

export type ResolvedIconBackground = {
  mode: IconBackgroundMode;
  color: string;
  source: IconBackgroundSource;
  visible: boolean;
};

type ResolveIconBackgroundOptions = {
  fallback?: string;
  shape?: string | null;
};

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const CSS_FUNCTION_COLOR_RE =
  /^(rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?(?:\s*,\s*(?:0|1|0?\.\d+|\d+%))?\s*\)|hsla?\(\s*[\d.]+(?:deg|rad|turn)?\s*,\s*[\d.]+%\s*,\s*[\d.]+%(?:\s*,\s*(?:0|1|0?\.\d+|\d+%))?\s*\))$/i;

const BLOCKED_LEGACY_BACKGROUNDS = new Set(["#000000", "bg-black"]);

export const normalizeIconBackgroundColor = (value?: string | null): string | null => {
  const raw = value?.trim();
  if (!raw) return null;

  const hexMatch = raw.match(HEX_COLOR_RE);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return `#${hex
        .split("")
        .map((char) => char + char)
        .join("")}`.toLowerCase();
    }
    return `#${hex}`.toLowerCase();
  }

  if (CSS_FUNCTION_COLOR_RE.test(raw)) return raw;

  if (typeof CSS !== "undefined" && CSS.supports?.("color", raw)) {
    return raw;
  }

  return null;
};

export const normalizeLegacyIconBackground = (value?: string | null): string | null => {
  const raw = value?.trim();
  if (!raw) return null;
  if (raw.includes("sky") || BLOCKED_LEGACY_BACKGROUNDS.has(raw)) return null;

  const bgClass = raw.split(/\s+/).find((part) => part.startsWith("bg-"));
  if (bgClass) return bgClass;

  return normalizeIconBackgroundColor(raw);
};

export const resolveIconBackground = (
  item: IconAppearanceInput,
  options: ResolveIconBackgroundOptions = {},
): ResolvedIconBackground => {
  const fallback = options.fallback || "bg-gray-100";
  const shape = options.shape || "";
  const mode: IconBackgroundMode = item.iconBackgroundMode === "custom" ? "custom" : "auto";
  const visible = shape !== "hidden" && shape !== "none";
  const legacy = normalizeLegacyIconBackground(item.color);

  if (mode === "custom") {
    const custom = normalizeIconBackgroundColor(item.iconCustomBackgroundColor);
    if (custom) return { mode, color: custom, source: "custom", visible };
    if (legacy) return { mode, color: legacy, source: "legacy", visible };
    return { mode, color: fallback, source: "fallback", visible };
  }

  const auto = normalizeIconBackgroundColor(item.iconAutoBackgroundColor);
  if (auto) return { mode, color: auto, source: "auto", visible };
  if (legacy) return { mode, color: legacy, source: "legacy", visible };
  return { mode, color: fallback, source: "fallback", visible };
};
