"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmEmailVerification } from "@/lib/auth/custom-auth-adapter";

type VerifyState = "verifying" | "success" | "error";

// FE-09: confirm the token, then strip it from the URL/history immediately — it's single-use
// and must never linger in browser history, analytics events, or Sentry breadcrumbs.
export function VerifyEmailConfirm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<VerifyState>("verifying");
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const token = searchParams.get("token");
    window.history.replaceState(null, "", window.location.pathname);

    if (!token) {
      setState("error");
      return;
    }

    confirmEmailVerification(token)
      .then(() => setState("success"))
      .catch(() => setState("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "verifying") {
    return (
      <div className="auth-card w-full max-w-[min(100vw-2rem,26rem)] rounded-3xl border border-white/10 bg-[rgba(14,11,32,0.78)] p-6 text-center shadow-[0_0_60px_-12px_hsl(265_90%_60%/0.45)] backdrop-blur-xl sm:p-8">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground" role="status">
          Verifying your email…
        </p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="auth-card w-full max-w-[min(100vw-2rem,26rem)] rounded-3xl border border-white/10 bg-[rgba(14,11,32,0.78)] p-6 text-center shadow-[0_0_60px_-12px_hsl(265_90%_60%/0.45)] backdrop-blur-xl sm:p-8">
        <XCircle className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-4 text-lg font-semibold">Link invalid or expired</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in and we&apos;ll send a fresh verification link.</p>
        <Link
          href="/sign-in"
          className="mt-6 inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-card w-full max-w-[min(100vw-2rem,26rem)] rounded-3xl border border-white/10 bg-[rgba(14,11,32,0.78)] p-6 text-center shadow-[0_0_60px_-12px_hsl(265_90%_60%/0.45)] backdrop-blur-xl sm:p-8">
      <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
      <h1 className="mt-4 text-lg font-semibold">Email verified</h1>
      <p className="mt-1 text-sm text-muted-foreground">You&apos;re all set.</p>
      <Button className="mt-6 w-full" onClick={() => router.replace("/auth/callback")}>
        Continue
      </Button>
    </div>
  );
}
