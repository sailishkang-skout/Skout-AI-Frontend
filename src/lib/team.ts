import { getApiBase, useApiFetch } from "@/lib/api-client";
import type { AcceptInviteResult, InviteDetails, WorkspaceInvite, WorkspaceMember, WorkspaceRole } from "@/types/api";

export function useTeamApi() {
  const fetchApi = useApiFetch();

  return {
    listMembers: () =>
      fetchApi<{ data: WorkspaceMember[] }>("/api/v1/team/members"),

    listInvites: () =>
      fetchApi<{ data: WorkspaceInvite[] }>("/api/v1/team/invites"),

    inviteMember: (email: string, role: WorkspaceRole) =>
      fetchApi<{
        data: {
          email: string;
          role: WorkspaceRole;
          expiresAt: string;
          acceptUrl: string;
          emailSent: boolean;
          emailError?: string;
        };
      }>("/api/v1/team/invites", { method: "POST", body: JSON.stringify({ email, role }) }),

    updateRole: (userId: string, role: WorkspaceRole) =>
      fetchApi<{ data: { userId: string; role: WorkspaceRole } }>(
        `/api/v1/team/members/${userId}/role`,
        { method: "PATCH", body: JSON.stringify({ role }) }
      ),

    removeMember: (userId: string) =>
      fetchApi<undefined>(`/api/v1/team/members/${userId}`, { method: "DELETE" }),

    revokeInvite: (inviteId: string) =>
      fetchApi<undefined>(`/api/v1/team/invites/${inviteId}`, { method: "DELETE" }),

    acceptInvite: (token: string) =>
      fetchApi<{ data: AcceptInviteResult }>(
        `/api/v1/team/invites/${token}/accept`,
        { method: "POST" }
      ),
  };
}

export async function getInviteDetails(token: string): Promise<InviteDetails> {
  const res = await fetch(`${getApiBase()}/api/v1/team/invites/${token}`);
  const body = await res.json() as { data?: InviteDetails; error?: string };
  if (!res.ok) throw new Error(body.error ?? "Invite not found");
  return body.data!;
}
