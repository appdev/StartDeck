// @vitest-environment jsdom
import { defineComponent, h } from "vue";
import { createPinia, setActivePinia, disposePinia } from "pinia";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/auth";
import { useMainStore } from "@/stores/main";
import { useSaveStore } from "@/stores/save";
import { fetchSdMemoWidgetData } from "./sdMemoApi";
import SdMemoWidget from "./SdMemoWidget.vue";
import SdMemoOpenedPanel from "./SdMemoOpenedPanel.vue";
import type { SdMemoWidgetData } from "./sdMemoTypes";

vi.mock("./sdMemoApi", () => ({ fetchSdMemoWidgetData: vi.fn() }));

const memoData = (body: string): SdMemoWidgetData => ({
  runtime: "sd-memo",
  version: 1,
  sizeKey: "2x2",
  activeNoteId: "note",
  notes: [
    {
      id: "note",
      title: "Test",
      body,
      pinned: false,
      createdAt: "2026-09-27T00:00:00Z",
      updatedAt: "2026-09-27T00:00:00Z",
    },
  ],
});

describe("memo polling during editing", () => {
  let pinia: ReturnType<typeof createPinia>;
  let wrapper: ReturnType<typeof mount> | undefined;
  beforeEach(() => {
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuthStore();
    auth.sessionReady = true;
    auth.username = "memo-test";
    auth.sessionGeneration = "memo-test-session";
    vi.mocked(fetchSdMemoWidgetData).mockReset();
  });
  afterEach(() => {
    wrapper?.unmount();
    disposePinia(pinia);
    vi.useRealTimers();
    localStorage.clear();
  });

  const mountMemo = () => {
    const store = useMainStore();
    store.widgets = [
      { id: "memo", type: "sd-memo-04", enable: true, data: memoData("ABCD") },
    ];
    const update = (data: SdMemoWidgetData) => {
      store.widgets[0]!.data = data;
      store.markDirty();
    };
    wrapper = mount(
      defineComponent({
        setup: () => () =>
          h("div", [
            h(SdMemoWidget, {
              widget: store.widgets[0]!,
              sizeKey: "2x2",
              onUpdateData: update,
            }),
            h(SdMemoOpenedPanel, {
              widget: store.widgets[0]!,
              onUpdateData: update,
            }),
          ]),
      }),
    );
    return store;
  };

  it.each([false, true])(
    "does not let a delayed desktop poll overwrite panel edits or backup (already saved=%s)",
    async (alreadySaved) => {
      let finishPoll!: (data: SdMemoWidgetData) => void;
      vi.mocked(fetchSdMemoWidgetData).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishPoll = resolve;
          }),
      );
      mountMemo();
      await wrapper!.get("textarea").setValue("CVBD");
      if (alreadySaved) useSaveStore().hasUnsavedChanges = false;
      finishPoll(memoData("ABCD"));
      await flushPromises();
      expect(wrapper!.get<HTMLTextAreaElement>("textarea").element.value).toBe(
        "CVBD",
      );
      const backup = JSON.parse(
        localStorage.getItem("startdeck-sd-memo-backup-auth:memo-test-memo")!,
      );
      expect(backup[0].body).toBe("CVBD");
    },
  );

  it("does not resurrect a deleted note from an older pending poll", async () => {
    let finishPoll!: (data: SdMemoWidgetData) => void;
    vi.mocked(fetchSdMemoWidgetData).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishPoll = resolve;
        }),
    );
    mountMemo();
    await wrapper!.get(".memo-note-action.delete").trigger("click");
    finishPoll(memoData("ABCD"));
    await flushPromises();
    expect(wrapper!.find("textarea").exists()).toBe(false);
    expect(useMainStore().widgets[0]!.data).toMatchObject({ notes: [] });
  });

  it("keeps pending edits beyond the old grace period and resumes polling after acknowledgement", async () => {
    vi.useFakeTimers();
    vi.mocked(fetchSdMemoWidgetData).mockResolvedValue(memoData("ABCD"));
    mountMemo();
    await flushPromises();
    const save = useSaveStore();
    await wrapper!.get("textarea").setValue("CVBD");
    vi.mocked(fetchSdMemoWidgetData).mockClear();
    await vi.advanceTimersByTimeAsync(20000);
    expect(fetchSdMemoWidgetData).not.toHaveBeenCalled();
    expect(wrapper!.get<HTMLTextAreaElement>("textarea").element.value).toBe(
      "CVBD",
    );

    save.hasUnsavedChanges = false;
    vi.mocked(fetchSdMemoWidgetData).mockResolvedValue(memoData("REMOTE"));
    await vi.advanceTimersByTimeAsync(10000);
    await flushPromises();
    expect(wrapper!.get<HTMLTextAreaElement>("textarea").element.value).toBe(
      "REMOTE",
    );
  });
});
