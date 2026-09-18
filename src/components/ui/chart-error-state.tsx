import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Distinct error/retry state shown in place of a chart when its query fails, so a failed
 * fetch never looks like "no data" (which is what the empty-state branch communicates).
 * Sits alongside ChartSkeleton as the third state every GTM Command Center chart can be in:
 * loading, error, or (successfully) empty/populated. */
export function ChartErrorState({
  message = "Couldn't load chart data.",
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("flex h-full w-full flex-col items-center justify-center gap-2 text-center", className)}
    >
      <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/50"
        >
          <RefreshCw className="h-3 w-3" />
          Try again
        </button>
      )}
    </div>
  );
}
