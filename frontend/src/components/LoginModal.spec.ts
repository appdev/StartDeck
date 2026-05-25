// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import LoginModal from "./LoginModal.vue";

let wrapper: VueWrapper | null = null;

const mountLoginModal = () => {
  wrapper = mount(LoginModal, {
    attachTo: document.body,
    props: {
      show: true,
    },
    global: {
      plugins: [
        createTestingPinia({
          createSpy: () => vi.fn(),
          initialState: {
            config: {
              systemConfig: {
                authMode: "single",
              },
            },
          },
        }),
      ],
      stubs: {
        transition: false,
      },
    },
  });
  return wrapper;
};

describe("LoginModal", () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = "";
  });

  it("uses the compact title layout and shared window close control", async () => {
    const modal = mountLoginModal();
    await modal.vm.$nextTick();

    const surface = document.body.querySelector(".sd-modal-surface");
    const closeButton = document.body.querySelector(
      ".sd-window-controls .sd-window-control-dot.is-red",
    );

    expect(surface?.classList.contains("sd-compact-window")).toBe(true);
    expect(document.body.textContent).toContain("管理员登录");
    expect(
      document.body.querySelector(".sd-window-control-dot.is-green"),
    ).not.toBeNull();
    expect(closeButton?.getAttribute("aria-label")).toBe("关闭");

    closeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await modal.vm.$nextTick();

    expect(modal.emitted("update:show")).toEqual([[false]]);
  });
});
