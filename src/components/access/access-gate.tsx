"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAccess } from "@/lib/access";
import { featureForAppPath, isFeatureOn, isOptInFeature } from "@/lib/feature-nav";
import { FeatureOff } from "./feature-off";

/**
 * Early access gate around the workspace. A workspace that is not yet active (waiting for approval,
 * code sent, or rejected) only sees /early-access; an area whose feature is switched off shows
 * FeatureOff. The API enforces the same rules; this keeps the app from rendering screens that would
 * only fail. Runs outside IcpEnforcement, whose onboarding check would itself be refused while pending.
 *
 * Opt-in areas (WORKBOOKS_V2) fail closed: when the access check fails they show FeatureOff instead of
 * falling through, because the app has no way to know the workspace was granted them.
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

  const feature = featureForAppPath(pathname);

  // A failed check falls through to the app: the API still refuses what the workspace can't use.
  // Except for opt-in areas, which are off unless a known-good answer says otherwise (a failed refetch
  // keeps the last answer; with none, they stay closed).
  if (access.isError) {
    if (!feature || !isOptInFeature(feature)) return children;
    return status === "active" && isFeatureOn(access.data?.features, feature) ? children : <FeatureOff />;
  }
  if (!status || status !== "active") {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </main>
    );
  }

  if (feature && !isFeatureOn(access.data?.features, feature)) return <FeatureOff />;
  return children;
}
