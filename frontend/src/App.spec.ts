import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync("src/App.vue", "utf8");

describe("App global feedback dialogs", () => {
  it("uses the compact modal window shell for alert dialogs", () => {
    expect(appSource).toContain('surface-class="sd-compact-window"');
  });
});
