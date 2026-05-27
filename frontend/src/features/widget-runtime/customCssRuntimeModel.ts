import type { WidgetConfig } from "@/types";
import {
  resolveRuntimeWidgetSize,
  resolveRuntimeWidgetSizeKey,
  type RuntimeWidgetSizeKey,
} from "./widgetRuntimeSizes";

export const CUSTOM_CSS_WIDGET_TYPE = "custom-css";
export const CUSTOM_CSS_RUNTIME = "custom-css";
export const CUSTOM_CSS_DEFAULT_SIZE: RuntimeWidgetSizeKey = "1x1";

export interface CustomCssWidgetRuntimeData extends Record<string, unknown> {
  runtime: typeof CUSTOM_CSS_RUNTIME;
  version: number;
  sizeKey: RuntimeWidgetSizeKey;
  title: string;
  html: string;
  css: string;
  js?: string;
}

const DEFAULT_CUSTOM_CSS_TITLE = "自定义组件";
const DEFAULT_CUSTOM_CSS_HTML =
  '<div class="my-custom-component">\n  <h3>自定义组件</h3>\n  <p>点击打开后编辑内容</p>\n</div>';
const DEFAULT_CUSTOM_CSS_CSS =
  ".my-custom-component {\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  border-radius: 16px;\n  background: #ffffff;\n  color: #111827;\n  text-align: center;\n  font-weight: 700;\n}\n.my-custom-component h3 {\n  margin: 0;\n  font-size: 14px;\n}\n.my-custom-component p {\n  margin: 0;\n  color: #64748b;\n  font-size: 11px;\n}";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringValue = (value: unknown, fallback: string) =>
  typeof value === "string" ? value : fallback;

export const normalizeCustomCssWidgetData = (
  value: unknown,
): CustomCssWidgetRuntimeData => {
  const source = isRecord(value) ? { ...value } : {};
  const sizeKey =
    resolveRuntimeWidgetSizeKey(CUSTOM_CSS_WIDGET_TYPE, {
      sizeKey: typeof source.sizeKey === "string" ? source.sizeKey : undefined,
    }) || CUSTOM_CSS_DEFAULT_SIZE;

  return {
    ...source,
    runtime: CUSTOM_CSS_RUNTIME,
    version: typeof source.version === "number" ? source.version : 1,
    sizeKey,
    title: stringValue(source.title, DEFAULT_CUSTOM_CSS_TITLE),
    html: stringValue(source.html, DEFAULT_CUSTOM_CSS_HTML),
    css: stringValue(source.css, DEFAULT_CUSTOM_CSS_CSS),
    js: stringValue(source.js, ""),
  };
};

export const applyCustomCssWidgetSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: RuntimeWidgetSizeKey,
) => {
  const resolvedSizeKey =
    resolveRuntimeWidgetSizeKey(CUSTOM_CSS_WIDGET_TYPE, { sizeKey }) ||
    CUSTOM_CSS_DEFAULT_SIZE;
  const size = resolveRuntimeWidgetSize(resolvedSizeKey);
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
  widget.data = {
    ...normalizeCustomCssWidgetData(widget.data),
    sizeKey: resolvedSizeKey,
  };
};
