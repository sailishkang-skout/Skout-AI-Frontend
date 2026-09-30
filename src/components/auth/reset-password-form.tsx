"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiBase } from "@/lib/api-client";

class ResetPasswordError extends Error {}

// §3 / BE-15: reset invalidates every session but does not itself establish one — the user signs
// in fresh afterward — so, like forgot-password, this calls the API directly.
async function resetPassword(input: { token: string; password: string }): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/v1/auth/password/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ResetPasswordError(body.error ?? "This link is invalid or has expired.");
  }
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // FE-09: keep the token for the submit call, but — like the verify-email confirm page —
  // strip it from the URL/history immediately, so it never lingers there or in analytics.
  const tokenRef = useRef(searchParams.get("token") ?? "");
  const [hasToken] = useState(() => Boolean(tokenRef.current));
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (tokenRef.current) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const resetMut = useMutation({
    mutationFn: () => resetPassword({ token: tokenRef.current, password }),
  });

  if (!hasToken) {
    return (
      <div className="w-full max-w-[min(100vw-2rem,24rem)] rounded-xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <h1 className="text-lg font-semibold">Invalid link</h1>
        <p className="mt-1 text-sm text-muted-foreground">This password reset link is missing its token.</p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  if (resetMut.isSuccess) {
    return (
      <div className="w-full max-w-[min(100vw-2rem,24rem)] rounded-xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
        <h1 className="mt-4 text-lg font-semibold">Password updated</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in with your new password.</p>
        <Button className="mt-6 w-full" onClick={() => router.replace("/sign-in")}>
          Sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[min(100vw-2rem,24rem)] rounded-xl border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="text-xl font-semibold">Choose a new password</h1>

      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          resetMut.mutate();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reset-password" className="text-sm font-medium">
            New password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="reset-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              autoFocus
              required
              minLength={10}
              maxLength={128}
              placeholder="At least 10 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9 pr-9"
              aria-describedby="reset-password-hint"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p id="reset-password-hint" className="text-xs text-muted-foreground">
            At least 10 characters. Avoid common or previously-breached passwords.
          </p>
        </div>

        {resetMut.isError && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {(resetMut.error as Error).message}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={resetMut.isPending || password.length < 10}>
          {resetMut.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating…
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </form>
    </div>
  );
}
