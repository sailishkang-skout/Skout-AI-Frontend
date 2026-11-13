import type { FilterCategory, FilterSectionDef } from "@/components/prospects/prospect-filter-sidebar";
import { describeSearch, type SearchChip } from "@/lib/search-summary";
import { EMPTY_FILTER_DRAFT, type FilterDraft } from "@/lib/search-constants";

export type FilterToken = SearchChip & { category: FilterCategory | "query" };

/** Colour classes per filter category, used by tokens, dock pills and the All filters dialog. */
export const CATEGORY_STYLE: Record<FilterCategory | "query", { token: string; dot: string; label: string }> = {
  person: { token: "bg-primary/10 text-primary", dot: "bg-primary", label: "Person" },
  company: { token: "bg-teal-500/10 text-teal-700 dark:text-teal-300", dot: "bg-teal-500", label: "Company" },
  signals: { token: "bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500", label: "Signals & controls" },
  query: { token: "bg-muted text-foreground", dot: "bg-muted-foreground", label: "Search" },
};

/** Only the given fields of a draft, everything else empty. */
export function pickFields(draft: FilterDraft, keys: (keyof FilterDraft)[]): FilterDraft {
  const out: FilterDraft = { ...EMPTY_FILTER_DRAFT };
  for (const k of keys) (out as Record<string, unknown>)[k] = draft[k];
  return out;
}

/** "CTO, C-Level" — what a section currently filters on, or "" when it is not in use. */
export function sectionSummary(draft: FilterDraft, section: FilterSectionDef): string {
  return describeSearch("", pickFields(draft, section.keys))
    .map((c) => c.value)
    .join(", ");
}

/** How many fields of a section are in use. */
export function sectionCount(draft: FilterDraft, section: FilterSectionDef): number {
  return describeSearch("", pickFields(draft, section.keys)).length;
}

/** One token per active filter field, coloured by the category of the section that owns it. */
export function tokensFor(draft: FilterDraft, sections: FilterSectionDef[]): FilterToken[] {
  const categoryOf = new Map<keyof FilterDraft, FilterCategory>();
  for (const s of sections) for (const k of s.keys) if (!categoryOf.has(k)) categoryOf.set(k, s.category);
  return describeSearch("", draft).map((chip) => ({
    ...chip,
    category: chip.key === "query" ? "query" : (categoryOf.get(chip.key) ?? "company"),
  }));
}
