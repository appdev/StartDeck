// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import ConfirmDialog from "@/components/base/ConfirmDialog.vue";

let wrapper: VueWrapper | null = null;

const mountDialog = (props: Record<string, unknown> = {}) => {
  wrapper = mount(ConfirmDialog, {
    attachTo: document.body,
    props: {
      show: true,
      title: "删除确认",
      message: "确定删除这个卡片吗？",
      confirmLabel: "删除",
      cancelLabel: "取消",
      tone: "danger",
      ...props,
    },
    global: {
      stubs: {
        transition: false,
      },
    },
  });
  return wrapper;
};

describe("ConfirmDialog", () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = "";
  });

  it("uses a blocking alertdialog contract by default", async () => {
    mountDialog();
    await nextTick();
    await nextTick();

    const panel = document.body.querySelector("[role='alertdialog']");
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute("aria-modal")).toBe("true");
    expect(panel?.getAttribute("aria-labelledby")).toBeTruthy();
    expect(panel?.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.body.querySelector("[aria-label='关闭']")).toBeNull();
    expect(document.activeElement?.textContent).toBe("取消");
  });

  it("ignores outside click and Escape in blocking mode", async () => {
    const dialog = mountDialog();
    await nextTick();

    document.body
      .querySelector(".overlay-motion-root")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    await nextTick();

    expect(dialog.emitted("update:show")).toBeUndefined();
    expect(dialog.emitted("cancel")).toBeUndefined();
    expect(document.body.textContent).toContain("删除确认");
  });

  it("still closes through the explicit safe cancel action", async () => {
    const dialog = mountDialog();
    await nextTick();

    const cancel = document.body.querySelector("[data-modal-cancel]");
    cancel?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();

    expect(dialog.emitted("cancel")).toHaveLength(1);
    expect(dialog.emitted("update:show")).toEqual([[false]]);
  });
});
