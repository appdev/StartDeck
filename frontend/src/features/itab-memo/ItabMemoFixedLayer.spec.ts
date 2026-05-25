// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "@/stores/auth";
import ItabMemoFixedLayer from "./ItabMemoFixedLayer.vue";
import { ITAB_MEMO_WIDGET_TYPE } from "./itabMemoTypes";

const componentSource = readFileSync(
  "src/features/itab-memo/ItabMemoFixedLayer.vue",
  "utf8",
);

const widget = {
  id: "memo",
  type: ITAB_MEMO_WIDGET_TYPE,
  enable: true,
  isPublic: true,
  data: {
    runtime: "itab-memo",
    version: 1,
    notes: [
      {
        id: "fixed",
        title: "固定备忘",
        body: "固定在桌面",
        pinned: true,
        createdAt: "2026-05-22T00:00:00.000Z",
        updatedAt: "2026-05-22T00:01:00.000Z",
      },
    ],
  },
};

describe("ItabMemoFixedLayer", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.token = "token";
    auth.username = "ying";
  });

  it("renders pinned memo notes in the fixed layer", () => {
    const wrapper = mount(ItabMemoFixedLayer, {
      props: { widget },
    });

    expect(wrapper.find("[data-itab-memo-fixed-layer]").exists()).toBe(true);
    expect(wrapper.find(".notes-fixed-item").text()).toContain("固定备忘");
  });

  it("uses backdrop blur instead of only changing opacity", () => {
    expect(componentSource).toContain(
      "backdrop-filter: blur(10px) saturate(116%);",
    );
    expect(componentSource).toContain(
      "-webkit-backdrop-filter: blur(10px) saturate(116%);",
    );
    expect(componentSource).toContain(
      "background: var(--sd-theme-itab-memo-memo-fixed-layer-surface-01);",
    );
    expect(componentSource).not.toContain(
      "border: 1px solid rgba(255, 255, 255, 0.2);",
    );
  });
});
