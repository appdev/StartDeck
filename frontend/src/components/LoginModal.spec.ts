// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import LoginModal from "./LoginModal.vue";
import { useMainStore } from "../stores/main";
import { useUiFeedbackStore } from "@/stores/uiFeedback";

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

  it("shows a toast instead of an alert when the password is incorrect", async () => {
    const modal = mountLoginModal();
    const store = useMainStore();
    const uiFeedback = useUiFeedbackStore();
    vi.mocked(store.login).mockRejectedValueOnce(
      new Error("password_incorrect\n"),
    );

    const passwordInput = document.body.querySelector<HTMLInputElement>(
      'input[type="password"]',
    );
    const loginButton =
      document.body.querySelector<HTMLButtonElement>("button.sd-btn-primary");
    expect(passwordInput).not.toBeNull();
    expect(loginButton).not.toBeNull();

    passwordInput!.value = "bad-password";
    passwordInput!.dispatchEvent(new Event("input", { bubbles: true }));
    loginButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();

    expect(uiFeedback.notify).toHaveBeenCalledWith({
      title: "登录失败",
      message: "密码错误，请重新输入。",
      tone: "danger",
    });
    expect(uiFeedback.alert).not.toHaveBeenCalled();
    expect(modal.emitted("update:show")).toBeUndefined();
    expect(passwordInput!.value).toBe("");
  });
});
