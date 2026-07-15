"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle, Loader2, Mail, XCircle } from "lucide-react";
import { CLERK_ENABLED, getApiBase, useApiFetch, useAuthReady } from "@/lib/api-client";
import { getInviteDetails, useTeamApi } from "@/lib/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InviteDetails } from "@/types/api";

async function sendOtp(inviteToken: string): Promise<{ email: string; expiresInMinutes: number }> {
  const res = await fetch(`${getApiBase()}/api/v1/invite-auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inviteToken }),
  });
  const body = await res.json() as { data?: { email: string; expiresInMinutes: number }; error?: string };
  if (!res.ok) throw new Error(body.error ?? "Failed to send code");
  return body.data!;
}

async function verifyOtp(
  inviteToken: string,
  otp: string
): Promise<{ sessionToken: string; workspaceId: string; role: string; email: string }> {
  const res = await fetch(`${getApiBase()}/api/v1/invite-auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inviteToken, otp }),
  });
  const body = await res.json() as { data?: { sessionToken: string; workspaceId: string; role: string; email: string }; error?: string };
  if (!res.ok) throw new Error(body.error ?? "Invalid code");
  return body.data!;
}

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const authReady = useAuthReady();
  const teamApi = useTeamApi();

  const [otpStep, setOtpStep] = useState<"idle" | "sent" | "verified">("idle");
  const [otpValue, setOtpValue] = useState("");
  const [otpEmail, setOtpEmail] = useState("");

  const invite = useQuery<InviteDetails>({
    queryKey: ["invite", token],
    queryFn: () => getInviteDetails(token),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => teamApi.acceptInvite(token),
  });

  const sendOtpMut = useMutation({
    mutationFn: () => sendOtp(token),
    onSuccess: (data) => {
      setOtpEmail(data.email);
      setOtpStep("sent");
    },
  });

  const verifyOtpMut = useMutation({
    mutationFn: () => verifyOtp(token, otpValue.trim()),
    onSuccess: (data) => {
      // Store invite session token for authenticated calls
      localStorage.setItem("invite_session_token", data.sessionToken);
      setOtpStep("verified");
    },
  });

  const inviteData = invite.data;
  const notLoggedIn = CLERK_ENABLED && !authReady;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">

        {/* Loading */}
        {invite.isLoading && (
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading invitation…</p>
          </div>
        )}

        {/* Not found / revoked */}
        {invite.isError && (
          <div className="flex flex-col items-center gap-3 text-center">
            <XCircle className="h-10 w-10 text-destructive" />
            <h1 className="text-lg font-semibold">Invitation not found</h1>
            <p className="text-sm text-muted-foreground">This invite link is invalid or has been revoked.</p>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>Go to dashboard</Button>
          </div>
        )}

        {/* Already accepted */}
        {inviteData?.accepted && (
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle className="h-10 w-10 text-green-500" />
            <h1 className="text-lg font-semibold">Already accepted</h1>
            <p className="text-sm text-muted-foreground">This invitation has already been accepted.</p>
            <Button onClick={() => router.push("/dashboard")}>Go to dashboard</Button>
          </div>
        )}

        {/* Expired */}
        {inviteData && !inviteData.accepted && inviteData.expired && (
          <div className="flex flex-col items-center gap-3 text-center">
            <XCircle className="h-10 w-10 text-destructive" />
            <h1 className="text-lg font-semibold">Invitation expired</h1>
            <p className="text-sm text-muted-foreground">Ask your workspace admin to send a new invite.</p>
          </div>
        )}

        {/* Valid invite */}
        {inviteData && !inviteData.accepted && !inviteData.expired && (
          <>
            {/* Workspace header */}
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                {inviteData.workspaceName[0]?.toUpperCase()}
              </div>
              <h1 className="text-xl font-semibold">You&apos;re invited!</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Join <strong>{inviteData.workspaceName}</strong> as a <strong className="capitalize">Team Member</strong>.
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Sent to {inviteData.email}</p>
            </div>

            {/* OTP verified — auto-accepted, show success */}
            {otpStep === "verified" && (
              <div className="flex flex-col items-center gap-3 text-center">
                <CheckCircle className="h-10 w-10 text-green-500" />
                <h1 className="text-lg font-semibold">Welcome to {inviteData.workspaceName}!</h1>
                <p className="text-sm text-muted-foreground">
                  You&apos;ve joined as a <strong>Team Member</strong>.
                </p>
                <Button onClick={() => router.push("/dashboard")}>Go to dashboard</Button>
              </div>
            )}

            {/* Already accepted via Clerk flow */}
            {!notLoggedIn && accept.isSuccess && otpStep !== "verified" && (
              <div className="flex flex-col items-center gap-3 text-center">
                <CheckCircle className="h-10 w-10 text-green-500" />
                <h1 className="text-lg font-semibold">Welcome to {inviteData.workspaceName}!</h1>
                <p className="text-sm text-muted-foreground">You&apos;ve joined as a <strong>Team Member</strong>.</p>
                <Button onClick={() => router.push("/dashboard")}>Go to dashboard</Button>
              </div>
            )}

            {/* Not logged in — OTP flow */}
            {notLoggedIn && otpStep !== "verified" && (
              <div className="flex flex-col gap-4">
                {otpStep === "idle" && (
                  <>
                    {sendOtpMut.isError && (
                      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {(sendOtpMut.error as Error).message}
                      </p>
                    )}
                    <Button
                      onClick={() => sendOtpMut.mutate()}
                      disabled={sendOtpMut.isPending}
                      className="w-full"
                    >
                      {sendOtpMut.isPending
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending code…</>
                        : <><Mail className="mr-2 h-4 w-4" />Send verification code</>}
                    </Button>
                    <div className="relative flex items-center">
                      <div className="flex-grow border-t border-border" />
                      <span className="mx-3 text-xs text-muted-foreground">or</span>
                      <div className="flex-grow border-t border-border" />
                    </div>
                    <a
                      href={`/sign-in?redirect_url=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : `/invite/${token}`)}`}
                      className="inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent"
                    >
                      Sign in with SSO
                    </a>
                  </>
                )}

                {otpStep === "sent" && (
                  <div className="flex flex-col gap-3">
                    <p className="text-center text-sm text-muted-foreground">
                      We sent a 6-digit code to <strong>{otpEmail}</strong>
                    </p>
                    <Input
                      placeholder="Enter 6-digit code"
                      value={otpValue}
                      onChange={(e) => setOtpValue(e.target.value)}
                      maxLength={6}
                      className="text-center text-xl tracking-widest"
                      autoFocus
                    />
                    {verifyOtpMut.isError && (
                      <p className="text-sm text-destructive">{(verifyOtpMut.error as Error).message}</p>
                    )}
                    <Button
                      onClick={() => verifyOtpMut.mutate()}
                      disabled={verifyOtpMut.isPending || otpValue.length < 6}
                      className="w-full"
                    >
                      {verifyOtpMut.isPending
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</>
                        : "Verify & join workspace"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setOtpStep("idle"); setOtpValue(""); }}
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Resend code
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Logged in via Clerk — direct accept */}
            {!notLoggedIn && !accept.isSuccess && otpStep !== "verified" && (
              <div className="flex flex-col gap-3">
                {accept.isError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {(accept.error as Error).message}
                  </div>
                )}
                <Button onClick={() => accept.mutate()} disabled={accept.isPending} className="w-full">
                  {accept.isPending
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Accepting…</>
                    : "Accept invitation"}
                </Button>
              </div>
            )}

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Expires {new Date(inviteData.expiresAt).toLocaleDateString()}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
