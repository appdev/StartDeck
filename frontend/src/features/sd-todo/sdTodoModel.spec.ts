import { describe, expect, it } from "vitest";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  applySdTodoSizeToWidget,
  createDefaultSdTodoWidget,
  normalizeSdTodoWidgetData,
} from "./sdTodoModel";
import { SD_TODO_WIDGET_TYPE } from "./sdTodoTypes";

describe("todo model", () => {
  it("creates the canonical Todo runtime widget", () => {
    expect(createDefaultSdTodoWidget()).toMatchObject({
      id: "todo",
      type: SD_TODO_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "sd-todo",
        layoutSystem: SD_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
        tasks: [],
      },
    });
  });

  it("normalizes canonical data and legacy array task data", () => {
    expect(
      normalizeSdTodoWidgetData({
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
      normalizeSdTodoWidgetData([
        { id: "legacy", text: "旧数组", done: false },
      ]),
    ).toMatchObject({
      sizeKey: "2x2",
      tasks: [{ id: "legacy", text: "旧数组", done: false }],
    });
  });

  it("applies scoped size keys to widget spans without inversion", () => {
    const widget = createDefaultSdTodoWidget();

    applySdTodoSizeToWidget(widget, "1x2");
    expect(widget).toMatchObject({
      type: SD_TODO_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 1,
      w: 2,
      h: 1,
      data: expect.objectContaining({ sizeKey: "1x2" }),
    });
  });

  it("normalizes and applies the Todo-only 4x4 runtime size", () => {
    expect(
      normalizeSdTodoWidgetData({
        sizeKey: "4x4",
        tasks: [{ id: "a", text: "扩展待办", done: false }],
      }),
    ).toMatchObject({
      sizeKey: "4x4",
      tasks: [{ id: "a", text: "扩展待办", done: false }],
    });

    const widget = createDefaultSdTodoWidget();
    applySdTodoSizeToWidget(widget, "4x4");

    expect(widget).toMatchObject({
      type: SD_TODO_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 4,
      w: 4,
      h: 4,
      data: expect.objectContaining({ sizeKey: "4x4" }),
    });
  });
});
