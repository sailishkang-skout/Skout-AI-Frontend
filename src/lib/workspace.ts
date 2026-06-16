import { useApiFetch } from "./api-client";
import type { CreditTransaction, WorkspaceCurrent } from "@/types/api";

export function useWorkspaceApi() {
  const fetchApi = useApiFetch();
  return {
    getCurrent: () =>
      fetchApi<{ data: WorkspaceCurrent }>("/api/v1/workspaces/current"),

    rename: (name: string) =>
      fetchApi<{ data: WorkspaceCurrent }>("/api/v1/workspaces/current", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),

    getTransactions: (limit = 50) =>
      fetchApi<{ data: CreditTransaction[] }>(
        `/api/v1/credits/transactions?limit=${limit}`
      ),

    topUpCredits: (amount = 100) =>
      fetchApi<{ data: { balance: number; amount: number } }>("/api/v1/credits/topup", {
        method: "POST",
        body: JSON.stringify({ amount }),
      }),
  };
}
