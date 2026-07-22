"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { createClientLogger } from "@/lib/logger";

const log = createClientLogger("app.error");

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    log.error("route error boundary", error, { digest: error.digest });
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        An unexpected error occurred on this page. You can try again, or refresh.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-accent"
      >
        Try again
      </button>
    </div>
  );
}
