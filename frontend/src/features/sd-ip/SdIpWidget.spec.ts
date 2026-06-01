// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SdIpWidget from "./SdIpWidget.vue";
import { createDefaultSdIpWidget } from "./sdIpModel";
import { fetchSdIpLatency, fetchSdIpLookup } from "./sdIpApi";
import { resetSdIpRuntimeForTests } from "./useSdIpRuntime";

vi.mock("./sdIpApi", () => ({
  fetchSdIpLookup: vi.fn(async () => ({
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
  fetchSdIpLatency: vi.fn(async () => ({
    latencyMs: 24.2,
    checkedAt: "2026/05/24 01:40",
    serverTs: 1780000000000,
  })),
}));

const nextTickCycle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("IP widget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSdIpRuntimeForTests();
  });

  it("renders compact sizes as icon-only and large sizes with live IP/location", async () => {
    for (const sizeKey of ["1x1", "1x2", "2x1", "2x2", "2x4"] as const) {
      const wrapper = mount(SdIpWidget, {
        props: {
          widget: createDefaultSdIpWidget(),
          sizeKey,
        },
      });

      await nextTickCycle();
      await nextTickCycle();

      expect(wrapper.attributes("data-sd-ip-size")).toBe(sizeKey);
      expect(wrapper.attributes("data-sd-ip-address")).toBe("163.125.214.27");
      expect(wrapper.attributes("data-sd-ip-location")).toBe(
        "广东省深圳市龙华",
      );
      if (sizeKey === "2x2" || sizeKey === "2x4") {
        expect(wrapper.text()).toContain("163.125.214.27");
        expect(wrapper.text()).toContain("广东省深圳市龙华");
        expect(wrapper.text()).toContain("延迟 24 ms");
        expect(fetchSdIpLatency).toHaveBeenCalledTimes(1);
      } else {
        expect(wrapper.text()).not.toContain("163.125.214.27");
        expect(wrapper.text()).not.toContain("延迟");
        expect(wrapper.find("img").attributes("src")).toBe(
          "/sd-live-assets/ip.svg",
        );
        expect(fetchSdIpLatency).not.toHaveBeenCalled();
      }

      wrapper.unmount();
      resetSdIpRuntimeForTests();
      vi.clearAllMocks();
    }
  });

  it("refreshes through the runtime token contract without bypassing the IP cache", async () => {
    const wrapper = mount(SdIpWidget, {
      props: {
        widget: createDefaultSdIpWidget(),
        sizeKey: "2x2",
        refreshToken: 0,
      },
    });

    await nextTickCycle();
    await wrapper.setProps({ refreshToken: 1 });
    await nextTickCycle();

    expect(fetchSdIpLookup).toHaveBeenCalledWith(
      false,
      expect.any(AbortSignal),
    );
  });

  it("auto-refreshes visible latency every five minutes and stops after unmount", async () => {
    vi.useFakeTimers();
    try {
      const wrapper = mount(SdIpWidget, {
        props: {
          widget: createDefaultSdIpWidget(),
          sizeKey: "2x2",
        },
      });

      await flushPromises();
      await flushPromises();
      expect(fetchSdIpLatency).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(fetchSdIpLatency).toHaveBeenCalledTimes(2);

      wrapper.unmount();
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(fetchSdIpLatency).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
