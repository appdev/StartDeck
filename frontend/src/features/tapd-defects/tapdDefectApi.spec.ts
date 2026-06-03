import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryStartDeckConnector } from "@/utils/startdeckConnector";
import { queryTapdDefects, resolveTapdWorkspace } from "./tapdDefectApi";

vi.mock("@/utils/startdeckConnector", () => ({
  queryStartDeckConnector: vi.fn(),
}));

const mockedConnector = vi.mocked(queryStartDeckConnector);

const request = {
  widgetId: "tapd-1",
  workspaceId: "40685585",
  page: 1,
  limit: 100 as const,
  order: "modified desc",
  fields: ["id", "title"],
  visibilityScope: "owned-by-current-user" as const,
  filters: { status: "new|assigned|in_progress|reopened" },
  blockedBugIds: [],
};

describe("tapdDefectApi", () => {
  beforeEach(() => {
    mockedConnector.mockReset();
  });

  it("uses the browser connector by default", async () => {
    mockedConnector.mockResolvedValue({
      status: "connected",
      workspaceId: "40685585",
      total: 1,
      visibleTotal: 1,
      blockedTotal: 0,
      verificationTotal: 0,
      critical: 0,
      assignedToCurrentUser: 1,
      visibleScope: "owned-by-current-user",
      page: 1,
      limit: 100,
      items: [],
    });

    const result = await queryTapdDefects(request);

    expect(result.status).toBe("connected");
    expect(mockedConnector).toHaveBeenCalledWith(
      "tapdDefects.query",
      expect.objectContaining({ requestMode: "connector" }),
    );
  });

  it("uses the browser connector for defect queries and workspace lookup", async () => {
    mockedConnector
      .mockResolvedValueOnce({
        status: "connected",
        workspaceId: "40685585",
        total: 2,
        visibleTotal: 2,
        blockedTotal: 0,
        verificationTotal: 0,
        critical: 0,
        assignedToCurrentUser: 2,
        visibleScope: "owned-by-current-user",
        page: 1,
        limit: 100,
        items: [],
      })
      .mockResolvedValueOnce({
        status: "connected",
        workspaceId: "40685585",
        projectName: "StartDeck",
        fallbackName: "TAPD 缺陷 · 40685585",
      });

    await queryTapdDefects({
      ...request,
      requestMode: "connector",
      credential: {
        credentialType: "basic",
        apiUser: "tapd-user",
        apiPassword: "tapd-password",
      },
    });
    await resolveTapdWorkspace("tapd-1", "40685585", {
      credential: {
        credentialType: "bearer",
        accessToken: "token",
      },
    });

    expect(mockedConnector).toHaveBeenNthCalledWith(
      1,
      "tapdDefects.query",
      expect.objectContaining({ requestMode: "connector" }),
    );
    expect(mockedConnector).toHaveBeenNthCalledWith(
      2,
      "tapdDefects.workspace",
      expect.objectContaining({ workspaceId: "40685585" }),
    );
  });
});
