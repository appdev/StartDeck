// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SdPomodoroWidget from "./SdPomodoroWidget.vue";
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

const createWidget = (id: string) => ({
  id,
  type: SD_POMODORO_WIDGET_TYPE,
  enable: true,
  isPublic: true,
  data: {
    runtime: "sd-pomodoro",
    version: 1,
    sizeKey: "2x4",
    duration: 1500,
    remainingSeconds: 1500,
    phase: "idle",
    isRunning: false,
    sessions: 0,
    themeIndex: 0,
    audioEnabled: true,
  },
});

describe("pomodoro widget", () => {
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

  it.each([
    ["1x1", "25:00"],
    ["1x2", "25:00"],
    ["2x1", "2500"],
    ["2x2", "25:00"],
    ["2x4", "25:00"],
  ] as const)("renders source timer content for %s", (sizeKey, text) => {
    const wrapper = mount(SdPomodoroWidget, {
      props: {
        widget: createWidget(`pomodoro-render-${sizeKey}`),
        sizeKey,
      },
    });

    expect(wrapper.attributes("data-sd-pomodoro-size")).toBe(sizeKey);
    expect(wrapper.text()).toContain(text);
    expect(wrapper.find("img").attributes("src")).toContain(
      "/sd/widget/tomato/hailang.jpg",
    );
    wrapper.unmount();
  });

  it("emits canonical running state when the timer starts", async () => {
    const wrapper = mount(SdPomodoroWidget, {
      props: {
        widget: createWidget("pomodoro-start"),
        sizeKey: "2x4",
      },
    });

    await wrapper.find(".tomato-outer-control-primary").trigger("click");

    const emitted = wrapper.emitted("updateData")?.at(-1)?.[0] as {
      phase: string;
      isRunning: boolean;
      remainingSeconds: number;
      sizeKey: string;
    };
    expect(emitted).toMatchObject({
      phase: "focus",
      isRunning: true,
      remainingSeconds: 1500,
      sizeKey: "2x4",
    });
    expect(wrapper.attributes("data-tomato-running")).toBe("true");
    wrapper.unmount();
  });

  it("switches 2x4 background theme through local controls", async () => {
    const wrapper = mount(SdPomodoroWidget, {
      props: {
        widget: createWidget("pomodoro-theme"),
        sizeKey: "2x4",
      },
    });

    await wrapper.findAll(".tomato-switch-action")[1]!.trigger("click");

    const emitted = wrapper.emitted("updateData")?.at(-1)?.[0] as {
      themeIndex: number;
    };
    expect(emitted.themeIndex).toBe(1);
    expect(wrapper.text()).toContain("篝火");
    wrapper.unmount();
  });
});
