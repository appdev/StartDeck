import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const saveStoreSource = readFileSync("src/stores/save.ts", "utf8");
const offlineQueueSource = readFileSync("src/utils/offlineQueue.ts", "utf8");
const syncStoreSource = readFileSync("src/stores/sync.ts", "utf8");

describe("save operation timestamp semantics", () => {
  it("sends the operation timestamp header on direct saves and queued replays", () => {
    expect(saveStoreSource).toContain(
      'SAVE_OPERATION_TIMESTAMP_HEADER =\n  "X-StartDeck-Operation-Timestamp"',
    );
    expect(saveStoreSource).toContain(
      "withOperationTimestampHeader(\n                  cacheStore.getHeaders(),",
    );
    expect(saveStoreSource).toContain(
      "withOperationTimestampHeader(getHeaders(), operationTimestamp)",
    );
    expect(saveStoreSource).not.toContain("res.status === 409");
  });

  it("stores queued saves with their original operation timestamp", () => {
    expect(offlineQueueSource).toContain("operation timestamp order");
    expect(offlineQueueSource).toContain(
      "id: `full_${operationTimestamp}_${Date.now()}`",
    );
    expect(offlineQueueSource).toContain("timestamp: operationTimestamp");
    expect(offlineQueueSource).not.toContain("onVersionConflict");
  });

  it("does not prompt the user to resolve remote layout conflicts", () => {
    expect(syncStoreSource).not.toContain("uiFeedback.confirm");
    expect(syncStoreSource).not.toContain("云端配置已更新");
    expect(syncStoreSource).toContain("saveStore.hasUnsavedChanges");
  });
});
