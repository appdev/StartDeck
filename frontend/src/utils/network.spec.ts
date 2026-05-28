import { describe, it, expect } from "vitest";
import {
  classifyNetworkTarget,
  computeEffectiveNetworkMode,
  isInternalNetwork,
  networkLocationMatches,
  normalizeNetworkLocationAddress,
} from "./network";

describe("network rules: ip:", () => {
  it("matches ip prefix with trailing dot", () => {
    expect(classifyNetworkTarget("11.22.33.44", "ip:11.22.", "")).toBe("lan");
    expect(isInternalNetwork("11.22.33.44", "", "ip:11.22.")).toBe(true);
  });

  it("matches ip prefix without trailing dot", () => {
    expect(classifyNetworkTarget("11.22.33.44", "ip:11.22", "")).toBe("lan");
    expect(classifyNetworkTarget("11.22.33.44", "ip:11.22.33", "")).toBe("lan");
  });

  it("matches full ipv4 exactly (does not behave like prefix)", () => {
    expect(classifyNetworkTarget("11.22.33.44", "ip:11.22.33.44", "")).toBe(
      "lan",
    );
    expect(classifyNetworkTarget("11.22.33.45", "ip:11.22.33.44", "")).toBe(
      "wan",
    );
  });

  it("does not match domains", () => {
    expect(classifyNetworkTarget("example.com", "ip:11.22.", "")).toBe("wan");
  });
});

describe("network location rules", () => {
  it("normalizes address fields into a stable key without relying on IP", () => {
    expect(
      normalizeNetworkLocationAddress({
        country: "中国",
        province: "广东省",
        adm2: "深圳",
        city: "龙华区",
        ip: "1.1.1.1",
      }),
    ).toMatchObject({
      key: "中国|广东|深圳|龙华",
      label: "广东省 / 深圳 / 龙华区",
    });
  });

  it("matches equivalent province/city/district addresses", () => {
    expect(
      networkLocationMatches(
        {
          country: "中国",
          region: "广东",
          adm2: "深圳市",
          district: "龙华",
        },
        {
          key: "中国|广东|深圳|龙华",
          label: "广东省 / 深圳 / 龙华区",
          country: "中国",
          province: "广东省",
          city: "深圳",
          district: "龙华区",
        },
      ),
    ).toBe(true);
  });

  it("treats a matched configured address as LAN in auto mode", () => {
    const result = computeEffectiveNetworkMode("start.zsl.one", "", "", 0, {
      currentLocation: {
        country: "中国",
        region: "广东省",
        adm2: "深圳",
        city: "龙华",
      },
      internalLocation: {
        key: "中国|广东|深圳|龙华",
        label: "广东省 / 深圳 / 龙华",
        country: "中国",
        province: "广东省",
        city: "深圳",
        district: "龙华",
      },
    });

    expect(result).toMatchObject({
      isLan: true,
      reason: "location_matched",
    });
  });
});
