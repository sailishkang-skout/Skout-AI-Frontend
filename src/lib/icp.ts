import { useApiFetch } from "./api-client";
import { WORKSPACE_ID } from "./enrichment";
import type { IcpConfig, IcpResponse } from "@/types/api";

export function useIcpApi() {
  const fetchApi = useApiFetch();
  return {
    get: () =>
      fetchApi<IcpResponse>("/api/v1/workspace/icp", { workspaceId: WORKSPACE_ID }),
    save: (config: IcpConfig) =>
      fetchApi<IcpResponse>("/api/v1/workspace/icp", {
        method: "PUT",
        body: JSON.stringify(config),
        workspaceId: WORKSPACE_ID,
      }),
  };
}

export const ICP_INDUSTRIES = [
  "Software",
  "SaaS",
  "Financial Services",
  "Healthcare",
  "Manufacturing",
  "Retail",
  "Professional Services",
];

export const ICP_COUNTRIES = ["US", "CA", "UK", "DE", "FR", "AU", "IN"];

export const ICP_SENIORITIES = [
  { id: "c_level", label: "C-Level" },
  { id: "vp", label: "VP" },
  { id: "director", label: "Director" },
  { id: "manager", label: "Manager" },
  { id: "individual_contributor", label: "Individual contributor" },
];
