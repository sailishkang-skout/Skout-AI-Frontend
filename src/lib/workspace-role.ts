import { useQuery } from "@tanstack/react-query";
import { ApiError, useApiFetch, useAuthReady } from "./api-client";

interface MeResponse {
  userId?: string;
  role?: string;
}

/**
 * Role hint for conditional UI (e.g. hiding delete buttons for `member`-role users).
 * Reads the same `["me"]` query already fetched by the sidebar/TopBar (cache-hit, not
 * a duplicate network call) — the CRM service resolves role from the same
 * `workspace_members` row as the main API, so this is a valid same-DB inference.
 *
 * This is a hint only: every delete mutation must still handle a 403 response
 * defensively, since a stale cache or a future divergence between services could
 * make this wrong.
 */
export function useWorkspaceRole() {
  const apiFetch = useApiFetch();
  const authReady = useAuthReady();

  const { data } = useQuery<MeResponse>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/v1/me"),
    enabled: authReady,
    staleTime: 30_000,
  });

  const role = data?.role;
  const canDelete = role === "owner" || role === "admin";

  return { role, canDelete, userId: data?.userId };
}

/** True if a CRM delete/mutation was rejected because the user's role isn't owner/admin. */
export function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}
