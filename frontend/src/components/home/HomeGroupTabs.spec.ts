// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HomeGroupTabs from "./HomeGroupTabs.vue";

describe("HomeGroupTabs", () => {
  it("renders group tabs under the home search and emits selection", async () => {
    const wrapper = mount(HomeGroupTabs, {
      props: {
        activeId: "favorites",
        groups: [
          { id: "common", title: "常用" },
          { id: "favorites", title: "收藏夹" },
          { id: "work", title: "工作" },
        ],
      },
    });

    const tabs = wrapper.findAll("button");
    expect(tabs).toHaveLength(3);
    expect(tabs[1]?.classes()).toContain("is-active");

    await tabs[2]?.trigger("click");

    expect(wrapper.emitted("select")).toEqual([["work"]]);
  });
});
