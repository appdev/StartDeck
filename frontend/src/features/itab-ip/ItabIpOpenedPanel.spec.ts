// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ItabIpOpenedPanel from "./ItabIpOpenedPanel.vue";
import { createDefaultItabIpWidget } from "./itabIpModel";
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

describe("ItabIpOpenedPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetItabIpRuntimeForTests();
  });

  it("renders the simplified local IP information panel without tabs or search", async () => {
    const wrapper = mount(ItabIpOpenedPanel, {
      props: {
        widget: createDefaultItabIpWidget(),
      },
    });

    await nextTickCycle();

    expect(wrapper.attributes("data-itab-ip-source-status")).toBe("ok");
    expect(wrapper.findAll("input")).toHaveLength(0);
    expect(wrapper.findAll("button")).toHaveLength(0);
    expect(wrapper.findAll("[role='tab']")).toHaveLength(0);
    expect(wrapper.text()).toContain("本机IP地址信息");
    expect(wrapper.text()).toContain("解析地址：163.125.214.27");
    expect(wrapper.text()).toContain("归属地：中国-广东-深圳");
    expect(wrapper.text()).toContain("网络：中国联通");
    expect(wrapper.text()).toContain("经纬度：114.045422,22.696667");
  });
});
