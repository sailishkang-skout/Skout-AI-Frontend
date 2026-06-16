import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useApiFetch, useAuthReady } from "./api-client";
import { WORKSPACE_ID } from "./enrichment";
import { isIcpConfigured } from "./scoring";
import type { IcpConfig, IcpResponse } from "@/types/api";

export const ICP_SETUP_PATH = "/settings/icp";

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

export function useIcpStatus() {
  const authReady = useAuthReady();
  const icpApi = useIcpApi();
  const query = useQuery({
    queryKey: ["icp"],
    queryFn: icpApi.get,
    enabled: authReady,
  });

  return {
    configured: isIcpConfigured(query.data?.config),
    isLoading: !authReady || query.isLoading,
  };
}

/** Redirect to ICP settings when enrichment requires a configured profile. */
export function useRedirectToIcpSetup() {
  const router = useRouter();
  const { configured, isLoading } = useIcpStatus();

  const redirectToIcpSetup = useCallback(
    (returnPath: string) => {
      if (isLoading || configured) return false;
      router.replace(`${ICP_SETUP_PATH}?return=${encodeURIComponent(returnPath)}`);
      return true;
    },
    [configured, isLoading, router]
  );

  return { configured, isLoading, redirectToIcpSetup };
}
