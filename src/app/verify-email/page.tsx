import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailConfirm } from "@/components/auth/verify-email-confirm";

// FE-09: the token is in the URL, so no referrer should ever leak it to a third party.
export const metadata: Metadata = { referrer: "no-referrer" };

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
      <Suspense>
        <VerifyEmailConfirm />
      </Suspense>
    </main>
  );
}
