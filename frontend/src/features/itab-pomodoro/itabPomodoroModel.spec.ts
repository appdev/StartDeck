import { describe, expect, it } from "vitest";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  applyItabPomodoroSizeToWidget,
  createDefaultItabPomodoroWidget,
  normalizeItabPomodoroWidgetData,
} from "./itabPomodoroModel";
import { ITAB_POMODORO_WIDGET_TYPE } from "./itabPomodoroTypes";

describe("itabPomodoroModel", () => {
  it("creates the canonical iTab Pomodoro widget with source default size", () => {
    expect(createDefaultItabPomodoroWidget()).toMatchObject({
      id: "pomodoro",
      type: ITAB_POMODORO_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "itab-pomodoro",
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
        duration: 1500,
        remainingSeconds: 1500,
        phase: "idle",
        isRunning: false,
        sessions: 0,
        themeIndex: 0,
        audioEnabled: true,
      },
    });
  });

  it("normalizes invalid timer data to a complete local model", () => {
    expect(
      normalizeItabPomodoroWidgetData({
        sizeKey: "bad",
        duration: -1,
        remainingSeconds: 9999,
        phase: "break",
        isRunning: 1,
        sessions: -3,
        themeIndex: 999,
        audioEnabled: false,
      }),
    ).toEqual({
      runtime: "itab-pomodoro",
      layoutSystem: ITAB_GRID_SCHEMA_VERSION,
      version: 1,
      sizeKey: "2x2",
      duration: 1500,
      remainingSeconds: 1500,
      phase: "idle",
      isRunning: true,
      sessions: 0,
      themeIndex: 12,
      audioEnabled: false,
    });
  });

  it("applies iTab size keys without StartDeck size inversion", () => {
    const widget = createDefaultItabPomodoroWidget();

    applyItabPomodoroSizeToWidget(widget, "2x4");

    expect(widget).toMatchObject({
      id: "pomodoro",
      type: ITAB_POMODORO_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({ sizeKey: "2x4" }),
    });
  });
});
