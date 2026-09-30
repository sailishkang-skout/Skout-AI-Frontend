"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, LogOut, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useAccountApi } from "@/lib/account";

const SESSIONS_QUERY_KEY = ["auth", "sessions"] as const;

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * AUTH-FE-13 — account/security page: change password (revokes other sessions) and active
 * sessions with per-device sign-out. The user-menu half of FE-13 is components/auth/user-menu.tsx.
 */
export default function AccountSecurityPage() {
  const authReady = useAuthReady();
  const accountApi = useAccountApi();
  const queryClient = useQueryClient();

  const sessions = useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: accountApi.getSessions,
    enabled: authReady,
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => accountApi.revokeSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY }),
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);

  const changePasswordMut = useMutation({
    mutationFn: () => accountApi.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
    },
  });

  const rows = sessions.data?.data.sessions ?? [];

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Account & security"
        description="Manage your password and see where you're signed in."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Change password
          </CardTitle>
          <CardDescription>Changing your password signs out every other device.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              changePasswordMut.mutate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="current-password" className="text-sm font-medium">
                Current password
              </label>
              <Input
                id="current-password"
                type={showPasswords ? "text" : "password"}
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-password" className="text-sm font-medium">
                New password
              </label>
              <Input
                id="new-password"
                type={showPasswords ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={10}
                maxLength={128}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">At least 10 characters.</p>
            </div>

            <button
              type="button"
              onClick={() => setShowPasswords((v) => !v)}
              className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              {showPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPasswords ? "Hide" : "Show"} passwords
            </button>

            {changePasswordMut.isError && (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formatQueryError(changePasswordMut.error, "Could not change your password.")}
              </p>
            )}
            {changePasswordMut.isSuccess && (
              <p role="status" className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                Password updated. Other devices have been signed out.
              </p>
            )}

            <Button
              type="submit"
              className="w-fit"
              disabled={changePasswordMut.isPending || newPassword.length < 10 || !currentPassword}
            >
              {changePasswordMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating…
                </>
              ) : (
                "Update password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MonitorSmartphone className="h-4 w-4" />
            Active sessions
          </CardTitle>
          <CardDescription>Everywhere you&apos;re currently signed in.</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading sessions…
            </div>
          )}
          {sessions.isError && (
            <p role="alert" className="text-sm text-destructive">
              {formatQueryError(sessions.error, "Could not load your sessions.")}
            </p>
          )}
          {sessions.isSuccess && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No active sessions found.</p>
          )}
          <ul className="divide-y">
            {rows.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {session.isCurrent ? "This device" : "Another device"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Signed in {formatTimestamp(session.createdAt)} · last active{" "}
                    {formatTimestamp(session.lastUsedAt)}
                  </p>
                </div>
                {!session.isCurrent && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={revokeMut.isPending && revokeMut.variables === session.id}
                    onClick={() => revokeMut.mutate(session.id)}
                  >
                    <LogOut className="mr-1.5 h-3.5 w-3.5" />
                    Sign out
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </PageShell>
  );
}
