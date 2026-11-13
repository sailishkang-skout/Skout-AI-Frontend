"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FilterCategory, FilterSectionDef } from "@/components/prospects/prospect-filter-sidebar";
import { countActiveFilters, type FilterDraft } from "@/lib/search-constants";
import { CATEGORY_STYLE, sectionCount, sectionSummary } from "./filter-tokens";

const COLUMNS: FilterCategory[] = ["person", "company", "signals"];

/** Every filter group in three columns (Person, Company, Signals); a row opens in place. */
export function AllFiltersDialog({
  open,
  onClose,
  sections,
  draft,
  onClearAll,
  onShowResults,
}: {
  open: boolean;
  onClose: () => void;
  sections: FilterSectionDef[];
  draft: FilterDraft;
  onClearAll: () => void;
  onShowResults: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const active = countActiveFilters(draft);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="All filters"
      description={`${active} active across ${sections.length} filter groups`}
      className="max-w-6xl"
    >
      <div
        className="grid grid-cols-1 md:grid-cols-3 md:divide-x md:divide-border"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
            e.preventDefault();
            onShowResults();
          }
        }}
      >
        {COLUMNS.map((cat) => (
          <div key={cat} className="px-1 py-1 md:px-3">
            <div className="flex items-center gap-2 px-2 pb-2">
              <span className={cn("h-2.5 w-2.5 rounded-sm", CATEGORY_STYLE[cat].dot)} aria-hidden="true" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{CATEGORY_STYLE[cat].label}</span>
            </div>
            {sections
              .filter((s) => s.category === cat)
              .map((s) => {
                const summary = sectionSummary(draft, s);
                const count = sectionCount(draft, s);
                const isOpen = expanded.has(s.id);
                return (
                  <div key={s.id}>
                    <button
                      type="button"
                      onClick={() => toggle(s.id)}
                      aria-expanded={isOpen}
                      className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-muted/60"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{s.title}</span>
                          {count > 0 && (
                            <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold leading-[18px] text-primary-foreground">{count}</span>
                          )}
                        </div>
                        {summary && !isOpen && <div className="truncate text-xs text-primary">{summary}</div>}
                      </div>
                      <ChevronRight
                        className={cn("mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")}
                        aria-hidden="true"
                      />
                    </button>
                    {isOpen && <div className="space-y-3 px-2.5 pb-3 pt-1">{s.body}</div>}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
      <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 flex items-center justify-end gap-2 border-t bg-background px-4 py-3">
        <Button type="button" variant="ghost" onClick={onClearAll}>
          Clear all
        </Button>
        <Button type="button" onClick={onShowResults}>
          Show results
        </Button>
      </div>
    </Dialog>
  );
}
