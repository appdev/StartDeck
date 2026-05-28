// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ItabIpWidget from "./ItabIpWidget.vue";
import { createDefaultItabIpWidget } from "./itabIpModel";
import { fetchItabIpLatency, fetchItabIpLookup } from "./itabIpApi";
import { resetItabIpRuntimeForTests } from "./useItabIpRuntime";

vi.mock("./itabIpApi", () => ({
  fetchItabIpLookup: vi.fn(async () => ({
    ip: "163.125.214.27",
    location: "中国 广东省 深圳 龙华",
    country: "中国",
    region: "广东省",
    adm2: "深圳",
    city: "龙华",
    district: "龙华",
    isp: "",
    queryIp: "163.125.214.27",
    clientIp: "",
    clientIpSource: "",
    weatherLocationId: "101280608",
    weatherLocationType: "city",
    latitude: "22.696667",
    longitude: "114.045422",
    coordinateSource: "codelife-getLocation",
    coordinateAccuracy: "ip-geolocation",
    updatedAt: "2026/05/24 01:40",
    cached: false,
    sourceStatus: "ok",
  })),
  fetchItabIpLatency: vi.fn(async () => ({
    latencyMs: 24.2,
    checkedAt: "2026/05/24 01:40",
    serverTs: 1780000000000,
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
      await nextTickCycle();

      expect(wrapper.attributes("data-itab-ip-size")).toBe(sizeKey);
      expect(wrapper.attributes("data-itab-ip-address")).toBe("163.125.214.27");
      expect(wrapper.attributes("data-itab-ip-location")).toBe(
        "广东省深圳市龙华",
      );
      if (sizeKey === "2x2" || sizeKey === "2x4") {
        expect(wrapper.text()).toContain("163.125.214.27");
        expect(wrapper.text()).toContain("广东省深圳市龙华");
        expect(wrapper.text()).toContain("延迟 24 ms");
        expect(fetchItabIpLatency).toHaveBeenCalledTimes(1);
      } else {
        expect(wrapper.text()).not.toContain("163.125.214.27");
        expect(wrapper.text()).not.toContain("延迟");
        expect(wrapper.find("img").attributes("src")).toBe(
          "/itab-live-assets/ip.svg",
        );
        expect(fetchItabIpLatency).not.toHaveBeenCalled();
      }

      wrapper.unmount();
      resetItabIpRuntimeForTests();
      vi.clearAllMocks();
    }
  });

  it("refreshes through the runtime token contract without bypassing the IP cache", async () => {
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
      false,
      expect.any(AbortSignal),
    );
  });

  it("auto-refreshes visible latency every five minutes and stops after unmount", async () => {
    vi.useFakeTimers();
    try {
      const wrapper = mount(ItabIpWidget, {
        props: {
          widget: createDefaultItabIpWidget(),
          sizeKey: "2x2",
        },
      });

      await flushPromises();
      await flushPromises();
      expect(fetchItabIpLatency).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(fetchItabIpLatency).toHaveBeenCalledTimes(2);

      wrapper.unmount();
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(fetchItabIpLatency).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
