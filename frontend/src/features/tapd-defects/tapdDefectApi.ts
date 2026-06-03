import { queryStartDeckConnector } from "@/utils/startdeckConnector";
import type {
  TapdDefectsQueryRequest,
  TapdDefectSummary,
  TapdWorkspaceResponse,
} from "./tapdDefectTypes";

export const queryTapdDefects = async (
  request: TapdDefectsQueryRequest,
): Promise<TapdDefectSummary> =>
  await queryStartDeckConnector<TapdDefectSummary>("tapdDefects.query", {
    ...request,
    requestMode: "connector",
  });

export const resolveTapdWorkspace = async (
  widgetId: string,
  workspaceId: string,
  options: Pick<TapdDefectsQueryRequest, "credential"> = {},
): Promise<TapdWorkspaceResponse> =>
  await queryStartDeckConnector<TapdWorkspaceResponse>(
    "tapdDefects.workspace",
    {
      widgetId,
      workspaceId,
      credential: options.credential,
    },
  );
