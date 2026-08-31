import { useApiFetch } from "./api-client";

export interface WinLossDeal {
  id: string;
  accountName: string;
  outcome: "won" | "lost";
  competitors: string | null;
  differentiatorCited: string | null;
  evidenceOrRegionalMaterial: boolean | null;
  notes: string | null;
  createdAt: string;
}

export function useCompetitiveApi() {
  const fetchApi = useApiFetch();
  return {
    getWinLoss: () =>
      fetchApi<{
        data: { status: string; dealsReviewed: number } | null;
        deals: WinLossDeal[];
        positioning: Record<string, unknown>;
        defaults: { minDeals: number };
      }>("/api/v1/competitive/win-loss"),
    addDeal: (input: {
      accountName: string;
      outcome: "won" | "lost";
      competitors?: string;
      differentiatorCited?: string;
      evidenceOrRegionalMaterial?: boolean;
      notes?: string;
    }) =>
      fetchApi<{ data: WinLossDeal }>("/api/v1/competitive/win-loss/deals", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    assignOwner: () =>
      fetchApi<{ data: unknown }>("/api/v1/competitive/win-loss/assign", { method: "POST" }),
  };
}
