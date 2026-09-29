import { useApiFetch } from "./api-client";

export interface AuthSession {
  id: string;
  isCurrent: boolean;
  createdAt: string;
  lastUsedAt: string;
  idleExpiresAt: string;
}

/** AUTH-FE-13 — account/security page: active sessions + change password, on top of BE-14's
 *  new /auth/sessions and /auth/password/change endpoints. */
export function useAccountApi() {
  const fetchApi = useApiFetch();
  return {
    getSessions: () => fetchApi<{ data: { sessions: AuthSession[] } }>("/api/v1/auth/sessions"),

    revokeSession: (id: string) =>
      fetchApi<void>(`/api/v1/auth/sessions/${encodeURIComponent(id)}/revoke`, { method: "POST" }),

    changePassword: (currentPassword: string, newPassword: string) =>
      fetchApi<void>("/api/v1/auth/password/change", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
  };
}
