// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ItabClockOpenedPanel from "./ItabClockOpenedPanel.vue";
import { createDefaultItabClockWidget } from "./itabClockModel";

describe("ItabClockOpenedPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T21:09:08+08:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the flip-clock dialog and toggles seconds", async () => {
    const wrapper = mount(ItabClockOpenedPanel, {
      props: {
        widget: createDefaultItabClockWidget(),
      },
    });

    expect(wrapper.find(".opened-clock-panel").exists()).toBe(true);
    expect(wrapper.findAll(".scoreboard-digit")).toHaveLength(6);
    expect(
      wrapper
        .findAll(".scoreboard-value")
        .map((item) => item.text())
        .join(""),
    ).toBe("210908");
    expect(wrapper.findAll(".clock-flip-separator")).toHaveLength(2);

    await wrapper.find(".el-switch").trigger("click");

    expect(wrapper.find(".clock-flip-row").classes()).toContain(
      "is-seconds-hidden",
    );
    expect(wrapper.findAll(".scoreboard-digit")).toHaveLength(4);
    expect(wrapper.emitted("updateData")?.[0]?.[0]).toMatchObject({
      runtime: "itab-clock",
      sizeKey: "2x2",
      showSeconds: false,
    });
  });

  it("emits close from the source close button", async () => {
    const wrapper = mount(ItabClockOpenedPanel, {
      props: {
        widget: createDefaultItabClockWidget(),
      },
    });

    await wrapper.find(".close-window").trigger("click");

    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});
