// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import AiUsageOpenedPanel from "./AiUsageOpenedPanel.vue";
import { useUiFeedbackStore } from "@/stores/uiFeedback";
import { createDefaultAiUsageWidget } from "./aiUsageModel";

describe("AiUsageOpenedPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("saves sanitized widget data while keeping credentials outside widget data", async () => {
    localStorage.clear();
    localStorage.setItem("start-deck-username", "ying");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ success: true })),
    );

    const wrapper = mount(AiUsageOpenedPanel, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              auth: {
                sessionReady: true,
                isLogged: true,
                username: "ying",
                sessionGeneration: "test-session",
              },
            },
          }),
        ],
      },
      props: {
        widget: createDefaultAiUsageWidget(),
      },
    });

    await wrapper
      .find('input[type="password"]')
      .setValue("secret-access-token");
    await wrapper.find(".actions .primary").trigger("click");
    await flushPromises();

    const emitted = wrapper.emitted("updateData")?.[0]?.[0];
    expect(emitted).toMatchObject({
      providerId: "openai",
      displayName: "OpenAI 使用量",
      credentialStorage: "browser",
    });
    expect(JSON.stringify(emitted)).not.toContain("secret-access-token");
    expect(
      localStorage.getItem(
        "startdeck:ai-usage:credential:ying:ai-usage:openai",
      ),
    ).toContain("secret-access-token");
  });

  it("blocks guest credential saves with a toast", async () => {
    localStorage.clear();

    const wrapper = mount(AiUsageOpenedPanel, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
      },
      props: {
        widget: createDefaultAiUsageWidget(),
      },
    });
    const feedback = useUiFeedbackStore();

    await wrapper.find('input[type="password"]').setValue("guest-secret-token");
    await wrapper.find(".actions .primary").trigger("click");
    await flushPromises();

    expect(wrapper.emitted("updateData")).toBeUndefined();
    expect(
      localStorage.getItem(
        "startdeck:ai-usage:credential:guest:ai-usage:openai",
      ),
    ).toBeNull();
    expect(feedback.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "需要登录",
        message: "请先登录后再配置 AI 使用量组件。",
        tone: "warning",
      }),
    );
  });
});
