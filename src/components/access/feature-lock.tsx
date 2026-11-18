"use client";

import { Lock } from "lucide-react";
import { useFeatureOn } from "@/lib/access";
import type { ProductFeature } from "@/lib/feature-nav";

/**
 * A dashboard section whose feature isn't on the workspace's plan: shown blurred, unclickable and
 * hidden from assistive tech, with a "Not on your plan" label. Callers also skip the section's data
 * calls (the API would refuse them).
 */
export function FeatureLock({ feature, children, className }: { feature: ProductFeature; children: React.ReactNode; className?: string }) {
  const on = useFeatureOn(feature);
  if (on) return <>{children}</>;
  return (
    <div className={`relative ${className ?? ""}`} data-testid={`feature-locked-${feature}`}>
      {/* inert: no focus, no clicks, not read out. React 18 has no inert prop, so it is set on the node. */}
      <div className="pointer-events-none select-none opacity-60 blur-[3px]" aria-hidden ref={(el) => el?.setAttribute("inert", "")}>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="flex items-center gap-1.5 rounded-full border bg-background/90 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Not on your plan
        </span>
      </div>
    </div>
  );
}
