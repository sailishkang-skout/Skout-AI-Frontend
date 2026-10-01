import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthShell } from "@/components/auth/auth-shell";

// FE-09: the token is in the URL, so no referrer should ever leak it to a third party.
export const metadata: Metadata = { referrer: "no-referrer" };

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
