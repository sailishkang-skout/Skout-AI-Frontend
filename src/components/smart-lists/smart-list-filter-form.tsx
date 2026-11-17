"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuthReady } from "@/lib/api-client";
import { hasSmartListFilters, useSmartListApi } from "@/lib/smart-lists";
import type { SmartListFacetOption, SmartListFilters } from "@/types/api";
import { FacetMultiSelect, type FacetChoice } from "./facet-multi-select";

interface SmartListFilterFormProps {
  filters: SmartListFilters;
  onChange: (filters: SmartListFilters) => void;
}

/** Each stored value is its own choice (industries, seniorities). */
function choicesFromOptions(options: SmartListFacetOption[]): FacetChoice[] {
  return options.map((o) => ({ key: o.value, label: o.label, values: [o.value], count: o.count }));
}

/** Countries can be stored under several spellings ("IN", "India"): show one choice per country. */
function countryChoices(options: SmartListFacetOption[]): FacetChoice[] {
  const byLabel = new Map<string, FacetChoice>();
  for (const o of options) {
    const existing = byLabel.get(o.label);
    if (existing) {
      existing.values.push(o.value);
      existing.count = (existing.count ?? 0) + (o.count ?? 0);
    } else {
      byLabel.set(o.label, { key: o.value, label: o.label, values: [o.value], count: o.count });
    }
  }
  return Array.from(byLabel.values()).sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Drop empty values so saved filters (and the count request) only carry what was set. */
function clean(filters: SmartListFilters): SmartListFilters {
  const out: SmartListFilters = {};
  for (const [k, v] of Object.entries(filters)) {
    if (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== "") {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

export function SmartListFilterForm({ filters, onChange }: SmartListFilterFormProps) {
  const api = useSmartListApi();
  const authReady = useAuthReady();

  const facets = useQuery({
    queryKey: ["smart-list-facets"],
    queryFn: async () => (await api.facets()).data,
    enabled: authReady,
    staleTime: 10 * 60_000,
  });

  const debouncedFilters = useDebounced(clean(filters), 450);
  const hasFilters = hasSmartListFilters(debouncedFilters);
  const count = useQuery({
    queryKey: ["smart-list-count", debouncedFilters],
    queryFn: () => api.count(debouncedFilters),
    enabled: authReady && hasFilters,
    staleTime: 60_000,
  });

  const set = (patch: Partial<SmartListFilters>) => onChange(clean({ ...filters, ...patch }));
  const setText = (key: "query" | "jobTitle" | "tech" | "signal", value: string) => set({ [key]: value.trim() ? value : undefined });
  const setNumber = (key: "minEmployees" | "maxEmployees", value: string) =>
    set({ [key]: value.trim() === "" || Number.isNaN(Number(value)) ? undefined : Number(value) });

  const industryChoices = useMemo(() => choicesFromOptions(facets.data?.industry ?? []), [facets.data]);
  const countries = useMemo(() => countryChoices(facets.data?.country ?? []), [facets.data]);
  const seniorityChoices = useMemo(() => choicesFromOptions(facets.data?.seniority ?? []), [facets.data]);

  // Older lists saved single values; show them in the multi-selects so they can be edited.
  const selectedIndustries = [...(filters.industry ? [filters.industry] : []), ...(filters.industries ?? [])];
  const selectedCountries = [...(filters.country ? [filters.country] : []), ...(filters.countries ?? [])];
  const selectedSeniorities = [...(filters.seniority ? [filters.seniority] : []), ...(filters.seniorities ?? [])];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="filter-query" className="text-xs font-medium text-muted-foreground">
            Keywords
          </label>
          <Input
            id="filter-query"
            placeholder="Name, company, skill… e.g. Razorpay"
            value={filters.query ?? ""}
            onChange={(e) => setText("query", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="filter-jobTitle" className="text-xs font-medium text-muted-foreground">
            Job title
          </label>
          <Input
            id="filter-jobTitle"
            placeholder="e.g. Head of Sales"
            value={filters.jobTitle ?? ""}
            onChange={(e) => setText("jobTitle", e.target.value)}
          />
        </div>

        <FacetMultiSelect
          id="filter-industries"
          label="Industry"
          choices={industryChoices}
          selected={selectedIndustries}
          onChange={(v) => set({ industry: undefined, industries: v })}
          placeholder="Any industry"
          searchPlaceholder="Search industries"
          loading={facets.isLoading}
        />
        <FacetMultiSelect
          id="filter-countries"
          label="Country"
          choices={countries}
          selected={selectedCountries}
          onChange={(v) => set({ country: undefined, countries: v })}
          placeholder="Any country"
          searchPlaceholder="Search countries"
          loading={facets.isLoading}
        />
        <FacetMultiSelect
          id="filter-seniorities"
          label="Seniority"
          choices={seniorityChoices}
          selected={selectedSeniorities}
          onChange={(v) => set({ seniority: undefined, seniorities: v })}
          placeholder="Any seniority"
          searchPlaceholder="Search seniorities"
          loading={facets.isLoading}
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="filter-minEmployees" className="text-xs font-medium text-muted-foreground">
              Min employees
            </label>
            <Input
              id="filter-minEmployees"
              type="number"
              min={0}
              placeholder="10"
              value={filters.minEmployees ?? ""}
              onChange={(e) => setNumber("minEmployees", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="filter-maxEmployees" className="text-xs font-medium text-muted-foreground">
              Max employees
            </label>
            <Input
              id="filter-maxEmployees"
              type="number"
              min={0}
              placeholder="1000"
              value={filters.maxEmployees ?? ""}
              onChange={(e) => setNumber("maxEmployees", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="filter-tech" className="text-xs font-medium text-muted-foreground">
            Technology
          </label>
          <Input id="filter-tech" placeholder="e.g. HubSpot" value={filters.tech ?? ""} onChange={(e) => setText("tech", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="filter-signal" className="text-xs font-medium text-muted-foreground">
            Signal
          </label>
          <Input id="filter-signal" placeholder="e.g. hiring" value={filters.signal ?? ""} onChange={(e) => setText("signal", e.target.value)} />
        </div>
      </div>

      <p className="text-sm" aria-live="polite">
        {!hasFilters ? (
          <span className="text-muted-foreground">Add a filter to see how many prospects match.</span>
        ) : count.isFetching ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Counting…
          </span>
        ) : count.isError ? (
          <span className="text-muted-foreground">Couldn&apos;t count matches right now.</span>
        ) : count.data ? (
          <span>
            <span className="font-medium">{count.data.total.toLocaleString()}</span> matching prospects
            {count.data.total === 0 && (
              <span className="text-muted-foreground"> — try removing a filter or picking more values.</span>
            )}
            {count.data.demo && <span className="text-muted-foreground"> (demo data)</span>}
          </span>
        ) : null}
      </p>
    </div>
  );
}
