// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { blurActiveElementMatching } from "./focus";

describe("blurActiveElementMatching", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("blurs the active element when it matches the selector", () => {
    document.body.innerHTML =
      '<button class="widget-trigger" type="button">Open</button>';
    const trigger = document.querySelector(".widget-trigger") as HTMLElement;
    trigger.focus();

    expect(document.activeElement).toBe(trigger);
    expect(blurActiveElementMatching(".widget-trigger")).toBe(true);
    expect(document.activeElement).not.toBe(trigger);
  });

  it("leaves unrelated focus in place", () => {
    document.body.innerHTML =
      '<button class="search-trigger" type="button">Search</button>';
    const trigger = document.querySelector(".search-trigger") as HTMLElement;
    trigger.focus();

    expect(blurActiveElementMatching(".widget-trigger")).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });
});
