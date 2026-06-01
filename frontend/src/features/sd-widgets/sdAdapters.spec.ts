import { describe, expect, it } from "vitest";
import {
  buildSdPersistedData,
  resolveSdWidgetViewModel,
} from "./sdAdapters";
import { SD_WIDGET_REGISTRY } from "./sdWidgetRegistry";

describe("widget adapters", () => {
  it("builds persisted identity metadata", () => {
    const wallpaperEntry = SD_WIDGET_REGISTRY.find(
      (entry) => entry.id === "sd-wallpaper-16",
    )!;
    const data = buildSdPersistedData(wallpaperEntry);
    expect(data.sd).toMatchObject({
      namespace: "sd",
      captureIndex: 16,
      catalogId: "sd-wallpaper-16",
      localStateKey: "sd.wallpaper.16",
      adapterKind: "wallpaper",
    });
  });

  it("resolves fixture-first view models and honors local instance overrides", () => {
    const vm = resolveSdWidgetViewModel({
      type: "sd-weather-00",
      data: {
        sd: {
          state: {
            hero: "深圳 28°",
            progress: 2,
            lines: ["本地覆盖"],
          },
        },
      },
    });

    expect(vm?.entry.captureIndex).toBe(0);
    expect(vm?.hero).toBe("深圳 28°");
    expect(vm?.progress).toBe(1);
    expect(vm?.lines).toEqual(["本地覆盖"]);
    expect(vm?.privacyNote).toContain("No private upstream APIs");
  });
});
