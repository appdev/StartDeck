import { computed } from "vue";
import type { WidgetConfig } from "@/types";
import { toWidgetSizeKey } from "@/utils/widgetSizePresets";

export type WidgetDisplaySizeTier = "compact" | "wide" | "large" | "board";

type WidgetSizeInput = Pick<WidgetConfig, "w" | "h" | "colSpan" | "rowSpan">;

export const resolveWidgetDisplaySize = (widget?: WidgetSizeInput) => {
  const colSpan = widget?.w ?? widget?.colSpan ?? 1;
  const rowSpan = widget?.h ?? widget?.rowSpan ?? 1;
  const sizeKey =
    toWidgetSizeKey({ colSpan, rowSpan }) || `${colSpan}x${rowSpan}`;
  const tier: WidgetDisplaySizeTier =
    colSpan >= 4 && rowSpan >= 2
      ? "board"
      : rowSpan >= 2
        ? "large"
        : colSpan >= 2
          ? "wide"
          : "compact";

  return {
    colSpan,
    rowSpan,
    sizeKey,
    tier,
    isHalf: false,
    isCompact: tier === "compact",
    isWide: tier === "wide",
    isLarge: tier === "large",
    isBoard: tier === "board",
    isSquare: colSpan === rowSpan,
    className: `sd-widget-size-${sizeKey.replace(".", "_")}`,
  };
};

export const useWidgetDisplaySize = (
  widget: () => WidgetSizeInput | undefined,
) => {
  const displaySize = computed(() => resolveWidgetDisplaySize(widget()));

  return {
    displaySize,
    displaySizeClass: computed(() => displaySize.value.className),
  };
};
