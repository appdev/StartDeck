import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  prefetchItabIpLocationOnBoot,
  shouldPrefetchItabIpLocation,
} from "./itabIpBoot";
import { prefetchItabIpLocation } from "./useItabIpRuntime";

vi.mock("./useItabIpRuntime", () => ({
  prefetchItabIpLocation: vi.fn(async () => true),
}));

describe("itabIpBoot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefetches IP location on the main app route", () => {
    expect(shouldPrefetchItabIpLocation("/")).toBe(true);

    expect(prefetchItabIpLocationOnBoot("/")).toBe(true);

    expect(prefetchItabIpLocation).toHaveBeenCalledTimes(1);
  });

  it("skips the widget preview route", () => {
    expect(shouldPrefetchItabIpLocation("/widget-preview")).toBe(false);

    expect(prefetchItabIpLocationOnBoot("/widget-preview")).toBe(false);

    expect(prefetchItabIpLocation).not.toHaveBeenCalled();
  });
});
