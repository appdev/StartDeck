// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ItabClockWidget from "./ItabClockWidget.vue";
import { createDefaultItabClockWidget } from "./itabClockModel";

describe("ItabClockWidget", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T21:09:08+08:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["1x1", "clock-size-1-1", 2, false],
    ["1x2", "clock-size-1-2", 3, false],
    ["2x1", "clock-size-2-1", 2, false],
    ["2x2", "clock-size-2-2", 2, true],
    ["2x4", "clock-size-2-4", 3, true],
  ] as const)(
    "renders the source-sized %s clock branch",
    (sizeKey, sizeClass, timeCount, showsDate) => {
      const wrapper = mount(ItabClockWidget, {
        props: {
          widget: createDefaultItabClockWidget(),
          sizeKey,
        },
      });

      expect(wrapper.attributes("data-itab-clock-size")).toBe(sizeKey);
      expect(wrapper.find(`.${sizeClass}`).exists()).toBe(true);
      expect(wrapper.findAll("time")).toHaveLength(timeCount);
      expect(wrapper.find(".f16").exists()).toBe(showsDate);
      if (showsDate) {
        expect(wrapper.find(".f16").text()).toBe("05/21 周四");
      }
    },
  );

  it("keeps the calibrated 1x2 time group structure", () => {
    const wrapper = mount(ItabClockWidget, {
      props: {
        widget: createDefaultItabClockWidget(),
        sizeKey: "1x2",
      },
    });

    expect(wrapper.find(".size-1-2 .time.countdown").exists()).toBe(true);
    expect(wrapper.findAll(".size-1-2 .time.countdown time")).toHaveLength(3);
    expect(wrapper.findAll(".size-1-2 .time.countdown em")).toHaveLength(2);
  });
});
