import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { EarlyAccessForm } from "@/components/access/early-access-form";

// The invite code can arrive in the URL; never leak it through the referrer.
export const metadata: Metadata = { referrer: "no-referrer", title: "Early access" };

export default function EarlyAccessPage() {
  return (
    <AuthShell>
      <Suspense>
        <EarlyAccessForm />
      </Suspense>
    </AuthShell>
  );
}
