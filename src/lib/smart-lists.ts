import { useApiFetch } from "./api-client";
import type {
  SmartList,
  SmartListActivateResult,
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
