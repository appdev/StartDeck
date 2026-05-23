import { describe, expect, it } from "vitest";
import {
  buildItabPersistedData,
  resolveItabWidgetViewModel,
} from "./itabAdapters";
import { ITAB_WIDGET_REGISTRY } from "./itabWidgetRegistry";

describe("itabAdapters", () => {
  it("builds persisted identity under data.itab", () => {
    const data = buildItabPersistedData(ITAB_WIDGET_REGISTRY[23]!);
    expect(data.itab).toMatchObject({
      namespace: "itab",
      captureIndex: 23,
      catalogId: "itab-hotsearch-23",
      localStateKey: "itab.hotsearch.23",
      adapterKind: "hotsearch",
    });
  });

  it("resolves fixture-first view models and honors local instance overrides", () => {
    const vm = resolveItabWidgetViewModel({
      type: "itab-weather-00",
      data: {
        itab: {
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
    expect(vm?.privacyNote).toContain("No iTab private APIs");
  });
});
