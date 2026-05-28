// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import AppWindowBar from "@/components/base/AppWindowBar.vue";

const mainCssSource = readFileSync("src/assets/main.css", "utf8");

let wrapper: VueWrapper | null = null;

const mountBar = (props: Record<string, unknown> = {}) => {
  wrapper = mount(AppWindowBar, {
    props: {
      title: "Appearance and Wallpaper",
      subtitle: "Shared title bar contract",
      showClose: true,
      ...props,
    },
  });
  return wrapper;
};

describe("AppWindowBar", () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = "";
  });

  it("uses only the left macOS close control instead of a trailing close button when traffic lights are enabled", async () => {
    const bar = mountBar({ showTrafficLights: true });

    expect(bar.find(".sd-window-traffic-button.is-danger").exists()).toBe(true);
    expect(bar.find(".sd-window-traffic-dot.is-warning").exists()).toBe(false);
    expect(bar.find(".sd-window-traffic-dot.is-success").exists()).toBe(false);
    expect(
      bar.find(".sd-window-bar-edge.is-trailing [aria-label='关闭']").exists(),
    ).toBe(false);

    await bar.find(".sd-window-traffic-button.is-danger").trigger("click");

    expect(bar.emitted("close")).toEqual([[]]);
  });

  it("renders the trailing close button for ordinary dialogs", async () => {
    const bar = mountBar({ showTrafficLights: false });

    expect(bar.find(".sd-window-traffic-button").exists()).toBe(false);
    expect(bar.find(".sd-window-title-layer").exists()).toBe(true);
    expect(bar.find(".sd-window-controls").exists()).toBe(true);
    expect(bar.find(".sd-window-control-dot.is-green").exists()).toBe(true);
    expect(
      bar.find(".sd-window-control-dot.is-red[aria-label='关闭']").exists(),
    ).toBe(true);

    await bar.find(".sd-window-control-dot.is-red").trigger("click");

    expect(bar.emitted("close")).toEqual([[]]);
  });

  it("caps centered title padding relative to the window width", () => {
    expect(mainCssSource).toContain("padding-inline: min(6rem, 20%)");
  });
});
