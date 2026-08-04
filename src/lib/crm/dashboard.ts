import { useCrmServiceFetch } from "../crm-api-client";
import type { CroSummary, DashboardOverview, SwitchingCost } from "@/types/crm";

export function useCrmDashboardApi() {
  const fetchApi = useCrmServiceFetch();
  return {
    getOverview: () => fetchApi<DashboardOverview>("/api/v1/dashboard/overview"),

    /** R14.3 — owner/admin only. */
    getSwitchingCost: () => fetchApi<SwitchingCost>("/api/v1/dashboard/switching-cost"),

    /** R19.1 — owner/admin only. */
    getCroSummary: () => fetchApi<CroSummary>("/api/v1/dashboard/cro-summary"),
  };
}
