import { apiFetch } from "./api-client";
import { WORKSPACE_ID } from "./enrichment";
import type { SmartList, SmartListFilters, SmartListRunResult } from "@/types/api";

interface ListEnvelope<T> {
  workspaceId: string;
  data: T[];
  total: number;
}

export const smartListApi = {
  list: () =>
    apiFetch<ListEnvelope<SmartList>>("/api/v1/smart-lists", { workspaceId: WORKSPACE_ID }),

  create: (name: string, filters: SmartListFilters) =>
    apiFetch<SmartList>("/api/v1/smart-lists", {
      method: "POST",
      body: JSON.stringify({ name, filters }),
      workspaceId: WORKSPACE_ID,
    }),

  run: (id: string) =>
    apiFetch<SmartListRunResult>(`/api/v1/smart-lists/${id}/run`, {
      method: "POST",
      workspaceId: WORKSPACE_ID,
    }),
};
