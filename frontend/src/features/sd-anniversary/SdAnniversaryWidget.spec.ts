// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SdAnniversaryWidget from "./SdAnniversaryWidget.vue";
import { createDefaultSdAnniversaryWidget } from "./sdAnniversaryModel";
import { anniversaryTemplates } from "./useSdAnniversaryRuntime";

describe("anniversary widget", () => {
  it.each(["1x1", "1x2", "2x1", "2x2", "2x4"] as const)(
    "renders empty anniversary content for %s when no event data exists",
    (sizeKey) => {
      const wrapper = mount(SdAnniversaryWidget, {
        props: {
          widget: createDefaultSdAnniversaryWidget(),
          sizeKey,
        },
      });

      expect(wrapper.attributes("data-sd-anniversary-size")).toBe(sizeKey);
      expect(wrapper.text()).toBe("");
      expect(wrapper.find(".anniversary-card-copy").exists()).toBe(false);
      expect(
        wrapper.find("[data-sd-anniversary-card-size]").attributes(),
      ).toEqual(
        expect.objectContaining({
          "data-sd-anniversary-card-size": sizeKey,
        }),
      );
      wrapper.unmount();
    },
  );

  it("renders the payday template without a date suffix", () => {
    const widget = createDefaultSdAnniversaryWidget();
    widget.data = anniversaryTemplates.find((item) => item.id === "payday");

    const wrapper = mount(SdAnniversaryWidget, {
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
    const widget = createDefaultSdAnniversaryWidget();
    widget.data = {
      ...(widget.data as Record<string, unknown>),
      backgroundMode: "image",
      backgroundImage: "/sd-live-assets/anniversary/yiyan-25.webp",
      mask: 0,
    };

    const wrapper = mount(SdAnniversaryWidget, {
      props: {
        widget,
        sizeKey: "2x2",
      },
    });

    const style = wrapper
      .find("[data-sd-anniversary-card-size]")
      .attributes("style");
    expect(style).toContain(
      '--anniversary-image: url("/sd-live-assets/anniversary/yiyan-25.webp")',
    );
    expect(style).toContain("--anniversary-mask: 0");
    wrapper.unmount();
  });

  it("keeps payday image backgrounds on the card instead of falling back to solid surface", () => {
    const widget = createDefaultSdAnniversaryWidget();
    const paydayTemplate = anniversaryTemplates.find(
      (item) => item.id === "payday",
    );
    expect(paydayTemplate).toBeTruthy();
    widget.data = {
      ...paydayTemplate!,
      backgroundMode: "image",
      backgroundImage: "/sd-live-assets/anniversary/yiyan-8.webp",
      mask: 0,
    };

    const wrapper = mount(SdAnniversaryWidget, {
      props: {
        widget,
        sizeKey: "2x2",
      },
    });

    const card = wrapper.find("[data-sd-anniversary-card-size]");
    expect(card.classes()).toContain("is-payday");
    expect(card.classes()).toContain("has-image-background");
    expect(card.attributes("style")).toContain(
      '--anniversary-background-image: url("/sd-live-assets/anniversary/yiyan-8.webp")',
    );
    wrapper.unmount();
  });

  it("uses the selected color background on the outer card", () => {
    const widget = createDefaultSdAnniversaryWidget();
    widget.data = {
      ...(widget.data as Record<string, unknown>),
      backgroundMode: "color",
      backgroundColor: "#fc4548",
    };

    const wrapper = mount(SdAnniversaryWidget, {
      props: {
        widget,
        sizeKey: "2x2",
      },
    });

    const style = wrapper
      .find("[data-sd-anniversary-card-size]")
      .attributes("style");
    expect(style).toContain("--anniversary-bg: #fc4548");
    expect(style).toContain("--anniversary-image: none");
    wrapper.unmount();
  });

  it.each(["1x1", "1x2", "2x1", "2x2", "2x4"] as const)(
    "uses selected color background on countdown cards for %s",
    (sizeKey) => {
      const widget = createDefaultSdAnniversaryWidget();
      const paydayTemplate = anniversaryTemplates.find(
        (item) => item.id === "payday",
      );
      expect(paydayTemplate).toBeTruthy();
      widget.data = {
        ...paydayTemplate!,
        backgroundMode: "color",
        backgroundColor: "#fc4548",
      };

      const wrapper = mount(SdAnniversaryWidget, {
        props: {
          widget,
          sizeKey,
        },
      });

      const card = wrapper.find("[data-sd-anniversary-card-size]");
      expect(card.classes()).toContain("is-payday");
      expect(card.classes()).not.toContain("has-image-background");
      expect(card.attributes("style")).toContain("--anniversary-bg: #fc4548");
      expect(card.attributes("style")).toContain("--anniversary-image: none");
      wrapper.unmount();
    },
  );

  it("does not render a local synthetic list for 2x4 non-calendar templates", () => {
    const widget = createDefaultSdAnniversaryWidget();
    widget.data = anniversaryTemplates.find((item) => item.id === "love");

    const wrapper = mount(SdAnniversaryWidget, {
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
