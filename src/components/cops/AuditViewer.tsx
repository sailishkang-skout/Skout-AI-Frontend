"use client";

import { useState } from "react";
import { auditQueryString, type AuditFilters } from "@/lib/cops-nav";

export interface CopsAuditRow {
  id: string;
  occurredAt: string;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  entityType: string;
  entityId: string;
  action: string;
  reason: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  correlationId: string;
  sourceChannel: string;
}

function humanize(value: string): string {
  return value
    .replace(/^cops_/, "")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function stateChange(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string | null {
  const from = before?.state;
  const to = after?.state;
  return typeof from === "string" && typeof to === "string"
    ? `${humanize(from)} → ${humanize(to)}`
    : null;
}

/** Admin audit log with plain-language search and date filters. */
export function AuditViewer({
  rows,
  loading = false,
  error = null,
  hasMore = false,
  onQuery,
  onLoadMore,
}: {
  rows: CopsAuditRow[];
  loading?: boolean;
  error?: string | null;
  hasMore?: boolean;
  onQuery: (queryString: string) => void;
  onLoadMore?: () => void;
}) {
  const [filters, setFilters] = useState<AuditFilters>({ limit: 25 });

  return (
    <section className="flex flex-col gap-4">
      <form
        className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(16rem,2fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          onQuery(auditQueryString(filters));
        }}
      >
        <input
          aria-label="Search audit log"
          placeholder="Search person, change, record, or reason"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={filters.search ?? ""}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <input
          aria-label="From date"
          type="date"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          onChange={(e) => setFilters({
            ...filters,
            from: e.target.value ? new Date(`${e.target.value}T00:00:00`).toISOString() : undefined,
          })}
        />
        <input
          aria-label="To date"
          type="date"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          onChange={(e) => setFilters({
            ...filters,
            to: e.target.value ? new Date(`${e.target.value}T23:59:59.999`).toISOString() : undefined,
          })}
        />
        <button type="submit" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
          Search
        </button>
      </form>
      <p className="text-xs text-muted-foreground">
        Search by a person&apos;s name or email, what changed, the record type, or the reason. Dates are optional.
      </p>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading audit log…</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No audit events match these filters.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">Actor</th>
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">Entity</th>
                <th className="py-2 pr-4">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2 pr-4">{new Date(r.occurredAt).toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    <div>{r.actorName || r.actorEmail || humanize(r.actorType)}</div>
                    {r.actorName && r.actorEmail ? <div className="text-xs text-muted-foreground">{r.actorEmail}</div> : null}
                  </td>
                  <td className="py-2 pr-4">
                    <div>{humanize(r.action)}</div>
                    {r.reason ? <div className="max-w-sm text-xs text-muted-foreground">{r.reason}</div> : null}
                  </td>
                  <td className="py-2 pr-4">
                    <div>{humanize(r.entityType)}</div>
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Record details</summary>
                      {stateChange(r.beforeState, r.afterState) ? (
                        <div>State: {stateChange(r.beforeState, r.afterState)}</div>
                      ) : null}
                      <div>Reference: {r.entityId}</div>
                    </details>
                  </td>
                  <td className="py-2 pr-4">{humanize(r.sourceChannel)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {hasMore && onLoadMore ? (
        <button
          type="button"
          disabled={loading}
          onClick={onLoadMore}
          className="self-start rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          Load more
        </button>
      ) : null}
    </section>
  );
}
