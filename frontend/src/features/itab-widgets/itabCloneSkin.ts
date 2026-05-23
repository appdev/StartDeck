import { ITAB_CLONE_SKINS } from "@/features/itab-widgets/generated/itabCloneSkins.generated";
import { ITAB_SEMANTIC_EXPECTATIONS } from "@/features/itab-widgets/generated/itabSemanticExpectations.generated";
import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";

export type ItabVisualMode = "clone-skin" | "panel-skin" | "dom-native";
export type ItabDataMode = "fixture" | "live";

export type ItabCloneSkinSlot = (typeof ITAB_CLONE_SKINS)[number];
export type ItabSemanticExpectation =
  (typeof ITAB_SEMANTIC_EXPECTATIONS)[number];

export const getItabCloneSkin = (
  componentId: string,
  state: "body" | "opened",
  sizeKey?: ItabWidgetSizeKey,
) =>
  ITAB_CLONE_SKINS.find(
    (skin) =>
      skin.componentId === componentId &&
      skin.state === state &&
      ("sizeKey" in skin ? skin.sizeKey === sizeKey : state === "opened"),
  );

export const getItabSemanticExpectation = (
  componentId: string,
  state: "body" | "opened",
  sizeKey?: ItabWidgetSizeKey,
) =>
  ITAB_SEMANTIC_EXPECTATIONS.find(
    (expectation) =>
      expectation.componentId === componentId &&
      expectation.state === state &&
      ("sizeKey" in expectation
        ? expectation.sizeKey === sizeKey
        : state === "opened"),
  );

export const resolveItabMode = (options: {
  renderMode?: "fixture" | "live";
  visualMode?: ItabVisualMode;
  dataMode?: ItabDataMode;
}) => ({
  visualMode: options.visualMode || "clone-skin",
  dataMode:
    options.dataMode || (options.renderMode === "fixture" ? "fixture" : "live"),
});
