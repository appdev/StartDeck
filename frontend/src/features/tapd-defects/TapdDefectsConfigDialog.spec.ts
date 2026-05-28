// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TapdDefectsConfigDialog from "./TapdDefectsConfigDialog.vue";
import { normalizeTapdDefectWidgetData } from "./tapdDefectModel";
import type {
  TapdConfigSaveOptions,
  TapdDefectWidgetData,
} from "./tapdDefectTypes";

describe("TapdDefectsConfigDialog", () => {
  beforeEach(() => {
    localStorage.setItem("start-deck-token", "user-token");
    localStorage.setItem("start-deck-username", "ying");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("keeps a large blocked list inside the fixed management surface", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ hasServerCredential: false, widgetId: "tapd-1" }),
      })),
    );
    const data = normalizeTapdDefectWidgetData({
      workspaceId: "20358627",
      projectName: "支付平台",
      blockedBugIds: Array.from(
        { length: 24 },
        (_, index) => `${1700 + index}`,
      ),
      blockedBugSnapshots: Array.from({ length: 24 }, (_, index) => ({
        id: `${1700 + index}`,
        title: `历史缺陷 ${index}`,
      })),
    });
    const wrapper = mount(TapdDefectsConfigDialog, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
      },
      props: {
        data,
        widgetId: "tapd-1",
      },
    });
    await wrapper.vm.$nextTick();

    const list = wrapper.find('[data-testid="tapd-blocked-list"]');
    expect(list.exists()).toBe(true);
    expect(list.classes()).toContain("tapd-blocked-list");
    expect(wrapper.findAll(".tapd-blocked-row")).toHaveLength(24);

    await wrapper.find('input[placeholder="搜索 ID 或标题"]').setValue("1710");
    expect(wrapper.findAll(".tapd-blocked-row")).toHaveLength(1);
    expect(wrapper.text()).toContain("1710");
    expect(wrapper.text()).not.toContain("项目可见");
  });

  it("restores a blocked defect without asking the parent to close the dialog", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ hasServerCredential: false, widgetId: "tapd-1" }),
      })),
    );
    const data = normalizeTapdDefectWidgetData({
      workspaceId: "40685585",
      projectName: "UGOS_PRO",
      blockedBugIds: ["D-1751"],
      blockedBugSnapshots: [
        {
          id: "D-1751",
          title: "历史环境噪音告警",
        },
      ],
      lastSummary: {
        status: "connected",
        workspaceId: "40685585",
        total: 2,
        visibleTotal: 1,
        blockedTotal: 1,
        verificationTotal: 0,
        critical: 0,
        assignedToCurrentUser: 0,
        visibleScope: "owned-by-current-user",
        page: 1,
        limit: 100,
        items: [],
      },
    });
    const wrapper = mount(TapdDefectsConfigDialog, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
      },
      props: {
        data,
        widgetId: "tapd-1",
      },
    });

    const restoreButton = wrapper
      .findAll(".tapd-blocked-row button")
      .find((button) => button.text().includes("恢复"));
    expect(restoreButton).toBeTruthy();
    await restoreButton!.trigger("click");

    const [nextData, options] = (wrapper.emitted("save")?.at(-1) || []) as [
      TapdDefectWidgetData,
      TapdConfigSaveOptions,
    ];
    expect(options).toEqual({ close: false });
    expect(nextData?.blockedBugIds).toEqual([]);
    expect(nextData?.blockedBugSnapshots).toEqual([]);
    expect(nextData?.lastSummary?.blockedTotal).toBe(0);
    expect(wrapper.text()).toContain("已恢复屏蔽缺陷");
  });

  it("confirms credential deletion and immediately clears stale connection data", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => ({
        ok: true,
        json: async () =>
          init?.method === "DELETE"
            ? { success: true }
            : {
                hasServerCredential: true,
                widgetId: "tapd-1",
                credentialType: "bearer",
                accountHint: "****eacc",
              },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const data = normalizeTapdDefectWidgetData({
      workspaceId: "40685585",
      projectName: "UGOS_PRO",
      hasServerCredential: true,
      credentialType: "bearer",
      credentialAccountHint: "****eacc",
      blockedBugIds: ["D-1751"],
      lastSummary: {
        status: "connected",
        workspaceId: "40685585",
        projectName: "UGOS_PRO",
        total: 4,
        visibleTotal: 4,
        blockedTotal: 1,
        verificationTotal: 0,
        critical: 0,
        assignedToCurrentUser: 0,
        visibleScope: "owned-by-current-user",
        page: 1,
        limit: 100,
        items: [
          {
            id: "D-1824",
            severity: "P0",
            priorityLabel: "P0",
            title: "支付回调失败导致订单挂起",
            status: "new",
            url: "https://www.tapd.cn/40685585/bugtrace/bugs/view/D-1824",
          },
        ],
      },
    });
    const wrapper = mount(TapdDefectsConfigDialog, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
      },
      props: {
        data,
        widgetId: "tapd-1",
      },
    });
    await flushPromises();

    const deleteButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("删除凭据"));
    expect(deleteButton).toBeTruthy();
    await deleteButton!.trigger("click");
    expect(wrapper.text()).toContain("确认删除 TAPD 凭据");
    expect(wrapper.emitted("save")).toBeUndefined();

    const confirmButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("确认删除"));
    expect(confirmButton).toBeTruthy();
    await confirmButton!.trigger("click");
    await flushPromises();

    const [nextData, options] = (wrapper.emitted("save")?.at(-1) || []) as [
      TapdDefectWidgetData,
      TapdConfigSaveOptions | undefined,
    ];
    expect(options).toBeUndefined();
    expect(nextData?.workspaceId).toBe("");
    expect(nextData?.projectName).toBe("");
    expect(nextData?.displayName).toBeUndefined();
    expect(nextData?.query.currentUser).toBeUndefined();
    expect(nextData?.hasServerCredential).toBe(false);
    expect(nextData?.credentialType).toBeUndefined();
    expect(nextData?.credentialAccountHint).toBeUndefined();
    expect(nextData?.lastSummary?.status).toBe("needs-config");
    expect(nextData?.lastSummary?.errorCode).toBeUndefined();
    expect(nextData?.lastSummary?.items).toEqual([]);
    expect(nextData?.lastSummary?.visibleTotal).toBe(0);
  });

  it("hides stale project names when no server credential is saved", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ hasServerCredential: false, widgetId: "tapd-1" }),
      })),
    );
    const wrapper = mount(TapdDefectsConfigDialog, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
      },
      props: {
        data: normalizeTapdDefectWidgetData({
          workspaceId: "40685585",
          projectName: "UGOS_PRO",
          hasServerCredential: false,
          lastSummary: {
            status: "error",
            workspaceId: "40685585",
            projectName: "UGOS_PRO",
            total: 4,
            visibleTotal: 0,
            blockedTotal: 0,
            verificationTotal: 0,
            critical: 0,
            assignedToCurrentUser: 0,
            visibleScope: "owned-by-current-user",
            page: 1,
            limit: 100,
            errorCode: "server_credential_missing",
            items: [],
          },
        }),
        widgetId: "tapd-1",
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("TAPD 缺陷");
    expect(wrapper.text()).not.toContain("UGOS_PRO");
    expect(
      (
        wrapper.find('input[placeholder="workspace_id"]')
          .element as HTMLInputElement
      ).value,
    ).toBe("");
    expect(
      (
        wrapper.find('input[placeholder="从 TAPD 读取"]')
          .element as HTMLInputElement
      ).value,
    ).toBe("");
  });

  it("shows a credential-specific workspace lookup hint when the project id is already filled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ hasServerCredential: false, widgetId: "tapd-1" }),
      })),
    );
    const wrapper = mount(TapdDefectsConfigDialog, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
      },
      props: {
        data: normalizeTapdDefectWidgetData({
          workspaceId: "40685585",
          projectName: "UGOS_PRO",
          hasServerCredential: true,
        }),
        widgetId: "tapd-1",
      },
    });
    await flushPromises();
    const lookupButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("读取项目名"));
    expect(lookupButton).toBeTruthy();
    await lookupButton!.trigger("click");

    expect(wrapper.text()).toContain("请先保存 TAPD 服务端凭据");
    expect(wrapper.text()).not.toContain("请先填写项目 ID 并保存服务端凭据");
  });

  it("saves a new bearer credential before reading the workspace name", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/credentials/") && init?.method === "PUT") {
          return {
            ok: true,
            json: async () => ({
              hasServerCredential: true,
              widgetId: "tapd-1",
              credentialType: "bearer",
              accountHint: "****eacc",
            }),
          };
        }
        if (url.includes("/workspace")) {
          return {
            ok: true,
            json: async () => ({
              status: "connected",
              workspaceId: "40685585",
              projectName: "UGOS_PRO",
              fallbackName: "TAPD 缺陷 · 40685585",
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            hasServerCredential: false,
            widgetId: "tapd-1",
          }),
        };
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(TapdDefectsConfigDialog, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
      },
      props: {
        data: normalizeTapdDefectWidgetData({}),
        widgetId: "tapd-1",
      },
    });
    await flushPromises();

    await wrapper
      .find('input[placeholder="workspace_id"]')
      .setValue("40685585");
    await wrapper.find("select").setValue("bearer");
    await wrapper.find('input[type="password"]').setValue("tapd-token");
    await wrapper.find('input[type="checkbox"]').setValue(true);

    const lookupButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("读取项目名"));
    expect(lookupButton).toBeTruthy();
    await lookupButton!.trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tapd-defects/credentials/tapd-1",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tapd-defects/workspace",
      expect.objectContaining({ method: "POST" }),
    );
    expect(
      (
        wrapper.find('input[placeholder="从 TAPD 读取"]')
          .element as HTMLInputElement
      ).value,
    ).toBe("UGOS_PRO");
    expect(wrapper.text()).toContain("项目名称已更新");
  });

  it("explains expired StartDeck login tokens instead of showing raw invalid_token", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/credentials/") && init?.method === "PUT") {
          return {
            ok: false,
            status: 401,
            json: async () => ({ error: "invalid_token" }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            hasServerCredential: false,
            widgetId: "tapd-1",
          }),
        };
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(TapdDefectsConfigDialog, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: false })],
      },
      props: {
        data: normalizeTapdDefectWidgetData({}),
        widgetId: "tapd-1",
      },
    });
    await flushPromises();

    await wrapper
      .find('input[placeholder="workspace_id"]')
      .setValue("40685585");
    await wrapper.find("select").setValue("bearer");
    await wrapper.find('input[type="password"]').setValue("tapd-token");
    await wrapper.find('input[type="checkbox"]').setValue(true);
    const saveButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("保存配置"));
    expect(saveButton).toBeTruthy();
    await saveButton!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("登录状态已失效，请重新登录");
    expect(wrapper.text()).not.toContain("invalid_token");
    expect(localStorage.getItem("start-deck-token")).toBeNull();
  });
});
