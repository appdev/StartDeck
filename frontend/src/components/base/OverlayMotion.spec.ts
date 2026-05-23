// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import OverlayMotion from "@/components/base/OverlayMotion.vue";

const wrappers: VueWrapper[] = [];

const mountOverlay = (props: Record<string, unknown> = {}) => {
  const wrapper = mount(OverlayMotion, {
    attachTo: document.body,
    props: {
      show: true,
      teleportDisabled: true,
      ...props,
    },
    slots: {
      default: `
        <button type="button" data-modal-cancel>Cancel</button>
        <button type="button">Confirm</button>
      `,
    },
    global: {
      stubs: {
        transition: false,
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
};

describe("OverlayMotion", () => {
  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    document.body.innerHTML = "";
  });

  it("emits an overlay close reason when overlay dismissal is enabled", async () => {
    const wrapper = mountOverlay({ closeOnOverlay: true });

    await wrapper.find(".overlay-motion-root").trigger("click");

    expect(wrapper.emitted("close")).toEqual([["overlay"]]);
    expect(wrapper.emitted("dismiss-attempt")).toBeUndefined();
  });

  it("reports blocked overlay and Escape dismiss attempts without closing", async () => {
    const wrapper = mountOverlay({
      closeOnOverlay: false,
      closeOnEscape: false,
    });

    await wrapper.find(".overlay-motion-root").trigger("click");
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    await nextTick();

    expect(wrapper.emitted("close")).toBeUndefined();
    expect(wrapper.emitted("dismiss-attempt")).toEqual([
      ["overlay"],
      ["escape"],
    ]);
  });

  it("only lets the topmost overlay handle Escape", async () => {
    const lower = mountOverlay({ closeOnEscape: true });
    const upper = mountOverlay({ closeOnEscape: true });

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    await nextTick();

    expect(lower.emitted("close")).toBeUndefined();
    expect(upper.emitted("close")).toEqual([["escape"]]);
  });

  it("focuses the cancel action and restores the trigger focus", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open";
    document.body.appendChild(trigger);
    trigger.focus();

    const wrapper = mountOverlay({
      trapFocus: true,
      restoreFocus: true,
      initialFocus: "cancel",
    });
    await nextTick();
    await nextTick();

    expect(document.activeElement?.textContent).toBe("Cancel");

    await wrapper.setProps({ show: false });
    await nextTick();
    await nextTick();

    expect(document.activeElement).toBe(trigger);
  });

  it("keeps the popover root clickable so outside click dismissal works in browser", () => {
    const wrapper = mountOverlay({
      variant: "popover",
      closeOnOverlay: true,
    });

    expect(wrapper.find(".overlay-motion-root").classes()).not.toContain(
      "pointer-events-none",
    );
  });

  it("locks document scrolling for dialog overlays and restores it on close", async () => {
    const wrapper = mountOverlay({ variant: "dialog" });

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.touchAction).toBe("none");

    await wrapper.setProps({ show: false });
    await nextTick();
    await nextTick();

    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.touchAction || "").toBe("");
  });
});
