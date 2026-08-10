import { useCrmServiceFetch } from "../crm-api-client";
import type { AuditLog, CrmEntityType, CrmListEnvelope } from "@/types/crm";

export function useAuditLogApi() {
  const fetchApi = useCrmServiceFetch();

  return {
    list: (params: { entityType: CrmEntityType; entityId: string; limit?: number; offset?: number }) => {
      const query = new URLSearchParams({ entityType: params.entityType, entityId: params.entityId });
      if (params.limit !== undefined) query.set("limit", String(params.limit));
      if (params.offset !== undefined) query.set("offset", String(params.offset));
      return fetchApi<CrmListEnvelope<AuditLog>>(`/api/v1/audit-logs?${query.toString()}`);
    },
  };
}
