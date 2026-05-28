import { describe, expect, it } from "vitest";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  applyAiUsageSizeToWidget,
  createDefaultAiUsageWidget,
  normalizeAiUsageWidgetData,
} from "./aiUsageModel";
import { AI_USAGE_WIDGET_TYPE } from "./aiUsageTypes";

describe("aiUsageModel", () => {
  it("creates a private OpenAI usage widget with approved defaults", () => {
    expect(createDefaultAiUsageWidget()).toMatchObject({
      id: "ai-usage",
      type: AI_USAGE_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      isPublic: false,
      data: {
        runtime: "ai-usage",
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
        providerId: "openai",
        displayName: "OpenAI 使用量",
        iconKey: "openai",
        credentialStorage: "browser",
        credentialType: "access_token",
      },
    });
  });

  it("normalizes data without preserving raw credentials", () => {
    const normalized = normalizeAiUsageWidgetData({
      providerId: "openai",
      displayName: "Codex 额度",
      credential: "secret-token",
      accountId: "account-secret",
      authJson: { access_token: "secret" },
      sizeKey: "4x4",
      lastSummary: {
        status: "connected",
        primaryRemainingPercent: 85.4,
        weeklyRemainingPercent: 40,
      },
    });

    expect(normalized).toMatchObject({
      providerId: "openai",
      displayName: "Codex 额度",
      sizeKey: "2x2",
      lastSummary: {
        status: "connected",
        primaryRemainingPercent: 85.4,
        weeklyRemainingPercent: 40,
      },
    });
    expect(JSON.stringify(normalized)).not.toContain("secret");
  });

  it("applies all supported non-4x4 size keys", () => {
    const widget = createDefaultAiUsageWidget();

    applyAiUsageSizeToWidget(widget, "2x4");

    expect(widget).toMatchObject({
      type: AI_USAGE_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({ sizeKey: "2x4" }),
    });
  });
});
