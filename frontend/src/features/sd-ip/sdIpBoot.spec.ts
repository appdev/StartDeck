import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  prefetchSdIpLocationOnBoot,
  shouldPrefetchSdIpLocation,
} from "./sdIpBoot";
import { prefetchSdIpLocation } from "./useSdIpRuntime";

vi.mock("./useSdIpRuntime", () => ({
  prefetchSdIpLocation: vi.fn(async () => true),
}));

describe("IP boot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefetches IP location on the main app route", () => {
    expect(shouldPrefetchSdIpLocation("/")).toBe(true);

    expect(prefetchSdIpLocationOnBoot("/")).toBe(true);

    expect(prefetchSdIpLocation).toHaveBeenCalledTimes(1);
  });

  it("skips the widget preview route", () => {
    expect(shouldPrefetchSdIpLocation("/widget-preview")).toBe(false);

    expect(prefetchSdIpLocationOnBoot("/widget-preview")).toBe(false);

    expect(prefetchSdIpLocation).not.toHaveBeenCalled();
  });
});
