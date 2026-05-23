import { ITAB_RUNTIME_VISUAL_RESOURCES } from "@/features/itab-widgets/generated/itabResourceClient.generated";
import { ITAB_VISUAL_BINDINGS } from "@/features/itab-widgets/generated/itabVisualBindings.generated";
import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";

export type ItabRenderMode = "fixture" | "live";

export type ItabRuntimeVisualResource = {
  visualResourceId: string;
  componentId: string;
  state: "body" | "opened";
  sizeKey?: ItabWidgetSizeKey;
  role: string;
  renderMode:
    | "proxy-by-resource-id"
    | "startdeck-owned-css"
    | "startdeck-owned-svg"
    | "fixture-only-qa"
    | "omit";
  fallbackId?: string;
  dynamicFieldBindingId?: string;
};

export type ItabDynamicBindingStatus = {
  ok: boolean;
  issues: string[];
};

export const getItabVisualBinding = (componentId: string) =>
  ITAB_VISUAL_BINDINGS.find((binding) => binding.componentId === componentId);

export const getItabRuntimeResources = (
  componentId: string,
  mode: ItabRenderMode,
  filter: {
    state?: "body" | "opened";
    sizeKey?: ItabWidgetSizeKey;
  } = {},
) =>
  (
    ITAB_RUNTIME_VISUAL_RESOURCES as readonly ItabRuntimeVisualResource[]
  ).filter((resource) => {
    if (resource.componentId !== componentId) return false;
    if (filter.state && resource.state !== filter.state) return false;
    if (
      filter.sizeKey &&
      "sizeKey" in resource &&
      resource.sizeKey !== filter.sizeKey
    ) {
      return false;
    }
    return mode === "fixture" || resource.renderMode !== "fixture-only-qa";
  });

export const getItabRuntimeResourceById = (
  visualResourceId: string | undefined,
  mode: ItabRenderMode,
) => {
  if (!visualResourceId) return undefined;
  const resource = (
    ITAB_RUNTIME_VISUAL_RESOURCES as readonly ItabRuntimeVisualResource[]
  ).find((item) => item.visualResourceId === visualResourceId);
  if (!resource) return undefined;
  if (mode === "live" && resource.renderMode === "fixture-only-qa")
    return undefined;
  return resource;
};

export const resolveItabResourceUrl = (
  resource: ItabRuntimeVisualResource,
  mode: ItabRenderMode,
) => {
  if (resource.renderMode === "proxy-by-resource-id") {
    return `/api/itab-resources/${encodeURIComponent(resource.visualResourceId)}`;
  }
  if (resource.renderMode === "fixture-only-qa" && mode === "fixture") {
    return `/api/itab-resources/${encodeURIComponent(resource.visualResourceId)}`;
  }
  return "";
};

export const resolveItabResourceUrlById = (
  visualResourceId: string | undefined,
  mode: ItabRenderMode,
) => {
  const resource = getItabRuntimeResourceById(visualResourceId, mode);
  return resource ? resolveItabResourceUrl(resource, mode) : "";
};

export const validateItabDynamicBindings = (
  mode: ItabRenderMode = "live",
  componentId?: string,
): ItabDynamicBindingStatus => {
  const issues: string[] = [];
  const allResources =
    ITAB_RUNTIME_VISUAL_RESOURCES as readonly ItabRuntimeVisualResource[];
  const resources = componentId
    ? allResources.filter((resource) => resource.componentId === componentId)
    : allResources;

  for (const resource of resources) {
    if (mode === "live" && resource.renderMode === "fixture-only-qa") {
      continue;
    }
    if (!resource.dynamicFieldBindingId && resource.renderMode !== "omit") {
      issues.push(`${resource.visualResourceId}: missing dynamic binding`);
    }
    if (resource.renderMode === "proxy-by-resource-id") {
      const url = resolveItabResourceUrl(resource, mode);
      if (!url.startsWith("/api/itab-resources/")) {
        issues.push(
          `${resource.visualResourceId}: proxy resource does not use resourceId endpoint`,
        );
      }
    }
  }

  const bindings = componentId
    ? ITAB_VISUAL_BINDINGS.filter(
        (binding) => binding.componentId === componentId,
      )
    : ITAB_VISUAL_BINDINGS;
  for (const binding of bindings) {
    if (!binding.liveMode.adapterKind) {
      issues.push(`${binding.componentId}: missing live adapter`);
    }
    if (
      mode === "live" &&
      binding.fixtureMode.allowedRoute === "/qa/itab-widgets"
    ) {
      continue;
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
};
