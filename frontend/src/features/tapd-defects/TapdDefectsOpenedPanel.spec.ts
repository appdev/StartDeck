// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
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

describe("TapdDefectsOpenedPanel", () => {
  beforeEach(() => {
    localStorage.setItem("start-deck-token", "user-token");
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
        plugins: [createTestingPinia({ createSpy: vi.fn })],
      },
      props: { widget },
      attrs: {
        onUpdateData: updateData,
      },
    });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("支付回调失败");
    await wrapper.find(".tapd-table-row i").trigger("click");

    expect(updateData).toHaveBeenCalled();
    expect(JSON.stringify(updateData.mock.calls.at(-1)?.[0])).toContain("1824");
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
        plugins: [createTestingPinia({ createSpy: vi.fn })],
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
        plugins: [createTestingPinia({ createSpy: vi.fn })],
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
        plugins: [createTestingPinia({ createSpy: vi.fn })],
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
    expect(wrapper.find(".tapd-summary-card strong").text()).toBe("0");
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
        plugins: [createTestingPinia({ createSpy: vi.fn })],
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
