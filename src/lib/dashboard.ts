import { useApiFetch } from "./api-client";
import type { DashboardSummary, SetupChecklist } from "@/types/api";

export interface DashboardFunnel {
  discovered: number;
  enriched: number;
  inSequence: number;
  replied: number;
  activeInSequence: number;
}

export const DASHBOARD_SUMMARY_KEY = ["dashboard", "summary"] as const;
export const DASHBOARD_FUNNEL_KEY = ["dashboard", "funnel"] as const;
export const SETUP_CHECKLIST_KEY = ["workspace", "setup-checklist"] as const;

export function useDashboardApi() {
  const fetchApi = useApiFetch();
  return {
    getSummary: () => fetchApi<{ data: DashboardSummary }>("/api/v1/dashboard/summary"),

    /** GTM revamp — GTM Funnel chart's discovered/enriched/inSequence/replied stages, plus the
     * "Active in Sequence" KPI card. The funnel's remaining two stages (meetings, opportunities)
     * live in apps/crm and are composed client-side — see src/lib/crm/{meetings,deals}.ts. */
    getFunnel: () => fetchApi<{ data: DashboardFunnel }>("/api/v1/dashboard/funnel"),
    getSetupChecklist: () =>
      fetchApi<{ data: SetupChecklist }>("/api/v1/workspaces/current/setup-checklist"),
    seedDemoData: () =>
      fetchApi<{ data: { listId: string; added: number; alreadySeeded: boolean } }>(
        "/api/v1/workspaces/current/seed-demo-data",
        { method: "POST" }
      ),
  };
}
