"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Shield, Trash2, UserPlus, Users, X } from "lucide-react";
import { GuideLink } from "@/components/guides/guide-link";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiFetch, useAuthReady } from "@/lib/api-client";
import { useTeamApi, useWorkspaceMembers } from "@/lib/team";
import type { WorkspaceMember, WorkspaceRole } from "@/types/api";

const ROLE_ORDER: Record<WorkspaceRole, number> = { owner: 0, admin: 1, member: 2 };

function roleTone(role: WorkspaceRole) {
  if (role === "owner") return "warning" as const;
  if (role === "admin") return "info" as const;
  return "muted" as const;
}

function RoleIcon({ role }: { role: WorkspaceRole }) {
  if (role === "owner") return <Crown className="h-3 w-3" />;
  if (role === "admin") return <Shield className="h-3 w-3" />;
  return null;
}

export default function TeamPage() {
  const queryClient = useQueryClient();
  const teamApi = useTeamApi();
  const fetchApi = useApiFetch();
  const authReady = useAuthReady();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("member");
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [lastAcceptUrl, setLastAcceptUrl] = useState<string | null>(null);
  const [lastEmailSent, setLastEmailSent] = useState(true);

  // Current user's role (to gate actions)
  const me = useQuery<{ role?: string }>({
    queryKey: ["me"],
    queryFn: () => fetchApi("/api/v1/me"),
    enabled: authReady,
    staleTime: 30_000,
  });
  const myRole = (me.data?.role ?? "member") as WorkspaceRole;
  const canManage = myRole === "owner" || myRole === "admin";

  const members = useWorkspaceMembers();
  const sortedMembers = members.data ? [...members.data.data].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]) : [];

  const invites = useQuery({
    queryKey: ["team", "invites"],
    queryFn: teamApi.listInvites,
    enabled: authReady && canManage,
    select: (r) => r.data,
  });

  const sendInvite = useMutation({
    mutationFn: () => teamApi.inviteMember(inviteEmail.trim(), inviteRole),
    onSuccess: (res) => {
      setInviteEmail("");
      setLastAcceptUrl(res.data.acceptUrl);
      setLastEmailSent(res.data.emailSent);
      setInviteSuccess(
        res.data.emailSent
          ? `Invite emailed to ${res.data.email}`
          : `Invite created for ${res.data.email} — ${res.data.emailError ?? "email was not sent"}; copy the link below`
      );
      setInviteError(null);
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (err: Error) => {
      setInviteError(err.message);
      setLastAcceptUrl(null);
    },
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: WorkspaceRole }) =>
      teamApi.updateRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => teamApi.removeMember(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
  });

  const revokeInvite = useMutation({
    mutationFn: (inviteId: string) => teamApi.revokeInvite(inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
  });

  return (
    <PageShell data-testid="page-team">
      <PageHeader
        title="Team"
        description="Manage workspace members, roles, and pending invitations."
        actions={<GuideLink slug="team" label="Team guide" />}
      />

      {/* Invite form — owner/admin only */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <UserPlus className="h-4 w-4" />
              Invite a team member
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {inviteSuccess && (
              <Alert
                variant={lastEmailSent ? "success" : "warning"}
                title={lastEmailSent ? "Invitation sent" : "Invitation created"}
                dismissible
              >
                <p>{inviteSuccess}</p>
                {lastAcceptUrl && (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      readOnly
                      value={lastAcceptUrl}
                      className="min-w-0 flex-1 bg-background font-mono text-xs"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        void navigator.clipboard.writeText(lastAcceptUrl);
                      }}
                    >
                      Copy link
                    </Button>
                  </div>
                )}
              </Alert>
            )}
            {inviteError && (
              <Alert variant="error" title="Invite failed" dismissible>
                {inviteError}
              </Alert>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                type="email"
                placeholder="colleague@company.com"
                className="min-w-0 flex-1 bg-background"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && inviteEmail.trim() && sendInvite.mutate()}
              />
              <Select
                className="sm:w-36"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                {myRole === "owner" && <option value="owner">Owner</option>}
              </Select>
              <Button
                onClick={() => sendInvite.mutate()}
                disabled={!inviteEmail.trim() || sendInvite.isPending}
                className="shrink-0"
              >
                Send invite
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>Member</strong> — full feature access, no team management.{" "}
              <strong>Admin</strong> — can also invite/remove members.{" "}
              <strong>Owner</strong> — full control including billing.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Members list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Users className="h-4 w-4" />
            Members
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {members.isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          ) : members.error ? (
            <div className="p-4">
              <Alert variant="error" title="Failed to load members" onRetry={() => members.refetch()}>
                Could not load team members. Please try again.
              </Alert>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {sortedMembers.map((member) => (
                <MemberRow
                  key={member.userId}
                  member={member}
                  myRole={myRole}
                  onChangeRole={(role) => changeRole.mutate({ userId: member.userId, role })}
                  onRemove={() => removeMember.mutate(member.userId)}
                  isChangingRole={changeRole.isPending && changeRole.variables?.userId === member.userId}
                  isRemoving={removeMember.isPending && removeMember.variables === member.userId}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Pending invites — owner/admin only */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Pending invitations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {invites.isLoading ? (
              <div className="p-4">
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !invites.data?.length ? (
              <p className="p-4 text-sm text-muted-foreground">No pending invitations.</p>
            ) : (
              <ul className="divide-y divide-border">
                {invites.data.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge tone={roleTone(inv.role)} className="capitalize">{inv.role}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeInvite.mutate(inv.id)}
                        disabled={revokeInvite.isPending && revokeInvite.variables === inv.id}
                        title="Revoke invitation"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}

function MemberRow({
  member,
  myRole,
  onChangeRole,
  onRemove,
  isChangingRole,
  isRemoving,
}: {
  member: WorkspaceMember;
  myRole: WorkspaceRole;
  onChangeRole: (role: WorkspaceRole) => void;
  onRemove: () => void;
  isChangingRole: boolean;
  isRemoving: boolean;
}) {
  const canEdit = myRole === "owner" && member.role !== "owner";
  const canRemove = (myRole === "owner" || myRole === "admin") && member.role !== "owner";

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase text-muted-foreground">
        {(member.fullName ?? member.email)[0]}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{member.fullName ?? member.email}</p>
        {member.fullName && (
          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {canEdit ? (
          <Select
            className="h-7 w-28 text-xs"
            value={member.role}
            onChange={(e) => onChangeRole(e.target.value as WorkspaceRole)}
            disabled={isChangingRole}
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
          </Select>
        ) : (
          <Badge tone={roleTone(member.role)} className="flex items-center gap-1 capitalize">
            <RoleIcon role={member.role} />
            {member.role}
          </Badge>
        )}
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={isRemoving}
            title="Remove member"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </li>
  );
}
