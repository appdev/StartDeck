// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SdPomodoroOpenedPanel from "./SdPomodoroOpenedPanel.vue";
import { SD_POMODORO_WIDGET_TYPE } from "./sdPomodoroTypes";

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
  type: SD_POMODORO_WIDGET_TYPE,
  enable: true,
  isPublic: true,
  data: {
    runtime: "sd-pomodoro",
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

describe("pomodoro opened panel", () => {
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
    const wrapper = mount(SdPomodoroOpenedPanel, {
      props: { widget },
    });

    expect(wrapper.attributes("data-sd-pomodoro-opened-panel")).toBe("");
    expect(wrapper.attributes("data-tomato-running")).toBe("false");
    expect(wrapper.text()).toContain("25:00");
    expect(wrapper.text()).toContain("海浪");
    wrapper.unmount();
  });
});
