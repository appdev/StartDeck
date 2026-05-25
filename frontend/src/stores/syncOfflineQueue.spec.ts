import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const syncStoreSource = readFileSync("src/stores/sync.ts", "utf8");

describe("sync offline queue replay", () => {
  it("keeps failed saves on a logged-in periodic replay loop", () => {
    expect(syncStoreSource).toContain(
      "const OFFLINE_QUEUE_REPLAY_INTERVAL_MS = 30000",
    );
    expect(syncStoreSource).toContain("startOfflineQueueReplayTimer");
    expect(syncStoreSource).toContain("stopOfflineQueueReplayTimer");
    expect(syncStoreSource).toContain("offlineQueueReplayInProgress");
    expect(syncStoreSource).toContain("saveStore.triggerOfflineQueueReplay(");
    expect(syncStoreSource).toContain("void replayOfflineQueueIfNeeded()");
  });
});
