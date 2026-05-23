// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ItabPomodoroOpenedPanel from "./ItabPomodoroOpenedPanel.vue";
import { ITAB_POMODORO_WIDGET_TYPE } from "./itabPomodoroTypes";

class FakeAudio {
  loop = false;
  preload = "";
  volume = 0;
  src = "";
  currentTime = 0;

  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  load = vi.fn();
}

const widget = {
  id: "pomodoro-opened-panel",
  type: ITAB_POMODORO_WIDGET_TYPE,
  enable: true,
  isPublic: true,
  data: {
    runtime: "itab-pomodoro",
    version: 1,
    sizeKey: "2x2",
    duration: 1500,
    remainingSeconds: 1500,
    phase: "idle",
    isRunning: false,
    sessions: 0,
    themeIndex: 0,
    audioEnabled: true,
  },
};

describe("ItabPomodoroOpenedPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.stubGlobal("Audio", FakeAudio);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("renders opened timer panel with stable runtime attributes", () => {
    const wrapper = mount(ItabPomodoroOpenedPanel, {
      props: { widget },
    });

    expect(wrapper.attributes("data-itab-pomodoro-opened-panel")).toBe("");
    expect(wrapper.attributes("data-tomato-running")).toBe("false");
    expect(wrapper.text()).toContain("25:00");
    expect(wrapper.text()).toContain("海浪");
    wrapper.unmount();
  });
});
