import Link from "next/link";
import { Sparkles } from "lucide-react";
import { CLERK_ENABLED } from "@/lib/api-client";

/** Lightweight banner for local / E2E runs without Clerk. */
export function DemoBanner() {
  if (CLERK_ENABLED) return null;

  return (
    <div
      data-testid="demo-banner"
      className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm"
    >
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium text-foreground">Local workspace mode</p>
        <p className="text-muted-foreground">
          Auth is bypassed for development. Search uses the 5,300-record demo corpus when OpenSearch
          is unavailable.{" "}
          <Link href="/prospects/search" className="font-medium text-primary underline underline-offset-2">
            Try prospect search
          </Link>{" "}
          or install the{" "}
          <span className="font-medium text-foreground">Skout Chrome extension</span> to capture
          LinkedIn profiles.
        </p>
      </div>
    </div>
  );
}
