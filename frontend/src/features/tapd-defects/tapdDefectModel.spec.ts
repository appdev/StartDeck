import { describe, expect, it } from "vitest";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  applyTapdDefectSizeToWidget,
  buildTapdFilters,
  createDefaultTapdDefectWidget,
  normalizeTapdDefectWidgetData,
  resolveTapdDisplayName,
  tapdErrorMessage,
} from "./tapdDefectModel";
import {
  TAPD_ACTIONABLE_DEFECT_STATUS,
  TAPD_DEFECTS_WIDGET_TYPE,
} from "./tapdDefectTypes";

describe("tapdDefectModel", () => {
  it("creates a TAPD defect widget with approved defaults", () => {
    const widget = createDefaultTapdDefectWidget();
    expect(widget).toMatchObject({
      id: "tapd-defects",
      type: TAPD_DEFECTS_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "tapd-defects",
        layoutSystem: SD_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
        visibilityScope: "owned-by-current-user",
        query: {
          limit: 100,
          order: "modified desc",
          status: TAPD_ACTIONABLE_DEFECT_STATUS,
        },
      },
    });
    expect(widget).not.toHaveProperty("isPublic");
  });

  it("normalizes data without preserving raw credentials or follow filters", () => {
    const normalized = normalizeTapdDefectWidgetData({
      workspaceId: "20358627",
      projectName: "支付平台",
      credential: "secret-token",
      apiPassword: "secret-password",
      follow: true,
      sizeKey: "4x4",
      query: {
        limit: 200,
        label: "重点关注",
        currentOwner: "current-user",
        currentUser: "tapd_api_user",
        status: TAPD_ACTIONABLE_DEFECT_STATUS,
      },
      lastSummary: {
        status: "connected",
        total: 12,
        visibleTotal: 9,
        items: [{ id: "1", title: "支付回调失败", status: "处理中" }],
      },
    });

    expect(normalized).toMatchObject({
      workspaceId: "20358627",
      projectName: "支付平台",
      sizeKey: "2x2",
      query: {
        limit: 200,
        label: "重点关注",
        currentOwner: "current-user",
        currentUser: "tapd_api_user",
      },
      lastSummary: {
        status: "connected",
        total: 12,
        visibleTotal: 9,
      },
    });
    expect(JSON.stringify(normalized)).not.toContain("secret");
    expect(JSON.stringify(normalized)).not.toContain("follow");
  });

  it("applies all supported non-4x4 size keys", () => {
    const widget = createDefaultTapdDefectWidget();

    applyTapdDefectSizeToWidget(widget, "2x4");

    expect(widget).toMatchObject({
      type: TAPD_DEFECTS_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({ sizeKey: "2x4" }),
    });
  });

  it("resolves display names and current-user filters without visible personal copy", () => {
    const data = normalizeTapdDefectWidgetData({
      workspaceId: "20358627",
      projectName: "支付平台",
      query: {
        currentUser: "tapd_api_user",
        currentOwner: "current-user",
      },
    });

    expect(resolveTapdDisplayName(data)).toBe("支付平台缺陷");
    expect(buildTapdFilters(data.query)).toMatchObject({
      status: TAPD_ACTIONABLE_DEFECT_STATUS,
      currentOwner: "tapd_api_user",
    });
  });

  it("forces TAPD status filters to actionable current-owner states", () => {
    const normalized = normalizeTapdDefectWidgetData({
      query: {
        status: "resolved",
        vStatus: "已解决",
      },
    });

    expect(normalized.query.status).toBe(TAPD_ACTIONABLE_DEFECT_STATUS);
    expect(normalized.query.vStatus).toBeUndefined();
    expect(buildTapdFilters(normalized.query)).toMatchObject({
      status: TAPD_ACTIONABLE_DEFECT_STATUS,
      vStatus: undefined,
    });
  });

  it("normalizes legacy project-visible scope back to a personal scope", () => {
    const normalized = normalizeTapdDefectWidgetData({
      visibilityScope: "project-visible",
      lastSummary: {
        status: "connected",
        total: 85799,
        visibleTotal: 85799,
        visibleScope: "project-visible",
        items: [{ id: "1", title: "旧项目级结果" }],
      },
    });

    expect(normalized.visibilityScope).toBe("owned-by-current-user");
    expect(normalized.lastSummary?.visibleScope).toBe("owned-by-current-user");
    expect(normalized.lastSummary?.visibleTotal).toBe(0);
    expect(normalized.lastSummary?.items).toHaveLength(0);
  });

  it("forces older personal scopes back to current-owner processing", () => {
    const normalized = normalizeTapdDefectWidgetData({
      visibilityScope: "created-by-current-user",
      lastSummary: {
        status: "connected",
        visibleScope: "cc-to-current-user",
      },
    });

    expect(normalized.visibilityScope).toBe("owned-by-current-user");
    expect(normalized.lastSummary?.visibleScope).toBe("owned-by-current-user");
  });

  it("maps upstream error codes to user-facing messages", () => {
    expect(tapdErrorMessage("upstream_rate_limited")).toBe(
      "TAPD 接口限流，请稍后重试",
    );
    expect(tapdErrorMessage("reauth_required")).toBe(
      "TAPD 凭据已失效，请重新保存",
    );
    expect(tapdErrorMessage("source_shape_changed")).toBe(
      "TAPD 返回格式已变化",
    );
  });
});
