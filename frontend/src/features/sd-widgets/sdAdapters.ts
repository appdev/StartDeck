import type { WidgetConfig } from "@/types";
import {
  resolveSdFixture,
  type SdFixture,
} from "@/features/sd-widgets/sdFixtures";
import {
  resolveSdWidgetEntry,
  type SdWidgetRegistryEntry,
} from "@/features/sd-widgets/sdWidgetRegistry";

export type SdAdapterState =
  | "ready"
  | "idle"
  | "loading"
  | "empty"
  | "error"
  | "stale"
  | "running";

export interface SdWidgetViewModel {
  entry: SdWidgetRegistryEntry;
  fixture: SdFixture;
  state: SdAdapterState;
  hero: string;
  subline: string;
  meta: string;
  lines: string[];
  chips: string[];
  progress: number;
  updatedAt: string;
  privacyNote: string;
}

const stateByKind: Partial<Record<SdFixture["kind"], SdAdapterState>> = {
  pomodoro: "idle",
  foodPicker: "idle",
};

export const resolveSdWidgetViewModel = (
  widget: Pick<WidgetConfig, "type" | "data">,
): SdWidgetViewModel | undefined => {
  const entry = resolveSdWidgetEntry(widget.type);
  if (!entry) return undefined;
  const fixture = resolveSdFixture(entry.dataKind);
  const instance = widget.data?.sd?.state || {};
  const progress =
    typeof instance.progress === "number"
      ? instance.progress
      : fixture.progress || 0;
  return {
    entry,
    fixture,
    state: instance.state || stateByKind[fixture.kind] || "ready",
    hero: instance.hero || fixture.hero,
    subline: instance.subline || fixture.subline,
    meta: instance.meta || fixture.meta,
    lines: Array.isArray(instance.lines) ? instance.lines : fixture.lines,
    chips: Array.isArray(instance.chips) ? instance.chips : fixture.chips,
    progress: Math.max(0, Math.min(1, progress)),
    updatedAt: instance.updatedAt || "2026-05-20T23:40:00+08:00",
    privacyNote:
      "Fixture-first local adapter. No private upstream APIs, cookies, storage, auth headers, or proprietary assets.",
  };
};

export const buildSdPersistedData = (entry: SdWidgetRegistryEntry) => ({
  sd: {
    namespace: entry.persistedData.namespace,
    captureIndex: entry.captureIndex,
    catalogId: entry.id,
    localStateKey: entry.persistedData.localStateKey,
    adapterKind: entry.persistedData.adapterKind,
    state: {
      progress: resolveSdFixture(entry.dataKind).progress,
      updatedAt: "2026-05-20T23:40:00+08:00",
    },
  },
});

export const getSdPanelActions = (vm: SdWidgetViewModel) => {
  const common = ["刷新", "复制", "设置"];
  if (vm.fixture.kind === "pomodoro") return ["开始", "暂停", "重置"];
  if (vm.fixture.kind === "foodPicker") return ["开始抽取", "编辑菜单", "重置"];
  return vm.chips.length ? vm.chips : common;
};
