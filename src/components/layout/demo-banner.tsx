import Link from "next/link";
import { Info } from "lucide-react";

/** Shown on enrichment pages while provider API keys are not configured. */
export function DemoBanner() {
  return (
    <div
      role="status"
      className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800/50 dark:bg-blue-950/40 dark:text-blue-100"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
      <div className="min-w-0 space-y-1">
        <p className="font-medium">Demo mode — enrichment uses sample data until API keys are added.</p>
        <p className="text-blue-800/90 dark:text-blue-200/90">
          Search, lists, ICP, and smart lists work now. Connect{" "}
          <span className="font-medium">Hunter</span>, <span className="font-medium">OpenSearch</span>, and{" "}
          <span className="font-medium">OpenAI</span> in production for live results.{" "}
          <Link
            href="/enrichment"
            className="underline underline-offset-2 hover:text-blue-950 dark:hover:text-blue-50"
          >
            Try enrich →
          </Link>
        </p>
      </div>
    </div>
  );
}
