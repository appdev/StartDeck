import { describe, expect, it } from "vitest";
import { anniversaryDays } from "./useSdAnniversaryRuntime";

describe("anniversaryDays", () => {
  it("counts down to the next monthly occurrence", () => {
    expect(
      anniversaryDays("2026-6-10", "remaining", "每月", new Date(2026, 4, 28)),
    ).toBe(13);
  });

  it("clamps monthly repeats to shorter months without overflowing", () => {
    expect(
      anniversaryDays("2026-1-30", "remaining", "每月", new Date(2026, 0, 31)),
    ).toBe(28);
  });

  it("counts elapsed days from the previous monthly occurrence", () => {
    expect(
      anniversaryDays("2026-6-10", "elapsed", "每月", new Date(2026, 4, 28)),
    ).toBe(18);
  });

  it("supports weekly repeats in both countdown and elapsed modes", () => {
    expect(
      anniversaryDays("2026-5-25", "remaining", "每周", new Date(2026, 4, 28)),
    ).toBe(4);
    expect(
      anniversaryDays("2026-5-25", "elapsed", "每周", new Date(2026, 4, 28)),
    ).toBe(3);
  });

  it("clamps yearly and festival repeats on leap-day events", () => {
    expect(
      anniversaryDays("2024-2-29", "remaining", "每年", new Date(2025, 1, 28)),
    ).toBe(0);
    expect(
      anniversaryDays("2024-2-29", "elapsed", "节日", new Date(2025, 2, 1)),
    ).toBe(1);
  });
});
