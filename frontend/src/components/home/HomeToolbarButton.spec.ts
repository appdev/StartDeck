// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HomeToolbarButton from "./HomeToolbarButton.vue";

describe("HomeToolbarButton", () => {
  it("emits clicks and applies the shared toolbar button variant", async () => {
    const wrapper = mount(HomeToolbarButton, {
      props: {
        variant: "danger",
      },
      slots: {
        default: "退出",
      },
    });

    expect(wrapper.classes()).toContain("sd-home-toolbar-button");
    expect(wrapper.classes()).toContain("is-danger");

    await wrapper.trigger("click");

    expect(wrapper.emitted("click")).toHaveLength(1);
  });

  it("disables the shared toolbar button while busy", () => {
    const wrapper = mount(HomeToolbarButton, {
      props: {
        busy: true,
      },
      slots: {
        default: "保存中...",
      },
    });

    expect(wrapper.attributes("aria-busy")).toBe("true");
    expect(wrapper.attributes("disabled")).toBeDefined();
  });
});
