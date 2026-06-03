import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryStartDeckConnector } from "@/utils/startdeckConnector";
import { queryAiUsage } from "./aiUsageApi";

vi.mock("@/utils/startdeckConnector", () => ({
  queryStartDeckConnector: vi.fn(),
}));

const mockedConnector = vi.mocked(queryStartDeckConnector);

describe("aiUsageApi", () => {
  beforeEach(() => {
    mockedConnector.mockReset();
  });

  it("uses the browser connector by default", async () => {
    mockedConnector.mockResolvedValue({
      providerId: "openai",
      status: "connected",
      primaryRemainingPercent: 80,
      weeklyRemainingPercent: 60,
    });

    const result = await queryAiUsage({
      widgetId: "ai-1",
      providerId: "openai",
      credentialStorage: "browser",
      credentialType: "access_token",
      credential: "token",
    });

    expect(result.status).toBe("connected");
    expect(mockedConnector).toHaveBeenCalledWith(
      "aiUsage.query",
      expect.objectContaining({ requestMode: "connector" }),
    );
  });

  it("keeps explicit connector payloads on the browser connector", async () => {
    mockedConnector.mockResolvedValue({
      providerId: "openai",
      status: "connected",
      primaryRemainingPercent: 90,
      weeklyRemainingPercent: 70,
    });

    const result = await queryAiUsage({
      widgetId: "ai-1",
      providerId: "openai",
      requestMode: "connector",
      credentialStorage: "browser",
      credentialType: "access_token",
      credential: "token",
    });

    expect(result.primaryRemainingPercent).toBe(90);
    expect(mockedConnector).toHaveBeenCalledWith(
      "aiUsage.query",
      expect.objectContaining({ requestMode: "connector" }),
    );
  });
});
