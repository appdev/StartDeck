// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HomeActionBar from "./HomeActionBar.vue";

describe("HomeActionBar", () => {
  it("renders save as the only completion action without redo", async () => {
    const wrapper = mount(HomeActionBar, {
      props: {
        hasUnsavedChanges: true,
      },
    });

    expect(wrapper.text()).not.toContain("完成");
    expect(wrapper.text()).toContain("保存");
    expect(wrapper.text()).toContain("添加组件");
    expect(wrapper.text()).toContain("新建分组");
    expect(wrapper.text()).not.toContain("重做");
    expect(wrapper.text().toLowerCase()).not.toContain("redo");

    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(3);
    expect(buttons[0]?.attributes("aria-label")).toBe("保存：保存并退出编辑");
    expect(buttons[0]?.attributes("title")).toBe("保存：保存并退出编辑");
    expect(buttons[0]?.attributes("data-dirty")).toBe("true");

    await buttons[0]?.trigger("click");
    await buttons[1]?.trigger("click");
    await buttons[2]?.trigger("click");

    expect(wrapper.emitted("complete")).toBeUndefined();
    expect(wrapper.emitted("save")).toHaveLength(1);
    expect(wrapper.emitted("addWidget")).toHaveLength(1);
    expect(wrapper.emitted("addGroup")).toHaveLength(1);
  });
});
