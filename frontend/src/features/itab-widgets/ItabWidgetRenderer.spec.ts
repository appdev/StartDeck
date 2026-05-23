// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ItabWidgetRenderer from "./ItabWidgetRenderer.vue";
import { shouldOpenItabPanel } from "./itabInteraction";

describe("ItabWidgetRenderer", () => {
  it("renders a real iTab body for a scoped size", () => {
    const wrapper = mount(ItabWidgetRenderer, {
      props: {
        type: "itab-calendar-01",
        sizeKey: "2x1",
        preview: true,
      },
    });

    expect(wrapper.find("[data-itab-widget-root]").exists()).toBe(true);
    expect(wrapper.find("[data-size-key='2x1']").exists()).toBe(true);
    expect(wrapper.text()).toContain("20");
    expect(wrapper.text()).not.toContain("placeholder");
  });

  it("keeps movie calendar on captured movie layout instead of quote fallback", () => {
    const wrapper = mount(ItabWidgetRenderer, {
      props: {
        type: "itab-movie-calendar-05",
        sizeKey: "2x2",
        preview: true,
      },
    });

    expect(
      wrapper
        .find("[data-itab-component-id='itab-movie-calendar-05']")
        .exists(),
    ).toBe(true);
    expect(wrapper.find("[data-itab-state='body']").exists()).toBe(true);
    expect(wrapper.find(".quote-symbol").exists()).toBe(false);
    expect(wrapper.text()).toContain("豆瓣");
  });

  it("opens from safe root click and suppresses inner controls", async () => {
    const wrapper = mount(ItabWidgetRenderer, {
      props: {
        type: "itab-wooden-fish-11",
        sizeKey: "2x2",
      },
    });

    await wrapper
      .find("[data-itab-widget-root]")
      .trigger("click", { button: 0 });
    expect(wrapper.emitted("openPanel")).toHaveLength(1);

    const button = document.createElement("button");
    const click = new MouseEvent("click", { bubbles: true, button: 0 });
    Object.defineProperty(click, "target", { value: button });
    expect(shouldOpenItabPanel(click)).toBe(false);
  });

  it("renders clone-skin mode with semantic slots and real root hotspot markers", () => {
    const wrapper = mount(ItabWidgetRenderer, {
      props: {
        type: "itab-weather-00",
        sizeKey: "2x4",
        visualMode: "clone-skin",
        dataMode: "fixture",
        renderMode: "fixture",
      },
    });

    expect(wrapper.find("[data-itab-visual-mode='clone-skin']").exists()).toBe(
      true,
    );
    expect(wrapper.find("[data-itab-data-mode='fixture']").exists()).toBe(true);
    expect(
      wrapper.find("[data-itab-skin-id='itab-weather-00:2x4']").exists(),
    ).toBe(true);
    expect(wrapper.find(".itab-clone-skin-layer").attributes("src")).toBe(
      "/__itab-qa-skins/body/00-2x4.png",
    );
    expect(
      wrapper.findAll("[data-itab-semantic-slot-id]").length,
    ).toBeGreaterThanOrEqual(6);
    expect(wrapper.find("[data-itab-hotspot-id='root-open']").exists()).toBe(
      true,
    );
  });
});
