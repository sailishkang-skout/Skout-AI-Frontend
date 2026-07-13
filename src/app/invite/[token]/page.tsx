"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { CLERK_ENABLED, useApiFetch, useAuthReady } from "@/lib/api-client";
import { getInviteDetails, useTeamApi } from "@/lib/team";
import { Button } from "@/components/ui/button";
import type { InviteDetails } from "@/types/api";

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const authReady = useAuthReady();
  const teamApi = useTeamApi();

  // Fetch invite details — public endpoint, no auth needed
  const invite = useQuery<InviteDetails>({
    queryKey: ["invite", token],
    queryFn: () => getInviteDetails(token),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => teamApi.acceptInvite(token),
  });

  const inviteData = invite.data;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        {/* Loading invite details */}
        {invite.isLoading && (
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading invitation…</p>
          </div>
        )}

        {/* Invite not found / error */}
        {invite.isError && (
          <div className="flex flex-col items-center gap-3 text-center">
            <XCircle className="h-10 w-10 text-destructive" />
            <h1 className="text-lg font-semibold">Invitation not found</h1>
            <p className="text-sm text-muted-foreground">
              This invite link is invalid or has been revoked.
            </p>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Go to dashboard
            </Button>
          </div>
        )}

        {/* Invite already accepted */}
        {inviteData?.accepted && (
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle className="h-10 w-10 text-green-500" />
            <h1 className="text-lg font-semibold">Already accepted</h1>
            <p className="text-sm text-muted-foreground">
              This invitation has already been accepted.
            </p>
            <Button onClick={() => router.push("/dashboard")}>Go to dashboard</Button>
          </div>
        )}

        {/* Invite expired */}
        {inviteData && !inviteData.accepted && inviteData.expired && (
          <div className="flex flex-col items-center gap-3 text-center">
            <XCircle className="h-10 w-10 text-destructive" />
            <h1 className="text-lg font-semibold">Invitation expired</h1>
            <p className="text-sm text-muted-foreground">
              This invite has expired. Ask your workspace admin to send a new one.
            </p>
          </div>
        )}

        {/* Valid invite — accept flow */}
        {inviteData && !inviteData.accepted && !inviteData.expired && (
          <>
            {accept.isSuccess ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <CheckCircle className="h-10 w-10 text-green-500" />
                <h1 className="text-lg font-semibold">Welcome to {inviteData.workspaceName}!</h1>
                <p className="text-sm text-muted-foreground">
                  You&apos;ve joined as a <strong>{inviteData.role}</strong>.
                </p>
                <Button onClick={() => router.push("/dashboard")}>Go to dashboard</Button>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                    {inviteData.workspaceName[0]?.toUpperCase()}
                  </div>
                  <h1 className="text-xl font-semibold">You&apos;re invited!</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Join <strong>{inviteData.workspaceName}</strong> as a{" "}
                    <strong className="capitalize">{inviteData.role}</strong>.
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Sent to {inviteData.email}
                  </p>
                </div>

                {accept.isError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {(accept.error as Error).message}
                  </div>
                )}

                {/* Not signed in with Clerk */}
                {CLERK_ENABLED && !authReady ? (
                  <SignInPrompt token={token} />
                ) : (
                  <Button
                    onClick={() => accept.mutate()}
                    disabled={accept.isPending}
                    className="w-full"
                  >
                    {accept.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Accepting…</>
                    ) : (
                      "Accept invitation"
                    )}
                  </Button>
                )}

                <p className="text-center text-xs text-muted-foreground">
                  Expires {new Date(inviteData.expiresAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SignInPrompt({ token }: { token: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const redirectUrl = typeof window !== "undefined" ? `${window.location.origin}/invite/${token}` : `/invite/${token}`;

  return (
    <div className="space-y-3 text-center">
      <p className="text-sm text-muted-foreground">Sign in to accept this invitation.</p>
      <a
        href={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`}
        className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Sign in to accept
      </a>
    </div>
  );
}
