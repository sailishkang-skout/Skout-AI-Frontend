import { useCrmServiceFetch } from "../crm-api-client";
import type { DashboardOverview } from "@/types/crm";

export function useCrmDashboardApi() {
  const fetchApi = useCrmServiceFetch();
  return {
    getOverview: () => fetchApi<DashboardOverview>("/api/v1/dashboard/overview"),
  };
}
