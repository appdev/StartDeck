// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultItabCalendarWidget } from "./itabCalendarModel";
import ItabCalendarWidget from "./ItabCalendarWidget.vue";
import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";

const mountWidget = (sizeKey: ItabWidgetSizeKey) =>
  mount(ItabCalendarWidget, {
    props: {
      widget: createDefaultItabCalendarWidget(),
      sizeKey,
    },
  });

describe("ItabCalendarWidget", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 20, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["1x1", "周三20"],
    ["1x2", "5/20周三"],
    ["2x1", "2026/520周三"],
    ["2x2", "2026年5月20第140天 第21周四月初四 周三"],
    ["2x4", "2026年5月20第140天 第21周四月初四 周三"],
  ] as const)("renders source calendar outer text for %s", (sizeKey, text) => {
    const wrapper = mountWidget(sizeKey);

    expect(wrapper.attributes("data-itab-calendar-size")).toBe(sizeKey);
    expect(wrapper.attributes("data-itab-calendar-date")).toBe("2026-05-20");
    expect(wrapper.text()).toContain(text);
  });

  it("renders the 2x4 month grid with all six visible weeks", () => {
    const wrapper = mountWidget("2x4");

    expect(wrapper.findAll(".mini-week")).toHaveLength(7);
    expect(wrapper.findAll(".mini-day")).toHaveLength(42);
    expect(wrapper.find(".mini-day.today").text()).toBe("20");
  });

  it("keeps lunar text readable on the dark calendar card", () => {
    const cwd = process.cwd();
    const repoRoot =
      cwd.endsWith("/frontend") || cwd.endsWith("\\frontend")
        ? resolve(cwd, "..")
        : cwd;
    const source = readFileSync(
      resolve(repoRoot, "frontend/src/assets/main.css"),
      "utf8",
    );

    expect(source).toContain(
      "--sd-theme-itab-calendar-calendar-widget-text-05: #999;",
    );
    expect(source).not.toContain(
      "--sd-theme-itab-calendar-calendar-widget-text-05: rgba(0, 0, 0, 0.8);",
    );
  });
});
