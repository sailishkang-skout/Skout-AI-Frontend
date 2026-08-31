import { useApiFetch } from "./api-client";

export function useSsoScimApi() {
  const fetchApi = useApiFetch();
  return {
    getStatus: () =>
      fetchApi<{
        data: {
          platformReady: boolean;
          workspaceBinding: {
            status: string;
            clerkOrgId: string;
            idpProvider: string;
            scimEnabled: boolean;
          } | null;
          checklist: string;
        };
      }>("/api/v1/sso/stage6/status"),
    getConfig: () => fetchApi<{ data: Record<string, unknown> | null }>("/api/v1/sso/workspaces/current"),
    saveConfig: (input: {
      clerkOrgId: string;
      idpProvider: string;
      idpMetadataUrl?: string | null;
      scimEnabled?: boolean;
      notes?: string | null;
    }) =>
      fetchApi<{ data: Record<string, unknown> }>("/api/v1/sso/workspaces/current", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    activate: () =>
      fetchApi<{ data: Record<string, unknown> }>("/api/v1/sso/workspaces/current/activate", {
        method: "POST",
      }),
  };
}
