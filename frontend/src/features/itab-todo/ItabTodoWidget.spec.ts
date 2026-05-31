// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/auth";
import ItabTodoWidget from "./ItabTodoWidget.vue";
import { ITAB_TODO_WIDGET_TYPE } from "./itabTodoTypes";

const widget = {
  id: "todo",
  type: ITAB_TODO_WIDGET_TYPE,
  enable: true,
  isPublic: true,
  data: {
    runtime: "itab-todo",
    version: 1,
    sizeKey: "2x4",
    tasks: [
      { id: "a", text: "评审 UI", done: false },
      { id: "b", text: "补充 QA", done: false },
      { id: "c", text: "已完成项", done: true },
    ],
  },
};

describe("ItabTodoWidget", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.sessionReady = true;
    auth.username = "ying";
    auth.sessionGeneration = "session";
    auth.username = "ying";
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders icon-only sizes with the source Todo icon", () => {
    const wrapper = mount(ItabTodoWidget, {
      props: {
        widget,
        sizeKey: "1x1",
      },
    });

    expect(wrapper.find(".todo-icon-asset img").attributes("src")).toBe(
      "/itab/todo/todo.svg",
    );
    expect(wrapper.text()).not.toContain("评审 UI");
  });

  it("renders pending-only rows and toggles 2x4 tasks without opening the host", async () => {
    const wrapper = mount(ItabTodoWidget, {
      props: {
        widget,
        sizeKey: "2x4",
      },
    });

    expect(wrapper.text()).toContain("待办事项(2)");
    expect(wrapper.text()).toContain("评审 UI");
    expect(wrapper.text()).not.toContain("已完成项");
    expect(wrapper.find(".todo-icon-delete").exists()).toBe(false);

    await wrapper.find(".todo-icon-check").trigger("click");

    const emitted = wrapper.emitted("updateData")?.[0]?.[0] as {
      tasks: Array<{ id: string; done: boolean }>;
      sizeKey: string;
    };
    expect(emitted.sizeKey).toBe("2x4");
    expect(emitted.tasks.find((task) => task.id === "a")?.done).toBe(true);
  });

  it("renders public default tasks for logged-out users", () => {
    const auth = useAuthStore();
    auth.clearLocalSession();
    auth.sessionReady = true;

    const wrapper = mount(ItabTodoWidget, {
      props: {
        widget,
        sizeKey: "2x4",
      },
    });

    expect(wrapper.text()).toContain("待办事项(2)");
    expect(wrapper.text()).toContain("评审 UI");
    expect(wrapper.text()).toContain("补充 QA");
    expect(wrapper.text()).not.toContain("登录后使用待办");
    expect(wrapper.find(".todo-icon-check").exists()).toBe(false);
    expect(wrapper.find(".todo-icon-delete").exists()).toBe(false);
  });

  it("renders four pending rows in the 2x2 card", () => {
    const wrapper = mount(ItabTodoWidget, {
      props: {
        widget: {
          ...widget,
          data: {
            ...widget.data,
            sizeKey: "2x2",
            tasks: [
              { id: "a", text: "第一条", done: false },
              { id: "b", text: "第二条", done: false },
              { id: "c", text: "第三条", done: false },
              { id: "d", text: "第四条", done: false },
              { id: "e", text: "第五条", done: false },
            ],
          },
        },
        sizeKey: "2x2",
      },
    });

    expect(wrapper.findAll(".todo-icon-row")).toHaveLength(4);
    expect(wrapper.text()).toContain("第四条");
    expect(wrapper.text()).not.toContain("第五条");
  });

  it("renders a 4x4 task board and toggles tasks without dropping size", async () => {
    const wrapper = mount(ItabTodoWidget, {
      props: {
        widget: {
          ...widget,
          data: {
            ...widget.data,
            sizeKey: "4x4",
            tasks: [
              { id: "a", text: "第一条", done: false },
              { id: "b", text: "第二条", done: false },
              { id: "c", text: "第三条", done: false },
              { id: "d", text: "第四条", done: false },
              { id: "e", text: "第五条", done: false },
              { id: "f", text: "第六条", done: false },
              { id: "g", text: "第七条", done: false },
              { id: "h", text: "第八条", done: false },
              { id: "i", text: "第九条", done: false },
              { id: "done", text: "已完成任务", done: true },
            ],
          },
        },
        sizeKey: "4x4",
      },
    });

    expect(wrapper.attributes("data-itab-todo-size")).toBe("4x4");
    expect(wrapper.text()).toContain("待办事项(9)");
    expect(wrapper.text()).toContain("第八条");
    expect(wrapper.text()).toContain("第九条");
    expect(wrapper.text()).toContain("已完成");
    expect(wrapper.text()).toContain("已完成任务");
    expect(wrapper.text()).not.toContain("还有");
    expect(wrapper.findAll(".todo-icon-delete")).toHaveLength(10);
    expect(wrapper.find(".todo-icon-delete").attributes()).toMatchObject({
      "data-grid-drag-ignore": "true",
      "data-itab-inner-control": "true",
    });

    await wrapper.find(".todo-icon-check").trigger("click");

    const emitted = wrapper.emitted("updateData")?.[0]?.[0] as {
      tasks: Array<{ id: string; done: boolean }>;
      sizeKey: string;
    };
    expect(emitted.sizeKey).toBe("4x4");
    expect(emitted.tasks.find((task) => task.id === "a")?.done).toBe(true);

    await wrapper.find(".todo-icon-delete").trigger("click");

    const deleted = wrapper.emitted("updateData")?.at(-1)?.[0] as {
      tasks: Array<{ id: string }>;
      sizeKey: string;
    };
    expect(deleted.sizeKey).toBe("4x4");
    expect(deleted.tasks.some((task) => task.id === "a")).toBe(false);
  });

  it("keeps 4x4 delete buttons right aligned and hover gated", () => {
    const source = readFileSync(
      "src/features/itab-todo/ItabTodoWidget.vue",
      "utf8",
    );

    expect(source).toContain(".todo-icon-content.is-board .todo-icon-delete");
    expect(source).toContain("flex: 1 1 auto;");
    expect(source).toContain("margin: -3px 0 -3px auto;");
    expect(source).toContain("opacity: 0;");
    expect(source).toContain(
      ".todo-icon-content.is-board .todo-icon-row:hover .todo-icon-delete",
    );
    expect(source).toContain(
      ".todo-icon-content.is-board .todo-icon-row:focus-within .todo-icon-delete",
    );
  });

  it("loads remote data when the runtime refresh token changes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          runtime: "itab-todo",
          version: 1,
          sizeKey: "2x4",
          tasks: [{ id: "remote", text: "刷新数据", done: false }],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ItabTodoWidget, {
      props: {
        widget,
        sizeKey: "2x4",
        refreshToken: 0,
      },
    });

    await flushPromises();
    fetchMock.mockClear();
    await wrapper.setProps({ refreshToken: 1 });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/widgets/todo",
      expect.objectContaining({ cache: "no-store" }),
    );
    const emitted = wrapper.emitted("updateData")?.at(-1)?.[0] as {
      tasks: Array<{ id: string; text: string }>;
    };
    expect(emitted.tasks).toEqual([
      { id: "remote", text: "刷新数据", done: false },
    ]);
    wrapper.unmount();
  });
});
