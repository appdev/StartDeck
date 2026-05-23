// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import AddWidgetModal from "./AddWidgetModal.vue";
import type {
  AddComponentPayload,
  AddComponentResult,
} from "@/utils/addComponentTypes";
import type { StartDeckSiteShortcutCatalogItem } from "@/utils/siteShortcutCatalog";

const mountModal = (
  onAddComponent = vi.fn<
    (payload: AddComponentPayload) => Promise<AddComponentResult>
  >(async (payload) => ({
    status: "success",
    id: payload.kind === "widget" ? payload.catalogItemId : "created",
    groupId: payload.destinationGroupId,
  })),
  siteFixtureState?: {
    loading?: boolean;
    error?: string;
    items?: StartDeckSiteShortcutCatalogItem[];
  },
) =>
  mount(AddWidgetModal, {
    props: {
      show: true,
      widgets: [],
      groups: [{ id: "home", title: "主页", items: [] }],
      activeGroupId: "home",
      onAddComponent,
      siteFixtureState,
    },
    global: {
      plugins: [
        createTestingPinia({
          createSpy: () => vi.fn(),
          initialState: {
            groups: { groups: [{ id: "home", title: "主页", items: [] }] },
          },
        }),
      ],
      stubs: {
        AppModalShell: {
          props: ["show"],
          template: '<div v-if="show"><slot /></div>',
        },
        WidgetSizeVariantPreview: {
          props: ["title", "size"],
          template:
            '<div class="widget-preview-stub">{{ title }} {{ size?.label }}</div>',
        },
      },
    },
  });

describe("AddWidgetModal iTab add UI", () => {
  it("renders stable iTab selectors and switches tabs", async () => {
    const wrapper = mountModal();

    expect(wrapper.find('[data-testid="itab-add-modal"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="itab-add-tab-widget"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="itab-add-search"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="itab-add-destination"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="itab-add-widget-card"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="itab-add-batch-button"]').exists()).toBe(
      true,
    );
    expect(wrapper.text()).toContain("PDF转换大师");
    const initialCards = wrapper.findAll(
      '[data-testid="itab-add-widget-card"]',
    );
    expect(
      initialCards.slice(0, 4).map((card) => card.find("h3").text()),
    ).toEqual(["PDF转换大师", "数字大写转换", "日历", "渐变色"]);
    expect(wrapper.find(".itab-add-window-controls").exists()).toBe(true);
    expect(wrapper.find(".itab-add-replica-dots").exists()).toBe(true);
    expect(wrapper.find(".itab-add-size-button").exists()).toBe(false);

    await wrapper.find('[data-testid="itab-add-tab-site"]').trigger("click");
    expect(wrapper.find('[data-testid="itab-add-site-card"]').exists()).toBe(
      true,
    );
    expect(wrapper.text()).toContain("添加图标");
    expect(wrapper.find('[data-testid="itab-add-rank-tab"]').exists()).toBe(
      false,
    );

    await wrapper.find('[data-testid="itab-add-tab-custom"]').trigger("click");
    expect(wrapper.find('[data-testid="itab-add-custom-url"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="itab-add-search"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="itab-add-custom-save"]').exists()).toBe(
      true,
    );
    expect(
      wrapper.find('[data-testid="itab-add-custom-icon-color"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-testid="itab-add-custom-icon-text"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-testid="itab-add-custom-text-icon"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-testid="itab-add-custom-upload"]').exists(),
    ).toBe(true);
  });

  it("emits selected widget size through the shared payload contract", async () => {
    const addSpy = vi.fn(async (payload: AddComponentPayload) => ({
      status: "success" as const,
      id: payload.kind === "widget" ? payload.catalogItemId : "created",
      groupId: payload.destinationGroupId,
    }));
    const wrapper = mountModal(addSpy);

    await wrapper.find('[data-testid="itab-add-search"]').setValue("时钟");
    await wrapper.vm.$nextTick();

    const sizeButtons = wrapper.findAll(".itab-add-size-button");
    const targetSize = sizeButtons.find((button) => button.text() === "2x1");
    if (!targetSize) throw new Error("2x1 size button not found");

    await targetSize.trigger("click");
    await wrapper.find('[data-testid="itab-add-card-add"]').trigger("click");

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "widget",
        destinationGroupId: "home",
        saveMode: "dirty",
        sizeKey: "2x1",
      }),
    );
  });

  it("keeps iTab recommendation cards display-only until they are migrated", async () => {
    const addSpy = vi.fn(async (payload: AddComponentPayload) => ({
      status: "success" as const,
      id: payload.kind === "widget" ? payload.catalogItemId : "created",
      groupId: payload.destinationGroupId,
    }));
    const wrapper = mountModal(addSpy);

    const recommendationCards = wrapper.findAll(
      ".itab-add-widget-card.is-replica-card",
    );
    expect(recommendationCards.length).toBeGreaterThan(0);

    const firstReplicaButton = recommendationCards[0]!.find(
      '[data-testid="itab-add-card-add"]',
    );
    expect(firstReplicaButton.text()).toBe("待迁移");
    expect(firstReplicaButton.attributes("disabled")).toBeDefined();
    expect(firstReplicaButton.attributes("aria-disabled")).toBe("true");

    await firstReplicaButton.trigger("click");

    expect(addSpy).not.toHaveBeenCalled();
  });

  it("maps the iTab weather recommendation to the weather singleton add flow", async () => {
    const addSpy = vi.fn(async (payload: AddComponentPayload) => ({
      status: "success" as const,
      id: payload.kind === "widget" ? payload.catalogItemId : "created",
      groupId: payload.destinationGroupId,
    }));
    const wrapper = mountModal(addSpy);

    const weatherCard = wrapper
      .findAll(".itab-add-widget-card.is-replica-card")
      .find((card) => card.find("h3").text() === "天气");
    if (!weatherCard) throw new Error("weather recommendation not found");

    const addButton = weatherCard.find('[data-testid="itab-add-card-add"]');
    expect(addButton.text()).toBe("启用");
    expect(addButton.attributes("disabled")).toBeUndefined();

    await addButton.trigger("click");

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "widget",
        catalogItemId: "weather",
        destinationGroupId: "home",
        saveMode: "dirty",
        sizeKey: "1x2",
      }),
    );
  });

  it("maps migrated Clock, Memo, Todo, Pomodoro and poem recommendations to their canonical add flows", async () => {
    const addSpy = vi.fn(async (payload: AddComponentPayload) => ({
      status: "success" as const,
      id: payload.kind === "widget" ? payload.catalogItemId : "created",
      groupId: payload.destinationGroupId,
    }));
    const wrapper = mountModal(addSpy);

    const cards = wrapper.findAll(".itab-add-widget-card.is-replica-card");
    const clockCard = cards.find((card) => card.find("h3").text() === "时钟");
    const memoCard = cards.find((card) => card.find("h3").text() === "备忘录");
    const todoCard = cards.find(
      (card) => card.find("h3").text() === "待办事项",
    );
    const poemCard = cards.find(
      (card) => card.find("h3").text() === "今日诗词",
    );
    const pomodoroCard = cards.find(
      (card) => card.find("h3").text() === "番茄时钟",
    );
    if (!clockCard) throw new Error("clock recommendation not found");
    if (!memoCard) throw new Error("memo recommendation not found");
    if (!todoCard) throw new Error("todo recommendation not found");
    if (!poemCard) throw new Error("poem recommendation not found");
    if (!pomodoroCard) throw new Error("pomodoro recommendation not found");

    const clockButton = clockCard.find('[data-testid="itab-add-card-add"]');
    const memoButton = memoCard.find('[data-testid="itab-add-card-add"]');
    const todoButton = todoCard.find('[data-testid="itab-add-card-add"]');
    const poemButton = poemCard.find('[data-testid="itab-add-card-add"]');
    const pomodoroButton = pomodoroCard.find(
      '[data-testid="itab-add-card-add"]',
    );
    expect(clockButton.text()).toBe("启用");
    expect(memoButton.text()).toBe("启用");
    expect(todoButton.text()).toBe("启用");
    expect(pomodoroButton.text()).toBe("启用");
    expect(poemButton.text()).toBe("启用");
    expect(clockButton.attributes("disabled")).toBeUndefined();
    expect(memoButton.attributes("disabled")).toBeUndefined();
    expect(todoButton.attributes("disabled")).toBeUndefined();
    expect(pomodoroButton.attributes("disabled")).toBeUndefined();
    expect(poemButton.attributes("disabled")).toBeUndefined();

    await clockButton.trigger("click");
    await memoButton.trigger("click");
    await todoButton.trigger("click");
    await pomodoroButton.trigger("click");
    await poemButton.trigger("click");

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "widget",
        catalogItemId: "clock",
        destinationGroupId: "home",
        saveMode: "dirty",
        sizeKey: "2x2",
      }),
    );
    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "widget",
        catalogItemId: "memo",
        destinationGroupId: "home",
        saveMode: "dirty",
        sizeKey: "2x2",
      }),
    );
    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "widget",
        catalogItemId: "todo",
        destinationGroupId: "home",
        saveMode: "dirty",
        sizeKey: "2x2",
      }),
    );
    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "widget",
        catalogItemId: "pomodoro",
        destinationGroupId: "home",
        saveMode: "dirty",
        sizeKey: "2x2",
      }),
    );
    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "widget",
        catalogItemId: "poem",
        destinationGroupId: "home",
        saveMode: "dirty",
        sizeKey: "2x2",
      }),
    );
  });

  it("shows enabled and enable states for canonical iTab weather singleton", async () => {
    const enabled = mountModal(undefined, undefined);
    await enabled.setProps({
      widgets: [
        {
          id: "weather",
          type: "itab-weather-00",
          enable: true,
          isPublic: true,
        },
      ],
    });
    await enabled.find('[data-testid="itab-add-search"]').setValue("天气");
    await enabled.vm.$nextTick();
    expect(enabled.find('[data-testid="itab-add-card-add"]').text()).toBe(
      "已启用",
    );
    expect(
      enabled.find('[data-testid="itab-add-card-add"]').attributes("disabled"),
    ).toBeDefined();

    const disabled = mountModal(undefined, undefined);
    await disabled.setProps({
      widgets: [
        {
          id: "weather",
          type: "itab-weather-00",
          enable: false,
          isPublic: true,
        },
      ],
    });
    await disabled.find('[data-testid="itab-add-search"]').setValue("天气");
    await disabled.vm.$nextTick();
    expect(disabled.find('[data-testid="itab-add-card-add"]').text()).toBe(
      "启用",
    );
  });

  it("maps site and custom saves into site/custom payloads", async () => {
    const addSpy = vi.fn(async (payload: AddComponentPayload) => ({
      status: "success" as const,
      id: payload.kind === "widget" ? payload.catalogItemId : "created",
      groupId: payload.destinationGroupId,
    }));
    const wrapper = mountModal(addSpy);

    await wrapper.find('[data-testid="itab-add-tab-site"]').trigger("click");
    await wrapper.find('[data-testid="itab-add-card-add"]').trigger("click");
    expect(addSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: "site-shortcut",
        saveMode: "save",
        destinationGroupId: "home",
      }),
    );

    await wrapper.find('[data-testid="itab-add-tab-custom"]').trigger("click");
    await wrapper
      .find('[data-testid="itab-add-custom-url"]')
      .setValue("example.com");
    await wrapper
      .find('[data-testid="itab-add-custom-title"]')
      .setValue("Example");
    await wrapper
      .find('[data-testid="itab-add-custom-icon-text"]')
      .setValue("EX");
    await wrapper
      .find('[data-testid="itab-add-custom-text-icon"]')
      .setValue(true);
    await wrapper
      .find('[data-testid="itab-add-custom-save-continue"]')
      .trigger("click");

    expect(addSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: "custom-icon",
        saveMode: "save-and-continue",
        destinationGroupId: "home",
      }),
    );
    const payload = addSpy.mock.calls.at(-1)?.[0];
    expect(payload?.kind).toBe("custom-icon");
    if (payload?.kind === "custom-icon") {
      expect(payload.navItem.icon).toContain("data:image/svg+xml");
    }
  });

  it("renders explicit site loading, error, and empty fixture states", async () => {
    const loading = mountModal(undefined, { loading: true });
    await loading.find('[data-testid="itab-add-tab-site"]').trigger("click");
    expect(loading.find('[data-testid="itab-add-site-loading"]').exists()).toBe(
      true,
    );

    const error = mountModal(undefined, { error: "站点目录加载失败" });
    await error.find('[data-testid="itab-add-tab-site"]').trigger("click");
    expect(error.find('[data-testid="itab-add-site-error"]').text()).toContain(
      "站点目录加载失败",
    );

    const empty = mountModal(undefined, { items: [] });
    await empty.find('[data-testid="itab-add-tab-site"]').trigger("click");
    expect(empty.find('[data-testid="itab-add-site-empty"]').exists()).toBe(
      true,
    );
  });
});
