import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const syncStoreSource = readFileSync("src/stores/sync.ts", "utf8");

describe("sync websocket fallback", () => {
  it("does not run full data sync directly from the websocket disconnect callback", () => {
    const disconnectedBlock =
      /onDisconnected:\s*\(\) => \{[\s\S]*?\n    \},/.exec(
        syncStoreSource,
      )?.[0] || "";

    expect(disconnectedBlock).toContain("networkStore.markStale()");
    expect(disconnectedBlock).not.toContain("wsContinuousFailures++");
    expect(disconnectedBlock).not.toContain("fetchAndProcessData()");
  });

  it("counts closed websocket status once and falls back through throttled HTTP version checks", () => {
    expect(syncStoreSource).toContain(
      "const WS_FALLBACK_SYNC_MIN_INTERVAL_MS = 30000",
    );
    expect(syncStoreSource).toContain("scheduleWsFallbackSync");
    expect(syncStoreSource).toContain(
      "const serverVersion = await fetchVersionOnly()",
    );
    expect(syncStoreSource).toContain(
      'if (getWsStatus() !== "OPEN" && serverVersion > dataVersion.value)',
    );
    expect(syncStoreSource).toContain(
      "const shouldStartHttpPolling = !isHttpPollingActive",
    );
  });
});
