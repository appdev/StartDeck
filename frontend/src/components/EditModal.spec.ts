// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import EditModal from "./EditModal.vue";
import type { NavItem } from "@/types";

const editModalSource = readFileSync("src/components/EditModal.vue", "utf8");

const mountEditModal = (data: NavItem, onSave = vi.fn(async () => undefined)) =>
  mount(EditModal, {
    attachTo: document.body,
    props: {
      show: true,
      data,
      groupId: "links",
      onSave,
    },
    global: {
      plugins: [
        createTestingPinia({
          createSpy: () => vi.fn(),
          initialState: {
            groups: {
              groups: [
                {
                  id: "links",
                  title: "链接",
                  isPublic: true,
                  items: [data],
                },
              ],
            },
            config: {
              appConfig: {
                cardLayout: "vertical",
                iconShape: "rounded",
                daylightModeEnabled: false,
              },
            },
          },
        }),
      ],
      stubs: {
        IconShape: {
          props: ["icon"],
          template: '<div data-testid="icon-shape">{{ icon }}</div>',
        },
        IconUploader: true,
        IconSelectionModal: true,
        VueCropper: true,
        transition: false,
      },
    },
  });

describe("EditModal", () => {
  let wrapper: VueWrapper | null = null;

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("renders the edit-card shell for a link card with backup URLs", async () => {
    wrapper = mountEditModal({
      id: "link-1",
      title: "Link Card",
      url: "https://example.com",
      lanUrl: "http://192.168.1.2",
      icon: "https://example.com/favicon.ico",
      isPublic: true,
      backupUrls: ["https://backup.example.com"],
      backupLanUrls: [{ name: "NAS", url: "http://192.168.1.3" }],
    });
    await wrapper.vm.$nextTick();

    expect(document.body.querySelector(".edit-card-surface")).not.toBeNull();
    expect(document.body.textContent).toContain("修改项目");
    const inputValues = Array.from(
      document.body.querySelectorAll<HTMLInputElement>("input"),
    ).map((input) => input.value);
    expect(inputValues).toContain("Link Card");
    expect(inputValues).toContain("https://backup.example.com");
    expect(inputValues).toContain("NAS");
  });

  it("exposes an explicit icon upload action with stable spacing hooks", async () => {
    wrapper = mountEditModal({
      id: "link-1",
      title: "Link Card",
      url: "https://example.com",
      icon: "https://example.com/favicon.ico",
      isPublic: true,
    });
    await wrapper.vm.$nextTick();

    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => undefined);
    const uploadButton = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="edit-card-upload-icon"]',
    );
    expect(uploadButton).not.toBeNull();
    expect(uploadButton?.textContent).toContain("上传图标");
    expect(
      document.body.querySelector(".edit-card-icon-appearance-grid"),
    ).not.toBeNull();
    expect(
      document.body.querySelector(".edit-card-icon-url-row"),
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-testid="edit-card-icon-file-input"]'),
    ).not.toBeNull();

    uploadButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await wrapper.vm.$nextTick();

    expect(inputClick).toHaveBeenCalledTimes(1);
  });

  it("places links before base info and keeps extra addresses collapsed by default", async () => {
    wrapper = mountEditModal({
      id: "link-1",
      title: "Link Card",
      url: "https://example.com",
      icon: "https://example.com/favicon.ico",
      titleColor: "#000000",
      isPublic: true,
    });
    await wrapper.vm.$nextTick();

    const bodyText = document.body.textContent || "";
    expect(bodyText.indexOf("链接")).toBeLessThan(bodyText.indexOf("基础信息"));

    const linkMatchRow = document.body.querySelector(
      ".edit-card-link-match-row",
    );
    expect(linkMatchRow).not.toBeNull();
    expect(linkMatchRow?.textContent).toContain("自动获取");
    expect(
      document.body.querySelector(".edit-card-section-link"),
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-testid="edit-card-backup-url-row"]'),
    ).toBeNull();
    expect(
      document.body.querySelector(
        '[data-testid="edit-card-backup-lan-url-row"]',
      ),
    ).toBeNull();
    const addExtraButton = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent?.includes("添加其他地址"));
    expect(addExtraButton).not.toBeNull();

    addExtraButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await wrapper.vm.$nextTick();

    expect(
      document.body.querySelectorAll(
        '[data-testid="edit-card-backup-url-row"]',
      ),
    ).toHaveLength(1);
    const addWanButton = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent?.includes("添加备用公网"));
    addWanButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await wrapper.vm.$nextTick();
    const addLanButton = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent?.includes("添加备用内网"));
    addLanButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    addLanButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await wrapper.vm.$nextTick();

    expect(
      document.body.querySelectorAll(
        '[data-testid="edit-card-backup-url-row"]',
      ),
    ).toHaveLength(2);
    expect(
      document.body.querySelectorAll(
        '[data-testid="edit-card-backup-lan-url-row"]',
      ),
    ).toHaveLength(2);
    expect(document.body.textContent).toContain("公网地址");
    expect(document.body.textContent).toContain("内网地址");
    expect(document.body.querySelector(".edit-card-icon-toolbar")).toBeNull();
    expect(document.body.textContent).not.toContain("标题颜色");
    expect(editModalSource).not.toContain(
      '<label class="sd-label">标题颜色</label>',
    );
  });

  it("preserves legacy titleColor and group save wiring without showing group in base info", async () => {
    wrapper = mountEditModal({
      id: "link-1",
      title: "Link Card",
      url: "https://example.com",
      icon: "https://example.com/favicon.ico",
      titleColor: "#123456",
      isPublic: true,
    });
    await wrapper.vm.$nextTick();

    const basicText =
      document.body.querySelector(".edit-card-section-basic")?.textContent ||
      "";
    const advancedText =
      document.body.querySelector(".edit-card-section-advanced")?.textContent ||
      "";
    expect(basicText).toContain("标题");
    expect(basicText).toContain("公开");
    expect(basicText).not.toContain("分组");
    expect(advancedText).toContain("分组");
    expect(editModalSource).toContain("groupId: localGroupId.value");

    expect(editModalSource).toContain(
      'titleColor: props.data.titleColor || ""',
    );
    expect(editModalSource).toContain("item: { ...form.value");
    expect(editModalSource).toContain("groupId: localGroupId.value");
  });

  it("keeps shared window control dots out of edit-card header button theming", () => {
    expect(editModalSource).toContain(
      ".edit-card-header-actions :deep(button:not(.sd-window-control-dot))",
    );
    expect(editModalSource).toContain(
      ".edit-card-header-actions :deep(button:not(.sd-window-control-dot):hover)",
    );
    expect(editModalSource).toContain(
      'class="edit-card-form-pane custom-scrollbar"',
    );
    expect(editModalSource).toContain("<AppButton");
    expect(editModalSource).not.toContain(
      ".edit-card-header-actions :deep(button) {",
    );
    expect(editModalSource).not.toContain(
      ".edit-card-header-actions :deep(button:hover)",
    );
    expect(editModalSource).toContain(":global(.edit-card-panel:focus)");
    expect(editModalSource).toContain("outline: none;");
  });
});
