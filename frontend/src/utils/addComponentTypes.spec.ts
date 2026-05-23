import { describe, expect, it } from "vitest";
import type { AddComponentPayload } from "@/utils/addComponentTypes";

describe("addComponentTypes", () => {
  it("accepts widget add payloads from StartDeck and scoped iTab size keys", () => {
    const payload = {
      kind: "widget",
      catalogItemId: "clock",
      destinationGroupId: "home",
      saveMode: "dirty",
      sizeKey: "2x1",
    } satisfies AddComponentPayload;

    expect(payload.sizeKey).toBe("2x1");

    const itabPayload = {
      kind: "widget",
      catalogItemId: "weather",
      destinationGroupId: "home",
      saveMode: "dirty",
      sizeKey: "1x2",
    } satisfies AddComponentPayload;

    expect(itabPayload.sizeKey).toBe("1x2");
  });
});
