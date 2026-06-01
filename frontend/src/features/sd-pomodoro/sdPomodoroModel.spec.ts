import { describe, expect, it } from "vitest";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  applySdPomodoroSizeToWidget,
  createDefaultSdPomodoroWidget,
  normalizeSdPomodoroWidgetData,
} from "./sdPomodoroModel";
import { SD_POMODORO_WIDGET_TYPE } from "./sdPomodoroTypes";

describe("pomodoro model", () => {
  it("creates the canonical Pomodoro widget with source default size", () => {
    expect(createDefaultSdPomodoroWidget()).toMatchObject({
      id: "pomodoro",
      type: SD_POMODORO_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "sd-pomodoro",
        layoutSystem: SD_GRID_SCHEMA_VERSION,
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
      normalizeSdPomodoroWidgetData({
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
      runtime: "sd-pomodoro",
      layoutSystem: SD_GRID_SCHEMA_VERSION,
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

  it("applies scoped size keys without StartDeck size inversion", () => {
    const widget = createDefaultSdPomodoroWidget();

    applySdPomodoroSizeToWidget(widget, "2x4");

    expect(widget).toMatchObject({
      id: "pomodoro",
      type: SD_POMODORO_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({ sizeKey: "2x4" }),
    });
  });
});
