import type { WidgetConfig } from "@/types";

const LEGACY_STRING_REPLACEMENTS = [
  ["itab-grid/2026-05-22", "sd-grid/2026-05-22"],
  ["itab-capture", "sd-capture"],
  ["/itab-live-assets", "/sd-live-assets"],
  ["/itab/", "/sd/"],
  ["/itab", "/sd"],
  ["itab.", "sd."],
  ["itab_", "sd_"],
  ["itab-", "sd-"],
] as const;

const migrateLegacyString = (value: string) => {
  if (value === "itab") return "sd";
  if (/^https?:\/\//i.test(value)) return value;
  return LEGACY_STRING_REPLACEMENTS.reduce(
    (next, [from, to]) => next.split(from).join(to),
    value,
  );
};

const migrateLegacyValue = (value: unknown): unknown => {
  if (typeof value === "string") return migrateLegacyString(value);
  if (Array.isArray(value)) return value.map(migrateLegacyValue);
  if (!value || typeof value !== "object") return value;

  const migrated: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    migrated[key === "itab" ? "sd" : key] = migrateLegacyValue(entry);
  }
  return migrated;
};

export const migrateLegacyWidgetConfig = (
  widget: WidgetConfig,
): WidgetConfig => ({
  ...widget,
  id: migrateLegacyString(widget.id),
  type: migrateLegacyString(widget.type),
  data: migrateLegacyValue(widget.data),
});

export const migrateLegacyWidgetConfigs = (
  widgets: WidgetConfig[],
): WidgetConfig[] => widgets.map(migrateLegacyWidgetConfig);
