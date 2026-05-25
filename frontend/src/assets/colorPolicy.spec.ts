import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
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
});
