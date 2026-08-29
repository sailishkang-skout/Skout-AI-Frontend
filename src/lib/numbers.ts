import { useApiFetch } from "./api-client";

export type NumberMarketplaceConfig = {
  marketplaceEnabled: boolean;
  connectionAssigned: boolean;
  messagingProfileAssigned: boolean;
};

export type AvailableNumber = {
  phoneNumber: string;
  phoneNumberType: string;
  locality: string | null;
  administrativeArea: string | null;
  countryCode: string | null;
  features: string[];
  monthlyCost: string | null;
  upfrontCost: string | null;
  currency: string | null;
};

export type NumberRequirement = {
  id: string;
  countryCode: string | null;
  phoneNumberType: string | null;
  action: string | null;
  description: string | null;
};

export type NumberRequest = {
  id: string;
  country: string;
  region: string | null;
  city: string | null;
  areaCode: string | null;
  numberType: string;
  phoneNumber: string | null;
  status: string;
  complianceStatus: string;
  requiredDocuments: unknown;
  submittedDocumentVersions: unknown;
  failureReason: string | null;
  rejectionReason: string | null;
  providerOrderId: string | null;
  providerRequirementGroupId?: string | null;
  assignedWorkspaceId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SearchNumbersQuery = {
  country: string;
  numberType?: string;
  areaCode?: string;
  city?: string;
  region?: string;
  features?: string;
};

export function useNumbersApi() {
  const fetchApi = useApiFetch();
  return {
    getConfig: async () => {
      const res = await fetchApi<{
        data?: NumberMarketplaceConfig;
        marketplaceEnabled?: boolean;
        connectionAssigned?: boolean;
        messagingProfileAssigned?: boolean;
      }>("/api/v1/numbers/config");
      const inner = res.data;
      return {
        marketplaceEnabled: inner?.marketplaceEnabled ?? res.marketplaceEnabled ?? false,
        connectionAssigned: inner?.connectionAssigned ?? res.connectionAssigned ?? false,
        messagingProfileAssigned: inner?.messagingProfileAssigned ?? res.messagingProfileAssigned ?? false,
      };
    },

    search: (query: SearchNumbersQuery) => {
      const params = new URLSearchParams();
      params.set("country", query.country);
      if (query.numberType) params.set("numberType", query.numberType);
      if (query.areaCode) params.set("areaCode", query.areaCode);
      if (query.city) params.set("city", query.city);
      if (query.region) params.set("region", query.region);
      if (query.features) params.set("features", query.features);
      return fetchApi<{ data: AvailableNumber[] }>(`/api/v1/numbers/available?${params.toString()}`);
    },

    requirements: (country: string, numberType: string) =>
      fetchApi<{ data: NumberRequirement[] }>(
        `/api/v1/numbers/requirements?country=${encodeURIComponent(country)}&numberType=${encodeURIComponent(numberType)}`
      ),

    listRequests: () => fetchApi<{ data: NumberRequest[]; total: number }>("/api/v1/numbers/requests"),

    createRequest: (input: {
      country: string;
      region?: string;
      city?: string;
      areaCode?: string;
      numberType?: string;
      requestedCapabilities?: string[];
      phoneNumber?: string;
      idempotencyKey?: string;
    }) =>
      fetchApi<{ data: NumberRequest }>("/api/v1/numbers/requests", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    submitCompliance: (id: string, documents: unknown[]) =>
      fetchApi<{ data: NumberRequest }>(`/api/v1/numbers/requests/${id}/compliance`, {
        method: "POST",
        body: JSON.stringify({ documents }),
      }),

    uploadDocument: (
      id: string,
      input: { filename: string; contentBase64: string; requirementId?: string }
    ) =>
      fetchApi<{ data: NumberRequest }>(`/api/v1/numbers/requests/${id}/documents`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    order: (id: string) =>
      fetchApi<{ data: NumberRequest }>(`/api/v1/numbers/requests/${id}/order`, { method: "POST" }),

    refresh: (id: string) =>
      fetchApi<{ data: NumberRequest }>(`/api/v1/numbers/requests/${id}/refresh`, { method: "POST" }),

    cancel: (id: string) =>
      fetchApi<{ data: NumberRequest }>(`/api/v1/numbers/requests/${id}/cancel`, { method: "POST" }),
  };
}
