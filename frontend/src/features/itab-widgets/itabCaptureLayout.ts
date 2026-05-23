import { ITAB_CAPTURE_GEOMETRY } from "@/features/itab-widgets/generated/itabGeometry.generated";
import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";

type GeneratedRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type GeneratedElement = {
  key: string;
  tag?: string;
  text?: string;
  className?: string;
  resourceRef?: string;
  rect: GeneratedRect;
  style?: Record<string, string>;
};

type GeneratedSizeGeometry = {
  sizeKey: ItabWidgetSizeKey;
  title: string;
  label: string;
  base: {
    width: number;
    height: number;
  };
  rootStyle: Record<string, string>;
  layers: readonly GeneratedElement[];
  images: readonly GeneratedElement[];
  texts: readonly GeneratedElement[];
};

export type ItabCaptureLayoutElement = {
  key: string;
  tag: string;
  text: string;
  className: string;
  resourceRef?: string;
  role: "text" | "layer" | "image";
  style: Record<string, string>;
};

export type ItabCaptureLayout = {
  captureIndex: number;
  sizeKey: ItabWidgetSizeKey;
  title: string;
  label: string;
  base: {
    width: number;
    height: number;
  };
  className: string;
  rootStyle: Record<string, string>;
  layers: ItabCaptureLayoutElement[];
  images: ItabCaptureLayoutElement[];
  texts: ItabCaptureLayoutElement[];
};

const geometryByIndex = new Map<
  number,
  Record<ItabWidgetSizeKey, GeneratedSizeGeometry>
>(
  ITAB_CAPTURE_GEOMETRY.map((record) => [
    record.captureIndex,
    record.sizes as unknown as Record<ItabWidgetSizeKey, GeneratedSizeGeometry>,
  ]),
);

const px = (value: number) => `${Math.round(value * 1000) / 1000}px`;

const rectStyle = (rect: GeneratedRect): Record<string, string> => ({
  left: px(rect.x),
  top: px(rect.y),
  width: px(rect.w),
  height: px(rect.h),
});

const textAlignForClass = (className = "") => {
  if (/text-right/.test(className)) return "right";
  if (/ac|text-center/.test(className)) return "center";
  return "left";
};

const captureClassName = (captureIndex: number, sizeKey: ItabWidgetSizeKey) =>
  [
    "itab-capture-card",
    `is-capture-${captureIndex}`,
    `is-capture-size-${sizeKey}`,
  ].join(" ");

const toLayer = (
  element: GeneratedElement,
  index: number,
  role: "layer" | "image" | "text",
): ItabCaptureLayoutElement => ({
  key: `${role}-${index}-${element.key}`,
  tag: element.tag || "div",
  text: role === "text" ? element.text || "" : "",
  resourceRef: element.resourceRef,
  className:
    role === "text"
      ? `capture-text ${element.className || ""}`
      : role === "image"
        ? `capture-image ${element.className || ""}`
        : `capture-layer ${element.className || ""}`,
  role,
  style: {
    ...rectStyle(element.rect),
    ...(role === "text"
      ? {
          color: element.style?.color || "inherit",
          fontSize: element.style?.fontSize || "12px",
          fontWeight: element.style?.fontWeight || "400",
          lineHeight:
            element.style?.lineHeight || element.style?.fontSize || "normal",
          textAlign: textAlignForClass(element.className),
          whiteSpace: element.style?.whiteSpace || "nowrap",
        }
      : role === "image"
        ? {
            background:
              element.style?.backgroundColor || "rgba(255, 255, 255, 0.24)",
            borderRadius: element.style?.borderRadius || "8px",
          }
        : {}),
    ...element.style,
  },
});

export const getItabCaptureLayout = (
  captureIndex: number,
  sizeKey: ItabWidgetSizeKey,
): ItabCaptureLayout | undefined => {
  const capture = geometryByIndex.get(captureIndex)?.[sizeKey];
  if (!capture) return undefined;

  return {
    captureIndex,
    sizeKey,
    title: capture.title,
    label: capture.label,
    base: capture.base,
    className: captureClassName(captureIndex, sizeKey),
    rootStyle: {
      width: "100%",
      height: "100%",
      borderRadius: capture.rootStyle.borderRadius || "18px",
      boxShadow:
        capture.rootStyle.boxShadow || "rgba(0, 0, 0, 0.1) 0px 0px 5px 0px",
      ...(capture.rootStyle.backgroundColor
        ? { background: capture.rootStyle.backgroundColor }
        : {}),
    },
    layers: capture.layers.map((element, index) =>
      toLayer(element, index, "layer"),
    ),
    images: capture.images.map((element, index) =>
      toLayer(element, index, "image"),
    ),
    texts: capture.texts.map((element, index) =>
      toLayer(element, index, "text"),
    ),
  };
};
