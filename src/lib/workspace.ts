import { useApiFetch } from "./api-client";
import { WORKSPACE_ID } from "./enrichment";
import type { CreditTransaction, WorkspaceCurrent } from "@/types/api";

export function useWorkspaceApi() {
  const fetchApi = useApiFetch();
  return {
    getCurrent: () =>
      fetchApi<{ data: WorkspaceCurrent }>("/api/v1/workspaces/current", {
        workspaceId: WORKSPACE_ID,
      }),

    rename: (name: string) =>
      fetchApi<{ data: WorkspaceCurrent }>("/api/v1/workspaces/current", {
        method: "PATCH",
        body: JSON.stringify({ name }),
        workspaceId: WORKSPACE_ID,
      }),

    getTransactions: (limit = 50) =>
      fetchApi<{ data: CreditTransaction[] }>(
        `/api/v1/credits/transactions?limit=${limit}`,
        { workspaceId: WORKSPACE_ID }
      ),
  };
}
