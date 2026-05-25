// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import EditModal from "./EditModal.vue";
import type { NavItem } from "@/types";

const mountEditModal = (data: NavItem) =>
  mount(EditModal, {
    attachTo: document.body,
    props: {
      show: true,
      data,
      groupId: "links",
      onSave: vi.fn(async () => undefined),
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
      document.body.querySelector(".edit-card-icon-editor"),
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
});
