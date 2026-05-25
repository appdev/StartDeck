// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import ItabAnniversaryOpenedPanel from "./ItabAnniversaryOpenedPanel.vue";
import { createDefaultItabAnniversaryWidget } from "./itabAnniversaryModel";

const openedPanelSource = readFileSync(
  "src/features/itab-anniversary/ItabAnniversaryOpenedPanel.vue",
  "utf8",
);
const cardSource = readFileSync(
  "src/features/itab-anniversary/ItabAnniversaryCard.vue",
  "utf8",
);

describe("ItabAnniversaryOpenedPanel", () => {
  it("keeps the source-measured light template list and 2x2 card metrics", () => {
    const wrapper = mount(ItabAnniversaryOpenedPanel, {
      props: { widget: createDefaultItabAnniversaryWidget() },
    });

    const templateCards = wrapper.findAll(".anniversary-template-card");
    expect(templateCards).toHaveLength(3);
    const firstThumbnail = templateCards[0]!.find(".itab-anniversary-card");
    expect(firstThumbnail.classes()).toContain("is-template-plain-life");
    expect(firstThumbnail.attributes("style")).toContain(
      "--anniversary-bg: #eee1d9",
    );
    expect(openedPanelSource).toContain(
      "var(--sd-theme-itab-anniversary-anniversary-opened-panel-surface-01) 0 374px",
    );
    expect(openedPanelSource).toContain("font-size: 12px;");
    expect(openedPanelSource).toContain(
      "0 0 0 3px\n      var(--sd-theme-itab-anniversary-anniversary-opened-panel-shadow-02)",
    );
    expect(openedPanelSource).toContain("padding: 8px 0 4px 17px;");
    expect(openedPanelSource).toContain('class="anniversary-image-panel"');
    expect(openedPanelSource).toContain("height: 100px;");
    expect(cardSource).toContain("padding: 9.5px 7.6px;");
    expect(cardSource).toContain("font-size: 34.2px;");
    expect(cardSource).toContain("line-height: 51.3px;");
    expect(cardSource).toContain(".variant-mini.is-payday.size-2-4");
    expect(cardSource).toContain("width: calc(100% + 32px);");
    expect(cardSource).toContain(
      ".itab-anniversary-card.size-2-4:not(.with-calendar):not(.is-payday)",
    );
    expect(cardSource).not.toContain(
      "\n.size-2-4:not(.with-calendar):not(.is-payday)",
    );
  });

  it("keeps source-like common event behavior: only the event text changes", async () => {
    const wrapper = mount(ItabAnniversaryOpenedPanel, {
      props: { widget: createDefaultItabAnniversaryWidget() },
    });

    await wrapper.find(".anniversary-common-trigger").trigger("click");

    const eventNames = wrapper
      .findAll(".anniversary-event-popover > div")
      .map((item) => item.text());
    expect(eventNames).toEqual([
      "和她❤️相爱已经",
      "Ta的生日🎈还有",
      "宝宝👶出生已经",
      "情人节🧑🏻‍❤️‍🧑🏼还有",
      "周末还有😃",
      "周年纪念日🥂",
      "聚餐🌮",
      "还款日💰",
      "派对🎉",
      "父亲节👨",
      "母亲节👩",
      "考试✍️还有",
      "面试🤝",
      "看医生🧑‍⚕️",
    ]);

    document.body.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true }),
    );
    await nextTick();
    expect(wrapper.find(".anniversary-event-popover").exists()).toBe(false);

    await wrapper.find(".anniversary-common-trigger").trigger("click");

    await wrapper
      .findAll(".anniversary-event-popover > div")[3]!
      .trigger("click");

    expect(
      (wrapper.find('input[aria-label="事件名称"]').element as HTMLInputElement)
        .value,
    ).toBe("情人节🧑🏻‍❤️‍🧑🏼还有");
    expect(wrapper.find('button[aria-label="日期"]').text()).toBe("1997-10-1");
    expect(wrapper.find(".anniversary-repeat-select span").text()).toBe(
      "不重复",
    );
    expect(wrapper.find(".anniversary-event-popover").exists()).toBe(false);
  });

  it("opens the wheel date picker, updates day selection, and closes when repeat opens", async () => {
    const wrapper = mount(ItabAnniversaryOpenedPanel, {
      props: { widget: createDefaultItabAnniversaryWidget() },
    });

    await wrapper.find('button[aria-label="日期"]').trigger("click");
    expect(wrapper.find(".anniversary-date-popper").exists()).toBe(true);
    const columns = wrapper.findAll(".anniversary-picker-column");
    expect(columns).toHaveLength(3);
    expect(columns[0]!.find("button.is-select").text()).toBe("1997");
    expect(columns[1]!.find("button.is-select").text()).toBe("10");
    expect(columns[2]!.find("button.is-select").text()).toBe("01");

    const dayTwo = columns[2]!
      .findAll("button")
      .find((item) => item.text() === "02");
    expect(dayTwo).toBeTruthy();
    await dayTwo!.trigger("click");
    expect(wrapper.find('button[aria-label="日期"]').text()).toBe("1997-10-2");
    expect(
      wrapper
        .findAll(".anniversary-picker-column")[2]!
        .find("button.is-select")
        .text(),
    ).toBe("02");

    await wrapper
      .findAll(".anniversary-picker-column")[2]!
      .trigger("wheel", { deltaY: 100 });
    expect(wrapper.find('button[aria-label="日期"]').text()).toBe("1997-10-3");

    await wrapper
      .find(".anniversary-repeat-select .anniversary-select-trigger")
      .trigger("click");
    expect(wrapper.find(".anniversary-date-popper").exists()).toBe(false);
    expect(wrapper.find(".anniversary-repeat-popper").text()).toBe(
      "不重复每周每月每年节日",
    );
  });

  it("emits normalized customized data from the action row", async () => {
    const wrapper = mount(ItabAnniversaryOpenedPanel, {
      props: { widget: createDefaultItabAnniversaryWidget() },
    });

    await wrapper.find('input[aria-label="组件名称"]').setValue("发薪提醒");
    await wrapper.find(".anniversary-mask-control input").setValue("42");
    await wrapper.find(".anniversary-action-row button").trigger("click");

    const emitted = wrapper.emitted("updateData")?.[0]?.[0] as {
      title: string;
      mask: number;
      runtime: string;
    };
    expect(emitted).toMatchObject({
      runtime: "itab-anniversary",
      title: "发薪提醒",
      mask: 42,
    });
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("emits add data separately from modifying the selected widget", async () => {
    const wrapper = mount(ItabAnniversaryOpenedPanel, {
      props: { widget: createDefaultItabAnniversaryWidget() },
    });

    await wrapper
      .findAll(".anniversary-preview-arrow")
      .find((button) => button.attributes("aria-label") === "下一个尺寸")!
      .trigger("click");
    await wrapper
      .findAll(".anniversary-action-row button")[1]!
      .trigger("click");

    const emitted = wrapper.emitted("addData")?.[0]?.[0] as {
      runtime: string;
      sizeKey: string;
    };
    expect(emitted).toMatchObject({
      runtime: "itab-anniversary",
      sizeKey: "2x4",
    });
    expect(wrapper.emitted("updateData")).toBeUndefined();
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("emits image-backed add data with the selected source image", async () => {
    const wrapper = mount(ItabAnniversaryOpenedPanel, {
      props: { widget: createDefaultItabAnniversaryWidget() },
    });

    const imageButtons = wrapper.findAll(".anniversary-image-strip button");
    expect(imageButtons).toHaveLength(25);
    await imageButtons[24]!.trigger("click");
    await wrapper
      .findAll(".anniversary-action-row button")[1]!
      .trigger("click");

    expect(wrapper.emitted("addData")?.[0]?.[0]).toMatchObject({
      backgroundMode: "image",
      backgroundImage: "/itab-live-assets/anniversary/yiyan-25.webp",
    });
  });

  it("emits color-backed update data and removes image mode", async () => {
    const wrapper = mount(ItabAnniversaryOpenedPanel, {
      props: { widget: createDefaultItabAnniversaryWidget() },
    });

    await wrapper
      .findAll(".anniversary-background-mode button")
      .find((button) => button.text() === "颜色")!
      .trigger("click");
    expect(wrapper.find(".anniversary-mask-row").exists()).toBe(false);
    const backgroundSwatches = wrapper.findAll(
      ".anniversary-bg-swatches-row .anniversary-color-swatches span",
    );
    await backgroundSwatches[2]!.trigger("click");
    await wrapper.find(".anniversary-action-row button").trigger("click");

    expect(wrapper.emitted("updateData")?.[0]?.[0]).toMatchObject({
      backgroundMode: "color",
      backgroundColor: "#fc4548",
    });
  });
});
