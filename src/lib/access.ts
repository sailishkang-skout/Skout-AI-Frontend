import { useQuery } from "@tanstack/react-query";
import { authQueryOptions, useApiFetch, useAuthReady } from "./api-client";
import { isFeatureOn, type FeatureMap, type ProductFeature } from "./feature-nav";

export type AccessStatus = "pending" | "invited" | "active" | "rejected";

export interface AccessRequestInfo {
  company: string | null;
  role_title: string | null;
  use_case: string | null;
  submitted: boolean;
  created_at: string;
}

export interface AccessState {
  status: AccessStatus;
  features: FeatureMap;
  request: AccessRequestInfo | null;
}

export interface AccessAnswers {
  company: string;
  role_title: string;
  use_case?: string;
}

export const ACCESS_QUERY_KEY = ["access"] as const;

/** Early access endpoints (GET/POST /api/v1/access-request, POST /api/v1/access-request/redeem). */
export function useAccessApi() {
  const fetchApi = useApiFetch();
  return {
    get: () => fetchApi<{ data: AccessState }>("/api/v1/access-request"),
    submit: (answers: AccessAnswers) =>
      fetchApi<{ data: AccessState }>("/api/v1/access-request", { method: "POST", body: JSON.stringify(answers) }),
    redeem: (code: string) =>
      fetchApi<{ data: { status: AccessStatus } }>("/api/v1/access-request/redeem", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
  };
}

/** The signed-in workspace's early access status and feature switches. */
export function useAccess() {
  const api = useAccessApi();
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ACCESS_QUERY_KEY,
    queryFn: async () => (await api.get()).data,
    enabled: authReady,
    staleTime: 30_000,
    ...authQueryOptions,
  });
}

/**
 * Whether a feature is on, read from the access state AccessGate already loaded (no fetch of its
 * own). Unknown switches count as on: the API still refuses what the workspace can't use.
 */
export function useFeatureOn(feature: ProductFeature): boolean {
  const { data } = useQuery<AccessState>({ queryKey: ACCESS_QUERY_KEY, enabled: false });
  return isFeatureOn(data?.features, feature);
}
