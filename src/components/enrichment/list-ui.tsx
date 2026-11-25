"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/** A row of summary numbers above a list, in the style of the Capture queue page. */
export function StatGrid({ items, loading }: { items: Array<{ label: string; value: number | string; note?: string; tone?: "default" | "success" | "warning" }>; loading?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="stat-grid">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-16" />
          ) : (
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${item.tone === "success" ? "text-emerald-700 dark:text-emerald-400" : item.tone === "warning" ? "text-amber-700 dark:text-amber-400" : ""}`}>
              {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
            </p>
          )}
          {item.note && <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>}
        </div>
      ))}
    </div>
  );
}

export type SortDirection = "asc" | "desc";

/** A column header that sorts the rows on screen. */
export function SortHeader({ label, active, direction, onSort, className = "" }: { label: string; active: boolean; direction: SortDirection; onSort: () => void; className?: string }) {
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={`px-4 py-3 font-medium ${className}`} aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={onSort} className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground">
        {label}
        <Icon className="h-3 w-3" aria-hidden="true" />
      </button>
    </th>
  );
}

/** "Showing 25 of 140 people", with a way back when filters hide things. */
export function ResultsBar({ shown, total, noun, filtered, onClear, children }: { shown: number; total: number; noun: string; filtered: boolean; onClear: () => void; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground" data-testid="results-bar">
      <span>
        {total === 0 ? `No ${noun}` : `Showing ${shown.toLocaleString()} of ${total.toLocaleString()} ${noun}`}
        {filtered && " matching your filters"}
      </span>
      <span className="flex items-center gap-3">
        {children}
        {filtered && (
          <button type="button" onClick={onClear} className="font-medium text-primary underline-offset-4 hover:underline">
            Clear filters
          </button>
        )}
      </span>
    </div>
  );
}

export function sortRows<T>(rows: T[], key: (row: T) => string | number | null | undefined, direction: SortDirection): T[] {
  return [...rows].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    const result = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { sensitivity: "base" });
    return direction === "asc" ? result : -result;
  });
}
