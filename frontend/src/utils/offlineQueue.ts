/**
 * Offline Save Queue
 *
 * When network is unavailable, save requests are stored in IndexedDB.
 * Upon network recovery, items are replayed in operation timestamp order.
 * Server-side last-write-wins arbitration ignores stale operations.
 *
 * Supports both full data saves and fine-grained widget saves.
 */

export type SaveType = "full" | "widget";

export interface PendingSave {
  id: string;
  timestamp: number;
  baseVersion: number;
  data: Record<string, unknown>;
  type: SaveType;
  widgetId?: string;
  widgetVersion?: number;
  retries: number;
}

const DB_NAME = "StartDeckOfflineQueue";
const STORE_NAME = "pendingSaves";
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Enqueue a full data save
 */
export async function enqueue(
  data: Record<string, unknown>,
  baseVersion: number,
  operationTimestamp = Date.now(),
): Promise<void> {
  return enqueueItem({
    id: `full_${operationTimestamp}_${Date.now()}`,
    timestamp: operationTimestamp,
    baseVersion,
    data,
    type: "full",
    retries: 0,
  });
}

/**
 * Enqueue a fine-grained widget save
 */
export async function enqueueWidget(
  widgetId: string,
  data: Record<string, unknown>,
  baseVersion: number,
  widgetVersion?: number,
  operationTimestamp = Date.now(),
): Promise<void> {
  // Remove existing queued saves for same widget to avoid duplicates
  await removeByWidget(widgetId);

  return enqueueItem({
    id: `widget_${widgetId}_${operationTimestamp}_${Date.now()}`,
    timestamp: operationTimestamp,
    baseVersion,
    data,
    type: "widget",
    widgetId,
    widgetVersion,
    retries: 0,
  });
}

async function enqueueItem(item: PendingSave): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  // Clean expired items
  const allReq = store.getAll();
  allReq.onsuccess = () => {
    const items: PendingSave[] = allReq.result || [];
    const now = Date.now();
    items.forEach((i) => {
      if (now - i.timestamp > EXPIRY_MS) {
        store.delete(i.id);
      }
    });
  };

  store.put(item);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Remove all queued saves for a specific widget
 */
async function removeByWidget(widgetId: string): Promise<void> {
  const items = await getAll();
  for (const item of items) {
    if (item.type === "widget" && item.widgetId === widgetId) {
      await remove(item.id);
    }
  }
}

export async function getAll(): Promise<PendingSave[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const items: PendingSave[] = (req.result || [])
        .filter((item) => Date.now() - item.timestamp <= EXPIRY_MS)
        .sort((a, b) => a.timestamp - b.timestamp);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function remove(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clear(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function size(): Promise<number> {
  const items = await getAll();
  return items.length;
}

/**
 * Replay queue items in order.
 *
 * Distinguishes:
 * - Recoverable errors (network timeout) - will retry
 * - Non-recoverable errors (data format) - will abort and notify
 */
export async function replay(
  onSave: (
    data: Record<string, unknown>,
    operationTimestamp: number,
  ) => Promise<boolean>,
  onSaveWidget: (
    widgetId: string,
    data: Record<string, unknown>,
    operationTimestamp: number,
    widgetVersion?: number,
  ) => Promise<boolean>,
  onNonRecoverableError: (item: PendingSave, error: unknown) => void,
): Promise<void> {
  const items = await getAll();
  if (items.length === 0) return;

  const REPLAY_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

  for (const item of items) {
    const age = Date.now() - item.timestamp;
    if (age > REPLAY_EXPIRY_MS) {
      console.warn(
        `[OfflineQueue] Item ${item.id} is ${Math.round(age / 3600000)}h old, discarding`,
      );
      await remove(item.id);
      continue;
    }

    let success: boolean;
    try {
      if (item.type === "widget" && item.widgetId) {
        success = await onSaveWidget(
          item.widgetId,
          item.data,
          item.timestamp,
          item.widgetVersion,
        );
      } else {
        success = await onSave(item.data, item.timestamp);
      }
    } catch (e) {
      // Non-recoverable error (data format issue, etc.)
      console.error(
        `[OfflineQueue] Non-recoverable error for item ${item.id}:`,
        e,
      );
      onNonRecoverableError(item, e);
      return;
    }

    if (!success) {
      console.warn("[OfflineQueue] Save failed, stopping replay");
      return;
    }

    await remove(item.id);
  }
}
