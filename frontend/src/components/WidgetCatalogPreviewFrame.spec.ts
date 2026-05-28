// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import WidgetCatalogPreviewFrame from "./WidgetCatalogPreviewFrame.vue";

const mountPreview = (search: string) => {
  window.history.pushState({}, "", `/${search}`);
  return mount(WidgetCatalogPreviewFrame, {
    global: {
      stubs: {
        WidgetRuntimeFrame: {
          props: ["widget"],
          template:
            '<div class="runtime-frame-stub" :data-size-key="widget.data?.sizeKey" :data-span="`${widget.w}x${widget.h}`" :data-catalog-preview="widget.data?.catalogPreview ? \'true\' : \'false\'" :data-primary="widget.data?.lastSummary?.primaryRemainingPercent" :data-weekly="widget.data?.lastSummary?.weeklyRemainingPercent" :data-tapd-visible="widget.data?.lastSummary?.visibleTotal" :data-tapd-workspace="widget.data?.workspaceId"></div>',
        },
      },
    },
  });
};

describe("WidgetCatalogPreviewFrame", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  it.each([
    ["Todo", "todo"],
    ["Memo", "memo"],
  ])("applies runtime size data for %s 4x4 previews", (_label, catalogId) => {
    const wrapper = mountPreview(`?catalogId=${catalogId}&size=4x4`);

    expect(
      wrapper.find(".widget-catalog-preview-stage").attributes(),
    ).toMatchObject({
      "data-size-key": "4x4",
    });
    expect(wrapper.find(".runtime-frame-stub").attributes()).toMatchObject({
      "data-size-key": "4x4",
      "data-span": "4x4",
    });
  });

  it("falls back when a non-adapted runtime widget requests 4x4", () => {
    const wrapper = mountPreview("?catalogId=weather&size=4x4");

    expect(
      wrapper.find(".widget-catalog-preview-stage").attributes(),
    ).toMatchObject({
      "data-size-key": "2x2",
    });
    expect(wrapper.find(".runtime-frame-stub").attributes()).toMatchObject({
      "data-size-key": "2x2",
      "data-span": "2x2",
    });
  });

  it("marks runtime widgets as catalog previews", () => {
    const wrapper = mountPreview("?catalogId=system-status&size=2x2");

    expect(wrapper.find(".runtime-frame-stub").attributes()).toMatchObject({
      "data-size-key": "2x2",
      "data-span": "2x2",
      "data-catalog-preview": "true",
    });
  });

  it("uses design-state data for AI usage previews", () => {
    const wrapper = mountPreview("?catalogId=ai-usage&size=2x4");

    expect(wrapper.find(".runtime-frame-stub").attributes()).toMatchObject({
      "data-size-key": "2x4",
      "data-span": "4x2",
      "data-catalog-preview": "true",
      "data-primary": "85",
      "data-weekly": "40",
    });
  });

  it("uses design-state data for TAPD defect previews", () => {
    const wrapper = mountPreview("?catalogId=tapd-defects&size=2x4");

    expect(wrapper.find(".runtime-frame-stub").attributes()).toMatchObject({
      "data-size-key": "2x4",
      "data-span": "4x2",
      "data-catalog-preview": "true",
      "data-tapd-visible": "23",
      "data-tapd-workspace": "20358627",
    });
  });
});
