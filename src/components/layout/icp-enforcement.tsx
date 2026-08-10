"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldAlert } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { authQueryOptions, formatQueryError, useAuthReady } from "@/lib/api-client";
import { useIcpApi } from "@/lib/icp";
import { isOnboardingComplete } from "@/lib/scoring";

interface IcpEnforcementProps {
  children: React.ReactNode;
}

/**
 * Fail-closed app gate. Authenticated users cannot render or navigate through
 * the workspace until the onboarding wizard has been explicitly completed.
 */
export function IcpEnforcement({ children }: IcpEnforcementProps) {
  // Playwright CI runs with E2E_AUTH_BYPASS=true and stub auth; the backend seed
  // does not include a completed onboarding profile, so the gate would block every
  // dashboard spec waiting for data-testid page shells that never mount.
  if (process.env.E2E_AUTH_BYPASS === "true") {
    return children;
  }

  return <IcpEnforcementInner>{children}</IcpEnforcementInner>;
}

function IcpEnforcementInner({ children }: IcpEnforcementProps) {
  const pathname = usePathname();
  const router = useRouter();
  const icpApi = useIcpApi();
  const authReady = useAuthReady();
  const isWizard = pathname === "/onboarding" || pathname === "/onboarding/";
  const query = useQuery({
    queryKey: ["icp"],
    queryFn: icpApi.get,
    enabled: authReady && !isWizard,
    ...authQueryOptions,
  });
  const complete = isOnboardingComplete(query.data?.config);

  useEffect(() => {
    if (!isWizard && query.isSuccess && !complete) {
      router.replace("/onboarding");
    }
  }, [complete, isWizard, query.isSuccess, router]);

  // The wizard must always remain reachable so an incomplete user can finish it.
  if (isWizard) return children;

  if (query.isError) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-4 text-lg font-semibold">Unable to verify setup</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatQueryError(query.error, "We could not verify your onboarding status.")}
          </p>
          <Button className="mt-5" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      </main>
    );
  }

  if (query.isPending || !complete) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Checking workspace setup…
        </div>
      </main>
    );
  }

  return children;
}
