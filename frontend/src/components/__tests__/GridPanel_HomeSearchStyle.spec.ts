import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const gridPanelSource = readFileSync("src/components/GridPanel.vue", "utf8");

const getRuleBlock = (source: string, selector: string) => {
  const marker = `${selector} {`;
  const start = source.indexOf(marker);
  expect(start, `Missing CSS rule for ${selector}`).toBeGreaterThanOrEqual(0);

  const bodyStart = source.indexOf("{", start) + 1;
  let depth = 1;

  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(bodyStart, index);
  }

  throw new Error(`Unclosed CSS rule for ${selector}`);
};

describe("GridPanel home search styles", () => {
  it("derives the search engine mask from the search box surface token", () => {
    const searchBlock = getRuleBlock(gridPanelSource, ".sd-itab-home-search");
    const wrapBlock = getRuleBlock(
      gridPanelSource,
      ".sd-itab-home-search-wrap",
    );
    const engineButtonBlock = getRuleBlock(
      gridPanelSource,
      ".sd-itab-home-search-engines button",
    );
    const activeButtonBlock = getRuleBlock(
      gridPanelSource,
      ".sd-itab-home-search-engines button:hover,\n.sd-itab-home-search-engines button:focus-visible,\n.sd-itab-home-search-engines button.is-active",
    );

    expect(searchBlock).toContain(
      "background: var(--sd-theme-grid-panel-surface-02);",
    );
    expect(wrapBlock).toContain("--sd-itab-home-search-engine-mask");
    expect(wrapBlock).toContain("var(--sd-theme-grid-panel-surface-02) 72%");
    expect(wrapBlock).toContain("var(--sd-theme-grid-panel-surface-02) 88%");
    expect(engineButtonBlock).toContain(
      "background: var(--sd-itab-home-search-engine-mask);",
    );
    expect(engineButtonBlock).toContain(
      "var(--sd-theme-grid-panel-text-01) 88%",
    );
    expect(activeButtonBlock).toContain(
      "background: var(--sd-itab-home-search-engine-mask-strong);",
    );
  });
});
