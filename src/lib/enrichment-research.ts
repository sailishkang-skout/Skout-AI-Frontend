import { useMemo } from "react";
import { useApiFetch, useApiFetchBlob } from "./api-client";

/** One observed fact from the Evidence Ledger (ProspectEvidence / AccountEvidence contract). */
export interface EvidenceFact {
  evidenceId: string;
  attribute: string;
  value: unknown;
  source: string;
  sourceUrl: string | null;
  observedAt: string;
  capturedAt: string;
  confidence: number;
  state: "verified" | "discovery" | "unverified";
  method: string | null;
  freshnessExpiresAt: string | null;
  stale: boolean;
  usableForClaims: boolean;
}

export interface PersonSummary {
  prospectId: string;
  contactId: string | null;
  fullName: string | null;
  headline: string | null;
  title: string | null;
  companyId: string | null;
  companyName: string | null;
  location: string | null;
  linkedinUrl: string | null;
  salesNavigatorLeadUrl: string | null;
  identity: "public_profile" | "sales_lead" | "none";
  employmentState: "verified" | "candidate" | "unknown";
  seniority: string | null;
  jobFunction: string | null;
  captureSource: string | null;
  sourceUrl: string | null;
  capturedAt: string;
  pendingCapture: boolean;
}

export interface ChangeEvent {
  id: string;
  field: string;
  changeType: string;
  oldValue: unknown;
  newValue: unknown;
  isJobChange: boolean;
  detectedAt: string;
  reviewedAt: string | null;
}

export type CapturedItem = Record<string, unknown>;

export interface PersonDetail extends PersonSummary {
  summary: string | null;
  connectionsCount: number | null;
  followersCount: number | null;
  relationshipContext: Record<string, unknown> | null;
  experience: { current: CapturedItem[]; previous: CapturedItem[] };
  educations: CapturedItem[];
  skills: Array<CapturedItem | string>;
  certifications: CapturedItem[];
  languages: CapturedItem[];
  companyDomain: string | null;
  identityKeys: string[];
  candidateCompanies: Array<{ companyId: string; companyName: string; source: string; capturedAt: string }>;
  facts: EvidenceFact[];
  evidence: EvidenceFact[];
  changes: ChangeEvent[];
  freshness: { capturedAt: string | null; stale: boolean };
}

export interface CompanySummary {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employeeCount: number | null;
  location: string | null;
  updatedAt: string;
  verifiedEmployees: number;
  discoveryCandidates: number;
}

export interface CompanyDetail extends Omit<CompanySummary, "verifiedEmployees" | "discoveryCandidates"> {
  linkedinUrl: string | null;
  capture: {
    capturedAt: string | null;
    sourceUrl: string | null;
    tagline: string | null;
    overview: string | null;
    website: string | null;
    size: string | null;
    headquarter: string | null;
    foundedAt: string | null;
    specialties: string[];
    followers: number | null;
    openJobs: number;
    sections: string[];
  };
  people: { visibleAssociatedMembers: number | null; verifiedEmployees: number; discoveryCandidates: number };
  facts: EvidenceFact[];
  evidence: EvidenceFact[];
  changes: ChangeEvent[];
  freshness: { capturedAt: string | null; stale: boolean };
}

export interface CompanyPerson extends PersonSummary {
  discoverySource: string | null;
  discoveredAt: string | null;
}

export interface JobChange extends ChangeEvent {
  prospectId: string;
  fullName: string | null;
  sourceUrl: string | null;
  from: { company: string | null; title: string | null };
  to: { company: string | null; title: string | null };
  requiresReview: boolean;
}

export interface Paged {
  total: number;
  page: number;
  pageSize: number;
}

export interface ResearchOverview {
  people: { total: number; verifiedEmployment: number; discoveryCandidates: number; publicProfiles: number; salesNavigatorOnly: number };
  companies: { total: number };
  jobChanges: { pendingReview: number };
  captures: { runsLast7Days: number; leadsLast7Days: number };
}

export type PeopleFilters = Partial<{
  q: string;
  state: "verified" | "candidate";
  identity: "public_profile" | "sales_lead";
  department: string;
  seniority: string;
  page: number;
  pageSize: number;
}>;

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

const BASE = "/api/v1/enrichment";
const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function useResearchApi() {
  const apiFetch = useApiFetch();
  const apiFetchBlob = useApiFetchBlob();
  return useMemo(
    () => ({
      overview: () => apiFetch<ResearchOverview>(`${BASE}/overview`),
      people: (filters: PeopleFilters) => apiFetch<Paged & { people: PersonSummary[] }>(`${BASE}/people${query(filters)}`),
      person: (id: string) => apiFetch<{ person: PersonDetail }>(`${BASE}/people/${encodeURIComponent(id)}`),
      companies: (filters: { q?: string; page?: number }) =>
        apiFetch<Paged & { companies: CompanySummary[] }>(`${BASE}/companies${query(filters)}`),
      company: (id: string) => apiFetch<{ company: CompanyDetail }>(`${BASE}/companies/${id}`),
      companyPeople: (id: string, filters: PeopleFilters & { group: "verified" | "candidates" }) =>
        apiFetch<Paged & { group: string; people: CompanyPerson[] }>(`${BASE}/companies/${id}/people${query(filters)}`),
      jobChanges: (filters: { status: "pending" | "reviewed" | "all"; page?: number; pageSize?: number }) =>
        apiFetch<Paged & { jobChanges: JobChange[] }>(`${BASE}/job-changes${query(filters)}`),
      reviewJobChange: (id: string) => apiFetch<{ jobChange: ChangeEvent }>(`${BASE}/job-changes/${id}/review`, json({})),
      attachPublicUrl: (id: string, url: string) =>
        apiFetch<{ prospectId: string; linkedinUrl: string; merged: boolean }>(`${BASE}/people/${encodeURIComponent(id)}/public-url`, json({ url })),
      addLinkedinUrl: (url: string) =>
        apiFetch<{ kind: "person" | "company"; prospectId?: string; companyId?: string; created: boolean }>(`${BASE}/linkedin-urls`, json({ url })),
      deletePerson: (id: string) => apiFetch(`${BASE}/people/${encodeURIComponent(id)}`, { method: "DELETE" }),
      deleteCompany: (id: string) => apiFetch(`${BASE}/companies/${id}`, { method: "DELETE" }),
      reEnrich: (person: PersonDetail) =>
        apiFetch<{ jobId: string; status: string }>(`/api/v1/prospects/${encodeURIComponent(person.prospectId)}/enrich`, json({
          prospect: {
            prospectId: person.prospectId,
            fullName: person.fullName ?? undefined,
            title: person.title ?? undefined,
            companyDomain: person.companyDomain,
            linkedinUrl: person.linkedinUrl ?? undefined,
          },
          fields: ["company", "email", "validation"],
        })),
      personCsv: (id: string) => apiFetchBlob(`${BASE}/people/${encodeURIComponent(id)}/export.csv`),
      companyPeopleCsv: (id: string) => apiFetchBlob(`${BASE}/companies/${id}/export.csv`),
      exportCsv: (type: "people" | "companies") => apiFetchBlob(`${BASE}/export`, json({ type })),
    }),
    [apiFetch, apiFetchBlob]
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const SOURCE_LABELS: Record<string, string> = {
  linkedin_public_profile: "LinkedIn profile",
  linkedin_company_page: "LinkedIn company page",
  sales_navigator_search_result: "Sales Navigator search card",
  linkedin_company_people_result: "LinkedIn people result",
  manual_linkedin_url: "Entered by a teammate",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}

export function formatCaptureDate(value: string | null | undefined): string {
  if (!value) return "not captured";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown date" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** attribute → current fact, for showing provenance next to a displayed value. */
export function factsByAttribute(facts: EvidenceFact[]): Record<string, EvidenceFact | undefined> {
  return Object.fromEntries(facts.map((fact) => [fact.attribute, fact]));
}
