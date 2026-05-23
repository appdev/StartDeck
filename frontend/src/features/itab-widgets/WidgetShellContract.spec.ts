import { describe, expect, it } from "vitest";

import {
  assertWidgetShell,
  assertWidgetShellSource,
  findForbiddenWidgetShellSelectors,
  findForbiddenWidgetShellStyleProperties,
  validateWidgetShell,
  validateWidgetShellSource,
  WIDGET_SHELL_CONTRACT_VERSION,
  WidgetShellContractError,
} from "./WidgetShellContract";
import {
  STARTDECK_WIDGET_SHELL_CONTRACT_VERSION,
  STARTDECK_WIDGET_SHELL_PROFILE,
} from "../widget-shell/WidgetShellContract";

const rect = (width: number, height: number) =>
  ({
    x: 0,
    y: 0,
    top: 0,
    right: width,
    bottom: height,
    left: 0,
    width,
    height,
    toJSON: () => ({}),
  }) as DOMRect;

const buildValidShell = () => {
  const root = document.createElement("button");
  root.className = "itab-native-widget";
  root.dataset.widgetShellContract = WIDGET_SHELL_CONTRACT_VERSION;
  root.style.position = "relative";
  root.style.display = "block";
  root.style.minWidth = "0px";
  root.style.padding = "0";

  const card = document.createElement("span");
  card.className = "widget-card";
  card.style.position = "absolute";
  card.style.top = "0px";
  card.style.right = "0px";
  card.style.bottom = "0px";
  card.style.left = "0px";
  card.style.display = "block";
  card.style.overflow = "hidden";
  card.style.borderRadius = "18px";
  card.style.boxShadow = "0 12px 26px rgba(0, 0, 0, 0.21)";

  const title = document.createElement("span");
  title.className = "widget-title";
  title.style.position = "absolute";
  title.style.overflow = "hidden";
  title.style.textOverflow = "ellipsis";
  title.style.whiteSpace = "nowrap";

  root.append(card, title);
  root.getBoundingClientRect = () => rect(150, 150);
  card.getBoundingClientRect = () => rect(150, 150);

  document.body.append(root);
  return { root, card, title };
};

const buildValidStartDeckShell = () => {
  const root = document.createElement("div");
  root.className = "sd-main-widget-shell";
  root.dataset.mainWidgetShell = "";
  root.dataset.mainShellManaged = "true";
  root.dataset.widgetShellContract = STARTDECK_WIDGET_SHELL_CONTRACT_VERSION;
  root.dataset.widgetType = "weather";
  root.dataset.widgetSize = "2x2";
  root.style.position = "relative";
  root.style.display = "block";
  root.style.minWidth = "0px";
  root.style.minHeight = "0px";

  const card = document.createElement("div");
  card.className = "sd-main-widget-shell-card";
  card.dataset.mainWidgetShellCard = "";
  card.style.position = "absolute";
  card.style.top = "0px";
  card.style.right = "0px";
  card.style.bottom = "0px";
  card.style.left = "0px";
  card.style.display = "block";
  card.style.overflow = "hidden";
  card.style.borderWidth = "0px";
  card.style.borderRadius = "18px";
  card.style.backgroundImage = "none";
  card.style.boxShadow = "none";

  const content = document.createElement("div");
  content.className = "sd-main-widget-shell-content";
  content.dataset.mainWidgetShellContent = "";
  content.style.position = "relative";
  content.style.width = "100%";
  content.style.height = "100%";
  content.style.minWidth = "0px";
  content.style.minHeight = "0px";

  card.append(content);
  root.append(card);
  root.getBoundingClientRect = () => rect(150, 150);
  card.getBoundingClientRect = () => rect(150, 150);
  content.getBoundingClientRect = () => rect(150, 150);

  document.body.append(root);
  return { root, card, content };
};

const appendValidStartDeckTitle = (root: HTMLElement) => {
  const title = document.createElement("div");
  title.className = "sd-main-widget-shell-title";
  title.dataset.mainWidgetShellTitle = "";
  title.style.position = "absolute";
  title.style.overflow = "hidden";
  title.style.textOverflow = "ellipsis";
  title.style.whiteSpace = "nowrap";
  root.append(title);
  return title;
};

describe("WidgetShellContract", () => {
  it("accepts the centralized frame shell structure and computed styles", () => {
    const { root } = buildValidShell();

    expect(validateWidgetShell(root)).toEqual({
      valid: true,
      violations: [],
    });
    expect(assertWidgetShell(root).valid).toBe(true);
  });

  it("keeps the default validation profile pinned to iTab selectors", () => {
    const { root } = buildValidStartDeckShell();

    expect(validateWidgetShell(root)).toEqual(
      expect.objectContaining({ valid: false }),
    );
    expect(validateWidgetShell(root).violations).toContainEqual(
      expect.objectContaining({
        code: "missing-root-class",
        expected: ".itab-native-widget",
      }),
    );
  });

  it("accepts the StartDeck main shell profile without iTab DOM classes", () => {
    const { root } = buildValidStartDeckShell();

    expect(
      validateWidgetShell(root, { profile: STARTDECK_WIDGET_SHELL_PROFILE }),
    ).toEqual({
      valid: true,
      violations: [],
    });
    expect(root.className).not.toContain("itab");
  });

  it("accepts a StartDeck shell-owned title as a root child outside the clipped card", () => {
    const { root, card } = buildValidStartDeckShell();
    const title = appendValidStartDeckTitle(root);

    const result = validateWidgetShell(root, {
      profile: STARTDECK_WIDGET_SHELL_PROFILE,
    });

    expect(result).toEqual({ valid: true, violations: [] });
    expect(title.parentElement).toBe(root);
    expect(card.contains(title)).toBe(false);
  });

  it("rejects borders on the StartDeck shell card so component chrome stays content-owned", () => {
    const { root, card, content } = buildValidStartDeckShell();
    card.style.border = "1px solid rgba(255, 255, 255, 0.68)";
    content.style.width = "148px";
    content.style.height = "148px";
    root.getBoundingClientRect = () => rect(150, 150);
    card.getBoundingClientRect = () => rect(150, 150);
    content.getBoundingClientRect = () => rect(148, 148);

    const result = validateWidgetShell(root, {
      profile: STARTDECK_WIDGET_SHELL_PROFILE,
    });

    expect(result).toEqual({
      valid: false,
      violations: expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-style",
          element: "card",
          property: "borderTopWidth",
          expected: "0px",
          actual: "1px",
        }),
      ]),
    });
  });

  it("rejects StartDeck shell card background and shadow chrome", () => {
    const { root, card } = buildValidStartDeckShell();
    card.style.backgroundImage =
      "linear-gradient(rgb(251, 251, 253), rgb(243, 245, 248))";
    card.style.boxShadow = "0 18px 42px rgba(15, 23, 42, 0.16)";

    const result = validateWidgetShell(root, {
      profile: STARTDECK_WIDGET_SHELL_PROFILE,
    });

    expect(result).toEqual({
      valid: false,
      violations: expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-style",
          element: "card",
          property: "backgroundImage",
          expected: "none",
        }),
        expect.objectContaining({
          code: "invalid-style",
          element: "card",
          property: "boxShadow",
          expected: "none",
        }),
      ]),
    });
  });

  it("reports shell-owned style mutations instead of allowing them silently", () => {
    const { root, card } = buildValidShell();
    card.style.borderRadius = "24px";
    card.style.boxShadow = "none";

    const result = validateWidgetShell(root);

    expect(result.valid).toBe(false);
    expect(result.violations.map((violation) => violation.code)).toContain(
      "invalid-style",
    );
    expect(result.violations.map((violation) => violation.code)).toContain(
      "missing-shadow",
    );
    expect(() => assertWidgetShell(root)).toThrow(WidgetShellContractError);
  });

  it("requires the card to fill the widget frame geometry", () => {
    const { root, card } = buildValidShell();
    root.getBoundingClientRect = () => rect(150, 150);
    card.getBoundingClientRect = () => rect(120, 150);

    const result = validateWidgetShell(root);

    expect(result.valid).toBe(false);
    expect(result.violations).toContainEqual(
      expect.objectContaining({
        code: "invalid-geometry",
        element: "card",
      }),
    );
  });

  it("finds shell selectors and shell-owned CSS properties that custom widgets cannot own", () => {
    const source = `
      .user-card { position: relative; border-radius: 12px; color: red; }
      .widget-card { border-radius: 24px; }
      :deep(.opened-window) { box-shadow: none; }
    `;

    expect(findForbiddenWidgetShellSelectors(source)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ selector: ".widget-card" }),
        expect.objectContaining({ selector: ":deep(.opened-window)" }),
      ]),
    );
    expect(findForbiddenWidgetShellStyleProperties(source)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: "border-radius" }),
        expect.objectContaining({ property: "box-shadow" }),
      ]),
    );
    expect(validateWidgetShellSource(source)).toEqual(
      expect.objectContaining({
        valid: false,
      }),
    );
    expect(() => assertWidgetShellSource(source)).toThrow(
      WidgetShellContractError,
    );
  });

  it("allows custom widget content to own its own internal layout styles", () => {
    const source = `
      .content-body .user-card,
      #app-card {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
      }
    `;

    expect(findForbiddenWidgetShellSelectors(source)).toEqual([]);
    expect(findForbiddenWidgetShellStyleProperties(source)).toEqual([]);
    expect(validateWidgetShellSource(source)).toEqual({
      valid: true,
      violations: [],
    });
  });

  it("rejects StartDeck shell-owned selectors through the StartDeck profile", () => {
    const source = `
      .sd-main-widget-shell-card { border-radius: 30px; }
      [data-main-widget-shell-content] { overflow: hidden; }
    `;

    expect(
      findForbiddenWidgetShellSelectors(source, {
        profile: STARTDECK_WIDGET_SHELL_PROFILE,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ selector: ".sd-main-widget-shell-card" }),
        expect.objectContaining({
          selector: "[data-main-widget-shell-content]",
        }),
      ]),
    );
    expect(
      validateWidgetShellSource(source, {
        profile: STARTDECK_WIDGET_SHELL_PROFILE,
      }),
    ).toEqual(expect.objectContaining({ valid: false }));
  });
});
