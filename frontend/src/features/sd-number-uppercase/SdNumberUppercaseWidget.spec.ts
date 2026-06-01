// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SdNumberUppercaseWidget from "./SdNumberUppercaseWidget.vue";
import { createDefaultSdNumberUppercaseWidget } from "./sdNumberUppercaseModel";

describe("number uppercase widget", () => {
  it("renders mTab amount cards and derives missing 1x2/2x1 from the 1x1 icon", () => {
    for (const sizeKey of ["1x1", "1x2", "2x1", "2x2", "2x4"] as const) {
      const wrapper = mount(SdNumberUppercaseWidget, {
        props: {
          widget: createDefaultSdNumberUppercaseWidget(),
          sizeKey,
        },
      });

      expect(wrapper.attributes("data-sd-number-uppercase-size")).toBe(
        sizeKey,
      );
      expect(wrapper.find(".number-uppercase-card").exists()).toBe(true);
      if (["1x1", "1x2", "2x1"].includes(sizeKey)) {
        expect(wrapper.find(".number-uppercase-icon-tile").exists()).toBe(true);
        expect(wrapper.find(".number-uppercase-icon-symbol").text()).toBe("¥");
        expect(
          wrapper
            .find(".number-uppercase-card")
            .attributes("data-mtab-derived-size"),
        ).toBe("1x1-centered");
      } else {
        expect(wrapper.text()).toContain("¥ 1234.56");
        expect(wrapper.text()).toContain("金额换算 | Amount Conversion");
      }
    }
  });
});
