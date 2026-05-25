import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import AppModalShell from "./AppModalShell.vue";

const mountShell = (scheme: "auto" | "light" | "dark") =>
  mount(AppModalShell, {
    props: {
      show: true,
      title: "Theme shell",
      scheme,
      teleportDisabled: true,
    },
    global: {
      stubs: {
        OverlayMotion: {
          props: ["show"],
          template: '<div v-if="show"><slot /></div>',
        },
      },
    },
  });

describe("AppModalShell theme scheme", () => {
  it("does not set a local scheme when following the root theme", () => {
    const wrapper = mountShell("auto");
    expect(wrapper.find(".sd-modal-surface").attributes("data-sd-scheme")).toBe(
      undefined,
    );
  });

  it("keeps explicit shell overrides available for nested surfaces", () => {
    const wrapper = mountShell("dark");
    expect(wrapper.find(".sd-modal-surface").attributes("data-sd-scheme")).toBe(
      "dark",
    );
  });
});
