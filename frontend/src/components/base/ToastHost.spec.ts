// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import ToastHost from "./ToastHost.vue";

let wrapper: VueWrapper | null = null;

describe("ToastHost", () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = "";
  });

  it("teleports notifications to the document body", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    wrapper = mount(ToastHost, {
      attachTo: host,
      props: {
        items: [
          {
            id: 1,
            title: "登录失败",
            message: "密码错误，请重新输入。",
            tone: "danger",
          },
        ],
      },
    });
    await wrapper.vm.$nextTick();

    const toastHost = document.body.querySelector(".sd-toast-host");
    expect(toastHost).not.toBeNull();
    expect(toastHost?.parentElement).toBe(document.body);
    expect(toastHost?.textContent).toContain("密码错误，请重新输入。");
  });
});
