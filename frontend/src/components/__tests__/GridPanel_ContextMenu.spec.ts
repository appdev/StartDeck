// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises, mount, VueWrapper } from "@vue/test-utils";
import GridPanel from "../GridPanel.vue";
import ConfirmDialog from "../base/ConfirmDialog.vue";
import { createTestingPinia } from "@pinia/testing";
import { useMainStore } from "../../stores/main";
import { useUiFeedbackStore } from "../../stores/uiFeedback";
import type { AddComponentPayload } from "../../utils/addComponentTypes";
import { ITAB_WALLPAPER_WIDGET_TYPE } from "../../features/itab-wallpaper/itabWallpaperTypes";
import { ITAB_CALENDAR_WIDGET_TYPE } from "../../features/itab-calendar/itabCalendarTypes";
import { ITAB_FOOD_PICKER_WIDGET_TYPE } from "../../features/itab-food-picker/itabFoodPickerTypes";
import { ITAB_NUMBER_UPPERCASE_WIDGET_TYPE } from "../../features/itab-number-uppercase/itabNumberUppercaseTypes";
import { ITAB_TODO_WIDGET_TYPE } from "../../features/itab-todo/itabTodoTypes";
import { ITAB_MEMO_WIDGET_TYPE } from "../../features/itab-memo/itabMemoTypes";
import type { WidgetConfig } from "../../types";

const gridPanelSource = readFileSync("src/components/GridPanel.vue", "utf8");

const gridStackMock = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  let root: HTMLElement | null = null;
  const instance = {
    on: vi.fn((eventName: string, handler: (...args: unknown[]) => void) => {
      handlers.set(eventName, handler);
      return instance;
    }),
    getGridItems: vi.fn(() =>
      Array.from(
        (root || document).querySelectorAll<HTMLElement>(".grid-stack-item"),
      ),
    ),
    makeWidget: vi.fn((el: HTMLElement, options: Record<string, unknown>) => {
      (
        el as HTMLElement & {
          gridstackNode?: Record<string, unknown>;
        }
      ).gridstackNode = { ...options, el };
      return instance;
    }),
    update: vi.fn((el: HTMLElement, options: Record<string, unknown>) => {
      const gridEl = el as HTMLElement & {
        gridstackNode?: Record<string, unknown>;
      };
      gridEl.gridstackNode = {
        ...(gridEl.gridstackNode || {}),
        ...options,
        el,
      };
      return instance;
    }),
    removeWidget: vi.fn(() => instance),
    batchUpdate: vi.fn(() => instance),
    enableMove: vi.fn(() => instance),
    enableResize: vi.fn(() => instance),
    column: vi.fn(() => instance),
    cellHeight: vi.fn(() => instance),
    margin: vi.fn(() => instance),
    destroy: vi.fn(() => instance),
  };

  return {
    handlers,
    instance,
    init: vi.fn((_options: unknown, el: HTMLElement) => {
      root = el;
      return instance;
    }),
  };
});

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

vi.mock("gridstack", () => ({
  GridStack: {
    init: gridStackMock.init,
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
      x: Number(w.x ?? 0),
      y: Number(w.y ?? 0),
      w: Number(w.w ?? w.colSpan ?? 1),
      h: Number(w.h ?? w.rowSpan ?? 1),
    })),
  resolveResizeLayout: (layout: unknown[]) => layout,
  compactVertical: (layout: unknown[]) => layout,
}));
vi.mock("@/utils/network", () => ({
  isInternalNetwork: () => false,
  getNetworkConfig: () => ({
    internalDomains: "",
    internalLocation: null,
    networkRules: "",
    whitelistLatencyMode: false,
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
    gridStackMock.handlers.clear();
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
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1024,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 768,
    });
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
                    id: "custom-1",
                    type: "custom-css",
                    data: {
                      title: "Custom",
                      html: "<strong>Custom</strong>",
                      css: "strong { color: red; }",
                      sizeKey: "1x1",
                    },
                    x: 0,
                    y: 0,
                    w: 1,
                    h: 1,
                    i: "custom-1",
                    enable: true,
                    isPublic: true,
                  },
                  {
                    id: "docker-1",
                    type: "docker",
                    x: 1,
                    y: 0,
                    w: 1,
                    h: 1,
                    i: "docker-1",
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
          DockerWidget: true,
          SystemStatusWidget: true,
          CustomCssWidget: true,
          IconShape: true,
          EditModal: {
            props: ["show", "data", "groupId"],
            template:
              '<div v-if="show" data-testid="edit-modal-stub">{{ data?.title }} {{ groupId }}</div>',
          },
          SettingsModal: true,
          GroupSettingsModal: true,
          AddWidgetModal: {
            props: ["show"],
            template: '<div v-if="show" data-testid="itab-add-modal"></div>',
          },
          LoginModal: true,
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

  it("initializes GridStack for logged-in whole-card dragging", async () => {
    await flushPromises();

    const gridLayout = wrapper.find(".sd-home-grid-stack");
    expect(gridLayout.exists()).toBe(true);

    const gridItem = wrapper.find('[data-widget-grid-item="custom-1"]');
    expect(gridItem.exists()).toBe(true);
    expect(gridItem.attributes("gs-id")).toBe("custom-1");
    expect(gridItem.find(".grid-stack-item-content").exists()).toBe(true);

    expect(gridStackMock.init).toHaveBeenCalled();
    const options = (gridStackMock.init.mock.calls[0] as unknown[])?.[0] as {
      animate?: boolean;
      disableDrag?: boolean;
      disableResize?: boolean;
      draggable?: { handle?: string; cancel?: string; pause?: number };
    };
    expect(options.animate).toBe(false);
    expect(options.disableDrag).toBe(false);
    expect(options.disableResize).toBe(true);
    expect(options.draggable?.handle).toBe(".grid-stack-item-content");
    expect(options.draggable?.cancel).toContain("button");
    expect(options.draggable?.cancel).toContain("[data-grid-drag-ignore]");
    expect(options.draggable?.cancel).toContain("[data-itab-inner-control]");
    expect(options.draggable).not.toHaveProperty("pause");
  });

  it("reinitializes GridStack against the remounted responsive grid", async () => {
    await flushPromises();

    const initialInitCalls = gridStackMock.init.mock.calls.length;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });
    window.dispatchEvent(new Event("resize"));

    await wrapper.vm.$nextTick();
    await flushPromises();
    await wrapper.vm.$nextTick();
    await flushPromises();

    const remountedRoot = wrapper.find(".sd-home-grid-stack").element;
    const lastInitCall = gridStackMock.init.mock.calls.at(-1) as
      | unknown[]
      | undefined;

    expect(gridStackMock.instance.destroy).toHaveBeenCalled();
    expect(gridStackMock.init.mock.calls.length).toBeGreaterThan(
      initialInitCalls,
    );
    expect(lastInitCall?.[1]).toBe(remountedRoot);
  });

  it("gates whole-card dragging behind login state", () => {
    const dragEnabledBlock =
      /const isHomeWidgetDragEnabled = computed\([\s\S]*?\n\);/.exec(
        gridPanelSource,
      )?.[0];

    expect(dragEnabledBlock).toBeTruthy();
    expect(dragEnabledBlock).toContain("store.isLogged &&");
  });

  it("removes the old drag moved shadow state", () => {
    expect(gridPanelSource).not.toContain("sd-home-drag-moved");
    expect(gridPanelSource).not.toContain("onHomeWidgetMove");
    expect(gridPanelSource).not.toContain("onHomeWidgetMoved");
  });

  it("keeps GridStack dragging immediate and avoids invalid auto-placement coordinates", () => {
    expect(gridPanelSource).not.toContain("pause: HOME_WIDGET_DRAG_HOLD_MS");
    expect(gridPanelSource).not.toContain("grid-stack-item transition-all");
    expect(gridPanelSource).not.toContain("y: widget.y ?? Infinity");
  });

  it("does not render direct size controls outside the right-click menu", () => {
    expect(gridPanelSource).not.toContain("WidgetSizeStrip");
    expect(gridPanelSource).not.toContain("isWidgetSizeStripVisible");
    expect(gridPanelSource).toContain('@select-size="selectRuntimeWidgetSize"');
  });

  it("allows the number uppercase widget to enter the home grid layout", () => {
    const gridWidgetTypesBlock =
      /const gridWidgetTypes = new Set\(\[[\s\S]*?\]\);/.exec(
        gridPanelSource,
      )?.[0];

    expect(gridWidgetTypesBlock).toBeTruthy();
    expect(gridWidgetTypesBlock).toContain("ITAB_NUMBER_UPPERCASE_WIDGET_TYPE");
    expect(ITAB_NUMBER_UPPERCASE_WIDGET_TYPE).toBe("itab-number-uppercase-35");
  });

  it("lets GridStack own drag start without custom long-press interception", () => {
    expect(gridPanelSource).not.toContain("HOME_WIDGET_DRAG_HOLD_MS");
    expect(gridPanelSource).not.toContain(
      "HOME_WIDGET_LONG_PRESS_MOVE_CANCEL_PX",
    );
    expect(gridPanelSource).not.toContain("homeWidgetLongPress");
    expect(gridPanelSource).not.toContain("armHomeWidgetLongPressDrag");
    expect(gridPanelSource).not.toContain("releaseHomeWidgetLongPressDrag");
    expect(gridPanelSource).not.toContain("blockHomeWidgetDragBeforeHold");
    expect(gridPanelSource).not.toContain("@pointerdown.capture");
    expect(gridPanelSource).not.toContain("@mousedown.capture");
    expect(gridPanelSource).toContain('grid.on("dragstart"');
    expect(gridPanelSource).toContain('grid.on("dragstop"');
  });

  it("saves whole-card drag immediately without holding the layout sync guard", async () => {
    vi.mocked(store.saveData).mockResolvedValue("saved");
    await flushPromises();

    const gridItem = wrapper.find('[data-widget-grid-item="custom-1"]')
      .element as HTMLElement & {
      gridstackNode?: { x?: number; y?: number; w?: number; h?: number };
    };
    gridStackMock.handlers.get("dragstart")?.(new Event("dragstart"), gridItem);
    gridItem.gridstackNode = { ...(gridItem.gridstackNode || {}), x: 1 };
    gridStackMock.handlers.get("dragstop")?.(new Event("dragstop"), gridItem);

    expect(store.layoutEditInProgress).toBe(false);
    await wrapper.vm.$nextTick();
    await flushPromises();

    expect(store.saveData).toHaveBeenCalledWith(true);
    expect(store.layoutEditInProgress).toBe(false);
  });

  it("does not save a drag when the final grid position is unchanged", async () => {
    vi.mocked(store.saveData).mockResolvedValue("saved");
    await flushPromises();

    const gridItem = wrapper.find('[data-widget-grid-item="custom-1"]')
      .element as HTMLElement;
    gridStackMock.handlers.get("dragstart")?.(new Event("dragstart"), gridItem);
    gridStackMock.handlers.get("dragstop")?.(new Event("dragstop"), gridItem);

    await wrapper.vm.$nextTick();
    await flushPromises();

    expect(store.saveData).not.toHaveBeenCalled();
  });

  it("opens the iTab blank-area context menu", async () => {
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
    expect(blankMenu?.textContent).toContain("立即备份");
    expect(blankMenu?.textContent).toContain("设置");
  });

  it("reuses the runtime widget menu surface for blank-area menu glass", () => {
    const listStyle =
      gridPanelSource.match(
        /\.itab-add-blank-context-list\s*\{[\s\S]*?\n\}/,
      )?.[0] ?? "";

    expect(gridPanelSource).toContain(
      'overlay-class="sd-runtime-menu-overlay"',
    );
    expect(gridPanelSource).toContain('panel-class="sd-runtime-menu-panel"');
    expect(gridPanelSource).toContain(
      'surface-class="sd-runtime-menu-surface itab-add-blank-context-surface"',
    );
    expect(gridPanelSource).toContain('scheme="dark"');
    expect(gridPanelSource).not.toMatch(
      /:global\(\.itab-add-blank-context-surface\)\s*\{/,
    );
    expect(listStyle).not.toContain("backdrop-filter");
    expect(listStyle).not.toContain("background:");
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

  it("opens the link-card menu from contextmenu only and cancels the browser menu", async () => {
    expect(gridPanelSource).not.toContain("@mousedown.right");
    store.groups = [
      {
        id: "links",
        title: "链接",
        isPublic: true,
        items: [
          {
            id: "link-1",
            title: "Link Card",
            url: "https://example.com",
            icon: "",
            isPublic: true,
          },
        ],
      },
    ];
    await wrapper.vm.$nextTick();

    const linkCard = wrapper.find('[data-card-item="link-1"]');
    expect(linkCard.exists()).toBe(true);

    const rightMouseDown = new MouseEvent("mousedown", {
      button: 2,
      bubbles: true,
      cancelable: true,
      clientX: 12,
      clientY: 16,
    });
    expect(linkCard.element.dispatchEvent(rightMouseDown)).toBe(true);
    await wrapper.vm.$nextTick();
    expect(document.body.querySelector("[data-grid-context-menu]")).toBeNull();

    const contextEvent = new MouseEvent("contextmenu", {
      button: 2,
      bubbles: true,
      cancelable: true,
      clientX: 12,
      clientY: 16,
    });
    expect(linkCard.element.dispatchEvent(contextEvent)).toBe(false);
    expect(contextEvent.defaultPrevented).toBe(true);
    await wrapper.vm.$nextTick();

    const menu = document.body.querySelector("[data-grid-context-menu]");
    expect(menu).not.toBeNull();
    expect(menu?.textContent).toContain("编辑卡片");

    const menuContextEvent = new MouseEvent("contextmenu", {
      button: 2,
      bubbles: true,
      cancelable: true,
    });
    expect(menu!.dispatchEvent(menuContextEvent)).toBe(false);
    expect(menuContextEvent.defaultPrevented).toBe(true);
  });

  it("opens EditModal from the link-card context menu edit action", async () => {
    store.groups = [
      {
        id: "links",
        title: "链接",
        isPublic: true,
        items: [
          {
            id: "link-1",
            title: "Link Card",
            url: "https://example.com",
            icon: "",
            isPublic: true,
          },
        ],
      },
    ];
    await wrapper.vm.$nextTick();

    const linkCard = wrapper.find('[data-card-item="link-1"]');
    expect(linkCard.exists()).toBe(true);
    await linkCard.trigger("contextmenu", { clientX: 12, clientY: 16 });
    await wrapper.vm.$nextTick();

    const menu = document.body.querySelector("[data-grid-context-menu]");
    const editBtn = Array.from(
      menu!.querySelectorAll('[role="menuitem"]'),
    ).find((item) => item.textContent?.includes("编辑卡片"));
    if (!editBtn) throw new Error("Edit button not found");

    editBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await wrapper.vm.$nextTick();

    const editModal = wrapper.find('[data-testid="edit-modal-stub"]');
    expect(editModal.exists()).toBe(true);
    expect(editModal.text()).toContain("Link Card");
    expect(editModal.text()).toContain("links");
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(document.body.querySelector("[data-grid-context-menu]")).toBeNull();
  });

  it("applies selected size when adding a new widget payload", async () => {
    const vm = wrapper.vm as unknown as {
      addComponent: (payload: AddComponentPayload) => Promise<unknown>;
    };

    const result = await vm.addComponent({
      kind: "widget",
      catalogItemId: "custom-css",
      destinationGroupId: "home",
      saveMode: "dirty",
      sizeKey: "2x4",
    });

    const widget = store.widgets.find(
      (item) => item.type === "custom-css" && item.id !== "custom-1",
    );
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

  it("selects Todo 4x4 and saves the updated runtime layout", async () => {
    const vm = wrapper.vm as unknown as {
      addComponent: (payload: AddComponentPayload) => Promise<unknown>;
      selectRuntimeWidgetSize: (widget: WidgetConfig, sizeKey: "4x4") => void;
      layoutData: Array<{ i: string; w: number; h: number; data?: unknown }>;
    };
    vi.mocked(store.saveData).mockResolvedValue("saved");

    await vm.addComponent({
      kind: "widget",
      catalogItemId: "todo",
      destinationGroupId: "home",
      saveMode: "dirty",
      sizeKey: "2x2",
    });
    await wrapper.vm.$nextTick();

    const todo = store.widgets.find(
      (item) => item.type === ITAB_TODO_WIDGET_TYPE,
    );
    if (!todo) throw new Error("Todo widget not found");

    vm.selectRuntimeWidgetSize(todo, "4x4");
    await wrapper.vm.$nextTick();

    expect(todo).toMatchObject({
      w: 4,
      h: 4,
      colSpan: 4,
      rowSpan: 4,
      data: expect.objectContaining({ sizeKey: "4x4" }),
    });
    expect(vm.layoutData.find((item) => item.i === todo.id)).toMatchObject({
      w: 4,
      h: 4,
      data: expect.objectContaining({ sizeKey: "4x4" }),
    });
    expect(store.saveData).toHaveBeenCalledWith(true);
  });

  it.each([
    ["Todo", "todo", ITAB_TODO_WIDGET_TYPE],
    ["Memo", "memo", ITAB_MEMO_WIDGET_TYPE],
  ])(
    "adds %s directly as 4x4 without falling back to an iTab base size",
    async (_label, catalogItemId, type) => {
      const vm = wrapper.vm as unknown as {
        addComponent: (payload: AddComponentPayload) => Promise<unknown>;
        layoutData: Array<{ i: string; w: number; h: number; data?: unknown }>;
      };
      vi.mocked(store.saveData).mockResolvedValue("saved");

      await vm.addComponent({
        kind: "widget",
        catalogItemId,
        destinationGroupId: "home",
        saveMode: "dirty",
        sizeKey: "4x4",
      });
      await wrapper.vm.$nextTick();

      const widget = store.widgets.find((item) => item.type === type);
      if (!widget) throw new Error(`${type} widget not found`);

      expect(widget).toMatchObject({
        w: 4,
        h: 4,
        colSpan: 4,
        rowSpan: 4,
        data: expect.objectContaining({ sizeKey: "4x4" }),
      });
      expect(vm.layoutData.find((item) => item.i === widget.id)).toMatchObject({
        w: 4,
        h: 4,
        data: expect.objectContaining({ sizeKey: "4x4" }),
      });
    },
  );

  it("keeps Todo 4x4 when the mobile size strip applies 4x4 spans", async () => {
    const vm = wrapper.vm as unknown as {
      addComponent: (payload: AddComponentPayload) => Promise<unknown>;
      selectRuntimeWidgetSize: (widget: WidgetConfig, sizeKey: "4x4") => void;
      layoutData: Array<WidgetConfig & { i: string }>;
    };
    vi.mocked(store.saveData).mockResolvedValue("saved");

    await vm.addComponent({
      kind: "widget",
      catalogItemId: "todo",
      destinationGroupId: "home",
      saveMode: "dirty",
      sizeKey: "2x2",
    });
    await wrapper.vm.$nextTick();

    const todo = store.widgets.find(
      (item) => item.type === ITAB_TODO_WIDGET_TYPE,
    );
    if (!todo) throw new Error("Todo widget not found");
    const layoutTodo = vm.layoutData.find((item) => item.i === todo.id);
    if (!layoutTodo) throw new Error("Todo layout item not found");

    vm.selectRuntimeWidgetSize(todo, "4x4");
    await wrapper.vm.$nextTick();

    expect(todo).toMatchObject({
      w: 4,
      h: 4,
      colSpan: 4,
      rowSpan: 4,
      data: expect.objectContaining({ sizeKey: "4x4" }),
    });
    expect(layoutTodo).toMatchObject({
      w: 4,
      h: 4,
      colSpan: 4,
      rowSpan: 4,
      data: expect.objectContaining({ sizeKey: "4x4" }),
    });
  });

  it("persists dragged Todo 4x4 layout coordinates", async () => {
    const vm = wrapper.vm as unknown as {
      addComponent: (payload: AddComponentPayload) => Promise<unknown>;
      selectRuntimeWidgetSize: (widget: WidgetConfig, sizeKey: "4x4") => void;
    };
    vi.mocked(store.saveData).mockResolvedValue("saved");

    await vm.addComponent({
      kind: "widget",
      catalogItemId: "todo",
      destinationGroupId: "home",
      saveMode: "dirty",
      sizeKey: "2x2",
    });
    await wrapper.vm.$nextTick();

    const todo = store.widgets.find(
      (item) => item.type === ITAB_TODO_WIDGET_TYPE,
    );
    if (!todo) throw new Error("Todo widget not found");
    vm.selectRuntimeWidgetSize(todo, "4x4");
    await wrapper.vm.$nextTick();
    vi.mocked(store.saveData).mockClear();

    const gridItem = wrapper.find(`[data-widget-grid-item="${todo.id}"]`)
      .element as HTMLElement & {
      gridstackNode?: { x?: number; y?: number; w?: number; h?: number };
    };
    gridStackMock.handlers.get("dragstart")?.(new Event("dragstart"), gridItem);
    gridItem.gridstackNode = {
      ...(gridItem.gridstackNode || {}),
      x: 3,
      y: 2,
      w: 4,
      h: 4,
    };
    gridStackMock.handlers.get("dragstop")?.(new Event("dragstop"), gridItem);
    await wrapper.vm.$nextTick();
    await flushPromises();

    expect(todo).toMatchObject({ x: 3, y: 2, w: 4, h: 4 });
    expect(store.saveData).toHaveBeenCalledWith(true);
  });

  it("preserves Todo 4x4 when runtime data refreshes from the server", async () => {
    const vm = wrapper.vm as unknown as {
      addComponent: (payload: AddComponentPayload) => Promise<unknown>;
      selectRuntimeWidgetSize: (widget: WidgetConfig, sizeKey: "4x4") => void;
      updateRuntimeWidgetData: (
        widget: WidgetConfig,
        data: Record<string, unknown>,
      ) => void;
    };
    vi.mocked(store.saveData).mockResolvedValue("saved");

    await vm.addComponent({
      kind: "widget",
      catalogItemId: "todo",
      destinationGroupId: "home",
      saveMode: "dirty",
      sizeKey: "2x2",
    });
    await wrapper.vm.$nextTick();

    const todo = store.widgets.find(
      (item) => item.type === ITAB_TODO_WIDGET_TYPE,
    );
    if (!todo) throw new Error("Todo widget not found");
    vm.selectRuntimeWidgetSize(todo, "4x4");
    vi.mocked(store.saveData).mockClear();

    vm.updateRuntimeWidgetData(todo, {
      runtime: "itab-todo",
      version: 1,
      sizeKey: "2x2",
      tasks: [{ id: "remote", text: "远端更新", done: false }],
    });

    expect(todo.data).toEqual(
      expect.objectContaining({
        sizeKey: "4x4",
        tasks: [{ id: "remote", text: "远端更新", done: false }],
      }),
    );
    expect(store.saveData).toHaveBeenCalledWith(false);
  });

  it("selects Memo 4x4 and preserves it when runtime data refreshes from the server", async () => {
    const vm = wrapper.vm as unknown as {
      addComponent: (payload: AddComponentPayload) => Promise<unknown>;
      selectRuntimeWidgetSize: (widget: WidgetConfig, sizeKey: "4x4") => void;
      updateRuntimeWidgetData: (
        widget: WidgetConfig,
        data: Record<string, unknown>,
      ) => void;
      layoutData: Array<{ i: string; w: number; h: number; data?: unknown }>;
    };
    vi.mocked(store.saveData).mockResolvedValue("saved");

    await vm.addComponent({
      kind: "widget",
      catalogItemId: "memo",
      destinationGroupId: "home",
      saveMode: "dirty",
      sizeKey: "2x2",
    });
    await wrapper.vm.$nextTick();

    const memo = store.widgets.find(
      (item) => item.type === ITAB_MEMO_WIDGET_TYPE,
    );
    if (!memo) throw new Error("Memo widget not found");

    vm.selectRuntimeWidgetSize(memo, "4x4");
    await wrapper.vm.$nextTick();

    expect(memo).toMatchObject({
      w: 4,
      h: 4,
      colSpan: 4,
      rowSpan: 4,
      data: expect.objectContaining({ sizeKey: "4x4" }),
    });
    expect(vm.layoutData.find((item) => item.i === memo.id)).toMatchObject({
      w: 4,
      h: 4,
      data: expect.objectContaining({ sizeKey: "4x4" }),
    });
    vi.mocked(store.saveData).mockClear();

    vm.updateRuntimeWidgetData(memo, {
      runtime: "itab-memo",
      version: 1,
      sizeKey: "2x2",
      notes: [
        {
          id: "remote",
          title: "远端备忘",
          body: "远端内容",
          pinned: false,
          createdAt: "2026-05-27T00:00:00.000Z",
          updatedAt: "2026-05-27T00:00:00.000Z",
        },
      ],
    });

    expect(memo.data).toEqual(
      expect.objectContaining({
        sizeKey: "4x4",
        notes: [expect.objectContaining({ id: "remote", title: "远端备忘" })],
      }),
    );
    expect(store.saveData).toHaveBeenCalledWith(false);
  });

  it("clears the active runtime trigger before closing the opened panel", () => {
    const closeRuntimeWidgetBlock =
      /const closeRuntimeWidget = \(\) => \{[\s\S]*?\n\};/.exec(
        gridPanelSource,
      )?.[0];

    expect(closeRuntimeWidgetBlock).toBeTruthy();
    expect(closeRuntimeWidgetBlock).toContain(
      'blurActiveElementMatching("[data-runtime-widget]")',
    );
    expect(
      closeRuntimeWidgetBlock!.indexOf("blurActiveElementMatching"),
    ).toBeLessThan(closeRuntimeWidgetBlock!.indexOf("openedRuntimeWidgetId"));
  });

  it("places the migrated iTab wallpaper widget into the home grid", async () => {
    const vm = wrapper.vm as unknown as {
      addComponent: (payload: AddComponentPayload) => Promise<unknown>;
      layoutData: Array<{ i: string; w: number; h: number }>;
    };

    const result = await vm.addComponent({
      kind: "widget",
      catalogItemId: "wallpaper",
      destinationGroupId: "home",
      saveMode: "dirty",
      sizeKey: "2x2",
    });

    const widget = store.widgets.find(
      (item) => item.type === ITAB_WALLPAPER_WIDGET_TYPE,
    );
    expect(result).toMatchObject({ status: "success" });
    expect(widget).toMatchObject({
      type: ITAB_WALLPAPER_WIDGET_TYPE,
      w: 2,
      h: 2,
      colSpan: 2,
      rowSpan: 2,
      data: expect.objectContaining({
        sizeKey: "2x2",
        itab: expect.objectContaining({
          adapterKind: "wallpaper",
          catalogId: ITAB_WALLPAPER_WIDGET_TYPE,
          captureIndex: 16,
        }),
      }),
    });
    expect(vm.layoutData.some((item) => item.i === widget?.id)).toBe(true);
  });

  it("places the migrated iTab calendar widget into the home grid", async () => {
    const vm = wrapper.vm as unknown as {
      addComponent: (payload: AddComponentPayload) => Promise<unknown>;
      layoutData: Array<{ i: string; w: number; h: number }>;
    };

    const result = await vm.addComponent({
      kind: "widget",
      catalogItemId: "calendar",
      destinationGroupId: "home",
      saveMode: "dirty",
      sizeKey: "2x2",
    });

    const widget = store.widgets.find(
      (item) => item.type === ITAB_CALENDAR_WIDGET_TYPE,
    );
    expect(result).toMatchObject({ status: "success" });
    expect(widget).toMatchObject({
      id: "calendar",
      type: ITAB_CALENDAR_WIDGET_TYPE,
      w: 2,
      h: 2,
      colSpan: 2,
      rowSpan: 2,
      data: expect.objectContaining({
        runtime: "itab-calendar",
        version: 1,
        sizeKey: "2x2",
      }),
    });
    expect(vm.layoutData.some((item) => item.i === widget?.id)).toBe(true);
    expect(gridPanelSource).toContain("ITAB_CALENDAR_WIDGET_TYPE");
  });

  it("places the migrated iTab food picker widget into the home grid", async () => {
    const vm = wrapper.vm as unknown as {
      addComponent: (payload: AddComponentPayload) => Promise<unknown>;
      layoutData: Array<{ i: string; w: number; h: number }>;
    };

    const result = await vm.addComponent({
      kind: "widget",
      catalogItemId: "food-picker",
      destinationGroupId: "home",
      saveMode: "dirty",
      sizeKey: "2x2",
    });

    const widget = store.widgets.find(
      (item) => item.type === ITAB_FOOD_PICKER_WIDGET_TYPE,
    );
    expect(result).toMatchObject({ status: "success" });
    expect(widget).toMatchObject({
      type: ITAB_FOOD_PICKER_WIDGET_TYPE,
      w: 2,
      h: 2,
      colSpan: 2,
      rowSpan: 2,
      data: expect.objectContaining({
        runtime: "itab-food-picker",
        version: 1,
        sizeKey: "2x2",
      }),
    });
    expect(vm.layoutData.some((item) => item.i === widget?.id)).toBe(true);
    expect(gridPanelSource).toContain("ITAB_FOOD_PICKER_WIDGET_TYPE");
  });

  it("does not create duplicate singleton runtime widgets", async () => {
    const vm = wrapper.vm as unknown as {
      addComponent: (payload: AddComponentPayload) => Promise<unknown>;
    };
    store.widgets.push({
      id: "calendar",
      type: ITAB_CALENDAR_WIDGET_TYPE,
      enable: true,
      isPublic: true,
      w: 2,
      h: 2,
      colSpan: 2,
      rowSpan: 2,
    });

    const result = await vm.addComponent({
      kind: "widget",
      catalogItemId: "calendar",
      destinationGroupId: "home",
      saveMode: "dirty",
      sizeKey: "2x2",
    });

    expect(result).toMatchObject({ status: "duplicate", id: "calendar" });
    expect(
      store.widgets.filter((item) => item.type === ITAB_CALENDAR_WIDGET_TYPE),
    ).toHaveLength(1);
  });

  it("reuses the Docker singleton when adding from the catalog", async () => {
    const vm = wrapper.vm as unknown as {
      addComponent: (payload: AddComponentPayload) => Promise<unknown>;
    };
    const existingDocker = store.widgets.find((item) => item.type === "docker");
    if (!existingDocker) throw new Error("expected docker fixture");
    existingDocker.enable = false;
    existingDocker.hideOnMobile = true;

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
    expect(result).toMatchObject({ status: "success" });
    expect(dockerWidgets).toHaveLength(1);
    expect(dockerWidgets[0]).toMatchObject({
      id: "docker-1",
      enable: true,
      hideOnMobile: false,
      w: 4,
      h: 2,
      colSpan: 4,
      rowSpan: 2,
    });
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
    const feedback = useUiFeedbackStore();
    Object.defineProperty(store, "isLogged", {
      configurable: true,
      get: () => false,
    });
    expect(store.isLogged).toBe(false);
    const customCssCount = store.widgets.filter(
      (item) => item.type === "custom-css",
    ).length;

    const result = await vm.addComponent({
      kind: "widget",
      catalogItemId: "custom-css",
      destinationGroupId: "home",
      saveMode: "dirty",
      sizeKey: "2x2",
    });

    expect(result).toMatchObject({ status: "unauthorized" });
    expect(
      store.widgets.filter((item) => item.type === "custom-css"),
    ).toHaveLength(customCssCount);
    expect(feedback.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "需要登录",
        message: "请先登录后再添加组件。",
        tone: "warning",
      }),
    );
  });

  it("keeps link-card delete confirmation open on outside click and Escape, then clears it on cancel", async () => {
    store.groups = [
      {
        id: "links",
        title: "链接",
        isPublic: true,
        items: [
          {
            id: "link-1",
            title: "Link Card",
            url: "https://example.com",
            icon: "",
            isPublic: true,
          },
        ],
      },
    ];
    await wrapper.vm.$nextTick();

    const linkCard = wrapper.find('[data-card-item="link-1"]');
    expect(linkCard.exists()).toBe(true);

    await linkCard.trigger("contextmenu", { clientX: 12, clientY: 16 });
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

    expect(store.widgets.find((w) => w.id === "custom-1")?.enable).toBe(false);
  });

  it("exits home edit mode with Escape when no overlay is open", async () => {
    await wrapper.get('button[aria-label="进入编辑模式"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="home-action-bar"]').exists()).toBe(true);

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    await wrapper.vm.$nextTick();
    await flushPromises();

    expect(wrapper.find('[data-testid="home-action-bar"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('button[aria-label="进入编辑模式"]').exists()).toBe(
      true,
    );
    expect(store.layoutEditInProgress).toBe(false);
    expect(store.saveData).toHaveBeenCalledWith(true);
  });

  it("does not use Escape to exit edit mode while an overlay is open", async () => {
    await wrapper.get('button[aria-label="进入编辑模式"]').trigger("click");
    await wrapper.vm.$nextTick();
    const overlay = document.createElement("div");
    overlay.dataset.overlayMotionId = "test-overlay";
    document.body.appendChild(overlay);

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    await wrapper.vm.$nextTick();
    await flushPromises();

    expect(wrapper.find('[data-testid="home-action-bar"]').exists()).toBe(true);
    expect(store.layoutEditInProgress).toBe(true);
    expect(store.saveData).not.toHaveBeenCalled();
  });

  it("does not render legacy web group pagination tabs", async () => {
    store.groups = [
      { id: "g-common", title: "常用", items: [], isPublic: true },
      { id: "g-favorites", title: "收藏夹", items: [], isPublic: true },
    ];
    // Legacy saved configs can still carry this flag, but the homepage no
    // longer uses the one-page/group-pagination presentation mode.
    store.appConfig.webGroupPagination = true;
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="home-group-tabs"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).toContain("常用");
    expect(wrapper.text()).toContain("收藏夹");
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

  it("saves and exits home edit mode from the single save action", async () => {
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
    expect(wrapper.find('[data-testid="home-action-bar"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="home-top-actions"]').exists()).toBe(
      true,
    );
    expect(store.layoutEditInProgress).toBe(false);
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
    expect(wrapper.find(".widget-resize-grip").exists()).toBe(false);

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
