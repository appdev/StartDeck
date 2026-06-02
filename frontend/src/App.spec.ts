import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync("src/App.vue", "utf8");
const editModalSource = readFileSync("src/components/EditModal.vue", "utf8");

describe("App global feedback dialogs", () => {
  it("uses the compact modal window shell for alert dialogs", () => {
    expect(appSource).toContain('surface-class="sd-compact-window"');
  });

  it("keeps global feedback dialogs above editing modal layers", () => {
    expect(appSource).toContain("const GLOBAL_FEEDBACK_MODAL_Z_INDEX = 1000;");
    expect(editModalSource).toContain(':z-index="130"');
    expect(appSource.match(/:z-index="GLOBAL_FEEDBACK_MODAL_Z_INDEX"/g))
      .toHaveLength(2);
  });
});
