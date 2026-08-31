"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { extractVisionEntity, resolveVisionScreen } from "@/lib/vision-screens";
import { VisionConceptFrame } from "./vision-concept-frame";

const SKIP_PREFIXES = ["/onboarding", "/guides", "/linkedin/voice/h/"];

export function VisionRouteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : "";

  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) {
    return <>{children}</>;
  }

  const config = resolveVisionScreen(pathname, search);
  if (!config) return <>{children}</>;

  const entity = extractVisionEntity(pathname, search);

  return (
    <VisionConceptFrame
      config={config}
      entityType={entity.entityType}
      entityId={entity.entityId}
    >
      {children}
    </VisionConceptFrame>
  );
}
