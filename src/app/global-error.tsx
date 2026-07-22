"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { createClientLogger } from "@/lib/logger";

const log = createClientLogger("app.global-error");

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    log.error("global error boundary", error, { digest: error.digest });
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#0a0a0a",
          color: "#fafafa",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 20 }}>
            An unexpected error occurred. You can try again, or refresh the page.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              border: "1px solid #333",
              background: "#111",
              color: "#fafafa",
              borderRadius: 8,
              padding: "10px 16px",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
