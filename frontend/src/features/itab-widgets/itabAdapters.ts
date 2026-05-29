import type { WidgetConfig } from "@/types";
import {
  resolveItabFixture,
  type ItabFixture,
} from "@/features/itab-widgets/itabFixtures";
import {
  resolveItabWidgetEntry,
  type ItabWidgetRegistryEntry,
} from "@/features/itab-widgets/itabWidgetRegistry";

export type ItabAdapterState =
  | "ready"
  | "idle"
  | "loading"
  | "empty"
  | "error"
  | "stale"
  | "running";

export interface ItabWidgetViewModel {
  entry: ItabWidgetRegistryEntry;
  fixture: ItabFixture;
  state: ItabAdapterState;
  hero: string;
  subline: string;
  meta: string;
  lines: string[];
  chips: string[];
  progress: number;
  updatedAt: string;
  privacyNote: string;
}

const stateByKind: Partial<Record<ItabFixture["kind"], ItabAdapterState>> = {
  pomodoro: "idle",
  foodPicker: "idle",
};

export const resolveItabWidgetViewModel = (
  widget: Pick<WidgetConfig, "type" | "data">,
): ItabWidgetViewModel | undefined => {
  const entry = resolveItabWidgetEntry(widget.type);
  if (!entry) return undefined;
  const fixture = resolveItabFixture(entry.dataKind);
  const instance = widget.data?.itab?.state || {};
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
      "Fixture-first local adapter. No iTab private APIs, cookies, storage, auth headers, or proprietary assets.",
  };
};

export const buildItabPersistedData = (entry: ItabWidgetRegistryEntry) => ({
  itab: {
    namespace: entry.persistedData.namespace,
    captureIndex: entry.captureIndex,
    catalogId: entry.id,
    localStateKey: entry.persistedData.localStateKey,
    adapterKind: entry.persistedData.adapterKind,
    state: {
      progress: resolveItabFixture(entry.dataKind).progress,
      updatedAt: "2026-05-20T23:40:00+08:00",
    },
  },
});

export const getItabPanelActions = (vm: ItabWidgetViewModel) => {
  const common = ["刷新", "复制", "设置"];
  if (vm.fixture.kind === "pomodoro") return ["开始", "暂停", "重置"];
  if (vm.fixture.kind === "foodPicker") return ["开始抽取", "编辑菜单", "重置"];
  return vm.chips.length ? vm.chips : common;
};
