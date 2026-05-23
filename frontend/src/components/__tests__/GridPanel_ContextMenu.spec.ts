// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises, mount, VueWrapper } from "@vue/test-utils";
import GridPanel from "../GridPanel.vue";
import ConfirmDialog from "../base/ConfirmDialog.vue";
import { createTestingPinia } from "@pinia/testing";
import { useMainStore } from "../../stores/main";
import { useUiFeedbackStore } from "../../stores/uiFeedback";
import { useAuthStore } from "../../stores/auth";
import type { AddComponentPayload } from "../../utils/addComponentTypes";

// Mock dependencies
vi.mock("vue-draggable-plus", () => ({
  VueDraggable: {
    template: "<div><slot /></div>",
    props: [
      "modelValue",
      "group",
      "disabled",
      "sort",
      "handle",
      "move",
      "animation",
      "forceFallback",
      "ghostClass",
    ],
  },
}));

vi.mock("grid-layout-plus", () => ({
  GridLayout: {
    name: "GridLayout",
    template: "<div><slot /></div>",
    props: [
      "layout",
      "colNum",
      "rowHeight",
      "isDraggable",
      "isResizable",
      "verticalCompact",
      "useCssTransforms",
      "margin",
    ],
  },
  GridItem: {
    name: "GridItem",
    template: '<div class="grid-item"><slot /></div>',
    props: [
      "x",
      "y",
      "w",
      "h",
      "i",
      "dragAllowFrom",
      "dragIgnoreFrom",
      "dragOption",
    ],
    emits: ["move", "moved"],
  },
}));

// Mock composables
vi.mock("../composables/useWallpaperRotation", () => ({
  useWallpaperRotation: () => {},
}));
vi.mock("../composables/useDevice", () => ({
  useDevice: () => ({
    deviceKey: { value: "desktop" },
    isMobile: { value: false },
  }),
}));

// Mock utils
vi.mock("../utils/gridLayout", () => ({
  generateLayout: (widgets: Record<string, unknown>[]) =>
    widgets.map((w: Record<string, unknown>) => ({
      ...w,
      i: w.id,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    })),
  compactVertical: (layout: unknown[]) => layout,
}));
vi.mock("@/utils/network", () => ({
  isInternalNetwork: () => false,
  getNetworkConfig: () => ({
    internalDomains: "",
    networkRules: "",
    forceNetworkMode: "auto",
    latencyThresholdMs: 200,
  }),
  computeEffectiveNetworkMode: () => ({
    isLan: false,
    reason: "test",
    measuredLatencyMs: 0,
  }),
}));

describe("GridPanel Context Menu", () => {
  let wrapper: VueWrapper;
  let store: ReturnType<typeof useMainStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/api/ip")) {
          return new Response(
            JSON.stringify({
              success: true,
              ip: "127.0.0.1",
              clientIp: "127.0.0.1",
              clientIpSource: "test",
              location: "test",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.startsWith("/api/ping")) {
          return new Response(JSON.stringify({ success: true, latency: 1 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    document.body.innerHTML = "";
    Object.defineProperty(window.HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });

    wrapper = mount(GridPanel, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: () => vi.fn().mockResolvedValue(undefined),
            initialState: {
              auth: {
                token: "test-token",
              },
              widgets: {
                widgets: [
                  {
                    id: "div-card-1",
                    type: "div-card",
                    data: { title: "Test Div Card" },
                    x: 0,
                    y: 0,
                    w: 1,
                    h: 1,
                    i: "div-card-1",
                    enable: true,
                    isPublic: true,
                  },
                  {
                    id: "calculator-1",
                    type: "calculator",
                    x: 1,
                    y: 0,
                    w: 1,
                    h: 1,
                    i: "calculator-1",
                    enable: true,
                    isPublic: true,
                  },
                ],
              },
              groups: {
                groups: [],
              },
              config: {
                appConfig: {},
              },
            },
          }),
        ],
        stubs: {
          CalculatorWidget: true,
          CountdownWidget: true,
          CountUpWidget: true,
          IframeWidget: true,
          BookmarkWidget: true,
          HotWidget: true,
          RssWidget: true,
          DockerWidget: true,
          SystemStatusWidget: true,
          CustomCssWidget: true,
          FileTransferWidget: true,
          IconShape: true,
          AppSidebar: true,
          EditModal: true,
          SettingsModal: true,
          GroupSettingsModal: true,
          AddWidgetModal: {
            props: ["show"],
            template: '<div v-if="show" data-testid="itab-add-modal"></div>',
          },
          LoginModal: true,
          SizeSelector: true,
          transition: false,
        },
      },
    });
    store = useMainStore();
  });

  afterEach(() => {
    wrapper.unmount();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("renders div-card widget correctly", () => {
    const divCard = wrapper.find(".div-card-click-target");
    expect(divCard.exists()).toBe(true);
    expect(divCard.text()).toContain("Test Div Card");
  });

  it("enables iTab-style whole-card dragging outside edit mode", () => {
    const gridLayout = wrapper.findComponent({ name: "GridLayout" });
    expect(gridLayout.exists()).toBe(true);
    expect(gridLayout.props("isDraggable")).toBe(true);

    const gridItem = wrapper.findComponent({ name: "GridItem" });
    expect(gridItem.exists()).toBe(true);
    expect(gridItem.props("dragAllowFrom")).toBeUndefined();
    expect(gridItem.props("dragIgnoreFrom")).toContain("button");
    expect(gridItem.props("dragIgnoreFrom")).toContain(
      "[data-grid-drag-ignore]",
    );
    expect(gridItem.props("dragIgnoreFrom")).toContain(
      "[data-itab-inner-control]",
    );
    expect(gridItem.props("dragOption")).toMatchObject({
      hold: 200,
      delay: 200,
    });
  });

  it("closes widget context menus when a home widget drag begins", async () => {
    const divCard = wrapper.find(".div-card-click-target");
    await divCard.trigger("contextmenu", { clientX: 12, clientY: 16 });
    await wrapper.vm.$nextTick();

    expect(
      document.body.querySelector("[data-grid-context-menu]"),
    ).not.toBeNull();

    const gridItem = wrapper.findComponent({ name: "GridItem" });
    gridItem.vm.$emit("move", "div-card-1", 1, 0);
    await wrapper.vm.$nextTick();
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(document.body.querySelector("[data-grid-context-menu]")).toBeNull();
  });

  it("opens context menu on right click on div-card", async () => {
    const divCard = wrapper.find(".div-card-click-target");
    await divCard.trigger("contextmenu", { clientX: 12, clientY: 16 });
    await wrapper.vm.$nextTick();

    const menu = document.body.querySelector("[data-grid-context-menu]");
    expect(menu).not.toBeNull();

    // Check menu items
    expect(menu?.textContent).toContain("编辑卡片");
    expect(menu?.textContent).toContain("删除卡片");

    // Check SVGs are present (w-4 h-4 class)
    const svgs = menu?.querySelectorAll("svg.w-4.h-4") ?? [];
    expect(svgs.length).toBeGreaterThan(0);
  });

  it("opens the iTab blank-area context menu without replacing card menus", async () => {
    const homeSurface = wrapper.find(".flex-1");
    expect(homeSurface.exists()).toBe(true);

    await homeSurface.trigger("contextmenu", { clientX: 40, clientY: 60 });
    await wrapper.vm.$nextTick();

    const blankMenu = document.body.querySelector(
      '[data-testid="itab-add-context-menu"]',
    );
    expect(blankMenu).not.toBeNull();
    expect(blankMenu?.textContent).toContain("添加图标");
    expect(blankMenu?.textContent).toContain("换壁纸");
    expect(blankMenu?.textContent).toContain("本地搜索");
    expect(blankMenu?.textContent).toContain("立即备份");
    expect(blankMenu?.textContent).toContain("设置");

    const divCard = wrapper.find(".div-card-click-target");
    await divCard.trigger("contextmenu", { clientX: 12, clientY: 16 });
    await wrapper.vm.$nextTick();

    const menus = Array.from(
      document.body.querySelectorAll("[data-grid-context-menu]"),
    );
    expect(menus.some((menu) => menu.textContent?.includes("编辑卡片"))).toBe(
      true,
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(
      document.body.querySelector('[data-testid="itab-add-context-menu"]'),
    ).toBeNull();
  });

  it("does not open the blank-area menu from excluded interactive targets", async () => {
    const actionButton = wrapper.find(
      '[data-testid="home-top-actions"] button',
    );
    expect(actionButton.exists()).toBe(true);

    await actionButton.trigger("contextmenu", { clientX: 40, clientY: 60 });
    await wrapper.vm.$nextTick();

    expect(
      document.body.querySelector('[data-testid="itab-add-context-menu"]'),
    ).toBeNull();
  });

  it("rejects blank-menu targets for widgets, drag handles, inputs, overlays, menus, and controls", () => {
    const vm = wrapper.vm as unknown as {
      shouldOpenBlankContextMenu: (target: EventTarget | null) => boolean;
    };
    const container = document.createElement("div");
    container.innerHTML = `
      <div data-widget-grid-item="clock"><span class="child"></span></div>
      <div data-card-item="card"><span class="card-child"></span></div>
      <div class="widget-move-handle"></div>
      <div class="widget-resize-grip"></div>
      <div class="widget-size-strip"></div>
      <input class="target-input" />
      <div role="dialog"></div>
      <div class="sd-modal-surface"></div>
      <div class="sd-context-menu-surface"></div>
      <div data-grid-context-menu></div>
      <button class="target-button">按钮</button>
      <div class="blank-ok"></div>
    `;
    document.body.appendChild(container);

    for (const selector of [
      ".child",
      ".card-child",
      ".widget-move-handle",
      ".widget-resize-grip",
      ".widget-size-strip",
      ".target-input",
      '[role="dialog"]',
      ".sd-modal-surface",
      ".sd-context-menu-surface",
      "[data-grid-context-menu]",
      ".target-button",
    ]) {
      expect(
        vm.shouldOpenBlankContextMenu(container.querySelector(selector)),
      ).toBe(false);
    }
    expect(
      vm.shouldOpenBlankContextMenu(container.querySelector(".blank-ok")),
    ).toBe(true);
  });

  it("applies selected size when adding a new widget payload", async () => {
    const vm = wrapper.vm as unknown as {
      addComponent: (payload: AddComponentPayload) => Promise<unknown>;
    };

    const result = await vm.addComponent({
      kind: "widget",
      catalogItemId: "iframe",
      destinationGroupId: "home",
      saveMode: "dirty",
      sizeKey: "2x4",
    });

    const widget = store.widgets.find((item) => item.type === "iframe");
    expect(result).toMatchObject({ status: "success" });
    expect(widget).toMatchObject({ w: 4, h: 2, colSpan: 4, rowSpan: 2 });
    expect(store.markDirty).toHaveBeenCalled();
  });

  it("accepts the migrated iTab weather alias through the add payload", async () => {
    const vm = wrapper.vm as unknown as {
      addComponent: (payload: AddComponentPayload) => Promise<unknown>;
    };

    const result = await vm.addComponent({
      kind: "widget",
      catalogItemId: "itab-weather-00",
      destinationGroupId: "home",
      saveMode: "dirty",
      sizeKey: "2x1",
    });

    const widget = store.widgets.find(
      (item) => item.type === "itab-weather-00",
    );
    expect(result).toMatchObject({ status: "success", id: "weather" });
    expect(widget).toMatchObject({
      id: "weather",
      type: "itab-weather-00",
      w: 1,
      h: 2,
      colSpan: 1,
      rowSpan: 2,
      data: expect.objectContaining({
        runtime: "itab-weather",
        version: 1,
        sizeKey: "2x1",
      }),
    });
  });

  it("re-enables disabled singleton widgets with the selected size without duplicates", async () => {
    const vm = wrapper.vm as unknown as {
      addComponent: (payload: AddComponentPayload) => Promise<unknown>;
    };
    store.widgets.push({
      id: "docker",
      type: "docker",
      enable: false,
      isPublic: true,
      w: 1,
      h: 1,
      colSpan: 1,
      rowSpan: 1,
    });

    const result = await vm.addComponent({
      kind: "widget",
      catalogItemId: "docker",
      destinationGroupId: "home",
      saveMode: "dirty",
      sizeKey: "2x4",
    });

    const dockerWidgets = store.widgets.filter(
      (item) => item.type === "docker",
    );
    expect(result).toMatchObject({ status: "success", id: "docker" });
    expect(dockerWidgets).toHaveLength(1);
    expect(dockerWidgets[0]).toMatchObject({ enable: true, w: 4, h: 2 });
  });

  it("rolls back site shortcut immediate save conflicts", async () => {
    const vm = wrapper.vm as unknown as {
      addComponent: (payload: AddComponentPayload) => Promise<unknown>;
    };
    store.groups = [{ id: "home", title: "主页", items: [], isPublic: true }];
    vi.mocked(store.addItem).mockImplementation((item, groupId) => {
      store.groups.find((group) => group.id === groupId)?.items.push(item);
    });
    vi.mocked(store.saveData).mockResolvedValue("conflict");

    const result = await vm.addComponent({
      kind: "site-shortcut",
      catalogItemId: "manual",
      destinationGroupId: "home",
      saveMode: "save",
      navItem: {
        title: "Manual",
        url: "https://manual.example.com",
        icon: "",
        isPublic: true,
      },
    });

    expect(result).toMatchObject({ status: "save-error", rolledBack: true });
    expect(store.groups[0]?.items).toHaveLength(0);
  });

  it("rolls back custom icon immediate save failures and reports validation errors", async () => {
    const vm = wrapper.vm as unknown as {
      addComponent: (payload: AddComponentPayload) => Promise<unknown>;
    };
    store.groups = [{ id: "home", title: "主页", items: [], isPublic: true }];
    vi.mocked(store.addItem).mockImplementation((item, groupId) => {
      store.groups.find((group) => group.id === groupId)?.items.push(item);
    });
    vi.mocked(store.saveData).mockRejectedValue(new Error("network down"));

    const failed = await vm.addComponent({
      kind: "custom-icon",
      destinationGroupId: "home",
      saveMode: "save",
      navItem: {
        title: "Custom",
        url: "https://custom.example.com",
        icon: "",
        isPublic: true,
      },
    });
    expect(failed).toMatchObject({ status: "save-error", rolledBack: true });
    expect(store.groups[0]?.items).toHaveLength(0);

    const invalid = await vm.addComponent({
      kind: "custom-icon",
      destinationGroupId: "missing",
      saveMode: "save",
      navItem: {
        title: "Invalid",
        url: "https://invalid.example.com",
        icon: "",
        isPublic: true,
      },
    });
    expect(invalid).toMatchObject({ status: "validation-error" });
  });

  it("returns unauthorized add results without mutating state", async () => {
    const vm = wrapper.vm as unknown as {
      addComponent: (payload: AddComponentPayload) => Promise<unknown>;
    };
    const auth = useAuthStore();
    auth.token = "";

    const result = await vm.addComponent({
      kind: "widget",
      catalogItemId: "iframe",
      destinationGroupId: "home",
      saveMode: "dirty",
      sizeKey: "2x2",
    });

    expect(result).toMatchObject({ status: "unauthorized" });
    expect(store.widgets.some((item) => item.type === "iframe")).toBe(false);
  });

  it("clicking delete calls confirm delete logic", async () => {
    const divCard = wrapper.find(".div-card-click-target");
    await divCard.trigger("contextmenu", { clientX: 12, clientY: 16 });
    await wrapper.vm.$nextTick();

    const menu = document.body.querySelector("[data-grid-context-menu]");
    expect(menu).not.toBeNull();
    // Find delete button (last item usually)
    const items = Array.from(menu!.querySelectorAll('[role="menuitem"]'));
    const deleteBtn = items[items.length - 1];

    if (!deleteBtn) throw new Error("Delete button not found");
    expect(deleteBtn.textContent).toContain("删除卡片");
    deleteBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await wrapper.vm.$nextTick();

    // Check if delete confirm modal is shown
    expect(document.body.textContent).toContain("删除确认");
  });

  it("keeps delete confirmation open on outside click and Escape, then clears it on cancel", async () => {
    const divCard = wrapper.find(".div-card-click-target");
    await divCard.trigger("contextmenu", { clientX: 12, clientY: 16 });
    await wrapper.vm.$nextTick();

    const menu = document.body.querySelector("[data-grid-context-menu]");
    const items = Array.from(menu!.querySelectorAll('[role="menuitem"]'));
    const deleteBtn = items[items.length - 1];
    if (!deleteBtn) throw new Error("Delete button not found");

    deleteBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(document.body.textContent).toContain("删除确认");

    const overlays = Array.from(
      document.body.querySelectorAll(".overlay-motion-root"),
    );
    overlays[overlays.length - 1]?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    await wrapper.vm.$nextTick();

    expect(document.body.textContent).toContain("删除确认");
    expect(store.deleteItem).not.toHaveBeenCalled();

    (
      document.body.querySelector(
        "[data-modal-cancel]",
      ) as HTMLButtonElement | null
    )?.click();
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.findComponent(ConfirmDialog).props("show")).toBe(false);
    expect(store.deleteItem).not.toHaveBeenCalled();
  });

  it("disables ordinary widgets from edit mode close button", async () => {
    const editButton = wrapper
      .findAll("button")
      .find((button) => button.text().trim() === "编辑");
    if (!editButton) throw new Error("Edit button not found");

    await editButton.trigger("click");
    const disableButton = wrapper.find('[aria-label="禁用组件"]');

    expect(disableButton.exists()).toBe(true);
    await disableButton.trigger("click");

    expect(store.widgets.find((w) => w.id === "calculator-1")?.enable).toBe(
      false,
    );
  });

  it("shows home group tabs only when web group pagination is enabled", async () => {
    store.groups = [
      { id: "g-common", title: "常用", items: [], isPublic: true },
      { id: "g-favorites", title: "收藏夹", items: [], isPublic: true },
    ];
    store.appConfig.webGroupPagination = false;
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="home-group-tabs"]').exists()).toBe(
      false,
    );

    store.appConfig.webGroupPagination = true;
    await wrapper.vm.$nextTick();

    const tabs = wrapper.find('[data-testid="home-group-tabs"]');
    expect(tabs.exists()).toBe(true);
    expect(tabs.text()).toContain("常用");
    expect(tabs.text()).toContain("收藏夹");

    store.appConfig.webGroupPagination = false;
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="home-group-tabs"]').exists()).toBe(
      false,
    );
  });

  it("cycles the home network control through auto, lan, and wan only", async () => {
    store.forceNetworkMode = "auto";
    await wrapper.vm.$nextTick();

    const networkButton = wrapper.find(
      '[data-testid="home-top-actions"] button',
    );
    expect(networkButton.exists()).toBe(true);

    await networkButton.trigger("click");
    expect(store.forceNetworkMode).toBe("lan");

    await networkButton.trigger("click");
    expect(store.forceNetworkMode).toBe("wan");

    await networkButton.trigger("click");
    expect(store.forceNetworkMode).toBe("auto");
  });

  it("shows a home logout action for logged-in users", async () => {
    const logoutButton = wrapper
      .findAll('[data-testid="home-top-actions"] button')
      .find((button) => button.text().trim() === "退出");

    if (!logoutButton) throw new Error("Logout button not found");

    await logoutButton.trigger("click");

    expect(store.logout).toHaveBeenCalledTimes(1);
  });

  it("shows feedback when the home edit save has no changes", async () => {
    const uiFeedback = useUiFeedbackStore();
    vi.mocked(store.saveData).mockResolvedValue("no_change");

    const editButton = wrapper
      .findAll('[data-testid="home-top-actions"] button')
      .find((button) => button.text().trim() === "编辑");
    if (!editButton) throw new Error("Edit button not found");

    await editButton.trigger("click");
    await wrapper.vm.$nextTick();

    const saveButton = wrapper
      .findAll('[data-testid="home-action-bar"] button')
      .find((button) => button.text().trim() === "保存");
    if (!saveButton) throw new Error("Save button not found");

    await saveButton.trigger("click");
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.saveData).toHaveBeenCalledWith(true);
    expect(uiFeedback.notify).toHaveBeenCalledWith({
      title: "无需保存",
      message: "当前没有新的修改。",
      tone: "info",
    });
  });

  it("hides edit chrome while the add widget modal is open", async () => {
    const editButton = wrapper
      .findAll('[data-testid="home-top-actions"] button')
      .find((button) => button.text().trim() === "编辑");
    if (!editButton) throw new Error("Edit button not found");

    await editButton.trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="home-action-bar"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="禁用组件"]').exists()).toBe(true);
    expect(wrapper.find(".widget-move-handle").exists()).toBe(false);
    expect(wrapper.find(".widget-resize-grip").exists()).toBe(true);

    const addWidgetButton = wrapper
      .findAll('[data-testid="home-action-bar"] button')
      .find((button) => button.text().trim() === "添加组件");
    if (!addWidgetButton) throw new Error("Add widget button not found");

    await addWidgetButton.trigger("click");
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="itab-add-modal"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="home-action-bar"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="home-top-actions"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[aria-label="禁用组件"]').exists()).toBe(false);
    expect(wrapper.find(".widget-move-handle").exists()).toBe(false);
    expect(wrapper.find(".widget-resize-grip").exists()).toBe(false);
  });
});
