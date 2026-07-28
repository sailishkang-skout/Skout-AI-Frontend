import { useCrmServiceFetch } from "../crm-api-client";
import type { CrmEntityType, CrmListEnvelope, Task, TaskInput, TaskPatch, TaskStatus } from "@/types/crm";

export function useTasksApi() {
  const fetchApi = useCrmServiceFetch();
  return {
    list: (params?: {
      limit?: number;
      offset?: number;
      assignedTo?: string;
      status?: TaskStatus;
      relatedEntityType?: CrmEntityType;
      relatedEntityId?: string;
    }) => {
      const query = new URLSearchParams();
      if (params?.limit !== undefined) query.set("limit", String(params.limit));
      if (params?.offset !== undefined) query.set("offset", String(params.offset));
      if (params?.assignedTo) query.set("assignedTo", params.assignedTo);
      if (params?.status) query.set("status", params.status);
      if (params?.relatedEntityType) query.set("relatedEntityType", params.relatedEntityType);
      if (params?.relatedEntityId) query.set("relatedEntityId", params.relatedEntityId);
      const qs = query.toString();
      return fetchApi<CrmListEnvelope<Task>>(`/api/v1/tasks${qs ? `?${qs}` : ""}`);
    },

    create: (input: TaskInput) =>
      fetchApi<Task>("/api/v1/tasks", { method: "POST", body: JSON.stringify(input) }),

    update: (id: string, patch: TaskPatch) =>
      fetchApi<Task>(`/api/v1/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

    complete: (id: string) => fetchApi<Task>(`/api/v1/tasks/${id}/complete`, { method: "POST" }),

    remove: (id: string) => fetchApi<void>(`/api/v1/tasks/${id}`, { method: "DELETE" }),
  };
}
