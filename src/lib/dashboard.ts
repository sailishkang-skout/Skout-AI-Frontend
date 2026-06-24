import { useApiFetch } from "./api-client";
import type { DashboardSummary } from "@/types/api";

export const DASHBOARD_SUMMARY_KEY = ["dashboard", "summary"] as const;

export function useDashboardApi() {
  const fetchApi = useApiFetch();
  return {
    getSummary: () => fetchApi<{ data: DashboardSummary }>("/api/v1/dashboard/summary"),
  };
}
