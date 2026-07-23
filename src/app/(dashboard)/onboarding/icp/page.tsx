"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";

/** Legacy ICP wizard — redirected to the canonical onboarding flow. */
export default function IcpOnboardingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/onboarding");
  }, [router]);

  return (
    <PageShell>
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Redirecting to onboarding…
      </div>
    </PageShell>
  );
}
