"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Lock, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { useEnterpriseControlPlaneApi } from "@/lib/enterprise-control-plane";
import { useWorkspaceRole } from "@/lib/workspace-role";
import { AuditTrailPanel } from "./audit-trail-panel";
import { SideEffectPreview } from "./side-effect-preview";

export function VisionEnterpriseControlStrip({ compact }: { compact?: boolean }) {
  const authReady = useAuthReady();
  const { canDelete: isAdmin } = useWorkspaceRole();
  const api = useEnterpriseControlPlaneApi();

  const plane = useQuery({
    queryKey: ["enterprise-control-plane", "vision-strip"],
    queryFn: api.getControlPlane,
    enabled: authReady && isAdmin,
    staleTime: 60_000,
  });

  const summary = plane.data?.data.summary;
  const pending = summary?.dexterPendingApprovals ?? 0;
  const blocks = summary?.dexterPolicyBlocks ?? 0;
  const incidents = summary?.openIncidents ?? 0;

  const sideEffects = [
    pending > 0 ? `${pending} Dexter action(s) need approval` : null,
    blocks > 0 ? `${blocks} policy block(s) active` : null,
    incidents > 0 ? `${incidents} open incident(s)` : null,
  ].filter(Boolean) as string[];

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="rounded-md border bg-muted/20 p-2 text-xs">
          <p className="flex items-center gap-1 font-medium">
            <Shield className="h-3.5 w-3.5" aria-hidden />
            Enterprise control
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge tone={pending ? "warning" : "muted"}>Approvals · {pending}</Badge>
            <Badge tone={blocks ? "danger" : "muted"}>Blocks · {blocks}</Badge>
            {!isAdmin && (
              <Badge tone="muted">
                <Lock className="mr-1 h-3 w-3" />
                Admin view
              </Badge>
            )}
          </div>
        </div>
        <AuditTrailPanel compact />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4" />
          Enterprise control
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {plane.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge tone={pending ? "warning" : "success"}>Pending approvals · {pending}</Badge>
              <Badge tone={blocks ? "danger" : "success"}>Policy blocks · {blocks}</Badge>
              <Badge tone={incidents ? "warning" : "success"}>Incidents · {incidents}</Badge>
            </div>
            <SideEffectPreview effects={sideEffects.length ? sideEffects : ["No blocking side effects detected"]} />
            {!isAdmin && (
              <p className="text-xs text-muted-foreground">Some governance details require admin role.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/control-plane" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Control plane
              </Link>
              <Link href="/settings/compliance" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Compliance center
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
