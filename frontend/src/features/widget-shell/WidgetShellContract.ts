import {
  isItabWidgetSizeKey,
  resolveItabGridRect,
} from "@/features/itab-widgets/itabGrid";

export const ITAB_WIDGET_SHELL_CONTRACT_VERSION =
  "itab-widget-shell/2026-05-22";
export const STARTDECK_WIDGET_SHELL_CONTRACT_VERSION =
  "startdeck-home-widget-shell/2026-05-22";

export const ITAB_WIDGET_SHELL_SELECTORS = {
  root: ".itab-native-widget",
  card: ".widget-card",
  title: ".widget-title",
} as const;

export const STARTDECK_WIDGET_SHELL_SELECTORS = {
  root: "[data-main-widget-shell]",
  card: "[data-main-widget-shell-card]",
  content: "[data-main-widget-shell-content]",
  title: "[data-main-widget-shell-title]",
} as const;

export const WIDGET_SHELL_FORBIDDEN_STYLE_PROPERTIES = [
  "position",
  "inset",
  "top",
  "right",
  "bottom",
  "left",
  "z-index",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "overflow",
  "border",
  "border-radius",
  "box-shadow",
  "filter",
  "backdrop-filter",
  "transform",
] as const;

export const ITAB_WIDGET_SHELL_FORBIDDEN_SELECTORS = [
  ".itab-native-widget",
  ".widget-card",
  ".widget-title",
  ".itab-native-panel",
  ".opened-window",
  ":deep(.widget-card)",
  ":deep(.widget-title)",
  ":deep(.opened-window)",
  "body",
  "html",
  "#app",
] as const;

export const STARTDECK_WIDGET_SHELL_FORBIDDEN_SELECTORS = [
  "[data-main-widget-shell]",
  "[data-main-widget-shell-card]",
  "[data-main-widget-shell-content]",
  "[data-main-widget-shell-title]",
  ".sd-main-widget-shell",
  ".sd-main-widget-shell-card",
  ".sd-main-widget-shell-content",
  ".sd-main-widget-shell-title",
  ":deep([data-main-widget-shell])",
  ":deep([data-main-widget-shell-card])",
  ":deep([data-main-widget-shell-content])",
  ":deep([data-main-widget-shell-title])",
  ":deep(.sd-main-widget-shell)",
  ":deep(.sd-main-widget-shell-card)",
  ":deep(.sd-main-widget-shell-content)",
  ":deep(.sd-main-widget-shell-title)",
  "body",
  "html",
  "#app",
] as const;

const ITAB_ROOT_REQUIRED_STYLES = {
  position: "relative",
  display: "block",
  minWidth: "0px",
  paddingTop: "0px",
  paddingRight: "0px",
  paddingBottom: "0px",
  paddingLeft: "0px",
} as const;

const ITAB_CARD_REQUIRED_STYLES = {
  position: "absolute",
  top: "0px",
  right: "0px",
  bottom: "0px",
  left: "0px",
  overflow: "hidden",
  borderRadius: "18px",
} as const;

const ITAB_TITLE_REQUIRED_STYLES = {
  position: "absolute",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

const STARTDECK_ROOT_REQUIRED_STYLES = {
  position: "relative",
  display: "block",
  minWidth: "0px",
  minHeight: "0px",
} as const;

const STARTDECK_CARD_REQUIRED_STYLES = {
  position: "absolute",
  top: "0px",
  right: "0px",
  bottom: "0px",
  left: "0px",
  overflow: "hidden",
  borderTopWidth: "0px",
  borderRightWidth: "0px",
  borderBottomWidth: "0px",
  borderLeftWidth: "0px",
  borderRadius: "18px",
  backgroundImage: "none",
  boxShadow: "none",
} as const;

const STARTDECK_CONTENT_REQUIRED_STYLES = {
  position: "relative",
  minWidth: "0px",
  minHeight: "0px",
} as const;

const STARTDECK_TITLE_REQUIRED_STYLES = {
  position: "absolute",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

const CARD_ALLOWED_DISPLAY_VALUES = new Set([
  "block",
  "grid",
  "flex",
  "inline-flex",
]);

export type WidgetShellElementName = "root" | "card" | "title" | "content";

export type WidgetShellViolationCode =
  | "missing-root-class"
  | "missing-contract-version"
  | "missing-direct-card"
  | "missing-direct-title"
  | "missing-direct-content"
  | "invalid-style"
  | "missing-shadow"
  | "invalid-geometry"
  | "forbidden-selector"
  | "forbidden-style-property";

export type WidgetShellViolation = {
  code: WidgetShellViolationCode;
  element: WidgetShellElementName | "source";
  property?: string;
  selector?: string;
  expected: string;
  actual: string;
  message: string;
};

export type WidgetShellProfileElement = Exclude<WidgetShellElementName, "root">;

export type WidgetShellRequiredElement = {
  element: WidgetShellProfileElement;
  selector: string;
  directParent: "root" | "card";
  required: boolean;
  missingCode: Extract<
    WidgetShellViolationCode,
    "missing-direct-card" | "missing-direct-title" | "missing-direct-content"
  >;
  missingMessage: string;
};

export type WidgetShellProfile = {
  id: "itab" | "startdeck-home";
  version: string;
  selectors: Record<string, string>;
  rootSelector: string;
  rootMissingExpected: string;
  rootMissingMessage: string;
  forbiddenSelectors: readonly string[];
  forbiddenStyleProperties: readonly string[];
  requiredElements: readonly WidgetShellRequiredElement[];
  requiredStyles: Partial<
    Record<WidgetShellElementName, Record<string, string>>
  >;
  cardAllowedDisplayValues: ReadonlySet<string>;
  requireCardShadow: boolean;
  requireCardGeometryMatch: boolean;
  requireContentGeometryMatch: boolean;
  requireItabGridSizeMatch?: boolean;
  sourceStyleOwnerExpected: string;
};

export const ITAB_WIDGET_SHELL_PROFILE: WidgetShellProfile = {
  id: "itab",
  version: ITAB_WIDGET_SHELL_CONTRACT_VERSION,
  selectors: ITAB_WIDGET_SHELL_SELECTORS,
  rootSelector: ITAB_WIDGET_SHELL_SELECTORS.root,
  rootMissingExpected: ITAB_WIDGET_SHELL_SELECTORS.root,
  rootMissingMessage:
    "widget shell root must match the iTab widget shell profile",
  forbiddenSelectors: ITAB_WIDGET_SHELL_FORBIDDEN_SELECTORS,
  forbiddenStyleProperties: WIDGET_SHELL_FORBIDDEN_STYLE_PROPERTIES,
  requiredElements: [
    {
      element: "card",
      selector: ITAB_WIDGET_SHELL_SELECTORS.card,
      directParent: "root",
      required: true,
      missingCode: "missing-direct-card",
      missingMessage: "widget shell must render a direct .widget-card child",
    },
    {
      element: "title",
      selector: ITAB_WIDGET_SHELL_SELECTORS.title,
      directParent: "root",
      required: true,
      missingCode: "missing-direct-title",
      missingMessage: "widget shell must render a direct .widget-title child",
    },
  ],
  requiredStyles: {
    root: ITAB_ROOT_REQUIRED_STYLES,
    card: ITAB_CARD_REQUIRED_STYLES,
    title: ITAB_TITLE_REQUIRED_STYLES,
  },
  cardAllowedDisplayValues: CARD_ALLOWED_DISPLAY_VALUES,
  requireCardShadow: true,
  requireCardGeometryMatch: true,
  requireContentGeometryMatch: false,
  sourceStyleOwnerExpected: "shell-owned style stays in the widget shell",
};

export const STARTDECK_WIDGET_SHELL_PROFILE: WidgetShellProfile = {
  id: "startdeck-home",
  version: STARTDECK_WIDGET_SHELL_CONTRACT_VERSION,
  selectors: STARTDECK_WIDGET_SHELL_SELECTORS,
  rootSelector: STARTDECK_WIDGET_SHELL_SELECTORS.root,
  rootMissingExpected: STARTDECK_WIDGET_SHELL_SELECTORS.root,
  rootMissingMessage: "widget shell root must be rendered by MainWidgetShell",
  forbiddenSelectors: STARTDECK_WIDGET_SHELL_FORBIDDEN_SELECTORS,
  forbiddenStyleProperties: WIDGET_SHELL_FORBIDDEN_STYLE_PROPERTIES,
  requiredElements: [
    {
      element: "card",
      selector: STARTDECK_WIDGET_SHELL_SELECTORS.card,
      directParent: "root",
      required: true,
      missingCode: "missing-direct-card",
      missingMessage:
        "main widget shell must render a direct data-main-widget-shell-card child",
    },
    {
      element: "content",
      selector: STARTDECK_WIDGET_SHELL_SELECTORS.content,
      directParent: "card",
      required: true,
      missingCode: "missing-direct-content",
      missingMessage:
        "main widget shell must render a direct data-main-widget-shell-content child inside the card",
    },
    {
      element: "title",
      selector: STARTDECK_WIDGET_SHELL_SELECTORS.title,
      directParent: "root",
      required: false,
      missingCode: "missing-direct-title",
      missingMessage:
        "main widget shell title is optional but must be shell-owned when present",
    },
  ],
  requiredStyles: {
    root: STARTDECK_ROOT_REQUIRED_STYLES,
    card: STARTDECK_CARD_REQUIRED_STYLES,
    content: STARTDECK_CONTENT_REQUIRED_STYLES,
    title: STARTDECK_TITLE_REQUIRED_STYLES,
  },
  cardAllowedDisplayValues: CARD_ALLOWED_DISPLAY_VALUES,
  requireCardShadow: false,
  requireCardGeometryMatch: true,
  requireContentGeometryMatch: true,
  requireItabGridSizeMatch: true,
  sourceStyleOwnerExpected:
    "main shell owns structure only; widget content owns visual chrome",
};

export type WidgetShellValidationOptions = {
  componentId?: string;
  geometryTolerancePx?: number;
  profile?: WidgetShellProfile;
};

export type WidgetShellSourceValidationOptions = {
  profile?: WidgetShellProfile;
};

export type WidgetShellValidationResult = {
  valid: boolean;
  violations: WidgetShellViolation[];
};

export class WidgetShellContractError extends Error {
  readonly componentId?: string;
  readonly violations: WidgetShellViolation[];

  constructor(
    violations: WidgetShellViolation[],
    options: WidgetShellValidationOptions = {},
  ) {
    super(formatWidgetShellViolations(violations));
    this.name = "WidgetShellContractError";
    this.componentId = options.componentId;
    this.violations = violations;
  }
}

const directChildBySelector = (root: HTMLElement, selector: string) =>
  Array.from(root.children).find(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.matches(selector),
  ) ?? null;

const pushStyleViolations = (
  violations: WidgetShellViolation[],
  element: WidgetShellElementName,
  styles: CSSStyleDeclaration,
  expected: Record<string, string>,
) => {
  for (const [property, expectedValue] of Object.entries(expected)) {
    const actual = styles[property as keyof CSSStyleDeclaration];
    const actualValue = typeof actual === "string" ? actual : String(actual);
    if (actualValue === expectedValue) continue;
    violations.push({
      code: "invalid-style",
      element,
      property,
      expected: expectedValue,
      actual: actualValue,
      message: `${element}.${property} must be ${expectedValue}, got ${actualValue}`,
    });
  }
};

const hasUsableShadow = (boxShadow: string) =>
  boxShadow.trim() !== "" && boxShadow !== "none";

const rectsMatch = (rootRect: DOMRect, cardRect: DOMRect, tolerance: number) =>
  Math.abs(rootRect.width - cardRect.width) <= tolerance &&
  Math.abs(rootRect.height - cardRect.height) <= tolerance;

const cssPixelValue = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const contentRectMatchesCardContentBox = (
  cardRect: DOMRect,
  contentRect: DOMRect,
  cardStyles: CSSStyleDeclaration,
  tolerance: number,
) => {
  const expectedWidth = Math.max(
    0,
    cardRect.width -
      cssPixelValue(cardStyles.borderLeftWidth) -
      cssPixelValue(cardStyles.borderRightWidth),
  );
  const expectedHeight = Math.max(
    0,
    cardRect.height -
      cssPixelValue(cardStyles.borderTopWidth) -
      cssPixelValue(cardStyles.borderBottomWidth),
  );
  return (
    Math.abs(expectedWidth - contentRect.width) <= tolerance &&
    Math.abs(expectedHeight - contentRect.height) <= tolerance
  );
};

const resolveProfile = (profile?: WidgetShellProfile) =>
  profile ?? ITAB_WIDGET_SHELL_PROFILE;

export const validateWidgetShell = (
  root: HTMLElement | null | undefined,
  options: WidgetShellValidationOptions = {},
): WidgetShellValidationResult => {
  const profile = resolveProfile(options.profile);
  const violations: WidgetShellViolation[] = [];
  const tolerance = options.geometryTolerancePx ?? 0.75;

  if (!root?.matches(profile.rootSelector)) {
    violations.push({
      code: "missing-root-class",
      element: "root",
      expected: profile.rootMissingExpected,
      actual: root ? root.className || root.outerHTML : "null",
      message: profile.rootMissingMessage,
    });
    return { valid: false, violations };
  }

  const contractVersion = root.dataset.widgetShellContract ?? "";
  if (contractVersion !== profile.version) {
    violations.push({
      code: "missing-contract-version",
      element: "root",
      property: "data-widget-shell-contract",
      expected: profile.version,
      actual: contractVersion || "missing",
      message: "widget shell root must expose the active contract version",
    });
  }

  const elements: Partial<Record<WidgetShellElementName, HTMLElement>> = {
    root,
  };

  for (const requiredElement of profile.requiredElements) {
    const parent = elements[requiredElement.directParent];
    const child = parent
      ? directChildBySelector(parent, requiredElement.selector)
      : null;
    if (child) {
      elements[requiredElement.element] = child;
      continue;
    }
    if (!requiredElement.required) continue;
    violations.push({
      code: requiredElement.missingCode,
      element: requiredElement.element,
      expected: `direct child ${requiredElement.selector}`,
      actual: "missing",
      message: requiredElement.missingMessage,
    });
  }

  for (const [element, expectedStyles] of Object.entries(
    profile.requiredStyles,
  ) as Array<[WidgetShellElementName, Record<string, string>]>) {
    const target = elements[element];
    if (!target) continue;
    pushStyleViolations(
      violations,
      element,
      window.getComputedStyle(target),
      expectedStyles,
    );
  }

  const card = elements.card;
  if (card) {
    const cardStyles = window.getComputedStyle(card);
    if (!profile.cardAllowedDisplayValues.has(cardStyles.display)) {
      violations.push({
        code: "invalid-style",
        element: "card",
        property: "display",
        expected: Array.from(profile.cardAllowedDisplayValues).join(" | "),
        actual: cardStyles.display,
        message: `card.display must stay a layout container, got ${cardStyles.display}`,
      });
    }

    if (profile.requireCardShadow && !hasUsableShadow(cardStyles.boxShadow)) {
      violations.push({
        code: "missing-shadow",
        element: "card",
        property: "boxShadow",
        expected: "non-none shell shadow",
        actual: cardStyles.boxShadow,
        message:
          "widget card shadow is owned by the shell and cannot be removed",
      });
    }

    const rootRect = root.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const rootSizeKey = root.dataset.widgetSize;
    if (
      profile.requireItabGridSizeMatch &&
      rootSizeKey &&
      isItabWidgetSizeKey(rootSizeKey) &&
      rootRect.width > 0 &&
      rootRect.height > 0
    ) {
      const expectedRect = resolveItabGridRect(rootSizeKey);
      if (
        Math.abs(rootRect.width - expectedRect.width) > tolerance ||
        Math.abs(rootRect.height - expectedRect.height) > tolerance
      ) {
        violations.push({
          code: "invalid-geometry",
          element: "root",
          property: "rect",
          expected: `${expectedRect.width}x${expectedRect.height}`,
          actual: `${rootRect.width}x${rootRect.height}`,
          message:
            "main widget shell root must match the active iTab grid size",
        });
      }
    }
    if (
      profile.requireCardGeometryMatch &&
      rootRect.width > 0 &&
      rootRect.height > 0 &&
      !rectsMatch(rootRect, cardRect, tolerance)
    ) {
      violations.push({
        code: "invalid-geometry",
        element: "card",
        property: "rect",
        expected: `${rootRect.width}x${rootRect.height}`,
        actual: `${cardRect.width}x${cardRect.height}`,
        message: "widget card must exactly fill the frame root",
      });
    }

    const content = elements.content;
    if (profile.requireContentGeometryMatch && content) {
      const contentRect = content.getBoundingClientRect();
      if (
        cardRect.width > 0 &&
        cardRect.height > 0 &&
        !contentRectMatchesCardContentBox(
          cardRect,
          contentRect,
          cardStyles,
          tolerance,
        )
      ) {
        violations.push({
          code: "invalid-geometry",
          element: "content",
          property: "rect",
          expected: "card content box",
          actual: `${contentRect.width}x${contentRect.height}`,
          message:
            "widget shell content must fill the card content box without relying on computed width/height strings",
        });
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
};

export const assertWidgetShell = (
  root: HTMLElement | null | undefined,
  options: WidgetShellValidationOptions = {},
) => {
  const result = validateWidgetShell(root, options);
  if (!result.valid) {
    throw new WidgetShellContractError(result.violations, options);
  }
  return result;
};

export const formatWidgetShellViolations = (
  violations: readonly WidgetShellViolation[],
) =>
  violations
    .map(
      (violation) =>
        `[${violation.code}] ${violation.message} (expected: ${violation.expected}; actual: ${violation.actual})`,
    )
    .join("\n");

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const containsForbiddenShellSelector = (
  selectorText: string,
  forbiddenSelector: string,
) => {
  if (forbiddenSelector.startsWith(":deep(")) {
    return selectorText.includes(forbiddenSelector);
  }

  const escapedSelector = escapeRegExp(forbiddenSelector);
  const beforeSelectorBoundary = "(^|[\\s,>+~(])";
  const afterSelectorBoundary = "($|[\\s,>+~):.{#\\[])";
  return new RegExp(
    `${beforeSelectorBoundary}${escapedSelector}${afterSelectorBoundary}`,
  ).test(selectorText);
};

export const findForbiddenWidgetShellSelectors = (
  source: string,
  options: WidgetShellSourceValidationOptions = {},
) => {
  const profile = resolveProfile(options.profile);
  return profile.forbiddenSelectors.flatMap((selector) => {
    const lines = source.split(/\r?\n/);
    return lines.flatMap((line, index) =>
      containsForbiddenShellSelector(line, selector)
        ? [
            {
              code: "forbidden-selector" as const,
              selector,
              line: index + 1,
              message: `Custom widget source cannot target shell selector ${selector}`,
            },
          ]
        : [],
    );
  });
};

const lineNumberForIndex = (source: string, index: number) =>
  source.slice(0, index).split(/\r?\n/).length;

const cssRulePattern = /([^{}]+)\{([^{}]*)\}/g;

const shellOwnedSourceRules = (source: string, profile: WidgetShellProfile) => {
  const rules: Array<{
    selector: string;
    body: string;
    line: number;
  }> = [];
  let match: RegExpExecArray | null;

  while ((match = cssRulePattern.exec(source))) {
    const selector = match[1]?.trim() ?? "";
    const body = match[2] ?? "";
    if (
      !profile.forbiddenSelectors.some((forbiddenSelector) =>
        containsForbiddenShellSelector(selector, forbiddenSelector),
      )
    ) {
      continue;
    }

    rules.push({
      selector,
      body,
      line: lineNumberForIndex(source, match.index),
    });
  }

  return rules;
};

export const findForbiddenWidgetShellStyleProperties = (
  source: string,
  options: WidgetShellSourceValidationOptions = {},
) => {
  const profile = resolveProfile(options.profile);
  return shellOwnedSourceRules(source, profile).flatMap((rule) => {
    const declarations = rule.body.split(";");
    return profile.forbiddenStyleProperties.flatMap((property) => {
      const pattern = new RegExp(`(^|\\s)${property}\\s*:`, "i");
      return declarations.flatMap((declaration) =>
        pattern.test(declaration)
          ? [
              {
                code: "forbidden-style-property" as const,
                property,
                selector: rule.selector,
                line: rule.line,
                message: `Custom widget source cannot set shell-owned property ${property} on ${rule.selector}`,
              },
            ]
          : [],
      );
    });
  });
};

export const validateWidgetShellSource = (
  source: string,
  options: WidgetShellSourceValidationOptions = {},
): WidgetShellValidationResult => {
  const profile = resolveProfile(options.profile);
  const selectorViolations: WidgetShellViolation[] =
    findForbiddenWidgetShellSelectors(source, { profile }).map((violation) => ({
      code: violation.code,
      element: "source",
      selector: violation.selector,
      expected: "custom widget content selectors only",
      actual: `${violation.selector} at line ${violation.line}`,
      message: violation.message,
    }));

  const styleViolations: WidgetShellViolation[] =
    findForbiddenWidgetShellStyleProperties(source, { profile }).map(
      (violation) => ({
        code: violation.code,
        element: "source",
        property: violation.property,
        selector: violation.selector,
        expected: profile.sourceStyleOwnerExpected,
        actual: `${violation.property} on ${violation.selector} at line ${violation.line}`,
        message: violation.message,
      }),
    );

  const violations = [...selectorViolations, ...styleViolations];
  return {
    valid: violations.length === 0,
    violations,
  };
};

export const assertWidgetShellSource = (
  source: string,
  options: WidgetShellSourceValidationOptions = {},
) => {
  const result = validateWidgetShellSource(source, options);
  if (!result.valid) {
    throw new WidgetShellContractError(result.violations);
  }
  return result;
};
