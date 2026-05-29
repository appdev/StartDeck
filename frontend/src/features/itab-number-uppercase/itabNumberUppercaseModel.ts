import type { WidgetConfig } from "@/types";
import {
  ITAB_WIDGET_SIZE_BY_KEY,
  resolveItabWidgetSize,
  toItabWidgetSizeKey,
  type ItabWidgetSizeKey,
} from "@/features/itab-widgets/itabSizePresets";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  ITAB_NUMBER_UPPERCASE_CATALOG_ID,
  ITAB_NUMBER_UPPERCASE_DATA_VERSION,
  ITAB_NUMBER_UPPERCASE_DEFAULT_SIZE,
  ITAB_NUMBER_UPPERCASE_RUNTIME,
  ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
  type ItabNumberUppercaseWidgetData,
} from "./itabNumberUppercaseTypes";

const DIGITS = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
const SECTION_DIGIT_UNITS = ["", "拾", "佰", "仟"];
const SECTION_UNITS = ["", "万", "亿", "兆"];
const DECIMAL_UNITS = ["角", "分"];
const FULL_WIDTH_DIGITS = "０１２３４５６７８９";
const MAX_INTEGER_DIGITS = 16;
const MAX_DECIMAL_DIGITS = 2;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isItabNumberUppercaseSizeKey = (
  value: unknown,
): value is ItabWidgetSizeKey =>
  typeof value === "string" &&
  ITAB_WIDGET_SIZE_BY_KEY.has(value as ItabWidgetSizeKey);

export const normalizeItabNumberInput = (value: unknown) => {
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

export const formatItabNumberUppercaseAmount = (value: unknown) => {
  const input = normalizeItabNumberInput(value);
  if (!input || input === ".") return "";

  const [integerPart = "0", decimalPart = ""] = input.split(".");
  const decimalOutput = formatDecimalSection(
    decimalPart.padEnd(MAX_DECIMAL_DIGITS, "0").slice(0, MAX_DECIMAL_DIGITS),
  );

  return `${formatIntegerAmount(integerPart)}元${decimalOutput || "整"}`;
};

export const resolveItabNumberUppercaseResult = (inputNumber: unknown) =>
  formatItabNumberUppercaseAmount(inputNumber);

export const normalizeItabNumberUppercaseWidgetData = (
  raw: unknown,
): ItabNumberUppercaseWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isItabNumberUppercaseSizeKey(input.sizeKey)
    ? input.sizeKey
    : ITAB_NUMBER_UPPERCASE_DEFAULT_SIZE;
  const inputNumber = normalizeItabNumberInput(input.inputNumber);
  const uppercaseResult = resolveItabNumberUppercaseResult(inputNumber);

  return {
    runtime: ITAB_NUMBER_UPPERCASE_RUNTIME,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    version: ITAB_NUMBER_UPPERCASE_DATA_VERSION,
    sizeKey,
    inputNumber,
    uppercaseResult,
    formatMode: "currency",
  };
};

export const createDefaultItabNumberUppercaseWidget = (): WidgetConfig => {
  const size = resolveItabWidgetSize(ITAB_NUMBER_UPPERCASE_DEFAULT_SIZE);
  return {
    id: ITAB_NUMBER_UPPERCASE_CATALOG_ID,
    type: ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
    enable: true,
    isPublic: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: normalizeItabNumberUppercaseWidgetData({}),
  };
};

export const applyItabNumberUppercaseSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: ItabWidgetSizeKey,
) => {
  const size = resolveItabWidgetSize(sizeKey);
  const data = normalizeItabNumberUppercaseWidgetData(widget.data);
  widget.type = ITAB_NUMBER_UPPERCASE_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies ItabNumberUppercaseWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncItabNumberUppercaseSizeFromWidgetSpans = (
  widget: WidgetConfig,
) => {
  const sizeKey = toItabWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applyItabNumberUppercaseSizeToWidget(widget, sizeKey);
};
