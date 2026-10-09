"use client";

import { useCallback, useEffect, useState } from "react";
import { isRetryableAuthError, useApiFetch, useAuthReady } from "@/lib/api-client";
import { copsFetch, CopsRequestError } from "@/lib/cops-fetch";
import { fieldErrorsByPath } from "@/lib/cops-error";
import { AuditViewer, type CopsAuditRow } from "@/components/cops/AuditViewer";

/** Admin audit log (COPS-01). Requires admin:read on the API; the server enforces it. */
export default function CopsAuditPage() {
  const [rows, setRows] = useState<CopsAuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [activeQuery, setActiveQuery] = useState("limit=25");

  const authedFetch = useApiFetch();
  const runQuery = useCallback(async (queryString: string, append = false) => {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      let res: { data: CopsAuditRow[]; next_cursor: string | null } | undefined;
      // Token can land a moment after session load; retry the same auth race the other pages retry.
      for (let attempt = 1; !res; attempt++) {
        try {
          res = await copsFetch<{ data: CopsAuditRow[]; next_cursor: string | null }>(
            `/api/v1/cops/audit?${queryString}`,
            undefined,
            // Retryable errors (429 with retry_after_seconds, 503) back off up to 3 attempts.
            { request: authedFetch, maxAttempts: 3 }
          );
        } catch (err) {
          const raced = err instanceof CopsRequestError && isRetryableAuthError(err.cause);
          if (!raced || attempt >= 4) throw err;
          await new Promise((r) => setTimeout(r, 300 * attempt));
        }
      }
      setRows((current) => append ? [...current, ...res.data] : res.data);
      setNextCursor(res.next_cursor);
      if (!append) setActiveQuery(queryString);
    } catch (err) {
      const fields = err instanceof CopsRequestError && err.envelope ? fieldErrorsByPath(err.envelope) : {};
      if (Object.keys(fields).length > 0) {
        setFieldErrors(fields);
        setLoading(false);
        return;
      }
      setError(
        err instanceof CopsRequestError && err.envelope?.code === "FORBIDDEN"
          ? "You do not have permission to view this workspace audit log."
          : err instanceof CopsRequestError
            ? err.message
            : "Could not load the audit log"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Wait for the access token: copsFetch makes a single attempt, so a request sent before auth
  // is ready would fail with "Missing bearer token" and never retry.
  const authReady = useAuthReady();
  useEffect(() => {
    if (!authReady) return;
    void runQuery("limit=25");
  }, [authReady, runQuery]);

  const loadMore = () => {
    if (!nextCursor || loading) return;
    void runQuery(`${activeQuery}&cursor=${encodeURIComponent(nextCursor)}`, true);
  };

  return (
    <main data-testid="page-cops-audit" className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Audit log</h1>
        <p className="text-sm text-muted-foreground">High-impact changes in this workspace, newest first.</p>
      </header>
      <AuditViewer
        rows={rows}
        loading={loading}
        error={error}
        fieldErrors={fieldErrors}
        hasMore={Boolean(nextCursor)}
        onQuery={(query) => void runQuery(query)}
        onLoadMore={loadMore}
      />
    </main>
  );
}
