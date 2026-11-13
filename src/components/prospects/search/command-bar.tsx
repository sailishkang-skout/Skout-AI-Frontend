"use client";

import { Loader2, Search as SearchIcon, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SearchChip } from "@/lib/search-summary";
import { CATEGORY_STYLE, type FilterToken } from "./filter-tokens";

/**
 * The search bar. Typed text is searched as-is (the API turns plain words into filters), and
 * every active filter is shown inside the bar as a removable token.
 */
export function CommandBar({
  query,
  onQueryChange,
  onSubmit,
  tokens,
  onRemoveToken,
  onClearAll,
  isFetching,
  isDirty,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  onSubmit: () => void;
  tokens: FilterToken[];
  onRemoveToken: (key: SearchChip["key"]) => void;
  onClearAll: () => void;
  isFetching: boolean;
  isDirty: boolean;
}) {
  return (
    <div className="space-y-2">
      <form
        role="search"
        className="flex min-h-[58px] flex-wrap items-center gap-2 rounded-2xl border-[1.5px] border-primary bg-card py-2 pl-4 pr-2 shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <SearchIcon className="h-[18px] w-[18px] shrink-0 text-primary" aria-hidden="true" />
        {tokens.map((t) => (
          <span
            key={t.key}
            className={cn(
              "inline-flex max-w-full items-center gap-1 rounded-lg py-1 pl-2.5 pr-1 text-[13px] font-semibold",
              CATEGORY_STYLE[t.category].token
            )}
          >
            <span className="font-normal opacity-75">{t.label}:</span>
            <span className="truncate">{t.value}</span>
            <button
              type="button"
              onClick={() => onRemoveToken(t.key)}
              aria-label={`Remove ${t.label} ${t.value}`}
              className="ml-0.5 rounded p-0.5 hover:bg-background/60"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={tokens.length ? "Add more… e.g. at companies that are hiring" : "Describe who you're looking for…"}
          aria-label="Search prospects"
          className="h-9 min-w-[180px] flex-1 border-0 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" disabled={isFetching} className="h-[42px] rounded-xl px-5 text-sm font-semibold">
          {isFetching ? <Loader2 className="animate-spin" /> : <SearchIcon />}
          Search
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        {isDirty ? (
          <span className="font-medium text-amber-700 dark:text-amber-400" role="status">
            You have unapplied changes. Press Search to update the results.
          </span>
        ) : (
          <span>
            Type it the way you&apos;d say it, e.g. &ldquo;Head of Sales at SaaS companies in Germany&rdquo;. We turn it into
            filters you can edit.
          </span>
        )}
        {tokens.length > 0 && (
          <button type="button" onClick={onClearAll} className="ml-auto font-semibold text-primary hover:underline">
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
