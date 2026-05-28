import { describe, expect, it } from "vitest";
import { stripForceNetworkMode } from "./storeHelpers";

describe("storeHelpers", () => {
  it("strips client-only and deprecated layout app config fields", () => {
    expect(
      stripForceNetworkMode({
        forceNetworkMode: "lan",
        customJsDisclaimerAgreed: true,
        marketplaceListUrl: "removed",
        widgetAreaSize: 4,
        widgetAreaCols: 4,
        widgetAreaRows: 4,
        cardSize: 148,
        gridGap: 18,
        iconSize: 64,
        groupGap: 30,
        customTitle: "我的导航",
      }),
    ).toEqual({
      customTitle: "我的导航",
    });
  });
});
