import { useCrmServiceFetch } from "../crm-api-client";
import type {
  CroSummary,
  DashboardOverview,
  PipelineVelocityPoint,
  StaleDealSummary,
  SwitchingCost,
  MissingStakeholderDealSummary,
} from "@/types/crm";

export function useCrmDashboardApi() {
  const fetchApi = useCrmServiceFetch();
  return {
    getOverview: () => fetchApi<DashboardOverview>("/api/v1/dashboard/overview"),

    /** GTM revamp — Pipeline Velocity chart. Open to every workspace member. */
    getPipelineVelocity: () =>
      fetchApi<{ workspaceId: string; series: PipelineVelocityPoint[] }>("/api/v1/dashboard/pipeline-velocity"),

    /** R14.3 — owner/admin only. */
    getSwitchingCost: () => fetchApi<SwitchingCost>("/api/v1/dashboard/switching-cost"),

    /** R19.1 — owner/admin only. */
    getCroSummary: () => fetchApi<CroSummary>("/api/v1/dashboard/cro-summary"),

    /** Open to every workspace member — powers the CRM Intelligence page. */
    getStaleDeals: () =>
      fetchApi<{ workspaceId: string; staleDeals: StaleDealSummary[]; generatedAt: string }>(
        "/api/v1/dashboard/stale-deals"
      ),

    /** Open to every workspace member — powers CRM Intelligence missing stakeholder detection. */
    getMissingStakeholderDeals: () =>
      fetchApi<{ workspaceId: string; missingStakeholderDeals: MissingStakeholderDealSummary[]; generatedAt: string }>(
        "/api/v1/dashboard/missing-stakeholder-deals"
      ),
  };
}