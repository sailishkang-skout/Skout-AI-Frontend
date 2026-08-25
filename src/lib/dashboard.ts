import { useApiFetch } from "./api-client";
import type { DashboardSummary, SetupChecklist } from "@/types/api";

export const DASHBOARD_SUMMARY_KEY = ["dashboard", "summary"] as const;
export const SETUP_CHECKLIST_KEY = ["workspace", "setup-checklist"] as const;

export function useDashboardApi() {
  const fetchApi = useApiFetch();
  return {
    getSummary: () => fetchApi<{ data: DashboardSummary }>("/api/v1/dashboard/summary"),
    getSetupChecklist: () =>
      fetchApi<{ data: SetupChecklist }>("/api/v1/workspaces/current/setup-checklist"),
    seedDemoData: () =>
      fetchApi<{ data: { listId: string; added: number; alreadySeeded: boolean } }>(
        "/api/v1/workspaces/current/seed-demo-data",
        { method: "POST" }
      ),
  };
}
