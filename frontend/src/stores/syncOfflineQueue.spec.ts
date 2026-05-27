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

  it("preserves Todo and Memo card size when websocket data arrives", () => {
    expect(syncStoreSource).toContain('msg.type === "todo_updated"');
    expect(syncStoreSource).toContain('msg.type === "memo_updated"');
    expect(syncStoreSource).toContain("const currentSizeKey");
    expect(syncStoreSource).toContain("? { sizeKey: currentSizeKey }");
  });

  it("attempts an immediate save before clearing authenticated logout state", () => {
    const logoutBlock = /const logout = async \(\) => \{[\s\S]*?auth\.logout\(\);/.exec(
      syncStoreSource,
    )?.[0];

    expect(logoutBlock).toBeTruthy();
    expect(logoutBlock).toContain("saveStore.saveData(true, false");
    expect(logoutBlock!.indexOf("saveStore.saveData")).toBeLessThan(
      logoutBlock!.indexOf("auth.logout()"),
    );
  });
});
