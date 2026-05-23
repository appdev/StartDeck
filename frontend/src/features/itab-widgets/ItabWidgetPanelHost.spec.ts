// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import type { WidgetConfig } from "@/types";
import ItabWidgetPanelHost from "./ItabWidgetPanelHost.vue";

const movieWidget: WidgetConfig = {
  id: "movie-calendar",
  type: "itab-movie-calendar-05",
  enable: true,
  isPublic: false,
  w: 2,
  h: 2,
};

describe("ItabWidgetPanelHost", () => {
  afterEach(() => {
    document.documentElement.classList.remove("itab-panel-open");
    document.body.innerHTML = "";
  });

  it("renders movie calendar with a movie-specific opened panel", () => {
    const wrapper = mount(ItabWidgetPanelHost, {
      props: {
        widget: movieWidget,
        visualMode: "dom-native",
        dataMode: "fixture",
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    });

    expect(wrapper.find(".movie-calendar-panel").exists()).toBe(true);
    expect(wrapper.find(".reader-panel").exists()).toBe(false);
    expect(wrapper.text()).toContain("影");
    expect(wrapper.text()).toContain("豆瓣 7.2");
    expect(wrapper.text()).toContain("导演：张艺谋");
    expect(wrapper.text()).toContain("查看电影源→");
  });
});
