// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "@/stores/auth";
import ItabTodoOpenedPanel from "./ItabTodoOpenedPanel.vue";
import { ITAB_TODO_WIDGET_TYPE } from "./itabTodoTypes";

const createWidget = () => ({
  id: "todo",
  type: ITAB_TODO_WIDGET_TYPE,
  enable: true,
  isPublic: true,
  data: {
    runtime: "itab-todo",
    version: 1,
    sizeKey: "2x2",
    tasks: [{ id: "task-1", text: "评审 UI", done: false }],
  },
});

describe("ItabTodoOpenedPanel", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.sessionReady = true;
    auth.username = "ying";
    auth.sessionGeneration = "session";
    auth.username = "ying";
  });

  it("creates a task from the basic Todo input", async () => {
    const wrapper = mount(ItabTodoOpenedPanel, {
      props: { widget: createWidget() },
    });

    await wrapper.find("#todoAddInput").setValue("补充 QA");
    await wrapper.find("#todoAddInput").trigger("keydown", { key: "Enter" });

    const emitted = wrapper.emitted("updateData")?.[0]?.[0] as {
      tasks: Array<{ text: string; done: boolean }>;
    };
    expect(emitted.tasks[0]).toMatchObject({
      text: "补充 QA",
      done: false,
    });
  });

  it("edits, completes, and removes tasks through opened state controls", async () => {
    const wrapper = mount(ItabTodoOpenedPanel, {
      props: { widget: createWidget() },
    });

    await wrapper.find("[data-todo-textarea]").setValue("评审实现");
    expect(
      (
        wrapper.emitted("updateData")?.at(-1)?.[0] as {
          tasks: Array<{ text: string }>;
        }
      ).tasks[0]?.text,
    ).toBe("评审实现");

    await wrapper.find(".todo-check").trigger("click");
    expect(
      (
        wrapper.emitted("updateData")?.at(-1)?.[0] as {
          tasks: Array<{ done: boolean }>;
        }
      ).tasks[0]?.done,
    ).toBe(true);

    await wrapper.find(".todo-delete").trigger("click");
    expect(
      (wrapper.emitted("updateData")?.at(-1)?.[0] as { tasks: unknown[] })
        .tasks,
    ).toEqual([]);
  });
});
