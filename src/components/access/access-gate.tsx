"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAccess } from "@/lib/access";
import { featureForAppPath, isFeatureOn } from "@/lib/feature-nav";
import { FeatureOff } from "./feature-off";

/**
 * Early access gate around the workspace. A workspace that is not yet active (waiting for approval,
 * code sent, or rejected) only sees /early-access; an area whose feature is switched off shows
 * FeatureOff. The API enforces the same rules; this keeps the app from rendering screens that would
 * only fail. Runs outside IcpEnforcement, whose onboarding check would itself be refused while pending.
 */
export function AccessGate({ children }: { children: React.ReactNode }) {
  if (process.env.E2E_AUTH_BYPASS === "true") return children;
  return <AccessGateInner>{children}</AccessGateInner>;
}

function AccessGateInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const access = useAccess();
  const status = access.data?.status;

  useEffect(() => {
    if (status && status !== "active") router.replace("/early-access");
  }, [router, status]);

  // A failed check falls through to the app: the API still refuses what the workspace can't use.
  if (access.isError) return children;
  if (!status || status !== "active") {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </main>
    );
  }

  const feature = featureForAppPath(pathname);
  if (feature && !isFeatureOn(access.data?.features, feature)) return <FeatureOff />;
  return children;
}
