// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultSdCalendarWidget } from "./sdCalendarModel";
import SdCalendarOpenedPanel from "./SdCalendarOpenedPanel.vue";

const mountPanel = () =>
  mount(SdCalendarOpenedPanel, {
    props: {
      widget: createDefaultSdCalendarWidget(),
    },
  });

describe("calendar opened panel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 20, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the selected day detail and fixed month grid", () => {
    const wrapper = mountPanel();

    expect(wrapper.attributes("data-sd-calendar-selected-date")).toBe(
      "2026-05-20",
    );
    expect(wrapper.text()).toContain("2026-05-20 周三");
    expect(wrapper.text()).toContain("二〇二六年四月初四");
    expect(wrapper.text()).toContain("本年第21周， 第140天");
    expect(wrapper.findAll(".day-cell")).toHaveLength(42);
    expect(wrapper.find(".day-cell.today").text()).toContain("20");
  });

  it("switches months and selects a solar term day", async () => {
    const wrapper = mountPanel();
    const nextMonthButton = wrapper.find("[aria-label='下个月']");

    await nextMonthButton.trigger("click");

    expect(wrapper.attributes("data-sd-calendar-view-month")).toBe("2026-06");
    expect(wrapper.attributes("data-sd-calendar-selected-date")).toBe(
      "2026-06-01",
    );
    expect(wrapper.text()).toContain("2026-06-01 周一");

    const previousMonthButton = wrapper.find("[aria-label='上个月']");
    await previousMonthButton.trigger("click");
    expect(wrapper.attributes("data-sd-calendar-selected-date")).toBe(
      "2026-05-01",
    );

    const xiaoman = wrapper
      .findAll(".day-cell")
      .find(
        (cell) => cell.text().includes("21") && cell.text().includes("小满"),
      );

    expect(xiaoman).toBeTruthy();
    await xiaoman!.trigger("click");

    expect(wrapper.attributes("data-sd-calendar-selected-date")).toBe(
      "2026-05-21",
    );
    expect(wrapper.text()).toContain("2026-05-21 周四");
    expect(wrapper.text()).toContain("节日小满");
  });

  it("keeps the current month visible when selecting an adjacent-month cell", async () => {
    const wrapper = mountPanel();
    const juneFirst = wrapper
      .findAll(".day-cell")
      .find(
        (cell) =>
          cell.classes().includes("muted") && cell.text().includes("01"),
      );

    expect(juneFirst).toBeTruthy();
    await juneFirst!.trigger("click");

    expect(wrapper.attributes("data-sd-calendar-view-month")).toBe("2026-05");
    expect(wrapper.attributes("data-sd-calendar-selected-date")).toBe(
      "2026-06-01",
    );
    expect(wrapper.text()).toContain("2026-06-01 周一");
  });

  it("switches week start through the toolbar control", async () => {
    const wrapper = mountPanel();
    const switchButton = wrapper.find("[title='一周开始日']");

    expect(wrapper.find(".weekday-row").text()).toContain("一二三四五六日");
    expect(wrapper.findAll(".day-cell")[0]?.text()).toContain("27");
    expect(switchButton.attributes("aria-checked")).toBe("true");

    await switchButton.trigger("click");

    expect(switchButton.attributes("aria-checked")).toBe("false");
    expect(wrapper.find(".weekday-row").text()).toContain("日一二三四五六");
    expect(wrapper.findAll(".day-cell")[0]?.text()).toContain("26");
  });

  it("shows the today shortcut after navigating away and jumps back to today", async () => {
    const wrapper = mountPanel();
    const nextMonthButton = wrapper.find("[aria-label='下个月']");
    const todayButton = wrapper.find("[title='今天']");

    expect(todayButton.classes()).not.toContain("active");
    expect(todayButton.attributes("aria-hidden")).toBe("true");

    await nextMonthButton.trigger("click");

    expect(wrapper.attributes("data-sd-calendar-selected-date")).toBe(
      "2026-06-01",
    );
    expect(todayButton.classes()).toContain("active");
    expect(todayButton.attributes("aria-hidden")).toBe("false");

    await todayButton.trigger("click");

    expect(wrapper.attributes("data-sd-calendar-view-month")).toBe("2026-05");
    expect(wrapper.attributes("data-sd-calendar-selected-date")).toBe(
      "2026-05-20",
    );
    expect(todayButton.classes()).not.toContain("active");
    expect(todayButton.attributes("aria-hidden")).toBe("true");
  });

  it("opens year and month pickers from the toolbar", async () => {
    const wrapper = mountPanel();
    const yearButton = wrapper.find("[aria-label='选择年份']");
    const monthButton = wrapper.find("[aria-label='选择月份']");

    await yearButton.trigger("click");
    expect(yearButton.attributes("aria-expanded")).toBe("true");
    expect(wrapper.find("[role='listbox'][aria-label='年份']").exists()).toBe(
      true,
    );

    const year2027 = wrapper
      .findAll("[role='option']")
      .find((option) => option.text() === "2027");
    expect(year2027).toBeTruthy();
    await year2027!.trigger("click");

    expect(wrapper.attributes("data-sd-calendar-view-month")).toBe("2027-05");
    expect(wrapper.attributes("data-sd-calendar-selected-date")).toBe(
      "2027-05-01",
    );
    expect(wrapper.find("[role='listbox'][aria-label='年份']").exists()).toBe(
      false,
    );

    await monthButton.trigger("click");
    expect(monthButton.attributes("aria-expanded")).toBe("true");
    expect(wrapper.find("[role='listbox'][aria-label='月份']").exists()).toBe(
      true,
    );

    const month12 = wrapper
      .findAll("[role='option']")
      .find((option) => option.text() === "12");
    expect(month12).toBeTruthy();
    await month12!.trigger("click");

    expect(wrapper.attributes("data-sd-calendar-view-month")).toBe("2027-12");
    expect(wrapper.attributes("data-sd-calendar-selected-date")).toBe(
      "2027-12-01",
    );
  });

  it("opens tools, calculates dates, workdays, and festival details", async () => {
    const wrapper = mountPanel();
    const toolsTab = wrapper
      .findAll("[role='tab']")
      .find((tab) => tab.text() === "工具");

    expect(toolsTab).toBeTruthy();
    await toolsTab!.trigger("click");

    expect(wrapper.find("[data-sd-calendar-tools-panel]").exists()).toBe(
      true,
    );
    expect(wrapper.text()).toContain("日期差计算");
    expect(wrapper.text()).toContain("工作日计算");
    expect(wrapper.text()).toContain("节日大全");

    const dateInputs = wrapper.findAll("input[type='date']");
    await dateInputs[1]!.setValue("2026-06-01");
    expect(wrapper.text()).toContain("12");
    expect(wrapper.text()).toContain("含首尾 13 天");

    const workdayAmount = wrapper.find("input[type='number']");
    await workdayAmount.setValue(3);
    expect(wrapper.text()).toContain("2026-05-25 周一");

    const childFestival = wrapper
      .findAll(".festival-row")
      .find((row) => row.text().includes("儿童节"));
    expect(childFestival).toBeTruthy();
    await childFestival!.trigger("click");

    expect(wrapper.attributes("data-sd-calendar-selected-date")).toBe(
      "2026-06-01",
    );
    expect(wrapper.text()).toContain("节日儿童节");
  });

  it("keeps selected and hover date borders readable in the dark opened panel", () => {
    const cwd = process.cwd();
    const repoRoot =
      cwd.endsWith("/frontend") || cwd.endsWith("\\frontend")
        ? resolve(cwd, "..")
        : cwd;
    const source = readFileSync(
      resolve(repoRoot, "frontend/src/assets/main.css"),
      "utf8",
    );
    const shadow04Declarations = Array.from(
      source.matchAll(
        /--sd-theme-calendar-calendar-opened-panel-shadow-04:\s*([^;]+);/g,
      ),
      (match) => (match[1] ?? "").replace(/\s+/g, " ").trim(),
    );
    const shadow08Declarations = Array.from(
      source.matchAll(
        /--sd-theme-calendar-calendar-opened-panel-shadow-08:\s*([^;]+);/g,
      ),
      (match) => (match[1] ?? "").replace(/\s+/g, " ").trim(),
    );
    const darkShadow04Declaration = shadow04Declarations.at(-1);
    const darkShadow08Declaration = shadow08Declarations.at(-1);
    const panelSource = readFileSync(
      resolve(
        repoRoot,
        "frontend/src/features/sd-calendar/SdCalendarOpenedPanel.vue",
      ),
      "utf8",
    );

    expect(shadow04Declarations).toContain("rgba(0, 0, 0, 0.2)");
    expect(darkShadow04Declaration).toBe(
      "color-mix( in srgb, var(--sd-component-text-primary) 22%, transparent )",
    );
    expect(shadow08Declarations).toContain("rgba(0, 0, 0, 0.16)");
    expect(darkShadow08Declaration).toBe(
      "color-mix( in srgb, var(--sd-component-text-primary) 16%, transparent )",
    );
    expect(panelSource).toContain(".day-cell:hover:not(.today):not(.selected)");
    expect(panelSource).toContain(
      "var(--sd-theme-calendar-calendar-opened-panel-shadow-08)",
    );
  });
});
