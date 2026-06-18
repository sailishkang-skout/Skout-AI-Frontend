import { useApiFetch } from "./api-client";
import type {
  SmartList,
  SmartListActivateResult,
  SmartListFilters,
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

    run: (id: string) =>
      fetchApi<SmartListRunResult>(`/api/v1/smart-lists/${id}/run`, {
        method: "POST",
      }),

    activate: (id: string, opts?: { listName?: string; listId?: string }) =>
      fetchApi<SmartListActivateResult>(`/api/v1/smart-lists/${id}/activate`, {
        method: "POST",
        body: JSON.stringify(opts ?? {}),
      }),
  };
}
