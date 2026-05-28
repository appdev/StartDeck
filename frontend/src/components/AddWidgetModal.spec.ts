// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import AddWidgetModal from "./AddWidgetModal.vue";
import type {
  AddComponentPayload,
  AddComponentResult,
} from "@/utils/addComponentTypes";
import type { WidgetConfig } from "@/types";
import { ITAB_FOOD_PICKER_CATALOG_ID } from "@/features/itab-food-picker/itabFoodPickerTypes";
import { ITAB_NUMBER_UPPERCASE_CATALOG_ID } from "@/features/itab-number-uppercase/itabNumberUppercaseTypes";

const mountModal = (
  onAddComponent = vi.fn<
    (payload: AddComponentPayload) => Promise<AddComponentResult>
  >(async (payload) => ({
    status: "success",
    id: payload.kind === "widget" ? payload.catalogItemId : "created",
    groupId: payload.destinationGroupId,
  })),
  _siteFixtureState?: unknown,
  widgets: WidgetConfig[] = [],
) =>
  mount(AddWidgetModal, {
    props: {
      show: true,
      widgets,
      groups: [{ id: "home", title: "主页", items: [] }],
      activeGroupId: "home",
      onAddComponent,
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
  it("renders stable iTab selectors with only the widget add flow", async () => {
    const wrapper = mountModal();

    expect(wrapper.find('[data-testid="itab-add-modal"]').exists()).toBe(true);
    expect(wrapper.find(".itab-add-sidebar").exists()).toBe(false);
    expect(wrapper.find('[data-testid="itab-add-tab-widget"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="itab-add-tab-custom"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="itab-add-search"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="itab-add-destination"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="itab-add-widget-card"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="itab-add-batch-button"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="itab-add-tab-site"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="itab-add-custom-url"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).not.toContain("网址导航");
    expect(wrapper.text()).not.toContain("自定义图标");
    expect(wrapper.text()).not.toContain("PDF转换大师");
    expect(wrapper.text()).not.toContain("渐变色");
    expect(wrapper.text()).not.toContain("🔥");
    expect(wrapper.text()).not.toContain("今日推荐");
    expect(wrapper.text()).not.toContain("探索");
    expect(wrapper.text()).not.toContain("最近更新");
    expect(wrapper.text()).not.toContain("最受欢迎");
    expect(wrapper.text()).not.toContain("其他");
    expect(wrapper.find('[data-testid="itab-add-rank-tab"]').exists()).toBe(
      false,
    );
    expect(
      wrapper
        .findAll('[data-testid="itab-add-category-chip"]')
        .map((chip) => chip.text()),
    ).toEqual(["全部", "效率", "工具", "系统", "开发", "设计", "创意", "娱乐"]);
    expect(wrapper.find(".itab-add-replica-popularity").exists()).toBe(false);
    const initialCards = wrapper.findAll(
      '[data-testid="itab-add-widget-card"]',
    );
    expect(
      initialCards.slice(0, 4).map((card) => card.find("h3").text()),
    ).toEqual(["时钟", "天气", "纪念日", "日历"]);
    expect(
      wrapper.find(".itab-add-widget-preview-frame").attributes("src"),
    ).toContain("/widget-preview?");
    expect(
      wrapper
        .findAll('[data-testid="itab-add-category-chip"]')[0]!
        .attributes("aria-pressed"),
    ).toBe("true");
    expect(wrapper.find(".itab-add-window-controls").exists()).toBe(true);
    expect(wrapper.find(".itab-add-window-controls .is-green").exists()).toBe(
      true,
    );
    await wrapper.find(".itab-add-window-controls .is-red").trigger("click");
    expect(wrapper.emitted("update:show")).toEqual([[false]]);
    expect(wrapper.find(".itab-add-replica-dots").exists()).toBe(false);
    expect(wrapper.find(".itab-add-size-button").exists()).toBe(false);

    const allTabCard = wrapper.find('[data-testid="itab-add-widget-card"]');
    expect(allTabCard.classes()).toContain("is-replica-card");
    expect(allTabCard.classes()).toContain("is-catalog-card");
    expect(allTabCard.find(".itab-add-replica-heading").exists()).toBe(true);
    expect(allTabCard.find(".itab-add-replica-preview").exists()).toBe(true);
    expect(wrapper.find(".itab-add-size-button").exists()).toBe(false);
  });

  it("emits default widget size through the shared payload contract", async () => {
    const addSpy = vi.fn(async (payload: AddComponentPayload) => ({
      status: "success" as const,
      id: payload.kind === "widget" ? payload.catalogItemId : "created",
      groupId: payload.destinationGroupId,
    }));
    const wrapper = mountModal(addSpy);

    await wrapper.find('[data-testid="itab-add-search"]').setValue("时钟");
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".itab-add-size-button").exists()).toBe(false);
    await wrapper.find('[data-testid="itab-add-card-add"]').trigger("click");

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "widget",
        destinationGroupId: "home",
        saveMode: "dirty",
        sizeKey: "2x2",
      }),
    );
  });

  it("shows system widgets as single-instance enable actions", async () => {
    const addSpy = vi.fn(async (payload: AddComponentPayload) => ({
      status: "success" as const,
      id: payload.kind === "widget" ? payload.catalogItemId : "created",
      groupId: payload.destinationGroupId,
    }));
    const wrapper = mountModal(addSpy, undefined, [
      { id: "docker", type: "docker", enable: false, isPublic: true },
      {
        id: "system-status",
        type: "system-status",
        enable: true,
        isPublic: true,
      },
    ]);

    const systemChip = wrapper
      .findAll('[data-testid="itab-add-category-chip"]')
      .find((chip) => chip.text() === "系统");
    if (!systemChip) throw new Error("system category chip not found");
    await systemChip.trigger("click");
    await wrapper.vm.$nextTick();

    const cards = wrapper.findAll('[data-testid="itab-add-widget-card"]');
    const dockerCard = cards.find(
      (card) => card.find("h3").text() === "Docker",
    );
    const systemCard = cards.find(
      (card) => card.find("h3").text() === "系统状态",
    );
    if (!dockerCard || !systemCard) throw new Error("system widgets not found");

    const dockerButton = dockerCard.find('[data-testid="itab-add-card-add"]');
    expect(dockerButton.text()).toBe("启用");
    expect(dockerButton.attributes("disabled")).toBeUndefined();
    expect(systemCard.find('[data-testid="itab-add-card-add"]').text()).toBe(
      "已启用",
    );
    expect(
      systemCard
        .find('[data-testid="itab-add-card-add"]')
        .attributes("disabled"),
    ).toBeDefined();

    await dockerButton.trigger("click");
    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "widget",
        catalogItemId: "docker",
        destinationGroupId: "home",
        saveMode: "dirty",
      }),
    );
  });

  it("maps the weather catalog card to the weather singleton add flow", async () => {
    const addSpy = vi.fn(async (payload: AddComponentPayload) => ({
      status: "success" as const,
      id: payload.kind === "widget" ? payload.catalogItemId : "created",
      groupId: payload.destinationGroupId,
    }));
    const wrapper = mountModal(addSpy);

    await wrapper.find('[data-testid="itab-add-search"]').setValue("天气");
    await wrapper.vm.$nextTick();

    const weatherCard = wrapper
      .findAll(".itab-add-widget-card.is-replica-card")
      .find((card) => card.find("h3").text() === "天气");
    if (!weatherCard) throw new Error("weather catalog card not found");

    const addButton = weatherCard.find('[data-testid="itab-add-card-add"]');
    expect(addButton.text()).toBe("添加");
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

  it("maps the IP catalog card to the local IP add flow", async () => {
    const addSpy = vi.fn(async (payload: AddComponentPayload) => ({
      status: "success" as const,
      id: payload.kind === "widget" ? payload.catalogItemId : "created",
      groupId: payload.destinationGroupId,
    }));
    const wrapper = mountModal(addSpy);

    await wrapper.find('[data-testid="itab-add-search"]').setValue("本机IP");
    await wrapper.vm.$nextTick();

    const ipCard = wrapper
      .findAll(".itab-add-widget-card.is-replica-card")
      .find((card) => card.find("h3").text() === "本机IP");
    if (!ipCard) throw new Error("IP catalog card not found");

    const addButton = ipCard.find('[data-testid="itab-add-card-add"]');
    expect(addButton.text()).toBe("添加");
    expect(addButton.attributes("disabled")).toBeUndefined();

    await addButton.trigger("click");

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "widget",
        catalogItemId: "ip",
        destinationGroupId: "home",
        saveMode: "dirty",
        sizeKey: "2x2",
      }),
    );
  });

  it("maps the iTab food picker catalog search to the migrated multi-instance add flow", async () => {
    const addSpy = vi.fn(async (payload: AddComponentPayload) => ({
      status: "success" as const,
      id: payload.kind === "widget" ? payload.catalogItemId : "created",
      groupId: payload.destinationGroupId,
    }));
    const wrapper = mountModal(addSpy);

    await wrapper
      .find('[data-testid="itab-add-search"]')
      .setValue("今天吃什么");
    await wrapper.vm.$nextTick();

    const foodCard = wrapper
      .findAll('[data-testid="itab-add-widget-card"]')
      .find((card) => card.find("h3").text() === "今天吃什么");
    if (!foodCard) throw new Error("food picker catalog card not found");

    const addButton = foodCard.find('[data-testid="itab-add-card-add"]');
    expect(addButton.text()).toBe("添加");
    expect(addButton.attributes("disabled")).toBeUndefined();

    await addButton.trigger("click");

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "widget",
        catalogItemId: ITAB_FOOD_PICKER_CATALOG_ID,
        destinationGroupId: "home",
        saveMode: "dirty",
        sizeKey: "2x2",
      }),
    );
  });

  it("maps the amount conversion catalog card to the add flow", async () => {
    const addSpy = vi.fn(async (payload: AddComponentPayload) => ({
      status: "success" as const,
      id: payload.kind === "widget" ? payload.catalogItemId : "created",
      groupId: payload.destinationGroupId,
    }));
    const wrapper = mountModal(addSpy);

    await wrapper.find('[data-testid="itab-add-search"]').setValue("金额换算");
    await wrapper.vm.$nextTick();

    const numberCard = wrapper
      .findAll('[data-testid="itab-add-widget-card"]')
      .find((card) => card.find("h3").text() === "金额换算");
    if (!numberCard) throw new Error("number uppercase catalog card not found");

    const addButton = numberCard.find('[data-testid="itab-add-card-add"]');
    expect(addButton.text()).toBe("添加");
    expect(addButton.attributes("disabled")).toBeUndefined();

    await addButton.trigger("click");

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "widget",
        catalogItemId: ITAB_NUMBER_UPPERCASE_CATALOG_ID,
        destinationGroupId: "home",
        saveMode: "dirty",
        sizeKey: "2x2",
      }),
    );
  });

  it("maps migrated Clock, Memo, Todo, Pomodoro and poem catalog cards to their canonical add flows", async () => {
    const addSpy = vi.fn(async (payload: AddComponentPayload) => ({
      status: "success" as const,
      id: payload.kind === "widget" ? payload.catalogItemId : "created",
      groupId: payload.destinationGroupId,
    }));
    const wrapper = mountModal(addSpy);

    const cards = wrapper.findAll(".itab-add-widget-card.is-replica-card");
    const clockCard = cards.find((card) => card.find("h3").text() === "时钟");
    const memoCard = cards.find((card) => card.find("h3").text() === "备忘录");
    const todoCard = cards.find((card) => card.find("h3").text() === "待办");
    const poemCard = cards.find(
      (card) => card.find("h3").text() === "今日诗词",
    );
    const pomodoroCard = cards.find(
      (card) => card.find("h3").text() === "番茄时钟",
    );
    if (!clockCard) throw new Error("clock catalog card not found");
    if (!memoCard) throw new Error("memo catalog card not found");
    if (!todoCard) throw new Error("todo catalog card not found");
    if (!poemCard) throw new Error("poem catalog card not found");
    if (!pomodoroCard) throw new Error("pomodoro catalog card not found");

    const clockButton = clockCard.find('[data-testid="itab-add-card-add"]');
    const memoButton = memoCard.find('[data-testid="itab-add-card-add"]');
    const todoButton = todoCard.find('[data-testid="itab-add-card-add"]');
    const poemButton = poemCard.find('[data-testid="itab-add-card-add"]');
    const pomodoroButton = pomodoroCard.find(
      '[data-testid="itab-add-card-add"]',
    );
    expect(clockButton.text()).toBe("添加");
    expect(memoButton.text()).toBe("添加");
    expect(todoButton.text()).toBe("添加");
    expect(pomodoroButton.text()).toBe("添加");
    expect(poemButton.text()).toBe("添加");
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

  it("reports canonical iTab weather singleton state when matching widgets already exist", async () => {
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
    expect(
      disabled.find('[data-testid="itab-add-card-add"]').attributes("disabled"),
    ).toBeUndefined();
  });
});
