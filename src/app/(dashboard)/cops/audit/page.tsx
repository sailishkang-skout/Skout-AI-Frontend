"use client";

import { useCallback, useEffect, useState } from "react";
import { copsFetch, CopsRequestError } from "@/lib/cops-fetch";
import { AuditViewer, type CopsAuditRow } from "@/components/cops/AuditViewer";

/** Admin audit log (COPS-01). Requires admin:read on the API; the server enforces it. */
export default function CopsAuditPage() {
  const [rows, setRows] = useState<CopsAuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [activeQuery, setActiveQuery] = useState("limit=25");

  const runQuery = useCallback(async (queryString: string, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await copsFetch<{ data: CopsAuditRow[]; next_cursor: string | null }>(
        `/api/v1/cops/audit?${queryString}`
      );
      setRows((current) => append ? [...current, ...res.data] : res.data);
      setNextCursor(res.next_cursor);
      if (!append) setActiveQuery(queryString);
    } catch (err) {
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

  useEffect(() => {
    void runQuery("limit=25");
  }, [runQuery]);

  const loadMore = () => {
    if (!nextCursor || loading) return;
    void runQuery(`${activeQuery}&cursor=${encodeURIComponent(nextCursor)}`, true);
  };

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Audit log</h1>
        <p className="text-sm text-muted-foreground">High-impact changes in this workspace, newest first.</p>
      </header>
      <AuditViewer
        rows={rows}
        loading={loading}
        error={error}
        hasMore={Boolean(nextCursor)}
        onQuery={(query) => void runQuery(query)}
        onLoadMore={loadMore}
      />
    </main>
  );
}
