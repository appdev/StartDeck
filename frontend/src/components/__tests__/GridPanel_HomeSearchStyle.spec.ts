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
  it("keeps only the selected search engine masked with the search box color", () => {
    const searchBlock = getRuleBlock(gridPanelSource, ".sd-itab-home-search");
    const wrapBlock = getRuleBlock(
      gridPanelSource,
      ".sd-itab-home-search-wrap",
    );
    const engineButtonBlock = getRuleBlock(
      gridPanelSource,
      ".sd-itab-home-search-engines button",
    );
    const hoverButtonBlock = getRuleBlock(
      gridPanelSource,
      ".sd-itab-home-search-engines button:hover,\n.sd-itab-home-search-engines button:focus-visible",
    );
    const selectedButtonBlock = getRuleBlock(
      gridPanelSource,
      ".sd-itab-home-search-engines button.is-active",
    );

    expect(searchBlock).toContain(
      "background: var(--sd-theme-grid-panel-surface-02);",
    );
    expect(wrapBlock).toContain("--sd-itab-home-search-engine-selected-bg");
    expect(wrapBlock).toContain("var(--sd-theme-grid-panel-surface-02) 42%");
    expect(wrapBlock).toContain("--sd-itab-home-search-engine-text");
    expect(wrapBlock).toContain("--sd-itab-home-search-engine-selected-text");
    expect(wrapBlock).toContain("var(--sd-theme-grid-panel-text-06) 90%");
    expect(wrapBlock).toContain("--sd-itab-home-search-engine-text");
    expect(engineButtonBlock).toContain("background: transparent;");
    expect(engineButtonBlock).toContain("border: 1px solid transparent;");
    expect(engineButtonBlock).toContain(
      "color: var(--sd-itab-home-search-engine-text);",
    );
    expect(engineButtonBlock).toContain(
      "text-shadow: var(--sd-itab-home-search-engine-text-shadow);",
    );
    expect(hoverButtonBlock).not.toContain("background:");
    expect(hoverButtonBlock).not.toContain("color:");
    expect(selectedButtonBlock).toContain(
      "background: var(--sd-itab-home-search-engine-selected-bg);",
    );
    expect(selectedButtonBlock).toContain(
      "border-color: var(--sd-itab-home-search-engine-selected-border);",
    );
    expect(selectedButtonBlock).toContain(
      "color: var(--sd-itab-home-search-engine-selected-text);",
    );
  });
});
