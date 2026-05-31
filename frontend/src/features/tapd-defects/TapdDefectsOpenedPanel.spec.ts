// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TapdDefectsOpenedPanel from "./TapdDefectsOpenedPanel.vue";
import {
  createDefaultTapdDefectWidget,
  normalizeTapdDefectWidgetData,
} from "./tapdDefectModel";
import {
  TAPD_ACTIONABLE_DEFECT_STATUS,
  type TapdDefectWidgetData,
} from "./tapdDefectTypes";

const authenticatedState = {
  auth: {
    sessionReady: true,
    isLogged: true,
    username: "ying",
    sessionGeneration: "test-session",
  },
};

describe("TapdDefectsOpenedPanel", () => {
  beforeEach(() => {
    localStorage.setItem("start-deck-username", "ying");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("blocks a defect from the opened panel list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: "connected",
          workspaceId: "20358627",
          total: 1,
          visibleTotal: 1,
          blockedTotal: 0,
          verificationTotal: 0,
          critical: 1,
          visibleScope: "owned-by-current-user",
          page: 1,
          limit: 100,
          items: [
            {
              id: "1824",
              severity: "P0",
              priorityLabel: "P0",
              title: "支付回调失败导致订单挂起",
              status: "处理中",
              url: "https://www.tapd.cn/20358627/bugtrace/bugs/view/1824",
            },
          ],
        }),
      })),
    );
    const widget = createDefaultTapdDefectWidget();
    widget.id = "tapd-1";
    widget.data = {
      ...(widget.data as Record<string, unknown>),
      workspaceId: "20358627",
      projectName: "支付平台",
      hasServerCredential: true,
      query: {
        limit: 100,
        order: "modified desc",
        fields: ["id", "title", "status"],
      },
      lastSummary: {
        status: "connected",
        workspaceId: "20358627",
        total: 1,
        visibleTotal: 1,
        blockedTotal: 0,
        verificationTotal: 0,
        critical: 1,
        visibleScope: "owned-by-current-user",
        page: 1,
        limit: 100,
        items: [
          {
            id: "1824",
            severity: "P0",
            priorityLabel: "P0",
            title: "支付回调失败导致订单挂起",
            status: "处理中",
            url: "https://www.tapd.cn/20358627/bugtrace/bugs/view/1824",
          },
        ],
      },
    };
    const updateData = vi.fn();
    const wrapper = mount(TapdDefectsOpenedPanel, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState: authenticatedState })],
      },
      props: { widget },
      attrs: {
        onUpdateData: updateData,
      },
    });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("支付回调失败");
    await wrapper.find(".tapd-block-action").trigger("click");

    expect(updateData).toHaveBeenCalled();
    expect(JSON.stringify(updateData.mock.calls.at(-1)?.[0])).toContain("1824");
  });

  it("shows the full title popover only when the single-line title overflows", async () => {
    const longTitle =
      "支付回调失败导致订单挂起并且通知中心没有同步更新消息状态";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          status: "connected",
          workspaceId: "20358627",
          total: 2,
          visibleTotal: 2,
          blockedTotal: 0,
          verificationTotal: 0,
          critical: 1,
          visibleScope: "owned-by-current-user",
          page: 1,
          limit: 100,
          items: [],
        }),
      ),
    );
    const widget = createDefaultTapdDefectWidget();
    widget.id = "tapd-title-popover";
    widget.data = {
      ...(widget.data as Record<string, unknown>),
      workspaceId: "20358627",
      projectName: "支付平台",
      hasServerCredential: true,
      lastSummary: {
        status: "connected",
        workspaceId: "20358627",
        total: 2,
        visibleTotal: 2,
        blockedTotal: 0,
        verificationTotal: 0,
        critical: 1,
        visibleScope: "owned-by-current-user",
        page: 1,
        limit: 100,
        items: [
          {
            id: "1824",
            severity: "P0",
            priorityLabel: "P0",
            title: longTitle,
            status: "new",
            url: "https://www.tapd.cn/20358627/bugtrace/bugs/view/1824",
          },
          {
            id: "1825",
            severity: "P2",
            priorityLabel: "P2",
            title: "短标题",
            status: "new",
            url: "https://www.tapd.cn/20358627/bugtrace/bugs/view/1825",
          },
        ],
      },
    };
    const wrapper = mount(TapdDefectsOpenedPanel, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState: authenticatedState })],
      },
      props: { widget },
    });
    await wrapper.vm.$nextTick();

    const titles = wrapper.findAll(".tapd-title-preview");
    Object.defineProperty(titles[0].element, "clientWidth", {
      configurable: true,
      value: 120,
    });
    Object.defineProperty(titles[0].element, "scrollWidth", {
      configurable: true,
      value: 280,
    });
    Object.defineProperty(titles[1].element, "clientWidth", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(titles[1].element, "scrollWidth", {
      configurable: true,
      value: 200,
    });

    await titles[0].trigger("click");
    expect(wrapper.find(".tapd-title-popover").text()).toBe(longTitle);

    await titles[1].trigger("click");
    expect(wrapper.find(".tapd-title-popover").exists()).toBe(false);
  });

  it("renders the table title and sync status on the same title line", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          status: "connected",
          workspaceId: "40685585",
          total: 3,
          visibleTotal: 3,
          blockedTotal: 0,
          verificationTotal: 0,
          critical: 0,
          assignedToCurrentUser: 0,
          visibleScope: "owned-by-current-user",
          page: 1,
          limit: 100,
          items: [],
        }),
      ),
    );
    const widget = createDefaultTapdDefectWidget();
    widget.id = "tapd-table-title-line";
    widget.data = normalizeTapdDefectWidgetData({
      workspaceId: "40685585",
      projectName: "UGOS_PRO",
      hasServerCredential: true,
    });
    const wrapper = mount(TapdDefectsOpenedPanel, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState: authenticatedState })],
      },
      props: { widget },
    });

    await flushPromises();
    await wrapper.vm.$nextTick();

    const titleLine = wrapper.find(".tapd-table-title-line");
    expect(titleLine.find("h3").text()).toBe("当前账号待处理缺陷");
    expect(titleLine.find("span").text()).toBe("已同步 3 条待处理结果");
  });

  it("only exposes the current-owner processing filter", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        status: "connected",
        workspaceId: "40685585",
        total: 23,
        visibleTotal: 23,
        blockedTotal: 0,
        verificationTotal: 5,
        critical: 6,
        assignedToCurrentUser: 0,
        visibleScope: "owned-by-current-user",
        page: 1,
        limit: 100,
        items: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const widget = createDefaultTapdDefectWidget();
    widget.id = "tapd-real";
    widget.data = {
      ...(widget.data as Record<string, unknown>),
      workspaceId: "40685585",
      projectName: "UGOS_PRO",
      hasServerCredential: true,
      visibilityScope: "owned-by-current-user",
      query: {
        limit: 100,
        order: "modified desc",
        fields: ["id", "title", "status"],
      },
    };
    const wrapper = mount(TapdDefectsOpenedPanel, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState: authenticatedState })],
      },
      props: { widget },
    });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo,
      RequestInit,
    ];
    const body = JSON.parse(String(init.body));
    expect(body.visibilityScope).toBe("owned-by-current-user");
    expect(body.filters.status).toBe(TAPD_ACTIONABLE_DEFECT_STATUS);
    expect(wrapper.text()).not.toContain("项目可见");
    expect(wrapper.text()).not.toContain("创建的");
    expect(wrapper.text()).not.toContain("参与的");
    expect(wrapper.text()).not.toContain("抄送的");
    expect(wrapper.find(".tapd-filter-panel").exists()).toBe(false);
  });

  it("uses distinct severity colors for high medium and low defects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          status: "connected",
          workspaceId: "40685585",
          total: 3,
          visibleTotal: 3,
          blockedTotal: 0,
          verificationTotal: 0,
          critical: 1,
          assignedToCurrentUser: 0,
          visibleScope: "owned-by-current-user",
          page: 1,
          limit: 100,
          items: [],
        }),
      ),
    );
    const widget = createDefaultTapdDefectWidget();
    widget.id = "tapd-severity";
    widget.data = normalizeTapdDefectWidgetData({
      workspaceId: "40685585",
      projectName: "UGOS_PRO",
      hasServerCredential: true,
      lastSummary: {
        status: "connected",
        workspaceId: "40685585",
        total: 3,
        visibleTotal: 3,
        blockedTotal: 0,
        verificationTotal: 0,
        critical: 1,
        assignedToCurrentUser: 0,
        visibleScope: "owned-by-current-user",
        page: 1,
        limit: 100,
        items: [
          {
            id: "1",
            severity: "高",
            title: "高严重缺陷",
            status: "new",
            url: "",
          },
          {
            id: "2",
            severity: "中",
            title: "中严重缺陷",
            status: "new",
            url: "",
          },
          {
            id: "3",
            severity: "低",
            title: "低严重缺陷",
            status: "new",
            url: "",
          },
        ],
      },
    });
    const wrapper = mount(TapdDefectsOpenedPanel, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState: authenticatedState })],
      },
      props: { widget },
    });
    await wrapper.vm.$nextTick();

    const severityLabels = wrapper.findAll(".tapd-severity");
    expect(severityLabels.map((label) => label.text())).toEqual([
      "高",
      "中",
      "低",
    ]);
    expect(severityLabels[0].classes()).toContain("is-high");
    expect(severityLabels[1].classes()).toContain("is-medium");
    expect(severityLabels[2].classes()).toContain("is-low");
    expect(wrapper.text()).toContain("新建");
    expect(wrapper.text()).not.toContain("new");
  });

  it("disables next page when visible results do not exceed the current page", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const widget = createDefaultTapdDefectWidget();
    widget.id = "tapd-no-next-page";
    widget.data = normalizeTapdDefectWidgetData({
      workspaceId: "40685585",
      projectName: "UGOS_PRO",
      hasServerCredential: true,
      query: {
        limit: 100,
        order: "modified desc",
        fields: ["id", "title", "status"],
      },
      lastSummary: {
        status: "connected",
        workspaceId: "40685585",
        total: 4,
        visibleTotal: 4,
        blockedTotal: 0,
        verificationTotal: 0,
        critical: 0,
        assignedToCurrentUser: 0,
        visibleScope: "owned-by-current-user",
        page: 1,
        limit: 100,
        items: [
          {
            id: "1",
            severity: "高",
            title: "待处理缺陷",
            status: "new",
            url: "",
          },
        ],
      },
    });
    const wrapper = mount(TapdDefectsOpenedPanel, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState: authenticatedState })],
      },
      props: { widget },
    });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    const paginationButtons = wrapper.findAll(".tapd-pagination button");
    expect(paginationButtons[0].attributes("disabled")).toBeDefined();
    expect(paginationButtons[1].attributes("disabled")).toBeDefined();
  });

  it("keeps next page enabled when more visible results exist", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const widget = createDefaultTapdDefectWidget();
    widget.id = "tapd-has-next-page";
    widget.data = normalizeTapdDefectWidgetData({
      workspaceId: "40685585",
      projectName: "UGOS_PRO",
      hasServerCredential: true,
      query: {
        limit: 100,
        order: "modified desc",
        fields: ["id", "title", "status"],
      },
      lastSummary: {
        status: "connected",
        workspaceId: "40685585",
        total: 101,
        visibleTotal: 101,
        blockedTotal: 0,
        verificationTotal: 0,
        critical: 0,
        assignedToCurrentUser: 0,
        visibleScope: "owned-by-current-user",
        page: 1,
        limit: 100,
        items: [
          {
            id: "1",
            severity: "高",
            title: "待处理缺陷",
            status: "new",
            url: "",
          },
        ],
      },
    });
    const wrapper = mount(TapdDefectsOpenedPanel, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState: authenticatedState })],
      },
      props: { widget },
    });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    const paginationButtons = wrapper.findAll(".tapd-pagination button");
    expect(paginationButtons[0].attributes("disabled")).toBeDefined();
    expect(paginationButtons[1].attributes("disabled")).toBeUndefined();
  });

  it("masks stale opened-panel data when the credential is removed", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const widget = createDefaultTapdDefectWidget();
    widget.id = "tapd-missing-credential";
    widget.data = normalizeTapdDefectWidgetData({
      workspaceId: "40685585",
      projectName: "UGOS_PRO",
      hasServerCredential: false,
      lastSummary: {
        status: "error",
        workspaceId: "40685585",
        projectName: "UGOS_PRO",
        total: 4,
        visibleTotal: 4,
        blockedTotal: 0,
        verificationTotal: 0,
        critical: 2,
        assignedToCurrentUser: 0,
        visibleScope: "owned-by-current-user",
        page: 1,
        limit: 100,
        errorCode: "server_credential_missing",
        items: [
          {
            id: "1",
            severity: "高",
            title: "旧缺陷不应展示",
            status: "new",
            url: "",
          },
        ],
      },
    });
    const wrapper = mount(TapdDefectsOpenedPanel, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState: authenticatedState })],
      },
      props: { widget },
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("TAPD 缺陷");
    expect(wrapper.text()).toContain("请配置相关参数");
    expect(wrapper.text()).not.toContain("UGOS_PRO");
    expect(wrapper.text()).not.toContain("旧缺陷不应展示");
    expect(wrapper.find(".tapd-opened-mask").exists()).toBe(true);
    expect(wrapper.findAll(".tapd-table-row")).toHaveLength(0);
    expect(wrapper.find('[data-testid="tapd-summary-visible"]').text()).toBe(
      "0",
    );
  });

  it("refreshes defects after saving connected config", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () =>
      Response.json({
        status: "connected",
        workspaceId: "40685585",
        projectName: "UGOS_PRO",
        total: 1,
        visibleTotal: 1,
        blockedTotal: 0,
        verificationTotal: 0,
        critical: 1,
        assignedToCurrentUser: 1,
        visibleScope: "owned-by-current-user",
        page: 1,
        limit: 100,
        lastSyncedAt: "2026-05-29T09:40:00+08:00",
        items: [
          {
            id: "114068585",
            severity: "高",
            title: "保存后自动同步的缺陷",
            status: "new",
            url: "https://www.tapd.cn/40685585/bugtrace/bugs/view/114068585",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const widget = createDefaultTapdDefectWidget();
    widget.id = "tapd-refresh-after-save";
    widget.data = normalizeTapdDefectWidgetData({});
    const savedData = normalizeTapdDefectWidgetData({
      workspaceId: "40685585",
      projectName: "UGOS_PRO",
      hasServerCredential: true,
      credentialType: "bearer",
      credentialAccountHint: "****eacc",
      query: {
        limit: 100,
        order: "modified desc",
        fields: ["id", "title", "status"],
      },
    });
    const updateData = vi.fn();
    const wrapper = mount(TapdDefectsOpenedPanel, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState: authenticatedState })],
        stubs: {
          TapdDefectsConfigDialog: {
            props: ["data", "widgetId"],
            emits: ["save", "close"],
            template:
              '<div data-testid="config-stub"><button type="button" data-testid="child-save" @click="$emit(\'save\', savedData)">child save</button></div>',
            setup() {
              return { savedData };
            },
          },
        },
      },
      props: { widget },
      attrs: {
        onUpdateData: updateData,
      },
    });

    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("配置参数"))!
      .trigger("click");
    await wrapper.find('[data-testid="child-save"]').trigger("click");
    await flushPromises();

    const queryCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes("/api/tapd-defects/query"),
    );
    expect(queryCall).toBeTruthy();
    expect(JSON.parse(String(queryCall![1]?.body))).toEqual(
      expect.objectContaining({
        workspaceId: "40685585",
        page: 1,
        limit: 100,
      }),
    );
    expect(wrapper.find('[data-testid="config-stub"]').exists()).toBe(false);
    expect(updateData.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        workspaceId: "40685585",
        lastSummary: expect.objectContaining({
          visibleTotal: 1,
          items: expect.arrayContaining([
            expect.objectContaining({
              title: "保存后自动同步的缺陷",
            }),
          ]),
        }),
      }),
    );
  });

  it("keeps the config dialog open for non-closing child saves", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          status: "connected",
          workspaceId: "40685585",
          total: 0,
          visibleTotal: 0,
          blockedTotal: 0,
          verificationTotal: 0,
          critical: 0,
          assignedToCurrentUser: 0,
          visibleScope: "owned-by-current-user",
          page: 1,
          limit: 100,
          items: [],
        }),
      ),
    );
    const widget = createDefaultTapdDefectWidget();
    widget.id = "tapd-keep-config";
    widget.data = normalizeTapdDefectWidgetData({
      workspaceId: "40685585",
      projectName: "UGOS_PRO",
      hasServerCredential: true,
    });
    const updateData = vi.fn();
    const wrapper = mount(TapdDefectsOpenedPanel, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState: authenticatedState })],
        stubs: {
          TapdDefectsConfigDialog: {
            props: ["data", "widgetId"],
            emits: ["save", "close"],
            template:
              '<div data-testid="config-stub"><button type="button" data-testid="child-save" @click="$emit(\'save\', data, { close: false })">child save</button></div>',
          },
        },
      },
      props: { widget },
      attrs: {
        onUpdateData: updateData,
      },
    });

    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("配置参数"))!
      .trigger("click");
    expect(wrapper.find('[data-testid="config-stub"]').exists()).toBe(true);

    await wrapper.find('[data-testid="child-save"]').trigger("click");
    expect(updateData).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "40685585",
      }) as TapdDefectWidgetData,
    );
    expect(wrapper.find('[data-testid="config-stub"]').exists()).toBe(true);
  });
});
