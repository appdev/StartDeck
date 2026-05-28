import { describe, expect, it } from "vitest";
import {
  AI_USAGE_PROVIDERS,
  getAiUsageProvider,
  isAiUsageProviderQueryAvailable,
} from "./aiUsageProviders";

describe("aiUsageProviders", () => {
  it("uses real provider SVG assets and only enables OpenAI querying in v1", () => {
    expect(AI_USAGE_PROVIDERS.map((provider) => provider.id)).toEqual([
      "openai",
      "claude",
      "deepseek",
    ]);
    expect(getAiUsageProvider("openai").iconUrl).toBe(
      "/ai-usage/providers/openai.svg",
    );
    expect(getAiUsageProvider("claude").iconUrl).toBe(
      "/ai-usage/providers/claude-color.svg",
    );
    expect(getAiUsageProvider("deepseek").iconUrl).toBe(
      "/ai-usage/providers/deepseek-color.svg",
    );
    expect(isAiUsageProviderQueryAvailable("openai")).toBe(true);
    expect(isAiUsageProviderQueryAvailable("claude")).toBe(false);
    expect(isAiUsageProviderQueryAvailable("deepseek")).toBe(false);
  });
});
