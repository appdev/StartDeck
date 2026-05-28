import { describe, expect, it, vi } from "vitest";
import {
  applyCropperZoom,
  resolveCropperChangeScaleStep,
  type VueCropperHandle,
} from "./vueCropperZoom";

describe("vueCropperZoom", () => {
  it("converts UI zoom deltas into vue-cropper changeScale steps", () => {
    expect(
      resolveCropperChangeScaleStep(
        { trueWidth: 1000, trueHeight: 500 },
        1,
        2,
        0.4,
      ),
    ).toBe(20);
  });

  it("applies slider zoom as an absolute multiplier of the loaded cropper scale", () => {
    const cropper: VueCropperHandle = {
      trueWidth: 1000,
      trueHeight: 500,
      scale: 0.4,
      changeScale: vi.fn((step: number) => {
        cropper.scale = Number(cropper.scale) + step * 0.02;
      }),
    };

    const result = applyCropperZoom(cropper, 1, 2, 0.4);

    expect(cropper.changeScale).toHaveBeenCalledWith(20);
    expect(cropper.scale).toBeCloseTo(0.8);
    expect(result).toEqual({ applied: true, zoom: 2 });
  });

  it("does not call changeScale for unchanged slider values", () => {
    const cropper: VueCropperHandle = {
      trueWidth: 1000,
      trueHeight: 500,
      scale: 0.4,
      changeScale: vi.fn(),
    };

    const result = applyCropperZoom(cropper, 1, 1, 0.4);

    expect(cropper.changeScale).not.toHaveBeenCalled();
    expect(result).toEqual({ applied: true, zoom: 1 });
  });

  it("keeps the slider aligned when vue-cropper rejects a scale change", () => {
    const cropper: VueCropperHandle = {
      trueWidth: 1000,
      trueHeight: 500,
      scale: 0.4,
      changeScale: vi.fn((_step: number): false => false),
    };

    const result = applyCropperZoom(cropper, 1, 0.1, 0.4);

    expect(result).toEqual({ applied: false, zoom: 1 });
  });
});
