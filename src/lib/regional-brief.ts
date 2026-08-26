import { useApiFetch } from "./api-client";

export type RegionalBriefLayerType =
  | "global"
  | "region"
  | "country"
  | "industry"
  | "tenant"
  | "outcome_learning";

export type RegionalBriefFieldCategory =
  | "market_economics"
  | "business_practice"
  | "channel_policy"
  | "telecom_requirements"
  | "data_compliance"
  | "explainability";

export type RegionalBriefVersionStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "superseded";

export interface CountryItem {
  id: string;
  isoCode: string;
  isoAlpha3: string;
  name: string;
  regionId: string | null;
  currencyCode: string | null;
}

export interface RegionalBriefSlot {
  id: string;
  layerType: RegionalBriefLayerType;
  regionId: string | null;
  countryId: string | null;
  industry: string | null;
  workspaceId: string | null;
  fieldCategory: RegionalBriefFieldCategory;
  scopeKey: string;
  currentVersionId: string | null;
}

export interface RegionalBriefVersion {
  id: string;
  slotId: string;
  version: number;
  content: { summary: string; details: string[] };
  source: string;
  effectiveDate: string;
  confidence: number;
  evidence: string;
  expiryDate: string | null;
  status: RegionalBriefVersionStatus;
  reviewerId: string | null;
  reviewedAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ResolvedBriefEntry {
  fieldCategory: RegionalBriefFieldCategory;
  content: { summary: string; details: string[] };
  resolvedFromLayer: RegionalBriefLayerType;
  source: string;
  confidence: number;
  effectiveDate: string;
  evidence: string;
  isStale: boolean;
}

export interface ResolvedBrief {
  country: string;
  countryIso3?: string;
  industry: string | null;
  industryName?: string | null;
  industryInputWarning?: string | null;
  workspaceId: string | null;
  entries: ResolvedBriefEntry[];
}

export interface TamResult {
  countryIso2: string;
  countryIso3: string;
  countryName: string;
  industryCode: string;
  industryName: string;
  isDataLoaded: boolean;
  targetAccountsTam: number | null;
  annualRevenueTamUsd: number | null;
  assumptions: {
    establishments: number | null;
    icpFitPct: number;
    acvUsd: number;
    icpFitSource: "override" | "default";
    acvSource: "override" | "default";
    canonicalInclude: boolean;
    dataSource: string | null;
    dataYear: number | null;
  };
}

export interface CreateSlotInput {
  layerType: RegionalBriefLayerType;
  countryIso?: string;
  regionCode?: string;
  industry?: string;
  fieldCategory: RegionalBriefFieldCategory;
}

export interface CreateVersionInput {
  content: { summary: string; details: string[] };
  source: string;
  effectiveDate: string;
  confidence: number;
  evidence: string;
  expiryDate?: string;
}

export interface UpsertTamRowInput {
  countryIso: string;
  industryCode: string;
  industryName: string;
  establishments?: number | null;
  icpFitPct?: number;
  acvUsd?: number;
  dataSource?: string | null;
  dataYear?: number | null;
}

export function useRegionalBriefApi() {
  const fetchApi = useApiFetch();
  return {
    adminCheck: () =>
      fetchApi<{ platformAdmin: boolean }>("/api/v1/regional-brief/admin-check"),

    listCountries: () =>
      fetchApi<{ data: CountryItem[]; total: number }>("/api/v1/regional-brief/countries"),

    resolve: (country: string, industry?: string) =>
      fetchApi<ResolvedBrief>(
        `/api/v1/regional-brief/resolve?country=${encodeURIComponent(country)}${
          industry ? `&industry=${encodeURIComponent(industry)}` : ""
        }`
      ),

    getTam: (params: {
      country: string;
      industry: string;
      icpPct?: number;
      acvUsd?: number;
    }) => {
      const q = new URLSearchParams();
      q.set("country", params.country);
      q.set("industry", params.industry);
      if (params.icpPct !== undefined) q.set("icpPct", params.icpPct.toString());
      if (params.acvUsd !== undefined) q.set("acvUsd", params.acvUsd.toString());
      return fetchApi<TamResult>(`/api/v1/regional-brief/tam?${q.toString()}`);
    },

    listTamRows: (country?: string) =>
      fetchApi<{ data: TamResult[]; total: number }>(
        `/api/v1/regional-brief/tam/rows${country ? `?country=${encodeURIComponent(country)}` : ""}`
      ),

    upsertTamRow: (input: UpsertTamRowInput) =>
      fetchApi<TamResult>("/api/v1/regional-brief/tam/rows", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listSlots: (filter?: { layerType?: string; status?: string }) => {
      const q = new URLSearchParams();
      if (filter?.layerType) q.set("layerType", filter.layerType);
      if (filter?.status) q.set("status", filter.status);
      const qs = q.toString();
      return fetchApi<{ data: RegionalBriefSlot[]; total: number }>(
        `/api/v1/regional-brief/slots${qs ? `?${qs}` : ""}`
      );
    },

    listVersions: (slotId: string) =>
      fetchApi<{ data: RegionalBriefVersion[]; total: number }>(
        `/api/v1/regional-brief/slots/${slotId}/versions`
      ),

    createSlot: (input: CreateSlotInput) =>
      fetchApi<RegionalBriefSlot>("/api/v1/regional-brief/slots", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    createVersion: (slotId: string, input: CreateVersionInput) =>
      fetchApi<RegionalBriefVersion>(`/api/v1/regional-brief/slots/${slotId}/versions`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    approveVersion: (versionId: string) =>
      fetchApi<RegionalBriefVersion>(`/api/v1/regional-brief/versions/${versionId}/approve`, {
        method: "POST",
      }),

    rejectVersion: (versionId: string, reason: string) =>
      fetchApi<RegionalBriefVersion>(`/api/v1/regional-brief/versions/${versionId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
  };
}
