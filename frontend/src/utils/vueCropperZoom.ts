export type VueCropperHandle = {
  trueWidth?: number | string;
  trueHeight?: number | string;
  scale?: number | string;
  changeScale?: (step: number) => false | void;
  getCropData?: (callback: (data: string) => void) => void;
};

export type CropperZoomResult = {
  applied: boolean;
  zoom: number;
};

const ZOOM_PIXEL_STEP = 20;
const EPSILON = 0.000001;

const toPositiveNumber = (
  value: number | string | undefined,
): number | null => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : null;
};

export const readCropperScale = (
  cropper: VueCropperHandle | null | undefined,
): number | null => toPositiveNumber(cropper?.scale);

export const resolveCropperChangeScaleStep = (
  cropper: VueCropperHandle | null | undefined,
  previousZoom: number,
  nextZoom: number,
  baseScale: number,
): number | null => {
  const trueWidth = toPositiveNumber(cropper?.trueWidth);
  const trueHeight = toPositiveNumber(cropper?.trueHeight);
  const resolvedBaseScale = toPositiveNumber(baseScale);

  if (!trueWidth || !trueHeight || !resolvedBaseScale) return null;

  const cropperStep = Math.min(
    ZOOM_PIXEL_STEP / trueWidth,
    ZOOM_PIXEL_STEP / trueHeight,
  );
  if (!Number.isFinite(cropperStep) || cropperStep <= 0) return null;

  const targetScaleDelta = (nextZoom - previousZoom) * resolvedBaseScale;
  if (Math.abs(targetScaleDelta) < EPSILON) return 0;

  return targetScaleDelta / cropperStep;
};

export const applyCropperZoom = (
  cropper: VueCropperHandle | null | undefined,
  previousZoom: number,
  nextZoom: number,
  baseScale: number,
): CropperZoomResult => {
  if (!cropper?.changeScale) return { applied: false, zoom: previousZoom };

  const step = resolveCropperChangeScaleStep(
    cropper,
    previousZoom,
    nextZoom,
    baseScale,
  );
  if (step === null) return { applied: false, zoom: previousZoom };
  if (Math.abs(step) < EPSILON) return { applied: true, zoom: previousZoom };

  const result = cropper.changeScale(step);
  const actualScale = readCropperScale(cropper);
  const resolvedBaseScale = toPositiveNumber(baseScale);
  const resolvedZoom =
    actualScale && resolvedBaseScale
      ? actualScale / resolvedBaseScale
      : nextZoom;

  return {
    applied: result !== false,
    zoom: result === false ? resolvedZoom : nextZoom,
  };
};
