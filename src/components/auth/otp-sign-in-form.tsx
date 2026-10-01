"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiBase } from "@/lib/api-client";
import { verifyEmailOtp } from "@/lib/auth/custom-auth-adapter";

const RESEND_COOLDOWN_SECONDS = 30;
const CODE_LENGTH = 6;

// §3 / BE-15: sending a code has nothing to set (identical response for known/unknown
// addresses), so it's called directly, same as forgot-password.
async function sendOtp(email: string): Promise<void> {
  await fetch(`${getApiBase()}/api/v1/auth/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

// FE-09: 6-digit OTP entry with paste support and a resend cooldown. Also the "email me a
// code" path for users who have no password to sign in with.
export function OtpSignInForm() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendMut = useMutation({
    mutationFn: () => sendOtp(email.trim()),
    onSuccess: () => {
      setStep("code");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    },
  });

  const code = digits.join("");
  const verifyMut = useMutation({
    mutationFn: () => verifyEmailOtp({ email: email.trim(), code }),
    onSuccess: () => router.push("/auth/callback"),
  });

  function setDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    setDigits((prev) => {
      const next = [...prev];
      next[index] = clean.slice(-1) || "";
      return next;
    });
    if (clean && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    setDigits(Array.from({ length: CODE_LENGTH }, (_, i) => pasted[i] ?? ""));
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  }

  if (step === "email") {
    return (
      <div className="w-full max-w-[min(100vw-2rem,24rem)] rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-semibold">Sign in with a code</h1>
        <p className="mt-1 text-sm text-muted-foreground">We&apos;ll email you a 6-digit code.</p>

        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            sendMut.mutate();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="otp-email" className="text-sm font-medium">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="otp-email"
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
              "Send code"
            )}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[min(100vw-2rem,24rem)] rounded-xl border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="text-xl font-semibold">Enter your code</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        We sent a 6-digit code to <strong>{email}</strong>.
      </p>

      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === CODE_LENGTH) verifyMut.mutate();
        }}
      >
        <div className="flex justify-center gap-2" role="group" aria-label="6-digit verification code">
          {digits.map((d, i) => (
            <Input
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !digits[i] && i > 0) inputRefs.current[i - 1]?.focus();
              }}
              className="h-12 w-10 text-center text-lg"
              autoFocus={i === 0}
            />
          ))}
        </div>

        {verifyMut.isError && (
          <p role="alert" className="text-center text-sm text-destructive">
            {(verifyMut.error as Error).message}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={verifyMut.isPending || code.length !== CODE_LENGTH}>
          {verifyMut.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying…
            </>
          ) : (
            "Verify"
          )}
        </Button>

        <button
          type="button"
          disabled={cooldown > 0 || sendMut.isPending}
          onClick={() => sendMut.mutate()}
          className="text-center text-sm text-primary underline-offset-2 hover:underline disabled:text-muted-foreground disabled:no-underline"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </form>
    </div>
  );
}
