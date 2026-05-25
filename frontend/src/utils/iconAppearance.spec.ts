import { describe, expect, it } from "vitest";
import {
  normalizeIconBackgroundColor,
  resolveIconBackground,
} from "./iconAppearance";

describe("iconAppearance", () => {
  it("normalizes safe color values", () => {
    expect(normalizeIconBackgroundColor("#fff")).toBe("#ffffff");
    expect(normalizeIconBackgroundColor("#ABCDEF")).toBe("#abcdef");
    expect(normalizeIconBackgroundColor("rgb(17, 24, 39)")).toBe(
      "rgb(17, 24, 39)",
    );
    expect(normalizeIconBackgroundColor("javascript:alert(1)")).toBeNull();
  });

  it("resolves automatic background before fallback", () => {
    expect(
      resolveIconBackground({
        iconBackgroundMode: "auto",
        iconAutoBackgroundColor: "#111827",
        color: "bg-red-100",
      }),
    ).toMatchObject({
      color: "#111827",
      source: "auto",
    });
  });

  it("keeps custom background ahead of automatic metadata", () => {
    expect(
      resolveIconBackground({
        iconBackgroundMode: "custom",
        iconAutoBackgroundColor: "#111827",
        iconCustomBackgroundColor: "#f8fafc",
      }),
    ).toMatchObject({
      color: "#f8fafc",
      source: "custom",
    });
  });

  it("uses legacy color only as a read fallback", () => {
    expect(
      resolveIconBackground({
        color: "bg-gray-100 text-gray-700",
      }),
    ).toMatchObject({
      color: "bg-gray-100",
      source: "legacy",
    });
  });

  it("falls back to gray and marks none or hidden shapes as not visible", () => {
    expect(resolveIconBackground({}, { shape: "none" })).toMatchObject({
      color: "bg-gray-100",
      source: "fallback",
      visible: false,
    });
    expect(resolveIconBackground({}, { shape: "hidden" }).visible).toBe(false);
  });

  it("does not render invalid automatic colors", () => {
    expect(
      resolveIconBackground({
        iconBackgroundMode: "auto",
        iconAutoBackgroundColor: "javascript:alert(1)",
      }),
    ).toMatchObject({
      color: "bg-gray-100",
      source: "fallback",
    });
  });

  it("treats missing or old default mode as automatic", () => {
    expect(
      resolveIconBackground({
        iconAutoBackgroundColor: "#111827",
      }),
    ).toMatchObject({
      mode: "auto",
      color: "#111827",
      source: "auto",
    });
    expect(
      resolveIconBackground({
        iconBackgroundMode: "default" as never,
        iconAutoBackgroundColor: "#1d4ed8",
      }),
    ).toMatchObject({
      mode: "auto",
      color: "#1d4ed8",
      source: "auto",
    });
  });
});
