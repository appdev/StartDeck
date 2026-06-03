// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import AddWidgetModal from "./AddWidgetModal.vue";
import { useUiFeedbackStore } from "@/stores/uiFeedback";
import type {
  AddComponentPayload,
  AddComponentResult,
} from "@/utils/addComponentTypes";
import type { WidgetConfig } from "@/types";
import { AI_USAGE_CATALOG_ID } from "@/features/ai-usage/aiUsageTypes";
import { TAPD_DEFECTS_CATALOG_ID } from "@/features/tapd-defects/tapdDefectTypes";
import { SD_FOOD_PICKER_CATALOG_ID } from "@/features/sd-food-picker/sdFoodPickerTypes";
import { SD_NUMBER_UPPERCASE_CATALOG_ID } from "@/features/sd-number-uppercase/sdNumberUppercaseTypes";
import { WIDGET_CATALOG } from "@/utils/widgetCatalog";

const repositoryRoot = resolve(fileURLToPath(import.meta.url), "../../../..");
const frontendPreviewAssetsDir = resolve(
  repositoryRoot,
  "frontend/public/assets/widget-previews",
);
const backendPreviewAssetsDir = resolve(
  repositoryRoot,
  "rust/crates/startdeck-server/resources/public/assets/widget-previews",
);

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

describe("AddWidgetModal widget add UI", () => {
  it("renders stable widget selectors with only the widget add flow", async () => {
    const wrapper = mountModal();

    expect(wrapper.find('[data-testid="sd-add-modal"]').exists()).toBe(true);
    expect(wrapper.find(".sd-add-sidebar").exists()).toBe(false);
    expect(wrapper.find('[data-testid="sd-add-tab-widget"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="sd-add-tab-custom"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="sd-add-search"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="sd-add-destination"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="sd-add-widget-card"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="sd-add-batch-button"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="sd-add-tab-site"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="sd-add-custom-url"]').exists()).toBe(
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
    expect(wrapper.find('[data-testid="sd-add-rank-tab"]').exists()).toBe(
      false,
    );
    expect(
      wrapper
        .findAll('[data-testid="sd-add-category-chip"]')
        .map((chip) => chip.text()),
    ).toEqual(["全部", "效率", "工具", "系统", "开发", "设计", "创意", "娱乐"]);
    expect(wrapper.find(".sd-add-replica-popularity").exists()).toBe(false);
    const initialCards = wrapper.findAll('[data-testid="sd-add-widget-card"]');
    expect(
      initialCards.slice(0, 4).map((card) => card.find("h3").text()),
    ).toEqual(["时钟", "天气", "纪念日", "日历"]);
    expect(wrapper.find(".sd-add-widget-preview-frame").exists()).toBe(false);
    expect(wrapper.find(".sd-add-widget-preview-image").exists()).toBe(true);
    expect(wrapper.find(".sd-add-widget-preview").exists()).toBe(false);
    expect(wrapper.find(".widget-preview-stub").exists()).toBe(false);
    const firstPreviewImage = initialCards[0]!.find(
      "img.sd-add-widget-preview-image",
    );
    expect(firstPreviewImage.attributes("src")).toBe(
      "/assets/widget-previews/clock-2x2@3x.png",
    );
    expect(firstPreviewImage.attributes("width")).toBe("150");
    expect(firstPreviewImage.attributes("height")).toBe("150");
    expect(firstPreviewImage.attributes("alt")).toBe("时钟 组件真实预览");
    expect(
      wrapper
        .findAll('[data-testid="sd-add-category-chip"]')[0]!
        .attributes("aria-pressed"),
    ).toBe("true");
    expect(wrapper.find(".sd-add-window-controls").exists()).toBe(true);
    expect(wrapper.find(".sd-add-window-controls .is-green").exists()).toBe(
      true,
    );
    await wrapper.find(".sd-add-window-controls .is-red").trigger("click");
    expect(wrapper.emitted("update:show")).toEqual([[false]]);
    expect(wrapper.find(".sd-add-replica-dots").exists()).toBe(false);
    expect(wrapper.find(".sd-add-size-button").exists()).toBe(false);

    const allTabCard = wrapper.find('[data-testid="sd-add-widget-card"]');
    expect(allTabCard.classes()).toContain("is-replica-card");
    expect(allTabCard.classes()).toContain("is-catalog-card");
    expect(allTabCard.find(".sd-add-replica-heading").exists()).toBe(true);
    expect(allTabCard.find(".sd-add-replica-preview").exists()).toBe(true);
    expect(wrapper.find(".sd-add-size-button").exists()).toBe(false);
  });

  it("falls back to the lightweight preview only when a screenshot asset fails", async () => {
    const wrapper = mountModal();
    const firstCard = wrapper.find('[data-testid="sd-add-widget-card"]');

    expect(firstCard.find("img.sd-add-widget-preview-image").exists()).toBe(
      true,
    );
    expect(firstCard.find(".widget-preview-stub").exists()).toBe(false);

    await firstCard.find("img.sd-add-widget-preview-image").trigger("error");
    await wrapper.vm.$nextTick();

    expect(firstCard.find("img.sd-add-widget-preview-image").exists()).toBe(
      false,
    );
    expect(firstCard.find(".widget-preview-stub").exists()).toBe(true);
  });

  it("ships real preview screenshots for every catalog item", () => {
    for (const item of WIDGET_CATALOG) {
      const fileName = `${item.id}-2x2@3x.png`;
      expect(existsSync(resolve(frontendPreviewAssetsDir, fileName))).toBe(
        true,
      );
      expect(existsSync(resolve(backendPreviewAssetsDir, fileName))).toBe(true);
    }
  });

  it("emits default widget size through the shared payload contract", async () => {
    const addSpy = vi.fn(async (payload: AddComponentPayload) => ({
      status: "success" as const,
      id: payload.kind === "widget" ? payload.catalogItemId : "created",
      groupId: payload.destinationGroupId,
    }));
    const wrapper = mountModal(addSpy);
    const uiFeedback = useUiFeedbackStore();

    await wrapper.find('[data-testid="sd-add-search"]').setValue("时钟");
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".sd-add-size-button").exists()).toBe(false);
    await wrapper.find('[data-testid="sd-add-card-add"]').trigger("click");
    await flushPromises();

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "widget",
        destinationGroupId: "home",
        saveMode: "dirty",
        sizeKey: "2x2",
      }),
    );
    expect(wrapper.find(".sd-add-result").text()).toBe("时钟已添加");
    expect(wrapper.find('[data-testid="sd-add-card-add"]').text()).toBe(
      "已添加",
    );
    expect(uiFeedback.notify).toHaveBeenCalledWith({
      title: "添加成功",
      message: "时钟已添加，位置：主页",
      tone: "success",
    });
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
      .findAll('[data-testid="sd-add-category-chip"]')
      .find((chip) => chip.text() === "系统");
    if (!systemChip) throw new Error("system category chip not found");
    await systemChip.trigger("click");
    await wrapper.vm.$nextTick();

    const cards = wrapper.findAll('[data-testid="sd-add-widget-card"]');
    const dockerCard = cards.find(
      (card) => card.find("h3").text() === "Docker",
    );
    const systemCard = cards.find(
      (card) => card.find("h3").text() === "系统状态",
    );
    if (!dockerCard || !systemCard) throw new Error("system widgets not found");

    const dockerButton = dockerCard.find('[data-testid="sd-add-card-add"]');
    expect(dockerButton.text()).toBe("启用");
    expect(dockerButton.attributes("disabled")).toBeUndefined();
    expect(systemCard.find('[data-testid="sd-add-card-add"]').text()).toBe(
      "已启用",
    );
    expect(
      systemCard.find('[data-testid="sd-add-card-add"]').attributes("disabled"),
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

    await wrapper.find('[data-testid="sd-add-search"]').setValue("天气");
    await wrapper.vm.$nextTick();

    const weatherCard = wrapper
      .findAll(".sd-add-widget-card.is-replica-card")
      .find((card) => card.find("h3").text() === "天气");
    if (!weatherCard) throw new Error("weather catalog card not found");

    const addButton = weatherCard.find('[data-testid="sd-add-card-add"]');
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

    await wrapper.find('[data-testid="sd-add-search"]').setValue("本机IP");
    await wrapper.vm.$nextTick();

    const ipCard = wrapper
      .findAll(".sd-add-widget-card.is-replica-card")
      .find((card) => card.find("h3").text() === "本机IP");
    if (!ipCard) throw new Error("IP catalog card not found");

    const addButton = ipCard.find('[data-testid="sd-add-card-add"]');
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

  it("maps the food picker catalog search to the migrated multi-instance add flow", async () => {
    const addSpy = vi.fn(async (payload: AddComponentPayload) => ({
      status: "success" as const,
      id: payload.kind === "widget" ? payload.catalogItemId : "created",
      groupId: payload.destinationGroupId,
    }));
    const wrapper = mountModal(addSpy);

    await wrapper.find('[data-testid="sd-add-search"]').setValue("今天吃什么");
    await wrapper.vm.$nextTick();

    const foodCard = wrapper
      .findAll('[data-testid="sd-add-widget-card"]')
      .find((card) => card.find("h3").text() === "今天吃什么");
    if (!foodCard) throw new Error("food picker catalog card not found");

    const addButton = foodCard.find('[data-testid="sd-add-card-add"]');
    expect(addButton.text()).toBe("添加");
    expect(addButton.attributes("disabled")).toBeUndefined();

    await addButton.trigger("click");

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "widget",
        catalogItemId: SD_FOOD_PICKER_CATALOG_ID,
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

    await wrapper.find('[data-testid="sd-add-search"]').setValue("金额换算");
    await wrapper.vm.$nextTick();

    const numberCard = wrapper
      .findAll('[data-testid="sd-add-widget-card"]')
      .find((card) => card.find("h3").text() === "金额换算");
    if (!numberCard) throw new Error("number uppercase catalog card not found");

    const addButton = numberCard.find('[data-testid="sd-add-card-add"]');
    expect(addButton.text()).toBe("添加");
    expect(addButton.attributes("disabled")).toBeUndefined();

    await addButton.trigger("click");

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "widget",
        catalogItemId: SD_NUMBER_UPPERCASE_CATALOG_ID,
        destinationGroupId: "home",
        saveMode: "dirty",
        sizeKey: "2x2",
      }),
    );
  });

  it("maps the AI usage catalog card to the multi-instance add flow", async () => {
    const addSpy = vi.fn(async (payload: AddComponentPayload) => ({
      status: "success" as const,
      id: payload.kind === "widget" ? payload.catalogItemId : "created",
      groupId: payload.destinationGroupId,
    }));
    const wrapper = mountModal(addSpy);

    await wrapper.find('[data-testid="sd-add-search"]').setValue("AI 使用量");
    await wrapper.vm.$nextTick();

    const aiUsageCard = wrapper
      .findAll('[data-testid="sd-add-widget-card"]')
      .find((card) => card.find("h3").text() === "AI 使用量");
    if (!aiUsageCard) throw new Error("AI usage catalog card not found");

    const addButton = aiUsageCard.find('[data-testid="sd-add-card-add"]');
    expect(addButton.text()).toBe("添加");
    expect(addButton.attributes("disabled")).toBeUndefined();

    await addButton.trigger("click");

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "widget",
        catalogItemId: AI_USAGE_CATALOG_ID,
        destinationGroupId: "home",
        saveMode: "dirty",
        sizeKey: "2x2",
      }),
    );
  });

  it("maps the TAPD defects catalog card to the multi-instance add flow", async () => {
    const addSpy = vi.fn(async (payload: AddComponentPayload) => ({
      status: "success" as const,
      id: payload.kind === "widget" ? payload.catalogItemId : "created",
      groupId: payload.destinationGroupId,
    }));
    const wrapper = mountModal(addSpy);

    await wrapper.find('[data-testid="sd-add-search"]').setValue("TAPD 缺陷");
    await wrapper.vm.$nextTick();

    const tapdCard = wrapper
      .findAll('[data-testid="sd-add-widget-card"]')
      .find((card) => card.find("h3").text() === "TAPD 缺陷");
    if (!tapdCard) throw new Error("TAPD defects catalog card not found");

    const addButton = tapdCard.find('[data-testid="sd-add-card-add"]');
    expect(addButton.text()).toBe("添加");
    expect(addButton.attributes("disabled")).toBeUndefined();

    await addButton.trigger("click");

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "widget",
        catalogItemId: TAPD_DEFECTS_CATALOG_ID,
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

    const cards = wrapper.findAll(".sd-add-widget-card.is-replica-card");
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

    const clockButton = clockCard.find('[data-testid="sd-add-card-add"]');
    const memoButton = memoCard.find('[data-testid="sd-add-card-add"]');
    const todoButton = todoCard.find('[data-testid="sd-add-card-add"]');
    const poemButton = poemCard.find('[data-testid="sd-add-card-add"]');
    const pomodoroButton = pomodoroCard.find('[data-testid="sd-add-card-add"]');
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

  it("reports canonical weather singleton state when matching widgets already exist", async () => {
    const enabled = mountModal(undefined, undefined);
    await enabled.setProps({
      widgets: [
        {
          id: "weather",
          type: "sd-weather-00",
          enable: true,
          isPublic: true,
        },
      ],
    });
    await enabled.find('[data-testid="sd-add-search"]').setValue("天气");
    await enabled.vm.$nextTick();
    expect(enabled.find('[data-testid="sd-add-card-add"]').text()).toBe(
      "已启用",
    );
    expect(
      enabled.find('[data-testid="sd-add-card-add"]').attributes("disabled"),
    ).toBeDefined();

    const disabled = mountModal(undefined, undefined);
    await disabled.setProps({
      widgets: [
        {
          id: "weather",
          type: "sd-weather-00",
          enable: false,
          isPublic: true,
        },
      ],
    });
    await disabled.find('[data-testid="sd-add-search"]').setValue("天气");
    await disabled.vm.$nextTick();
    expect(disabled.find('[data-testid="sd-add-card-add"]').text()).toBe(
      "启用",
    );
    expect(
      disabled.find('[data-testid="sd-add-card-add"]').attributes("disabled"),
    ).toBeUndefined();
  });
});
