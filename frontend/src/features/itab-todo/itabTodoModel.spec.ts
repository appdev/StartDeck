import { describe, expect, it } from "vitest";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  applyItabTodoSizeToWidget,
  createDefaultItabTodoWidget,
  normalizeItabTodoWidgetData,
} from "./itabTodoModel";
import { ITAB_TODO_WIDGET_TYPE } from "./itabTodoTypes";

describe("itabTodoModel", () => {
  it("creates the canonical Todo runtime widget", () => {
    expect(createDefaultItabTodoWidget()).toMatchObject({
      id: "todo",
      type: ITAB_TODO_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "itab-todo",
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
        tasks: [],
      },
    });
  });

  it("normalizes canonical data and legacy array task data", () => {
    expect(
      normalizeItabTodoWidgetData({
        sizeKey: "2x4",
        tasks: [
          { id: "a", text: "评审", done: false },
          { id: "b", title: "旧标题字段", done: true },
          { id: "empty", text: "   ", done: false },
        ],
      }),
    ).toMatchObject({
      sizeKey: "2x4",
      tasks: [
        { id: "a", text: "评审", done: false },
        { id: "b", text: "旧标题字段", done: true },
      ],
    });

    expect(
      normalizeItabTodoWidgetData([
        { id: "legacy", text: "旧数组", done: false },
      ]),
    ).toMatchObject({
      sizeKey: "2x2",
      tasks: [{ id: "legacy", text: "旧数组", done: false }],
    });
  });

  it("applies iTab size keys to widget spans without inversion", () => {
    const widget = createDefaultItabTodoWidget();

    applyItabTodoSizeToWidget(widget, "1x2");
    expect(widget).toMatchObject({
      type: ITAB_TODO_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 1,
      w: 2,
      h: 1,
      data: expect.objectContaining({ sizeKey: "1x2" }),
    });
  });
});
