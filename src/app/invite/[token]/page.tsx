"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { CheckCircle, Eye, EyeOff, Loader2, Lock, Mail, XCircle } from "lucide-react";
import { CLERK_ENABLED, getApiBase } from "@/lib/api-client";
import { getInviteDetails } from "@/lib/team";
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

async function submitSetPassword(sessionToken: string, password: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/v1/invite-auth/set-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ password }),
  });
  const body = await res.json() as { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Failed to set password");
}

type OtpStep = "idle" | "sent" | "verified" | "done";

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  const [otpStep, setOtpStep] = useState<OtpStep>("idle");

  // After SSO login Clerk redirects back here — auto-send to dashboard
  // so resolveOrProvisionUser runs and auto-accepts the pending invite
  useEffect(() => {
    if (CLERK_ENABLED && isLoaded && isSignedIn && otpStep === "idle") {
      router.replace("/dashboard");
    }
  }, [isLoaded, isSignedIn, otpStep, router]);
  const [otpValue, setOtpValue] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const invite = useQuery<InviteDetails>({
    queryKey: ["invite", token],
    queryFn: () => getInviteDetails(token),
    retry: false,
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
      localStorage.setItem("invite_session_token", data.sessionToken);
      setSessionToken(data.sessionToken);
      setOtpStep("verified");
    },
  });

  const setPasswordMut = useMutation({
    mutationFn: () => submitSetPassword(sessionToken, password),
    onSuccess: () => {
      localStorage.removeItem("invite_session_token");
      setOtpStep("done");
    },
  });

  const inviteData = invite.data;

  const ssoSignInUrl = `/login?redirect_url=${encodeURIComponent(
    typeof window !== "undefined" ? window.location.href : `/invite/${token}`
  )}`;

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

            {/* Step: Account created — sign in to continue */}
            {otpStep === "done" && (
              <div className="flex flex-col items-center gap-4 text-center">
                <CheckCircle className="h-10 w-10 text-green-500" />
                <div>
                  <h2 className="text-lg font-semibold">Account created!</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sign in with your email and password to access <strong>{inviteData.workspaceName}</strong>.
                  </p>
                </div>
                <Button className="w-full" onClick={() => router.push(ssoSignInUrl)}>
                  Sign in to continue
                </Button>
              </div>
            )}

            {/* Step: Set password (after OTP verified) */}
            {otpStep === "verified" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Lock className="h-4 w-4 text-primary" />
                  Set your password
                </div>
                <p className="text-xs text-muted-foreground">
                  Create a password to sign in to Skout with <strong>{otpEmail}</strong>.
                </p>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Choose a password (min. 8 chars)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {setPasswordMut.isError && (
                  <p className="text-sm text-destructive">{(setPasswordMut.error as Error).message}</p>
                )}
                <Button
                  onClick={() => setPasswordMut.mutate()}
                  disabled={setPasswordMut.isPending || password.length < 8}
                  className="w-full"
                >
                  {setPasswordMut.isPending
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting password…</>
                    : "Set password & join workspace"}
                </Button>
              </div>
            )}

            {/* OTP flow — always shown (independent of Clerk auth state) */}
            {otpStep === "idle" && (
              <div className="flex flex-col gap-4">
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
                  href={ssoSignInUrl}
                  className="inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent"
                >
                  Sign in with SSO
                </a>
              </div>
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
                    : "Verify code"}
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

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Expires {new Date(inviteData.expiresAt).toLocaleDateString()}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
