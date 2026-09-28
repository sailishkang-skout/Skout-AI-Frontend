"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { customSignIn, AuthApiError } from "@/lib/auth/custom-auth-adapter";

// §3 error envelope codes for login. Generic on purpose: an unknown-account and a
// wrong-password response must read identically, so a code isn't an enumeration oracle.
function loginErrorMessage(err: unknown): string {
  if (err instanceof AuthApiError) {
    switch (err.code) {
      case "AUTH_RATE_LIMITED":
        return "Too many attempts. Please wait a moment and try again.";
      case "AUTH_EMAIL_NOT_VERIFIED":
        return "Please verify your email before signing in — check your inbox for the link.";
      case "AUTH_ACCOUNT_BLOCKED":
        return "This account is inactive. Contact your workspace admin.";
      default:
        return "Invalid email or password.";
    }
  }
  return "Something went wrong. Please try again.";
}

type Step = "identifier" | "password";

export function OwnAuthLoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("identifier");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loginMut = useMutation({
    mutationFn: () => customSignIn({ email: email.trim(), password }),
    onSuccess: () => {
      // Same landing decision as Clerk's flow: onboarding vs dashboard.
      router.push("/auth/callback");
    },
  });

  return (
    <div className="w-full max-w-[min(100vw-2rem,24rem)] rounded-xl border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="text-xl font-semibold">Sign in to Skout</h1>

      {step === "identifier" && (
        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) setStep("password");
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className="text-sm font-medium">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="login-email"
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
          <Button type="submit" className="w-full" disabled={!email.trim()}>
            Continue
          </Button>
        </form>
      )}

      {step === "password" && (
        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            loginMut.mutate();
          }}
        >
          <p className="text-sm text-muted-foreground">
            Signing in as <strong>{email}</strong>.{" "}
            <button
              type="button"
              onClick={() => {
                setStep("identifier");
                loginMut.reset();
              }}
              className="text-primary underline-offset-2 hover:underline"
            >
              Not you?
            </button>
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-password" className="text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                required
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 pr-9"
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
            <a href="/forgot-password" className="self-end text-xs text-primary underline-offset-2 hover:underline">
              Forgot password?
            </a>
          </div>

          {loginMut.isError && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {loginErrorMessage(loginMut.error)}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loginMut.isPending || !password}>
            {loginMut.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <a href="/sign-up" className="text-primary underline-offset-2 hover:underline">
          Sign up
        </a>
      </p>
    </div>
  );
}
