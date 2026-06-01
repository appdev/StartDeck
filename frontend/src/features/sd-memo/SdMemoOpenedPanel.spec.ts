// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "@/stores/auth";
import SdMemoOpenedPanel from "./SdMemoOpenedPanel.vue";
import { SD_MEMO_WIDGET_TYPE } from "./sdMemoTypes";

const widgetWithSingleNote = {
  id: "memo",
  type: SD_MEMO_WIDGET_TYPE,
  enable: true,
  isPublic: true,
  data: {
    runtime: "sd-memo",
    version: 1,
    sizeKey: "2x2",
    notes: [
      {
        id: "only-note",
        title: "临时记录",
        body: "删掉后应保持为空",
        pinned: false,
        createdAt: "2026-05-22T00:00:00.000Z",
        updatedAt: "2026-05-22T00:01:00.000Z",
      },
    ],
    activeNoteId: "only-note",
  },
};

describe("memo opened panel", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.sessionReady = true;
    auth.username = "ying";
    auth.sessionGeneration = "session";
    auth.username = "ying";
  });

  it("emits an explicit empty notes array when the user deletes the final memo", async () => {
    const wrapper = mount(SdMemoOpenedPanel, {
      props: {
        widget: widgetWithSingleNote,
      },
    });

    await wrapper.find(".memo-note-action.delete").trigger("click");

    expect(wrapper.emitted("updateData")?.[0]?.[0]).toMatchObject({
      notes: [],
    });
    expect(wrapper.emitted("updateData")?.[0]?.[0]).not.toHaveProperty(
      "activeNoteId",
    );
  });
});
