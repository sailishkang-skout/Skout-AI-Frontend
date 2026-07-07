import { useApiFetch } from "./api-client";
import type {
  EnrollSequenceResult,
  Sequence,
  SequenceAnalytics,
  SequenceDetail,
  SequenceEnrollment,
  SequenceStatus,
  SequenceStep,
  SequenceStepType,
} from "@/types/api";

interface ListEnvelope<T> {
  workspaceId: string;
  data: T[];
  total: number;
}

export function sequenceStatusTone(status: SequenceStatus) {
  switch (status) {
    case "active":
      return "success" as const;
    case "paused":
      return "warning" as const;
    case "archived":
      return "muted" as const;
    default:
      return "default" as const;
  }
}

export interface AddStepInput {
  stepType: SequenceStepType;
  delayDays: number;
  subject?: string;
  bodyTemplate?: string;
}

export interface UpdateStepInput {
  stepType?: SequenceStepType;
  delayDays?: number;
  subject?: string | null;
  bodyTemplate?: string | null;
}

export interface EnrollInput {
  prospectIds?: string[];
  listId?: string;
}

export function useSequencesApi() {
  const fetchApi = useApiFetch();

  return {
    list: () => fetchApi<ListEnvelope<Sequence>>("/api/v1/sequences"),

    get: (id: string) => fetchApi<SequenceDetail>(`/api/v1/sequences/${id}`),

    create: (name: string) =>
      fetchApi<Sequence>("/api/v1/sequences", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),

    update: (id: string, patch: { name?: string; status?: Sequence["status"] }) =>
      fetchApi<Sequence>(`/api/v1/sequences/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),

    remove: (id: string) =>
      fetchApi<void>(`/api/v1/sequences/${id}`, {
        method: "DELETE",
      }),

    addStep: (sequenceId: string, input: AddStepInput) =>
      fetchApi<SequenceStep>(`/api/v1/sequences/${sequenceId}/steps`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    updateStep: (sequenceId: string, stepId: string, input: UpdateStepInput) =>
      fetchApi<SequenceStep>(`/api/v1/sequences/${sequenceId}/steps/${stepId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),

    deleteStep: (sequenceId: string, stepId: string) =>
      fetchApi<void>(`/api/v1/sequences/${sequenceId}/steps/${stepId}`, {
        method: "DELETE",
      }),

    reorderSteps: (sequenceId: string, stepIds: string[]) =>
      fetchApi<SequenceStep[]>(`/api/v1/sequences/${sequenceId}/steps/reorder`, {
        method: "PUT",
        body: JSON.stringify({ stepIds }),
      }),

    enroll: (sequenceId: string, input: EnrollInput) =>
      fetchApi<EnrollSequenceResult>(`/api/v1/sequences/${sequenceId}/enroll`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    getAnalytics: (sequenceId: string) =>
      fetchApi<SequenceAnalytics>(`/api/v1/sequences/${sequenceId}/analytics`),

    listEnrollments: (sequenceId: string) =>
      fetchApi<ListEnvelope<SequenceEnrollment>>(`/api/v1/sequences/${sequenceId}/enrollments`),

    unenroll: (sequenceId: string, prospectId: string) =>
      fetchApi<void>(`/api/v1/sequences/${sequenceId}/enrollments/${prospectId}`, {
        method: "DELETE",
      }),

    getProspectEnrollments: (prospectId: string) =>
      fetchApi<ListEnvelope<SequenceEnrollment>>(
        `/api/v1/sequences/prospects/${prospectId}/enrollments`,
      ),
  };
}
