import { useApiFetch } from "./api-client";
import { SENIORITY_OPTIONS } from "./search-constants";
import type {
  SmartList,
  SmartListActivateResult,
  SmartListFacets,
  SmartListFilters,
  SmartListRefreshCadence,
  SmartListRefreshDetail,
  SmartListRefreshSummary,
  SmartListRunResult,
} from "@/types/api";

interface ListEnvelope<T> {
  workspaceId: string;
  data: T[];
  total: number;
}

export function useSmartListApi() {
  const fetchApi = useApiFetch();

  return {
    list: () => fetchApi<ListEnvelope<SmartList>>("/api/v1/smart-lists"),

    /** Filter choices from the values actually stored in the search index, with counts. */
    facets: () => fetchApi<{ data: SmartListFacets }>("/api/v1/smart-lists/facets"),

    /** Live match count for filters that haven't been saved yet. */
    count: (filters: SmartListFilters) =>
      fetchApi<{ total: number; demo: boolean }>("/api/v1/smart-lists/count", {
        method: "POST",
        body: JSON.stringify({ filters }),
      }),

    create: (name: string, filters: SmartListFilters) =>
      fetchApi<SmartList>("/api/v1/smart-lists", {
        method: "POST",
        body: JSON.stringify({ name, filters }),
      }),

    update: (id: string, patch: { name?: string; filters?: SmartListFilters }) =>
      fetchApi<SmartList>(`/api/v1/smart-lists/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),

    remove: (id: string) =>
      fetchApi<void>(`/api/v1/smart-lists/${id}`, {
        method: "DELETE",
      }),

    run: (id: string) =>
      fetchApi<SmartListRunResult>(`/api/v1/smart-lists/${id}/run`, {
        method: "POST",
      }),

    activate: (id: string, opts?: { listName?: string; listId?: string }) =>
      fetchApi<SmartListActivateResult>(`/api/v1/smart-lists/${id}/activate`, {
        method: "POST",
        body: JSON.stringify(opts ?? {}),
      }),

    updateRefreshSchedule: (id: string, cadence: SmartListRefreshCadence) =>
      fetchApi<SmartList>(`/api/v1/smart-lists/${id}/refresh-schedule`, {
        method: "PATCH",
        body: JSON.stringify({ cadence }),
      }),

    listRefreshes: (id: string) =>
      fetchApi<ListEnvelope<SmartListRefreshSummary>>(`/api/v1/smart-lists/${id}/refreshes`),

    getRefresh: (id: string, refreshId: string) =>
      fetchApi<SmartListRefreshDetail>(`/api/v1/smart-lists/${id}/refreshes/${refreshId}`),
  };
}

const SENIORITY_LABELS = new Map(SENIORITY_OPTIONS.map((o) => [o.value, o.label]));

function values(single: string | undefined, many: string[] | undefined): string[] {
  return [...(single ? [single] : []), ...(many ?? [])];
}

/** One readable line describing a smart list's filters (old single-value or new multi-value). */
export function summarizeSmartListFilters(f: SmartListFilters): string {
  const parts: string[] = [];
  if (f.query) parts.push(`"${f.query}"`);
  if (f.jobTitle) parts.push(f.jobTitle);
  const industries = values(f.industry, f.industries);
  if (industries.length) parts.push(industries.join(", "));
  const countries = values(f.country, f.countries);
  if (countries.length) parts.push(countries.join(", "));
  const seniorities = values(f.seniority, f.seniorities);
  if (seniorities.length) parts.push(seniorities.map((s) => SENIORITY_LABELS.get(s) ?? s).join(", "));
  if (f.minEmployees != null && f.maxEmployees != null) parts.push(`${f.minEmployees}–${f.maxEmployees} employees`);
  else if (f.minEmployees != null) parts.push(`${f.minEmployees}+ employees`);
  else if (f.maxEmployees != null) parts.push(`up to ${f.maxEmployees} employees`);
  if (f.tech) parts.push(`uses ${f.tech}`);
  if (f.signal) parts.push(`signal: ${f.signal}`);
  return parts.length ? parts.join(" · ") : "No filters";
}

/** True when at least one filter is set (empty strings and empty lists don't count). */
export function hasSmartListFilters(f: SmartListFilters): boolean {
  return Object.values(f).some((v) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== ""));
}
