// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ItabAnniversaryWidget from "./ItabAnniversaryWidget.vue";
import { createDefaultItabAnniversaryWidget } from "./itabAnniversaryModel";
import { anniversaryTemplates } from "./useItabAnniversaryRuntime";

describe("ItabAnniversaryWidget", () => {
  it.each(["1x1", "1x2", "2x1", "2x2", "2x4"] as const)(
    "renders source-sized anniversary content for %s",
    (sizeKey) => {
      const wrapper = mount(ItabAnniversaryWidget, {
        props: {
          widget: createDefaultItabAnniversaryWidget(),
          sizeKey,
        },
      });

      expect(wrapper.attributes("data-itab-anniversary-size")).toBe(sizeKey);
      expect(wrapper.text()).toContain("你在世界已经");
      expect(
        wrapper.find("[data-itab-anniversary-card-size]").attributes(),
      ).toEqual(
        expect.objectContaining({
          "data-itab-anniversary-card-size": sizeKey,
        }),
      );
      wrapper.unmount();
    },
  );

  it("renders the payday template without a date suffix", () => {
    const widget = createDefaultItabAnniversaryWidget();
    widget.data = anniversaryTemplates.find((item) => item.id === "payday");

    const wrapper = mount(ItabAnniversaryWidget, {
      props: {
        widget,
        sizeKey: "2x2",
      },
    });

    expect(wrapper.text()).toContain("发工资还有");
    expect(wrapper.text()).not.toContain("2023-12-01");
    expect(wrapper.find(".is-payday").exists()).toBe(true);
    wrapper.unmount();
  });

  it("uses the selected image background on the outer card", () => {
    const widget = createDefaultItabAnniversaryWidget();
    widget.data = {
      ...(widget.data as Record<string, unknown>),
      backgroundMode: "image",
      backgroundImage: "/itab-live-assets/anniversary/yiyan-25.webp",
      mask: 0,
    };

    const wrapper = mount(ItabAnniversaryWidget, {
      props: {
        widget,
        sizeKey: "2x2",
      },
    });

    const style = wrapper
      .find("[data-itab-anniversary-card-size]")
      .attributes("style");
    expect(style).toContain(
      '--anniversary-image: url("/itab-live-assets/anniversary/yiyan-25.webp")',
    );
    expect(style).toContain("--anniversary-mask: 0");
    wrapper.unmount();
  });

  it("keeps payday image backgrounds on the card instead of falling back to solid surface", () => {
    const widget = createDefaultItabAnniversaryWidget();
    const paydayTemplate = anniversaryTemplates.find(
      (item) => item.id === "payday",
    );
    expect(paydayTemplate).toBeTruthy();
    widget.data = {
      ...paydayTemplate!,
      backgroundMode: "image",
      backgroundImage: "/itab-live-assets/anniversary/yiyan-8.webp",
      mask: 0,
    };

    const wrapper = mount(ItabAnniversaryWidget, {
      props: {
        widget,
        sizeKey: "2x2",
      },
    });

    const card = wrapper.find("[data-itab-anniversary-card-size]");
    expect(card.classes()).toContain("is-payday");
    expect(card.classes()).toContain("has-image-background");
    expect(card.attributes("style")).toContain(
      '--anniversary-background-image: url("/itab-live-assets/anniversary/yiyan-8.webp")',
    );
    wrapper.unmount();
  });

  it("uses the selected color background on the outer card", () => {
    const widget = createDefaultItabAnniversaryWidget();
    widget.data = {
      ...(widget.data as Record<string, unknown>),
      backgroundMode: "color",
      backgroundColor: "#fc4548",
    };

    const wrapper = mount(ItabAnniversaryWidget, {
      props: {
        widget,
        sizeKey: "2x2",
      },
    });

    const style = wrapper
      .find("[data-itab-anniversary-card-size]")
      .attributes("style");
    expect(style).toContain("--anniversary-bg: #fc4548");
    expect(style).toContain("--anniversary-image: none");
    wrapper.unmount();
  });

  it.each(["1x1", "1x2", "2x1", "2x2", "2x4"] as const)(
    "uses selected color background on countdown cards for %s",
    (sizeKey) => {
      const widget = createDefaultItabAnniversaryWidget();
      const paydayTemplate = anniversaryTemplates.find(
        (item) => item.id === "payday",
      );
      expect(paydayTemplate).toBeTruthy();
      widget.data = {
        ...paydayTemplate!,
        backgroundMode: "color",
        backgroundColor: "#fc4548",
      };

      const wrapper = mount(ItabAnniversaryWidget, {
        props: {
          widget,
          sizeKey,
        },
      });

      const card = wrapper.find("[data-itab-anniversary-card-size]");
      expect(card.classes()).toContain("is-payday");
      expect(card.classes()).not.toContain("has-image-background");
      expect(card.attributes("style")).toContain("--anniversary-bg: #fc4548");
      expect(card.attributes("style")).toContain("--anniversary-image: none");
      wrapper.unmount();
    },
  );

  it("does not render a local synthetic list for 2x4 non-calendar templates", () => {
    const widget = createDefaultItabAnniversaryWidget();
    widget.data = anniversaryTemplates.find((item) => item.id === "love");

    const wrapper = mount(ItabAnniversaryWidget, {
      props: {
        widget,
        sizeKey: "2x4",
      },
    });

    expect(wrapper.text()).toContain("和她❤️恋爱已经");
    expect(wrapper.text()).not.toContain("发工资还有");
    expect(wrapper.find(".anniversary-wide-list").exists()).toBe(false);
    wrapper.unmount();
  });
});
