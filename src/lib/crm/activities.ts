import { useCrmServiceFetch } from "../crm-api-client";
import type { Activity, ActivityInput, CrmEntityType, CrmListEnvelope } from "@/types/crm";

export function useActivitiesApi() {
  const fetchApi = useCrmServiceFetch();
  return {
    list: (params: { entityType: CrmEntityType; entityId: string; limit?: number; offset?: number }) => {
      const query = new URLSearchParams({ entityType: params.entityType, entityId: params.entityId });
      if (params.limit !== undefined) query.set("limit", String(params.limit));
      if (params.offset !== undefined) query.set("offset", String(params.offset));
      return fetchApi<CrmListEnvelope<Activity>>(`/api/v1/activities?${query.toString()}`);
    },

    create: (input: ActivityInput) =>
      fetchApi<Activity>("/api/v1/activities", { method: "POST", body: JSON.stringify(input) }),
  };
}
