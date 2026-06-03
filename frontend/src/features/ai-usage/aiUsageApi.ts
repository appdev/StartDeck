import { queryStartDeckConnector } from "@/utils/startdeckConnector";
import type {
  AiUsageProviderSummary,
  AiUsageQueryRequest,
} from "./aiUsageTypes";

export const queryAiUsage = async (
  request: AiUsageQueryRequest,
): Promise<AiUsageProviderSummary> =>
  await queryStartDeckConnector<AiUsageProviderSummary>("aiUsage.query", {
    ...request,
    requestMode: "connector",
  });
