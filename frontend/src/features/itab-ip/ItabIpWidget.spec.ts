// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ItabIpWidget from "./ItabIpWidget.vue";
import { createDefaultItabIpWidget } from "./itabIpModel";
import { fetchItabIpLookup } from "./itabIpApi";
import { resetItabIpRuntimeForTests } from "./useItabIpRuntime";

vi.mock("./itabIpApi", () => ({
  fetchItabIpLookup: vi.fn(async () => ({
    ip: "163.125.214.27",
    location: "中国 广东 深圳 中国联通",
    country: "中国",
    region: "广东",
    city: "深圳",
    isp: "中国联通",
    queryIp: "163.125.214.27",
    clientIp: "",
    clientIpSource: "",
    latitude: "22.696667",
    longitude: "114.045422",
    updatedAt: "2026/05/24 01:40",
    cached: false,
    sourceStatus: "ok",
  })),
}));

const nextTickCycle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ItabIpWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetItabIpRuntimeForTests();
  });

  it("renders compact sizes as icon-only and large sizes with live IP/location", async () => {
    for (const sizeKey of ["1x1", "1x2", "2x1", "2x2", "2x4"] as const) {
      const wrapper = mount(ItabIpWidget, {
        props: {
          widget: createDefaultItabIpWidget(),
          sizeKey,
        },
      });

      await nextTickCycle();

      expect(wrapper.attributes("data-itab-ip-size")).toBe(sizeKey);
      expect(wrapper.attributes("data-itab-ip-address")).toBe("163.125.214.27");
      expect(wrapper.attributes("data-itab-ip-location")).toBe(
        "中国-广东-深圳",
      );
      if (sizeKey === "2x2" || sizeKey === "2x4") {
        expect(wrapper.text()).toContain("163.125.214.27");
        expect(wrapper.text()).toContain("中国-广东-深圳");
      } else {
        expect(wrapper.text()).not.toContain("163.125.214.27");
        expect(wrapper.find("img").attributes("src")).toBe(
          "/itab-live-assets/ip.svg",
        );
      }

      wrapper.unmount();
      resetItabIpRuntimeForTests();
    }
  });

  it("refreshes through the runtime token contract", async () => {
    const wrapper = mount(ItabIpWidget, {
      props: {
        widget: createDefaultItabIpWidget(),
        sizeKey: "2x2",
        refreshToken: 0,
      },
    });

    await nextTickCycle();
    await wrapper.setProps({ refreshToken: 1 });
    await nextTickCycle();

    expect(fetchItabIpLookup).toHaveBeenCalledWith(
      true,
      expect.any(AbortSignal),
    );
  });
});
