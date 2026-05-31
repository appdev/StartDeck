// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import tapdLogoUrl from "@/assets/tapd/logo.svg";
import TapdDefectsWidget from "./TapdDefectsWidget.vue";
import { createDefaultTapdDefectWidget } from "./tapdDefectModel";
import { TAPD_ACTIONABLE_DEFECT_STATUS } from "./tapdDefectTypes";

const authenticatedState = {
  auth: {
    sessionReady: true,
    isLogged: true,
    username: "ying",
    sessionGeneration: "test-session",
  },
};

describe("TapdDefectsWidget", () => {
  beforeEach(() => {
    localStorage.setItem("start-deck-username", "ying");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it.each(["1x1", "1x2", "2x1", "2x2", "2x4"] as const)(
    "renders the approved TAPD defects size %s without personal shorthand",
    (sizeKey) => {
      const widget = createDefaultTapdDefectWidget();
      widget.data = {
        ...(widget.data as Record<string, unknown>),
        sizeKey,
        workspaceId: "20358627",
        projectName: "支付平台",
        hasServerCredential: true,
        lastSummary: {
          status: "connected",
          workspaceId: "20358627",
          total: 23,
          visibleTotal: 23,
          verificationTotal: 5,
          critical: 6,
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
      const wrapper = mount(TapdDefectsWidget, {
        global: {
          plugins: [
            createTestingPinia({
              createSpy: vi.fn,
              initialState: authenticatedState,
            }),
          ],
        },
        props: {
          widget,
          sizeKey,
        },
      });

      expect(wrapper.attributes("data-tapd-size")).toBe(sizeKey);
      expect(wrapper.text()).toContain("23");
      expect(wrapper.text()).not.toContain("我的");
      expect(wrapper.text()).not.toContain("我");
      expect(wrapper.find("img").attributes("src")).toBe(tapdLogoUrl);
      wrapper.unmount();
    },
  );

  it("renders defect row statuses in Chinese", () => {
    const widget = createDefaultTapdDefectWidget();
    widget.data = {
      ...(widget.data as Record<string, unknown>),
      sizeKey: "2x4",
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
            title: "移动端接入异常",
            status: "new",
            url: "",
          },
          {
            id: "2",
            severity: "中",
            title: "重新打开的音频问题",
            status: "reopened",
            url: "",
          },
          {
            id: "3",
            severity: "低",
            title: "已接受的展示问题",
            status: "accepted",
            url: "",
          },
        ],
      },
    };
    const wrapper = mount(TapdDefectsWidget, {
      global: {
        plugins: [
            createTestingPinia({
              createSpy: vi.fn,
              initialState: authenticatedState,
            }),
        ],
      },
      props: {
        widget,
        sizeKey: "2x4",
      },
    });

    expect(wrapper.findAll(".tapd-row em").map((item) => item.text())).toEqual([
      "新建",
      "重新打开",
      "已接受",
    ]);
    expect(wrapper.text()).not.toContain("reopened");
    expect(wrapper.text()).not.toContain("accepted");
    wrapper.unmount();
  });

  it("masks stale project data when the server credential is missing", () => {
    const widget = createDefaultTapdDefectWidget();
    widget.data = {
      ...(widget.data as Record<string, unknown>),
      sizeKey: "2x2",
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
    };
    const wrapper = mount(TapdDefectsWidget, {
      global: {
        plugins: [
            createTestingPinia({
              createSpy: vi.fn,
              initialState: authenticatedState,
            }),
        ],
      },
      props: {
        widget,
        sizeKey: "2x2",
      },
    });

    expect(wrapper.text()).toContain("请配置相关参数");
    expect(wrapper.text()).toContain("TAPD 缺陷");
    expect(wrapper.text()).not.toContain("UGOS_PRO");
    expect(wrapper.text()).not.toContain("旧缺陷不应展示");
    expect(wrapper.find(".tapd-config-mask").exists()).toBe(true);
    expect(wrapper.find(".tapd-hero strong").text()).toBe("0");
    wrapper.unmount();
  });

  it("keeps personal defect scope when no TAPD username is configured", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        status: "connected",
        workspaceId: "40685585",
        projectName: "UGOS_PRO",
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

    const wrapper = mount(TapdDefectsWidget, {
      global: {
        plugins: [
            createTestingPinia({
              createSpy: vi.fn,
              initialState: authenticatedState,
            }),
        ],
      },
      props: {
        widget,
        sizeKey: "2x2",
      },
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
    expect(wrapper.emitted("updateData")?.at(-1)?.[0]).toMatchObject({
      visibilityScope: "owned-by-current-user",
    });
    wrapper.unmount();
  });
});
