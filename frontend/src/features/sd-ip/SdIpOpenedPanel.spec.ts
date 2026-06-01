// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SdIpOpenedPanel from "./SdIpOpenedPanel.vue";
import { fetchSdIpLatency, fetchSdIpLookup } from "./sdIpApi";
import { createDefaultSdIpWidget } from "./sdIpModel";
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

describe("IP opened panel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSdIpRuntimeForTests();
  });

  it("renders the simplified local IP information panel without tabs or search", async () => {
    const wrapper = mount(SdIpOpenedPanel, {
      props: {
        widget: createDefaultSdIpWidget(),
      },
    });

    await nextTickCycle();

    expect(wrapper.attributes("data-sd-ip-source-status")).toBe("ok");
    expect(wrapper.attributes("data-sd-ip-latency")).toBe("24");
    expect(wrapper.attributes("data-sd-ip-latency-status")).toBe("success");
    expect(wrapper.findAll("input")).toHaveLength(0);
    expect(wrapper.findAll("button")).toHaveLength(1);
    expect(wrapper.findAll("[role='tab']")).toHaveLength(0);
    expect(wrapper.text()).toContain("本机IP地址信息");
    expect(wrapper.find("[data-sd-ip-info-card]").exists()).toBe(true);
    expect(wrapper.find("[data-sd-ip-info-card]").text()).toContain(
      "当前位置",
    );
    expect(wrapper.attributes("data-sd-ip-network")).toBeUndefined();
    expect(wrapper.attributes("data-sd-ip-coordinate")).toBeUndefined();
    expect(wrapper.text()).toContain("解析地址：163.125.214.27");
    expect(wrapper.text()).toContain("归属地：广东省深圳市龙华");
    expect(wrapper.text()).not.toContain("网络：");
    expect(wrapper.text()).not.toContain("经纬度：");
    expect(wrapper.text()).toContain("PING测试：24 ms刷新");
    expect(
      wrapper.find("[data-sd-ip-map].opened-ip-map-layer").exists(),
    ).toBe(true);
    const iframe = wrapper.find("iframe");
    expect(iframe.attributes("src")).toContain(
      "https://www.openstreetmap.org/export/embed.html",
    );
    expect(decodeURIComponent(iframe.attributes("src") || "")).toContain(
      "marker=22.696667,114.045422",
    );
  });

  it("does not probe latency again when the IP information is unchanged", async () => {
    const widget = createDefaultSdIpWidget();
    const first = mount(SdIpOpenedPanel, {
      props: { widget },
    });

    await nextTickCycle();
    expect(fetchSdIpLookup).toHaveBeenCalledTimes(1);
    expect(fetchSdIpLatency).toHaveBeenCalledTimes(1);

    first.unmount();
    const second = mount(SdIpOpenedPanel, {
      props: { widget },
    });

    await nextTickCycle();
    expect(fetchSdIpLookup).toHaveBeenCalledTimes(1);
    expect(fetchSdIpLatency).toHaveBeenCalledTimes(1);
    second.unmount();
  });
});
