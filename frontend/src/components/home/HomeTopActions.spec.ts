// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HomeTopActions from "./HomeTopActions.vue";

describe("HomeTopActions", () => {
  it("renders the approved normal home action capsules with logout when logged in", async () => {
    const wrapper = mount(HomeTopActions, {
      props: {
        forceMode: "auto",
        isLan: true,
        latency: 2,
        isLogged: true,
      },
    });

    expect(wrapper.text()).toContain("自动");
    expect(wrapper.text()).toContain("内网");
    expect(wrapper.text()).toContain("2ms");
    expect(wrapper.text()).toContain("设置");
    expect(wrapper.text()).toContain("编辑");
    expect(wrapper.text()).toContain("退出");
    expect(wrapper.text()).not.toContain("强制");
    expect(wrapper.text()).not.toContain("延迟判定");

    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(4);
    await buttons[0]?.trigger("click");
    await buttons[1]?.trigger("click");
    await buttons[2]?.trigger("click");
    await buttons[3]?.trigger("click");

    expect(wrapper.emitted("toggleForceMode")).toHaveLength(1);
    expect(wrapper.emitted("settings")).toHaveLength(1);
    expect(wrapper.emitted("edit")).toHaveLength(1);
    expect(wrapper.emitted("logout")).toHaveLength(1);
  });

  it("keeps the edit slot as a login action for guests", async () => {
    const wrapper = mount(HomeTopActions, {
      props: {
        forceMode: "wan",
        isLan: false,
        latency: 18,
        isLogged: false,
      },
    });

    expect(wrapper.text()).toContain("外网");
    expect(wrapper.text()).toContain("18ms");
    expect(wrapper.text()).toContain("登录");
    expect(wrapper.text()).not.toContain("退出");

    expect(wrapper.findAll("button")).toHaveLength(3);
    await wrapper.findAll("button")[2]?.trigger("click");

    expect(wrapper.emitted("login")).toHaveLength(1);
    expect(wrapper.emitted("edit")).toBeUndefined();
  });
});
