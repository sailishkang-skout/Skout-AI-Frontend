"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FilterSectionDef } from "@/components/prospects/prospect-filter-sidebar";
import type { FilterDraft } from "@/lib/search-constants";
import { sectionSummary } from "./filter-tokens";

/** The filters people reach for most; everything else lives in the All filters dialog. */
export const QUICK_FILTER_IDS = ["job-title", "company", "location", "employee-headcount", "industry-keyword", "contact-details"];

const SHORT: Record<string, string> = {
  "job-title": "Job title",
  "employee-headcount": "Headcount",
  "industry-keyword": "Industry",
  "contact-details": "Contact details",
};

function DockPill({
  section,
  draft,
  onApply,
}: {
  section: FilterSectionDef;
  draft: FilterDraft;
  onApply: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const summary = sectionSummary(draft, section);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = SHORT[section.id] ?? section.title;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "inline-flex h-[34px] max-w-[280px] items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] transition-colors",
          summary
            ? "border-primary bg-primary/10 text-foreground"
            : "border-dashed border-border text-muted-foreground hover:border-primary hover:text-foreground"
        )}
      >
        <span className="font-semibold text-foreground">{label}</span>
        {summary && <span className="truncate text-primary">{summary}</span>}
        <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={section.title}
          className="absolute left-0 top-[42px] z-30 w-[300px] space-y-3 rounded-2xl border border-border bg-card p-3.5 shadow-xl"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
              e.preventDefault();
              setOpen(false);
              onApply();
            }
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">{section.title}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 text-muted-foreground hover:bg-accent">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-3">{section.body}</div>
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              setOpen(false);
              onApply();
            }}
          >
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}

export function FilterDock({
  sections,
  draft,
  onApply,
  onOpenAll,
}: {
  sections: FilterSectionDef[];
  draft: FilterDraft;
  onApply: () => void;
  onOpenAll: () => void;
}) {
  const quick = QUICK_FILTER_IDS.map((id) => sections.find((s) => s.id === id)).filter((s): s is FilterSectionDef => !!s);
  const more = sections.length - quick.length;
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="filter-dock">
      {quick.map((s) => (
        <DockPill key={s.id} section={s} draft={draft} onApply={onApply} />
      ))}
      <button
        type="button"
        onClick={onOpenAll}
        className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-border px-3 text-[13px] font-semibold hover:border-primary"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        All filters
        <span className="rounded-full bg-muted px-2 text-[11px] font-medium leading-[18px] text-muted-foreground">{more} more</span>
      </button>
    </div>
  );
}
