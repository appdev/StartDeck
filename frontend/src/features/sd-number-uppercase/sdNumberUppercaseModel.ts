import type { WidgetConfig } from "@/types";
import {
  SD_WIDGET_SIZE_BY_KEY,
  resolveSdWidgetSize,
  toSdWidgetSizeKey,
  type SdWidgetSizeKey,
} from "@/features/sd-widgets/sdSizePresets";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  SD_NUMBER_UPPERCASE_CATALOG_ID,
  SD_NUMBER_UPPERCASE_DATA_VERSION,
  SD_NUMBER_UPPERCASE_DEFAULT_SIZE,
  SD_NUMBER_UPPERCASE_RUNTIME,
  SD_NUMBER_UPPERCASE_WIDGET_TYPE,
  type SdNumberUppercaseWidgetData,
} from "./sdNumberUppercaseTypes";

const DIGITS = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
const SECTION_DIGIT_UNITS = ["", "拾", "佰", "仟"];
const SECTION_UNITS = ["", "万", "亿", "兆"];
const DECIMAL_UNITS = ["角", "分"];
const FULL_WIDTH_DIGITS = "０１２３４５６７８９";
const MAX_INTEGER_DIGITS = 16;
const MAX_DECIMAL_DIGITS = 2;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isSdNumberUppercaseSizeKey = (
  value: unknown,
): value is SdWidgetSizeKey =>
  typeof value === "string" &&
  SD_WIDGET_SIZE_BY_KEY.has(value as SdWidgetSizeKey);

export const normalizeSdNumberInput = (value: unknown) => {
  const source = typeof value === "string" ? value : String(value ?? "");
  let integerPart = "";
  let decimalPart = "";
  let hasDecimalPoint = false;

  for (const char of source.trim().replace(/[,，\s]/g, "")) {
    const fullWidthIndex = FULL_WIDTH_DIGITS.indexOf(char);
    const digit =
      fullWidthIndex >= 0
        ? String(fullWidthIndex)
        : char >= "0" && char <= "9"
          ? char
          : "";

    if (digit) {
      if (hasDecimalPoint) {
        if (decimalPart.length < MAX_DECIMAL_DIGITS) decimalPart += digit;
      } else if (integerPart.length < MAX_INTEGER_DIGITS) {
        integerPart += digit;
      }
      continue;
    }
    if ((char === "." || char === "。") && !hasDecimalPoint) {
      hasDecimalPoint = true;
    }
  }

  if (!integerPart && !hasDecimalPoint) return "";
  if (hasDecimalPoint) return `${integerPart || "0"}.${decimalPart}`;
  return integerPart;
};

const splitIntegerSections = (value: string) => {
  const sections: string[] = [];
  for (let end = value.length; end > 0; end -= 4) {
    sections.unshift(value.slice(Math.max(0, end - 4), end));
  }
  return sections;
};

const formatIntegerSection = (value: string) => {
  const padded = value.padStart(4, "0");
  let output = "";
  let zeroPending = false;

  for (let index = 0; index < padded.length; index += 1) {
    const numeric = Number.parseInt(padded[index] || "0", 10);
    if (numeric === 0) {
      if (output) zeroPending = true;
      continue;
    }
    if (zeroPending) {
      output += "零";
      zeroPending = false;
    }
    output += `${DIGITS[numeric]}${SECTION_DIGIT_UNITS[padded.length - index - 1]}`;
  }

  return output;
};

const formatIntegerAmount = (value: string) => {
  const integerPart = value.replace(/^0+(?=\d)/, "") || "0";
  if (integerPart === "0") return "零";

  const sections = splitIntegerSections(integerPart);
  let output = "";
  let zeroPending = false;

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index] || "";
    const numeric = Number.parseInt(section, 10);
    const unit = SECTION_UNITS[sections.length - index - 1] || "";

    if (numeric === 0) {
      if (output) zeroPending = true;
      continue;
    }

    if (output && (zeroPending || section.padStart(4, "0").startsWith("0"))) {
      output += "零";
    }
    output += `${formatIntegerSection(section)}${unit}`;
    zeroPending = false;
  }

  return output || "零";
};

const formatDecimalSection = (value: string) => {
  let output = "";
  for (let index = 0; index < DECIMAL_UNITS.length; index += 1) {
    const numeric = Number.parseInt(value[index] || "0", 10);
    if (numeric !== 0) output += `${DIGITS[numeric]}${DECIMAL_UNITS[index]}`;
  }
  return output;
};

export const formatSdNumberUppercaseAmount = (value: unknown) => {
  const input = normalizeSdNumberInput(value);
  if (!input || input === ".") return "";

  const [integerPart = "0", decimalPart = ""] = input.split(".");
  const decimalOutput = formatDecimalSection(
    decimalPart.padEnd(MAX_DECIMAL_DIGITS, "0").slice(0, MAX_DECIMAL_DIGITS),
  );

  return `${formatIntegerAmount(integerPart)}元${decimalOutput || "整"}`;
};

export const resolveSdNumberUppercaseResult = (inputNumber: unknown) =>
  formatSdNumberUppercaseAmount(inputNumber);

export const normalizeSdNumberUppercaseWidgetData = (
  raw: unknown,
): SdNumberUppercaseWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isSdNumberUppercaseSizeKey(input.sizeKey)
    ? input.sizeKey
    : SD_NUMBER_UPPERCASE_DEFAULT_SIZE;
  const inputNumber = normalizeSdNumberInput(input.inputNumber);
  const uppercaseResult = resolveSdNumberUppercaseResult(inputNumber);

  return {
    runtime: SD_NUMBER_UPPERCASE_RUNTIME,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    version: SD_NUMBER_UPPERCASE_DATA_VERSION,
    sizeKey,
    inputNumber,
    uppercaseResult,
    formatMode: "currency",
  };
};

export const createDefaultSdNumberUppercaseWidget = (): WidgetConfig => {
  const size = resolveSdWidgetSize(SD_NUMBER_UPPERCASE_DEFAULT_SIZE);
  return {
    id: SD_NUMBER_UPPERCASE_CATALOG_ID,
    type: SD_NUMBER_UPPERCASE_WIDGET_TYPE,
    enable: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: normalizeSdNumberUppercaseWidgetData({}),
  };
};

export const applySdNumberUppercaseSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: SdWidgetSizeKey,
) => {
  const size = resolveSdWidgetSize(sizeKey);
  const data = normalizeSdNumberUppercaseWidgetData(widget.data);
  widget.type = SD_NUMBER_UPPERCASE_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies SdNumberUppercaseWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncSdNumberUppercaseSizeFromWidgetSpans = (
  widget: WidgetConfig,
) => {
  const sizeKey = toSdWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applySdNumberUppercaseSizeToWidget(widget, sizeKey);
};
