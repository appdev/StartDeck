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
            '<div class="runtime-frame-stub" :data-size-key="widget.data?.sizeKey" :data-span="`${widget.w}x${widget.h}`"></div>',
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
});
