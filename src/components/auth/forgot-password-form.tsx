"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiBase } from "@/lib/api-client";

// §3 / BE-15: no session is created here — identical response for known and unknown addresses
// (anti-enumeration), so this can call the API directly like signup rather than through FE-05.
async function forgotPassword(email: string): Promise<void> {
  await fetch(`${getApiBase()}/api/v1/auth/password/forgot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  // Body/status are the same whether or not the address exists — nothing to branch on.
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const sendMut = useMutation({ mutationFn: () => forgotPassword(email.trim()) });

  if (sendMut.isSuccess) {
    return (
      <div className="w-full max-w-[min(100vw-2rem,24rem)] rounded-xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
        <h1 className="mt-4 text-lg font-semibold">Check your email</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          If an account exists for <strong>{email}</strong>, we sent a link to reset your password.
        </p>
        <a
          href="/sign-in"
          className="mt-6 inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent"
        >
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[min(100vw-2rem,24rem)] rounded-xl border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter the email on your account and we&apos;ll send a link to reset your password.
      </p>

      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          sendMut.mutate();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="forgot-email" className="text-sm font-medium">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="forgot-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoFocus
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={sendMut.isPending || !email.trim()}>
          {sendMut.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            "Send reset link"
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <a href="/sign-in" className="text-primary underline-offset-2 hover:underline">
          Sign in
        </a>
      </p>
    </div>
  );
}
