import { useApiFetch } from "./api-client";
import type { Tam, TamFilterConfig } from "@/types/api";

export interface CreateTamInput {
  name: string;
  filterConfig?: TamFilterConfig;
}

export interface DrillInInput {
  name: string;
  dimension?: "industry" | "size" | "geo";
  value?: string;
}

/** Smart list returned by a TAM segment drill-in. */
export interface DrilledSmartList {
  id: string;
  name: string;
}

/**
 * R12.1/R12.2/R12.3 — TAM (total addressable market) API.
 * Backend: apps/api/src/routes/tam.routes.ts.
 */
export function useTamApi() {
  const fetchApi = useApiFetch();
  return {
    list: () => fetchApi<{ data: Tam[] }>("/api/v1/tam"),

    get: (id: string) => fetchApi<{ data: Tam }>(`/api/v1/tam/${id}`),

    create: (input: CreateTamInput) =>
      fetchApi<{ data: Tam }>("/api/v1/tam", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    recompute: (id: string) =>
      fetchApi<{ data: Tam }>(`/api/v1/tam/${id}/recompute`, { method: "POST" }),

    drillIn: (id: string, input: DrillInInput) =>
      fetchApi<{ data: DrilledSmartList }>(`/api/v1/tam/${id}/segments/drill-in`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
  };
}

const COVERAGE_STAGES: { key: keyof import("@/types/api").TamCoverageFunnel; label: string }[] = [
  { key: "activated", label: "Activated" },
  { key: "enriched", label: "Enriched" },
  { key: "contacted", label: "Contacted" },
  { key: "replied", label: "Replied" },
  { key: "deal", label: "Deal" },
];

export function coverageStages() {
  return COVERAGE_STAGES;
}

/** Human label for a segment breakdown dimension. */
export function segmentDimensionLabel(dimension: "industry" | "size" | "geo"): string {
  switch (dimension) {
    case "industry":
      return "Industry";
    case "size":
      return "Company size";
    case "geo":
      return "Geography";
    default:
      return dimension;
  }
}
