// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { describe, expect, it, vi } from "vitest";
import AiUsageWidget from "./AiUsageWidget.vue";
import { createDefaultAiUsageWidget } from "./aiUsageModel";

describe("AiUsageWidget", () => {
  it.each(["1x1", "1x2", "2x1", "2x2", "2x4"] as const)(
    "renders the approved AI usage size %s without exposing config controls",
    (sizeKey) => {
      const widget = createDefaultAiUsageWidget();
      widget.data = {
        ...(widget.data as Record<string, unknown>),
        sizeKey,
        lastSummary: {
          providerId: "openai",
          status: "connected",
          primaryRemainingPercent: 85,
          weeklyRemainingPercent: 40,
        },
      };
      const wrapper = mount(AiUsageWidget, {
        global: {
          plugins: [createTestingPinia({ createSpy: vi.fn })],
        },
        props: {
          widget,
          sizeKey,
        },
      });

      expect(wrapper.attributes("data-ai-usage-size")).toBe(sizeKey);
      expect(wrapper.text()).toContain("85%");
      expect(wrapper.text()).toContain("40%");
      expect(wrapper.text()).not.toContain("credential");
      if (sizeKey === "1x1") {
        expect(wrapper.find(".ai-provider-icon").exists()).toBe(false);
      } else {
        expect(wrapper.find(".ai-provider-icon").exists()).toBe(true);
      }
      wrapper.unmount();
    },
  );
});
