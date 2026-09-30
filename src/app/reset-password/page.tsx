import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

// FE-09: the token is in the URL, so no referrer should ever leak it to a third party.
export const metadata: Metadata = { referrer: "no-referrer" };

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
