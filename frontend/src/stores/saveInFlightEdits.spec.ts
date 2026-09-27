// @vitest-environment jsdom
import { ref } from "vue";
import { createPinia, setActivePinia, disposePinia } from "pinia";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pako from "pako";
import { useAuthStore } from "./auth";
import { useCacheStore } from "./cache";
import { useSaveStore } from "./save";
import { useWidgetsStore } from "./widgets";
import { useGroupsStore } from "./groups";
import { useConfigStore } from "./config";
import { sessionFetch } from "@/utils/sessionFetch";

vi.mock("@/utils/sessionFetch", () => ({ sessionFetch: vi.fn() }));

describe("save responses with newer local memo edits", () => {
  let pinia: ReturnType<typeof createPinia>;
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    localStorage.clear();
    const auth = useAuthStore();
    auth.sessionReady = true;
    auth.username = "memo-test";
    auth.sessionGeneration = "memo-test-session";
    useCacheStore().hasServerSnapshot = true;
    vi.mocked(sessionFetch).mockReset();
  });
  afterEach(() => {
    disposePinia(pinia);
    localStorage.clear();
  });

  it.each([false, true])(
    "preserves and resaves edits typed while an older save response is delayed (ignored=%s)",
    async (ignored) => {
      const widgets = useWidgetsStore();
      widgets.widgets = [
        {
          id: "memo",
          type: "sd-memo-04",
          enable: true,
          data: {
            runtime: "sd-memo",
            layoutSystem: "sd-grid/2026-05-22",
            version: 1,
            sizeKey: "2x2",
            activeNoteId: "note",
            notes: [
              {
                id: "note",
                title: "Test",
                body: "ABCD",
                pinned: false,
                createdAt: "2026-09-27T00:00:00Z",
                updatedAt: "2026-09-27T00:00:00Z",
              },
            ],
          },
        },
      ];
      const save = useSaveStore();
      const version = ref(1);
      const sent: Array<Record<string, unknown>> = [];
      const responses: Array<(response: Response) => void> = [];
      vi.mocked(sessionFetch).mockImplementation(async (input, init) => {
        if (input !== "/api/save") return new Response("{}");
        sent.push(
          JSON.parse(pako.ungzip(init!.body as Uint8Array, { to: "string" })),
        );
        return new Promise((resolve) => responses.push(resolve));
      });
      const fetchData = vi.fn(async () => {});
      save.markDirty();
      const first = save.saveData(true, false, version, fetchData);
      const edited = JSON.parse(JSON.stringify(widgets.widgets[0]!.data));
      edited.notes[0].body = "CVBD";
      widgets.widgets[0]!.data = edited;
      useConfigStore().appConfig.customTitle = "edited during save";
      save.markDirty();
      await save.saveData(true, false, version, fetchData);
      responses[0]!(
        new Response(
          JSON.stringify({ success: true, ignored, version: 2, data: sent[0] }),
        ),
      );
      await first;
      await flushPromises();
      expect(
        widgets.widgets.find((widget) => widget.type === "sd-memo-04")?.data,
      ).toMatchObject({ notes: [{ body: "CVBD" }] });
      expect(sent).toHaveLength(2);
      expect(sent[1]!.widgets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              notes: [expect.objectContaining({ body: "CVBD" })],
            }),
          }),
        ]),
      );
      expect(save.hasUnsavedChanges).toBe(true);
      expect(fetchData).not.toHaveBeenCalled();
      responses[1]!(
        new Response(
          JSON.stringify({ success: true, version: 3, data: sent[1] }),
        ),
      );
      await flushPromises();
      expect(save.hasUnsavedChanges).toBe(false);
      expect(save.isSaving).toBe(false);
      expect(version.value).toBe(3);
    },
  );

  it("drops an old save acknowledgement after the session changes", async () => {
    let finish!: (response: Response) => void;
    vi.mocked(sessionFetch).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const save = useSaveStore();
    const version = ref(1);
    const pending = save.saveData(true, false, version, vi.fn());
    useAuthStore().sessionGeneration = "replacement-session";
    finish(
      new Response(
        JSON.stringify({
          success: true,
          version: 9,
          data: { groups: [], widgets: [], appConfig: {} },
        }),
      ),
    );
    expect(await pending).toBe("unauthorized");
    expect(version.value).toBe(1);
    expect(sessionFetch).toHaveBeenCalledTimes(1);
  });

  it("accepts server normalization when there were no intervening edits", async () => {
    const save = useSaveStore();
    const version = ref(1);
    const normalized = [
      { id: "server-group", title: "Server normalized", items: [] },
    ];
    vi.mocked(sessionFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          version: 2,
          data: { groups: normalized, widgets: [], appConfig: {} },
        }),
      ),
    );
    save.markDirty();
    expect(await save.saveData(true, false, version, vi.fn())).toBe("saved");
    expect(useGroupsStore().groups).toEqual(normalized);
    expect(save.hasPendingChanges()).toBe(false);
    expect(version.value).toBe(2);
  });
});
