// @vitest-environment jsdom
import { mount, type VueWrapper } from "@vue/test-utils";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import TodoWidget from "./TodoWidget.vue";
import type { WidgetConfig } from "../types";

const { mockStore } = vi.hoisted(() => ({
  mockStore: {
    isLogged: false,
    username: "admin",
    isLanModeInited: true,
    effectiveIsLan: true,
    isConnected: true,
    token: "test-token",
    getHeaders: vi.fn(() => ({ Authorization: "Bearer test-token" })),
    saveSingleWidget: vi.fn().mockResolvedValue(undefined),
    wsSend: vi.fn(),
  },
}));

vi.mock("../stores/main", () => ({
  useMainStore: () => mockStore,
}));

const createWidget = (data: WidgetConfig["data"] = [], isPublic = true): WidgetConfig => ({
  id: "todo-1",
  type: "todo",
  enable: true,
  isPublic,
  x: 0,
  y: 0,
  w: 1,
  h: 1,
  data,
});

describe("TodoWidget", () => {
  let wrapper: VueWrapper | null = null;

  beforeEach(() => {
    mockStore.isLogged = false;
    mockStore.username = "admin";
    mockStore.isLanModeInited = true;
    mockStore.effectiveIsLan = true;
    mockStore.isConnected = true;
    mockStore.token = "test-token";
    mockStore.getHeaders.mockClear();
    mockStore.saveSingleWidget.mockClear();
    mockStore.wsSend.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.unstubAllGlobals();
  });

  it("未登录公开待办时仍显示登录限制", () => {
    const widget = createWidget([
      { id: "1", text: "访客不可查看", done: false },
    ]);
    const originalData = JSON.stringify(widget.data);

    wrapper = mount(TodoWidget, {
      props: { widget },
    });

    expect(wrapper.text()).toContain("登录后使用待办");
    expect(wrapper.text()).toContain("需登录");
    expect(wrapper.text()).not.toContain("访客不可查看");
    expect(wrapper.find("input").exists()).toBe(false);
    expect(wrapper.find("button").exists()).toBe(false);
    expect(JSON.stringify(widget.data)).toBe(originalData);
    expect(mockStore.saveSingleWidget).not.toHaveBeenCalled();
    expect(mockStore.wsSend).not.toHaveBeenCalled();
  });

  it("未登录私有待办时显示登录限制", () => {
    const widget = createWidget([
      { id: "1", text: "私有待办", done: false },
    ], false);

    wrapper = mount(TodoWidget, {
      props: { widget },
    });

    expect(wrapper.text()).toContain("登录后使用待办");
    expect(wrapper.text()).toContain("需登录");
    expect(wrapper.text()).not.toContain("私有待办");
    expect(wrapper.find("input").exists()).toBe(false);
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("登录后允许添加待办", async () => {
    mockStore.isLogged = true;
    const widget = createWidget();

    wrapper = mount(TodoWidget, {
      props: { widget },
    });

    const input = wrapper.find("input");
    await input.setValue("整理部署清单");
    await input.trigger("keyup.enter");

    expect(widget.data).toHaveLength(1);
    expect(widget.data[0]).toMatchObject({ text: "整理部署清单", done: false });
  });
});
