// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/auth";
import ItabMemoWidget from "./ItabMemoWidget.vue";
import { ITAB_MEMO_WIDGET_TYPE } from "./itabMemoTypes";

const widget = {
  id: "memo",
  type: ITAB_MEMO_WIDGET_TYPE,
  enable: true,
  isPublic: true,
  data: {
    runtime: "itab-memo",
    version: 1,
    sizeKey: "2x4",
    notes: [
      {
        id: "a",
        title: "评审 UI",
        body: "补充 QA",
        pinned: false,
        createdAt: "2026-05-22T00:00:00.000Z",
        updatedAt: "2026-05-22T00:02:00.000Z",
      },
      {
        id: "b",
        title: "固定备忘",
        body: "放到桌面",
        pinned: true,
        createdAt: "2026-05-22T00:00:00.000Z",
        updatedAt: "2026-05-22T00:01:00.000Z",
      },
      {
        id: "c",
        title: "第三条",
        body: "",
        pinned: false,
        createdAt: "2026-05-22T00:00:00.000Z",
        updatedAt: "2026-05-22T00:00:30.000Z",
      },
      {
        id: "d",
        title: "第四条",
        body: "",
        pinned: false,
        createdAt: "2026-05-22T00:00:00.000Z",
        updatedAt: "2026-05-22T00:00:00.000Z",
      },
    ],
  },
};

describe("ItabMemoWidget", () => {
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

  it("renders memo rows with pinned notes first", () => {
    const wrapper = mount(ItabMemoWidget, {
      props: {
        widget,
        sizeKey: "2x4",
        remoteSync: false,
      },
    });

    expect(wrapper.text()).toContain("备忘录");
    expect(wrapper.text()).toContain("固定备忘");
    expect(wrapper.text()).toContain("评审 UI");
    expect(wrapper.text()).toContain("第三条");
    expect(wrapper.text()).not.toContain("第四条");
    expect(wrapper.find(".memo-widget-delete").exists()).toBe(false);
  });

  it("renders public default memo rows for logged-out users", () => {
    const auth = useAuthStore();
    auth.clearLocalSession();
    auth.sessionReady = true;

    const wrapper = mount(ItabMemoWidget, {
      props: {
        widget,
        sizeKey: "2x4",
        remoteSync: false,
      },
    });

    expect(wrapper.text()).toContain("固定备忘");
    expect(wrapper.text()).toContain("评审 UI");
    expect(wrapper.text()).not.toContain("登录后使用备忘录");
  });

  it("keeps compact sizes visually icon-like by hiding row text", () => {
    const wrapper = mount(ItabMemoWidget, {
      props: {
        widget,
        sizeKey: "1x1",
        remoteSync: false,
      },
    });

    expect(wrapper.classes()).toContain("is-compact-text-hidden");
    expect(wrapper.find(".memo-widget-top").text()).toBe("备忘录");
  });

  it("loads remote data when the runtime refresh token changes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          runtime: "itab-memo",
          version: 1,
          sizeKey: "2x4",
          notes: [
            {
              id: "remote",
              title: "刷新备忘",
              body: "远程内容",
              pinned: false,
              createdAt: "2026-05-22T00:00:00.000Z",
              updatedAt: "2026-05-22T00:01:00.000Z",
            },
          ],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ItabMemoWidget, {
      props: {
        widget,
        sizeKey: "2x4",
        refreshToken: 0,
        remoteSync: true,
      },
    });

    await flushPromises();
    fetchMock.mockClear();
    await wrapper.setProps({ refreshToken: 1 });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/widgets/memo",
      expect.objectContaining({ cache: "no-store" }),
    );
    const emitted = wrapper.emitted("updateData")?.at(-1)?.[0] as {
      notes: Array<{ id: string; title: string }>;
    };
    expect(emitted.notes).toEqual([
      expect.objectContaining({ id: "remote", title: "刷新备忘" }),
    ]);
    wrapper.unmount();
  });

  it("renders every memo in 4x4 and shows full body content without card delete controls", () => {
    const wrapper = mount(ItabMemoWidget, {
      props: {
        widget: {
          ...widget,
          data: {
            ...widget.data,
            sizeKey: "4x4",
            notes: [
              ...widget.data.notes,
              {
                id: "e",
                title: "第五条",
                body: "很长的正文\n第二行正文",
                pinned: false,
                createdAt: "2026-05-22T00:00:00.000Z",
                updatedAt: "2026-05-21T00:00:00.000Z",
              },
            ],
          },
        },
        sizeKey: "4x4",
        remoteSync: false,
      },
    });

    expect(wrapper.attributes("data-itab-memo-size")).toBe("4x4");
    expect(wrapper.classes()).toContain("is-board");
    expect(wrapper.text()).toContain("5 条");
    expect(wrapper.text()).toContain("第四条");
    expect(wrapper.text()).toContain("第五条");
    expect(wrapper.text()).toContain("很长的正文");
    expect(wrapper.text()).toContain("第二行正文");
    expect(wrapper.find(".memo-widget-delete").exists()).toBe(false);
    expect(wrapper.find("[aria-label^='删除']").exists()).toBe(false);
    expect(wrapper.emitted("updateData")).toBeUndefined();
  });
});
