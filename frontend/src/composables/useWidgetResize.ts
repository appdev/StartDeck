import { computed, ref, type ComputedRef, type Ref } from "vue";
import {
  resolveWidgetSizeFamily,
  type WidgetSize as PresetWidgetSize,
} from "@/utils/widgetSizePresets";
import {
  isRuntimeWidgetSizeSpan,
  resolveRuntimeWidgetSizeFamily,
} from "@/features/widget-runtime/widgetRuntimeSizes";

export type WidgetDeviceKey = "desktop" | "tablet" | "mobile";

export interface WidgetSize {
  colSpan: number;
  rowSpan: number;
}

export type WidgetSizeLimitReason =
  | "none"
  | "min-size"
  | "device-max"
  | "type-max"
  | "unsupported";

export interface WidgetSizeOption extends WidgetSize {
  label: string;
  disabled: boolean;
  current: boolean;
  target: boolean;
  reason: WidgetSizeLimitReason;
  reasonLabel: string;
  key?: string;
}

export interface WidgetSizeState {
  requestedSize: WidgetSize;
  clampedSize: WidgetSize;
  maxSize: WidgetSize;
  productMaxSize: WidgetSize;
  limitReason: WidgetSizeLimitReason;
  limitLabel: string;
  canCommit: boolean;
  options: WidgetSizeOption[];
}

export interface WidgetResizeOverlayState {
  widgetId: string;
  currentSize: WidgetSize;
  targetSize: WidgetSize;
  maxSize: WidgetSize;
  limited: boolean;
  limitLabel: string;
}

interface WidgetResizeTarget {
  widgetId: string;
  widgetType: string;
  currentSize: WidgetSize;
  itemElement?: HTMLElement | null;
}

interface ActiveResizeState extends WidgetResizeTarget {
  pointerId: number;
  startPointer: { x: number; y: number };
  currentSize: WidgetSize;
  requestedSize: WidgetSize;
  clampedSize: WidgetSize;
  maxSize: WidgetSize;
  limitReason: WidgetSizeLimitReason;
  limitLabel: string;
  canCommit: boolean;
}

export interface UseWidgetResizeOptions {
  deviceKey: Ref<string> | ComputedRef<string>;
  runtimeCols: Ref<number> | ComputedRef<number>;
  columnWidth?: Ref<number> | ComputedRef<number>;
  rowHeight: Ref<number> | ComputedRef<number>;
  gridElement: Ref<HTMLElement | null>;
  onCommit: (widgetId: string, size: WidgetSize) => void;
}

const GRID_STEP = 1;
const MIN_SIZE = 1;
const PRODUCT_MAX_COLS = 4;

const formatSize = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

export const snapWidgetSizeValue = (value: number) =>
  Math.round(value / GRID_STEP) * GRID_STEP;

const normalizePositive = (value: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(MIN_SIZE, snapWidgetSizeValue(value));
};

type ResizeSizePreset = {
  key: string;
  label: string;
  colSpan: number;
  rowSpan: number;
  reason?: string;
};

const resolveResizeSizeFamily = (widgetType: string) => {
  const runtimeFamily = resolveRuntimeWidgetSizeFamily(widgetType);
  if (runtimeFamily) {
    return {
      supported: runtimeFamily.supported,
      disabled: runtimeFamily.disabled,
      maxSize: runtimeFamily.maxSize,
      hardLimitLabel: undefined,
    };
  }
  return resolveWidgetSizeFamily(widgetType);
};

const getReasonLabel = (reason: WidgetSizeLimitReason, maxSize: WidgetSize) => {
  if (reason === "device-max")
    return `当前布局最大 ${formatSize(maxSize.colSpan)} x ${formatSize(maxSize.rowSpan)}`;
  if (reason === "type-max")
    return `组件最大 ${formatSize(maxSize.colSpan)} x ${formatSize(maxSize.rowSpan)}`;
  if (reason === "min-size")
    return `最小 ${formatSize(MIN_SIZE)} x ${formatSize(MIN_SIZE)}`;
  if (reason === "unsupported") return "该组件不支持此尺寸";
  return "";
};

export const getWidgetTypeSizeLimit = (widgetType: string): WidgetSize => {
  const maxSize = resolveResizeSizeFamily(widgetType).maxSize;
  return { colSpan: maxSize.colSpan, rowSpan: maxSize.rowSpan };
};

const isSameSize = (left: WidgetSize, right: WidgetSize) =>
  left.colSpan === right.colSpan && left.rowSpan === right.rowSpan;

const isWithinMax = (size: WidgetSize, maxSize: WidgetSize) =>
  size.colSpan <= maxSize.colSpan && size.rowSpan <= maxSize.rowSpan;

const sizeDistance = (left: WidgetSize, right: WidgetSize) =>
  Math.abs(left.colSpan - right.colSpan) +
  Math.abs(left.rowSpan - right.rowSpan);

const findSupportedSize = (
  requestedSize: WidgetSize,
  supported: ResizeSizePreset[],
  maxSize: WidgetSize,
) => {
  const available = supported.filter((size) => isWithinMax(size, maxSize));
  const candidates = available.length > 0 ? available : supported;
  return [...candidates].sort((a, b) => {
    const distanceDelta =
      sizeDistance(a, requestedSize) - sizeDistance(b, requestedSize);
    if (distanceDelta !== 0) return distanceDelta;
    return a.colSpan * a.rowSpan - b.colSpan * b.rowSpan;
  })[0]!;
};

const buildSizeOptions = (
  currentSize: WidgetSize,
  targetSize: WidgetSize,
  maxSize: WidgetSize,
  widgetType: string,
) => {
  const family = resolveResizeSizeFamily(widgetType);
  const supportedKeys = new Set(family.supported.map((size) => size.key));
  const disabledReasonByKey = new Map<string, string>(
    family.disabled.map((size): [string, string] => [
      size.key,
      size.reason || "该组件不支持此尺寸",
    ]),
  );
  const candidates = [...family.supported, ...family.disabled];
  return candidates.map((candidate) => {
    const isSupported = supportedKeys.has(candidate.key);
    const overDevice =
      candidate.colSpan > maxSize.colSpan ||
      candidate.rowSpan > maxSize.rowSpan;
    const reason: WidgetSizeLimitReason = !isSupported
      ? "unsupported"
      : overDevice
        ? "device-max"
        : "none";
    const reasonLabel =
      reason === "unsupported"
        ? disabledReasonByKey.get(candidate.key) ||
          getReasonLabel(reason, maxSize)
        : getReasonLabel(reason, maxSize);
    return {
      colSpan: candidate.colSpan,
      rowSpan: candidate.rowSpan,
      label: candidate.label,
      key: candidate.key,
      disabled: reason !== "none",
      current: isSameSize(candidate, currentSize),
      target: isSameSize(candidate, targetSize),
      reason,
      reasonLabel,
    };
  });
};

export const resolveWidgetSizeState = (input: {
  widgetType: string;
  deviceKey: string;
  runtimeCols: number;
  currentSize: WidgetSize;
  requestedSize?: WidgetSize;
}): WidgetSizeState => {
  const typeLimit = getWidgetTypeSizeLimit(input.widgetType);
  const runtimeCols = normalizePositive(input.runtimeCols, 1);
  const productMaxSize = {
    colSpan: Math.min(PRODUCT_MAX_COLS, typeLimit.colSpan),
    rowSpan: typeLimit.rowSpan,
  };
  const runtimeMaxCols =
    input.deviceKey === "mobile"
      ? runtimeCols
      : Math.min(PRODUCT_MAX_COLS, runtimeCols, typeLimit.colSpan);
  const maxSize = {
    colSpan: Math.max(MIN_SIZE, snapWidgetSizeValue(runtimeMaxCols)),
    rowSpan: Math.max(MIN_SIZE, snapWidgetSizeValue(typeLimit.rowSpan)),
  };
  const requestedSize = {
    colSpan: normalizePositive(
      input.requestedSize?.colSpan ?? input.currentSize.colSpan,
      input.currentSize.colSpan,
    ),
    rowSpan: normalizePositive(
      input.requestedSize?.rowSpan ?? input.currentSize.rowSpan,
      input.currentSize.rowSpan,
    ),
  };
  const boundedSize = {
    colSpan: Math.min(
      Math.max(requestedSize.colSpan, MIN_SIZE),
      maxSize.colSpan,
    ),
    rowSpan: Math.min(
      Math.max(requestedSize.rowSpan, MIN_SIZE),
      maxSize.rowSpan,
    ),
  };
  const family = resolveResizeSizeFamily(input.widgetType);
  const supportedTarget = findSupportedSize(
    boundedSize,
    family.supported,
    maxSize,
  );
  const clampedSize: PresetWidgetSize = {
    colSpan: supportedTarget.colSpan,
    rowSpan: supportedTarget.rowSpan,
  };

  let limitReason: WidgetSizeLimitReason = "none";
  if (requestedSize.colSpan < MIN_SIZE || requestedSize.rowSpan < MIN_SIZE) {
    limitReason = "min-size";
  } else if (
    requestedSize.colSpan > runtimeCols ||
    (input.deviceKey === "mobile" && requestedSize.colSpan > maxSize.colSpan)
  ) {
    limitReason = "device-max";
  } else if (
    !family.supported.some((size) => isSameSize(size, requestedSize)) &&
    isRuntimeWidgetSizeSpan(requestedSize)
  ) {
    limitReason = "unsupported";
  } else if (
    requestedSize.colSpan > typeLimit.colSpan ||
    requestedSize.rowSpan > typeLimit.rowSpan
  ) {
    limitReason = "type-max";
  } else if (
    !family.supported.some((size) => isSameSize(size, requestedSize))
  ) {
    limitReason = "unsupported";
  }

  return {
    requestedSize,
    clampedSize,
    maxSize,
    productMaxSize,
    limitReason,
    limitLabel:
      limitReason === "type-max" && family.hardLimitLabel
        ? family.hardLimitLabel
        : getReasonLabel(limitReason, maxSize),
    canCommit:
      limitReason === "none" &&
      requestedSize.colSpan === clampedSize.colSpan &&
      requestedSize.rowSpan === clampedSize.rowSpan,
    options: buildSizeOptions(
      input.currentSize,
      clampedSize,
      maxSize,
      input.widgetType,
    ),
  };
};

export function useWidgetResize(options: UseWidgetResizeOptions) {
  const active = ref<ActiveResizeState | null>(null);
  const isDragging = computed(() => active.value !== null);
  const activeWidgetId = computed(() => active.value?.widgetId ?? null);

  const clearListeners = () => {
    if (typeof window === "undefined") return;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerCancel);
    window.removeEventListener("keydown", handleKeyDown);
  };

  const getColumnWidth = (itemElement?: HTMLElement | null) => {
    const explicitColumnWidth = Number(options.columnWidth?.value);
    if (Number.isFinite(explicitColumnWidth) && explicitColumnWidth > 0) {
      return explicitColumnWidth;
    }
    const runtimeCols = Math.max(
      MIN_SIZE,
      Number(options.runtimeCols.value) || 1,
    );
    const gridWidth = options.gridElement.value?.getBoundingClientRect().width;
    if (gridWidth && gridWidth > 0) return gridWidth / runtimeCols;
    const itemWidth = itemElement?.getBoundingClientRect().width;
    const currentCols = active.value?.currentSize.colSpan || 1;
    if (itemWidth && itemWidth > 0) return itemWidth / currentCols;
    return 120;
  };

  const resolveActiveSize = (requestedSize: WidgetSize) => {
    const current = active.value;
    if (!current) return;
    const state = resolveWidgetSizeState({
      widgetType: current.widgetType,
      deviceKey: options.deviceKey.value,
      runtimeCols: options.runtimeCols.value,
      currentSize: current.currentSize,
      requestedSize,
    });
    current.requestedSize = state.requestedSize;
    current.clampedSize = state.clampedSize;
    current.maxSize = state.maxSize;
    current.limitReason = state.limitReason;
    current.limitLabel = state.limitLabel;
    current.canCommit = state.canCommit;
  };

  function handlePointerMove(event: PointerEvent) {
    const current = active.value;
    if (!current || event.pointerId !== current.pointerId) return;
    event.preventDefault();
    const colWidth = getColumnWidth(current.itemElement);
    const rowHeight = Math.max(1, Number(options.rowHeight.value) || 120);
    const deltaCols = snapWidgetSizeValue(
      (event.clientX - current.startPointer.x) / colWidth,
    );
    const deltaRows = snapWidgetSizeValue(
      (event.clientY - current.startPointer.y) / rowHeight,
    );
    resolveActiveSize({
      colSpan: current.currentSize.colSpan + deltaCols,
      rowSpan: current.currentSize.rowSpan + deltaRows,
    });
  }

  function handlePointerUp(event: PointerEvent) {
    const current = active.value;
    if (!current || event.pointerId !== current.pointerId) return;
    event.preventDefault();
    const target = current.clampedSize;
    const widgetId = current.widgetId;
    const canCommit = current.canCommit;
    active.value = null;
    clearListeners();
    if (canCommit) {
      options.onCommit(widgetId, target);
    }
  }

  function handlePointerCancel(event: PointerEvent) {
    const current = active.value;
    if (!current || event.pointerId !== current.pointerId) return;
    active.value = null;
    clearListeners();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    active.value = null;
    clearListeners();
  }

  const beginResize = (event: PointerEvent, target: WidgetResizeTarget) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    clearListeners();
    const currentSize = {
      colSpan: normalizePositive(target.currentSize.colSpan, 1),
      rowSpan: normalizePositive(target.currentSize.rowSpan, 1),
    };
    const state = resolveWidgetSizeState({
      widgetType: target.widgetType,
      deviceKey: options.deviceKey.value,
      runtimeCols: options.runtimeCols.value,
      currentSize,
      requestedSize: currentSize,
    });
    active.value = {
      ...target,
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      currentSize,
      requestedSize: state.requestedSize,
      clampedSize: state.clampedSize,
      maxSize: state.maxSize,
      limitReason: state.limitReason,
      limitLabel: state.limitLabel,
      canCommit: state.canCommit,
    };
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(
      event.pointerId,
    );
    if (typeof window !== "undefined") {
      window.addEventListener("pointermove", handlePointerMove, {
        passive: false,
      });
      window.addEventListener("pointerup", handlePointerUp, { passive: false });
      window.addEventListener("pointercancel", handlePointerCancel, {
        passive: false,
      });
      window.addEventListener("keydown", handleKeyDown);
    }
  };

  const cancelResize = () => {
    active.value = null;
    clearListeners();
  };

  const overlayState = computed<WidgetResizeOverlayState | null>(() => {
    const current = active.value;
    if (!current) return null;
    return {
      widgetId: current.widgetId,
      currentSize: current.currentSize,
      targetSize: current.clampedSize,
      maxSize: current.maxSize,
      limited: current.limitReason !== "none",
      limitLabel:
        current.limitLabel ||
        `最大 ${formatSize(current.maxSize.colSpan)} x ${formatSize(current.maxSize.rowSpan)}`,
    };
  });

  return {
    activeWidgetId,
    isDragging,
    overlayState,
    beginResize,
    cancelResize,
  };
}
