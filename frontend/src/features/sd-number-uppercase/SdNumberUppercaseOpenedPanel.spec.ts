// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SdNumberUppercaseOpenedPanel from "./SdNumberUppercaseOpenedPanel.vue";
import { createDefaultSdNumberUppercaseWidget } from "./sdNumberUppercaseModel";
import { SD_NUMBER_UPPERCASE_RUNTIME } from "./sdNumberUppercaseTypes";

describe("number uppercase opened panel", () => {
  it("computes and persists uppercase results from user input", async () => {
    const wrapper = mount(SdNumberUppercaseOpenedPanel, {
      props: {
        widget: createDefaultSdNumberUppercaseWidget(),
      },
    });

    await wrapper.find("input").setValue("1024");

    expect(wrapper.text()).toContain("壹仟零贰拾肆元整");
    expect(wrapper.attributes("data-sd-number-uppercase-result")).toBe(
      "壹仟零贰拾肆元整",
    );
    expect(wrapper.emitted("updateData")?.at(-1)?.[0]).toMatchObject({
      runtime: SD_NUMBER_UPPERCASE_RUNTIME,
      inputNumber: "1024",
      uppercaseResult: "壹仟零贰拾肆元整",
      formatMode: "currency",
    });
  });

  it("renders the source opened panel structure and placeholder state", () => {
    const wrapper = mount(SdNumberUppercaseOpenedPanel, {
      props: {
        widget: createDefaultSdNumberUppercaseWidget(),
      },
    });

    expect(wrapper.find("input").attributes("placeholder")).toBe(
      "请输入金额数值",
    );
    expect(wrapper.find(".amount-conversion-result").text()).toBe(
      "转换结果将显示在这里",
    );
    expect(wrapper.text()).toContain("大写数字与单位参考");
    expect(wrapper.findAll(".amount-conversion-character-item")).toHaveLength(
      20,
    );
  });
});
