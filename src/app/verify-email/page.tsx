import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailConfirm } from "@/components/auth/verify-email-confirm";
import { AuthShell } from "@/components/auth/auth-shell";

// FE-09: the token is in the URL, so no referrer should ever leak it to a third party.
export const metadata: Metadata = { referrer: "no-referrer" };

export default function VerifyEmailPage() {
  return (
    <AuthShell>
      <Suspense>
        <VerifyEmailConfirm />
      </Suspense>
    </AuthShell>
  );
}
