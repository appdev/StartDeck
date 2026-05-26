import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

type ColorAuditEntry = {
  file: string;
  hardcodedColors: string[];
};

type ColorAudit = {
  entries: ColorAuditEntry[];
};

const cwd = process.cwd();
const repoRoot =
  cwd.endsWith("/frontend") || cwd.endsWith("\\frontend")
    ? resolve(cwd, "..")
    : cwd;
const audit = JSON.parse(
  readFileSync(
    resolve(repoRoot, "docs/design/startdeck-component-color-audit.json"),
    "utf8",
  ),
) as ColorAudit;

const exactColorPattern =
  /#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]+\)|\bhsla?\([^)]+\)/g;

const ignoredLiteralColors = new Set(["transparent", "currentColor"]);
const allowedDynamicColorPatterns = [
  /^rgba\(0,0,0,\$\{store\.appConfig\.backgroundMask/,
  /^rgba\(15,23,42,\$\{store\.appConfig\.backgroundMask/,
  /^rgba\(0,0,0,\$\{form\.backgroundMask/,
];

const collectExactColors = (source: string) =>
  Array.from(source.matchAll(exactColorPattern), (match) => match[0]).filter(
    (color) =>
      !ignoredLiteralColors.has(color) &&
      !color.includes("${") &&
      !allowedDynamicColorPatterns.some((pattern) => pattern.test(color)),
  );

const collectBaselineColors = (entry: ColorAuditEntry) =>
  new Set(
    entry.hardcodedColors.flatMap((value) => {
      const exactColors = collectExactColors(value);
      return exactColors.length > 0 ? exactColors : [value];
    }),
  );

const collectVueFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const absolutePath = resolve(dir, name);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) return collectVueFiles(absolutePath);
    return name.endsWith(".vue") ? [absolutePath] : [];
  });

const collectStyleBlocks = (source: string) =>
  Array.from(
    source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g),
    (match) => match[1] ?? "",
  ).join("\n");

const normalizeCssValue = (value: string) => value.replace(/\s+/g, " ").trim();

const collectDarkThemeDeclarationValues = (
  source: string,
  tokens: readonly string[],
) => {
  const tokenSet = new Set(tokens);
  const values = new Map<string, string[]>(
    tokens.map((token) => [token, [] as string[]]),
  );
  const root = postcss.parse(source);

  root.walkRules((rule) => {
    const selectors = rule.selectors ?? [rule.selector];
    const isDarkThemeRule = selectors.some(
      (selector) =>
        selector.includes('[data-sd-theme="dark"]') ||
        selector.includes('[data-sd-scheme="dark"]'),
    );
    if (!isDarkThemeRule) return;

    rule.walkDecls((declaration) => {
      if (!tokenSet.has(declaration.prop)) return;
      values.get(declaration.prop)!.push(normalizeCssValue(declaration.value));
    });
  });

  return values;
};

const collectLightThemeDeclarationValues = (
  source: string,
  tokens: readonly string[],
) => {
  const tokenSet = new Set(tokens);
  const values = new Map<string, string[]>(
    tokens.map((token) => [token, [] as string[]]),
  );
  const root = postcss.parse(source);

  root.walkRules((rule) => {
    const selectors = rule.selectors ?? [rule.selector];
    const isLightThemeRule =
      selectors.includes(":root") &&
      selectors.includes('[data-sd-theme="light"]');
    if (!isLightThemeRule) return;

    rule.walkDecls((declaration) => {
      if (!tokenSet.has(declaration.prop)) return;
      values.get(declaration.prop)!.push(normalizeCssValue(declaration.value));
    });
  });

  return values;
};

const sourceLightOpenedPanelValuePattern =
  /#fff\b|#eee\b|#222\b|#333\b|rgb\(\s*(?:255\s*,\s*255\s*,\s*255|245\s*,\s*245\s*,\s*245|238\s*,\s*238\s*,\s*238|34\s*,\s*34\s*,\s*34|31\s*,\s*41\s*,\s*55|48\s*,\s*49\s*,\s*51)\s*\)|rgba\(\s*(?:245\s*,\s*247\s*,\s*250|16\s*,\s*24\s*,\s*40)\s*,/i;

const darkOpenedPanelCriticalTokens = [
  "--sd-theme-itab-anniversary-anniversary-opened-panel-surface-01",
  "--sd-theme-itab-anniversary-anniversary-opened-panel-text-01",
  "--sd-theme-itab-calendar-calendar-opened-panel-surface-01",
  "--sd-theme-itab-calendar-calendar-opened-panel-text-01",
  "--sd-theme-itab-food-picker-food-picker-opened-panel-surface-01",
  "--sd-theme-itab-food-picker-food-picker-opened-panel-text-01",
  "--sd-theme-itab-ip-ip-opened-panel-surface-01",
  "--sd-theme-itab-ip-ip-opened-panel-text-01",
  "--sd-theme-itab-memo-memo-opened-panel-surface-01",
  "--sd-theme-itab-memo-memo-opened-panel-text-01",
  "--sd-theme-itab-poem-poem-opened-panel-surface-01",
  "--sd-theme-itab-poem-poem-opened-panel-text-01",
  "--sd-theme-itab-todo-todo-opened-panel-surface-01",
  "--sd-theme-itab-todo-todo-opened-panel-text-01",
  "--sd-theme-itab-wallpaper-wallpaper-opened-panel-surface-01",
  "--sd-theme-itab-wallpaper-wallpaper-opened-panel-text-01",
] as const;

const sourceDarkOuterWidgetValuePattern =
  /#111\b|rgb\(\s*34\s*,\s*34\s*,\s*34\s*\)|rgb\(\s*223\s*,\s*221\s*,\s*221\s*\)|rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.8\s*\)/i;

const lightOuterWidgetCriticalTokens = [
  "--sd-theme-itab-calendar-calendar-widget-surface-01",
  "--sd-theme-itab-calendar-calendar-widget-text-01",
  "--sd-theme-itab-calendar-calendar-widget-text-03",
  "--sd-theme-itab-calendar-calendar-widget-text-06",
  "--sd-theme-itab-clock-clock-widget-surface-01",
  "--sd-theme-itab-clock-clock-widget-text-01",
  "--sd-theme-itab-memo-memo-widget-surface-01",
  "--sd-theme-itab-memo-memo-widget-text-01",
  "--sd-theme-itab-todo-todo-widget-surface-01",
  "--sd-theme-itab-todo-todo-widget-text-01",
] as const;

describe("component color policy", () => {
  it("blocks new hard-coded product colors outside the audited baseline", () => {
    for (const entry of audit.entries) {
      const source = readFileSync(resolve(repoRoot, entry.file), "utf8");
      const baselineColors = collectBaselineColors(entry);
      const currentColors = Array.from(new Set(collectExactColors(source)));
      const addedColors = currentColors.filter(
        (color) => !baselineColors.has(color),
      );

      expect(
        addedColors,
        `${entry.file} introduced hard-coded colors; use semantic --sd-* tokens or update the audited exception list with a reason.`,
      ).toEqual([]);
    }
  });

  it("keeps Vue component style blocks on theme tokens", () => {
    const vueFiles = [
      ...collectVueFiles(resolve(repoRoot, "frontend/src/components")),
      ...collectVueFiles(resolve(repoRoot, "frontend/src/features")),
    ].filter((file) => !file.endsWith("ItabLiveReplica.vue"));

    for (const file of vueFiles) {
      const relativeFile = file.slice(repoRoot.length + 1);
      const styleColors = Array.from(
        new Set(
          collectExactColors(collectStyleBlocks(readFileSync(file, "utf8"))),
        ),
      );
      expect(
        styleColors,
        `${relativeFile} style block contains hard-coded colors; move product UI color to semantic --sd-* tokens.`,
      ).toEqual([]);
    }
  });

  it("keeps theme coverage on all runtime widgets and global surfaces", () => {
    const auditedFiles = new Set(audit.entries.map((entry) => entry.file));

    for (const file of [
      "frontend/src/features/widget-runtime/WidgetOpenedPanelHost.vue",
      "frontend/src/components/DockerWidget.vue",
      "frontend/src/components/SystemStatusWidget.vue",
      "frontend/src/components/CustomCssWidget.vue",
      "frontend/src/features/itab-movie-calendar/ItabMovieCalendarWidget.vue",
      "frontend/src/features/itab-number-uppercase/ItabNumberUppercaseWidget.vue",
      "frontend/src/features/itab-food-picker/ItabFoodPickerWidget.vue",
      "frontend/src/components/SettingsModal.vue",
      "frontend/src/components/AddWidgetModal.vue",
      "frontend/src/components/EditModal.vue",
      "frontend/src/components/GroupSettingsModal.vue",
      "frontend/src/components/base/AppModalShell.vue",
      "frontend/src/components/base/PopoverSurface.vue",
      "frontend/src/components/base/ContextMenuSurface.vue",
      "frontend/src/components/base/ConfirmDialog.vue",
      "frontend/src/components/WallpaperLibrary.vue",
      "frontend/src/components/IconSelectionModal.vue",
      "frontend/src/components/MarketplaceModal.vue",
    ]) {
      expect(
        auditedFiles.has(file),
        `${file} is missing from color audit`,
      ).toBe(true);
    }
  });

  it("does not let modal components redefine the global sd-color palette", () => {
    const localPalettePattern = /--sd-color-[a-zA-Z0-9-]+:/;

    for (const file of [
      "frontend/src/components/SettingsModal.vue",
      "frontend/src/components/EditModal.vue",
      "frontend/src/components/GroupSettingsModal.vue",
      "frontend/src/components/AddWidgetModal.vue",
      "frontend/src/features/widget-runtime/WidgetOpenedPanelHost.vue",
    ]) {
      const source = readFileSync(resolve(repoRoot, file), "utf8");
      expect(source, `${file} should consume semantic tokens only`).not.toMatch(
        localPalettePattern,
      );
    }
  });

  it("keeps opened panel interiors dark-adapted instead of source-light in dark theme", () => {
    const source = readFileSync(
      resolve(repoRoot, "frontend/src/assets/main.css"),
      "utf8",
    );
    const darkThemeValues = collectDarkThemeDeclarationValues(
      source,
      darkOpenedPanelCriticalTokens,
    );

    for (const token of darkOpenedPanelCriticalTokens) {
      const values = darkThemeValues.get(token) ?? [];
      expect(values, `${token} should be declared in the dark token block`)
        .not.toHaveLength(0);
      expect(new Set(values).size, `${token} dark blocks should stay in sync`)
        .toBe(1);

      for (const value of values) {
        expect(
          value,
          `${token} must use semantic dark surfaces/text instead of the source light opened-panel value`,
        ).toMatch(/var\(\s*--sd-(?:component|state|shell|home|color)-/);
        expect(
          value,
          `${token} still resolves to a source-light opened-panel literal in dark theme`,
        ).not.toMatch(sourceLightOpenedPanelValuePattern);
      }
    }
  });

  it("keeps outer widget cards light-adapted instead of source-dark in light theme", () => {
    const source = readFileSync(
      resolve(repoRoot, "frontend/src/assets/main.css"),
      "utf8",
    );
    const lightThemeValues = collectLightThemeDeclarationValues(
      source,
      lightOuterWidgetCriticalTokens,
    );

    for (const token of lightOuterWidgetCriticalTokens) {
      const values = lightThemeValues.get(token) ?? [];
      expect(values, `${token} should be declared in the light token block`)
        .not.toHaveLength(0);

      for (const value of values) {
        expect(
          value,
          `${token} should consume semantic light surfaces/text instead of a source-dark literal`,
        ).toMatch(/var\(\s*--sd-component-/);
        expect(
          value,
          `${token} still resolves to a source-dark outer-widget literal in light theme`,
        ).not.toMatch(sourceDarkOuterWidgetValuePattern);
      }
    }
  });
});
