import type { WidgetConfig } from "@/types";
import {
  resolveRuntimeWidgetSize,
  resolveRuntimeWidgetSizeKey,
  type RuntimeWidgetSizeKey,
} from "./widgetRuntimeSizes";

export const DOCKER_WIDGET_TYPE = "docker";
export const DOCKER_RUNTIME = "docker";
export const DOCKER_DEFAULT_SIZE: RuntimeWidgetSizeKey = "2x2";

export const SYSTEM_STATUS_WIDGET_TYPE = "system-status";
export const SYSTEM_STATUS_RUNTIME = "system-status";
export const SYSTEM_STATUS_DEFAULT_SIZE: RuntimeWidgetSizeKey = "1x1";

export interface DockerWidgetRuntimeData extends Record<string, unknown> {
  runtime: typeof DOCKER_RUNTIME;
  version: number;
  sizeKey: RuntimeWidgetSizeKey;
  autoUpdate?: boolean;
  autoUpdateKeepImages?: number;
  autoUpdateMinFreeGB?: number;
  lanHost?: string;
  publicHost?: string;
  publicHosts?: Record<string, string>;
  disabledContainers?: string[];
}

export interface SystemStatusWidgetRuntimeData extends Record<string, unknown> {
  runtime: typeof SYSTEM_STATUS_RUNTIME;
  version: number;
  sizeKey: RuntimeWidgetSizeKey;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const resolveRuntimeSize = (
  type: string,
  fallback: RuntimeWidgetSizeKey,
  value: unknown,
): RuntimeWidgetSizeKey => {
  const sizeKey =
    isRecord(value) && typeof value.sizeKey === "string"
      ? value.sizeKey
      : undefined;
  return (
    resolveRuntimeWidgetSizeKey(type, {
      sizeKey,
    }) || fallback
  );
};

export const normalizeDockerWidgetData = (
  value: unknown,
): DockerWidgetRuntimeData => {
  const source = isRecord(value) ? { ...value } : {};
  delete source.useMock;
  return {
    ...source,
    runtime: DOCKER_RUNTIME,
    version: typeof source.version === "number" ? source.version : 1,
    sizeKey: resolveRuntimeSize(
      DOCKER_WIDGET_TYPE,
      DOCKER_DEFAULT_SIZE,
      source,
    ),
  };
};

export const normalizeSystemStatusWidgetData = (
  value: unknown,
): SystemStatusWidgetRuntimeData => {
  const source = isRecord(value) ? { ...value } : {};
  delete source.useMock;
  return {
    ...source,
    runtime: SYSTEM_STATUS_RUNTIME,
    version: typeof source.version === "number" ? source.version : 1,
    sizeKey: resolveRuntimeSize(
      SYSTEM_STATUS_WIDGET_TYPE,
      SYSTEM_STATUS_DEFAULT_SIZE,
      source,
    ),
  };
};

const applySizeToWidget = (
  widget: WidgetConfig,
  type: string,
  sizeKey: RuntimeWidgetSizeKey,
  normalize: (value: unknown) => Record<string, unknown>,
) => {
  const resolvedSizeKey = resolveRuntimeWidgetSizeKey(type, { sizeKey });
  if (!resolvedSizeKey) return;
  const size = resolveRuntimeWidgetSize(resolvedSizeKey);
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
  widget.data = {
    ...normalize(widget.data),
    sizeKey: resolvedSizeKey,
  };
};

export const applyDockerWidgetSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: RuntimeWidgetSizeKey,
) => {
  applySizeToWidget(
    widget,
    DOCKER_WIDGET_TYPE,
    sizeKey,
    normalizeDockerWidgetData,
  );
};

export const applySystemStatusWidgetSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: RuntimeWidgetSizeKey,
) => {
  applySizeToWidget(
    widget,
    SYSTEM_STATUS_WIDGET_TYPE,
    sizeKey,
    normalizeSystemStatusWidgetData,
  );
};
