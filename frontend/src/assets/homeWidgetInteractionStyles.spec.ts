import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mainCssSource = readFileSync("src/assets/main.css", "utf8");
const gridLayoutCssSource = readFileSync("src/assets/grid-layout.css", "utf8");

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

describe("home widget interaction styles", () => {
  it("uses the component radius for selected and resize shadows", () => {
    expect(mainCssSource).toContain(
      "--sd-home-widget-radius: var(--sd-radius-window);",
    );

    const frameBlock = getRuleBlock(mainCssSource, ".sd-home-widget-frame");
    const selectedBlock = getRuleBlock(
      mainCssSource,
      ".sd-home-widget-frame.is-selected",
    );
    const resizeGhostBlock = getRuleBlock(
      mainCssSource,
      ".sd-home-resize-ghost",
    );

    expect(frameBlock).toContain(
      "border-radius: var(--sd-home-widget-radius);",
    );
    expect(selectedBlock).toContain(
      "border-radius: var(--sd-home-widget-radius);",
    );
    expect(selectedBlock).not.toContain("outline-offset");
    expect(selectedBlock).toContain("var(--sd-home-widget-interaction-ring)");
    expect(selectedBlock).toContain("var(--sd-home-widget-interaction-shadow)");
    expect(resizeGhostBlock).toContain(
      "border-radius: var(--sd-home-widget-radius);",
    );
    expect(resizeGhostBlock).toContain(
      "var(--sd-home-widget-interaction-shadow)",
    );
  });

  it("removes GridStack drag placeholder border and shadow chrome", () => {
    const layoutBlock = getRuleBlock(
      gridLayoutCssSource,
      ".sd-home-grid-stack.sd-home-grid-stack",
    );
    const placeholderBlock = getRuleBlock(
      gridLayoutCssSource,
      ".sd-home-grid-stack\n  > .grid-stack-placeholder\n  > .placeholder-content.placeholder-content",
    );
    const draggingBlock = getRuleBlock(
      gridLayoutCssSource,
      ".sd-home-grid-stack .ui-draggable-dragging > .grid-stack-item-content,\n.sd-home-grid-stack .ui-resizable-resizing > .grid-stack-item-content",
    );

    expect(gridLayoutCssSource).not.toContain("red");
    expect(gridLayoutCssSource).not.toContain("sd-home-drag-moved");
    expect(placeholderBlock).toContain(
      "border-radius: var(--sd-home-widget-radius, 18px);",
    );
    expect(placeholderBlock).toContain("border: 0;");
    expect(placeholderBlock).toContain("outline: none;");
    expect(placeholderBlock).toContain("background: transparent;");
    expect(placeholderBlock).toContain("box-shadow: none;");
    expect(placeholderBlock).toContain("opacity: 0;");
    expect(layoutBlock).toContain("transition: height 200ms ease;");
    expect(draggingBlock).toContain("outline: none;");
    expect(draggingBlock).toContain("box-shadow: none;");
    expect(draggingBlock).toContain("opacity: 1;");
  });

  it("keeps edit mode chrome compact and removes the resize grip", () => {
    const deleteBlock = getRuleBlock(mainCssSource, ".sd-home-widget-delete");

    expect(mainCssSource).not.toContain(".sd-home-widget-resize-grip");
    expect(deleteBlock).toContain("width: 1.5rem;");
    expect(deleteBlock).toContain("height: 1.5rem;");
    expect(deleteBlock).toContain("top: -0.375rem;");
    expect(deleteBlock).toContain("left: -0.375rem;");
  });
});
