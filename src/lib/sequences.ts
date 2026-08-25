import { useApiFetch } from "./api-client";
import type {
  EnrollSequenceResult,
  Sequence,
  SequenceAnalytics,
  ConditionExpression,
  SequenceConditionType,
  SequenceDelayUnit,
  SequenceEvent,
  SequenceExperiment,
  SequenceExperimentAnalytics,
  SequenceDetail,
  SequenceEnrollment,
  SequenceLinkedinAction,
  SequenceMode,
  SequenceSource,
  SequenceStatus,
  SequenceStep,
  SequenceStepType,
  SequenceTemplateSummary,
  SequenceVariantKey,
  SequenceVersionSummary,
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

export interface StepVariantInput {
  variantKey: SequenceVariantKey;
  subject?: string | null;
  bodyTemplate?: string | null;
  weight?: number;
  enabled?: boolean;
}

export interface AddStepInput {
  stepType: SequenceStepType;
  delayDays: number;
  delayUnit?: SequenceDelayUnit;
  linkedinAction?: SequenceLinkedinAction;
  subject?: string;
  bodyTemplate?: string;
  conditionType?: SequenceConditionType | null;
  conditionExpression?: ConditionExpression | null;
  conditionWaitDays?: number;
  yesNextStepId?: string | null;
  noNextStepId?: string | null;
  parentStepId?: string | null;
  branch?: "yes" | "no" | null;
  goalLabel?: string | null;
  variants?: StepVariantInput[];
}

export interface UpdateStepInput {
  stepType?: SequenceStepType;
  delayDays?: number;
  delayUnit?: SequenceDelayUnit;
  linkedinAction?: SequenceLinkedinAction | null;
  subject?: string | null;
  bodyTemplate?: string | null;
  conditionType?: SequenceConditionType | null;
  conditionExpression?: ConditionExpression | null;
  conditionWaitDays?: number;
  yesNextStepId?: string | null;
  noNextStepId?: string | null;
  parentStepId?: string | null;
  branch?: "yes" | "no" | null;
  goalLabel?: string | null;
  variants?: StepVariantInput[];
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

    create: (name: string, source: SequenceSource = "manual", mode: SequenceMode = "C") =>
      fetchApi<Sequence>("/api/v1/sequences", {
        method: "POST",
        body: JSON.stringify({ name, source, mode }),
      }),

    listTemplates: () => fetchApi<{ data: SequenceTemplateSummary[]; total: number }>("/api/v1/sequences/templates"),

    createFromTemplate: (key: string, name?: string, mode?: SequenceMode) =>
      fetchApi<SequenceDetail>("/api/v1/sequences/from-template", {
        method: "POST",
        body: JSON.stringify({ key, name, mode }),
      }),

    generate: (input: { goal: string; listId?: string; channels?: ("email" | "linkedin")[] }) =>
      fetchApi<SequenceDetail>("/api/v1/sequences/generate", {
        method: "POST",
        body: JSON.stringify(input),
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

    approveModeC: (id: string) =>
      fetchApi<Sequence>(`/api/v1/sequences/${id}/approve-mode-c`, {
        method: "POST",
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

    listEnrolledLists: (sequenceId: string) =>
      fetchApi<ListEnvelope<SequenceEnrolledList>>(`/api/v1/sequences/${sequenceId}/lists`),

    listSequencesForList: (listId: string) =>
      fetchApi<ListEnvelope<ListRunningSequence>>(`/api/v1/lists/${listId}/sequences`),

    listVersions: (sequenceId: string) =>
      fetchApi<{ data: SequenceVersionSummary[]; total: number }>(`/api/v1/sequences/${sequenceId}/versions`),

    publishVersion: (sequenceId: string) =>
      fetchApi<SequenceVersionSummary>(`/api/v1/sequences/${sequenceId}/versions`, { method: "POST" }),

    listEvents: (sequenceId: string, opts?: { enrollmentId?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (opts?.enrollmentId) q.set("enrollmentId", opts.enrollmentId);
      if (opts?.limit) q.set("limit", String(opts.limit));
      const qs = q.toString();
      return fetchApi<{ data: SequenceEvent[]; total: number }>(
        `/api/v1/sequences/${sequenceId}/events${qs ? `?${qs}` : ""}`,
      );
    },

    listExperiments: () => fetchApi<{ data: SequenceExperiment[]; total: number }>("/api/v1/sequences/experiments"),

    createExperiment: (input: {
      name: string;
      fromTemplates?: boolean;
      sequenceAId?: string;
      sequenceBId?: string;
      weightA?: number;
      weightB?: number;
      primaryMetric?: string;
      durationDays?: number;
    }) =>
      fetchApi<SequenceExperiment>("/api/v1/sequences/experiments", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    getExperiment: (id: string) => fetchApi<SequenceExperiment>(`/api/v1/sequences/experiments/${id}`),

    updateExperiment: (id: string, patch: { name?: string; status?: string; weightA?: number; weightB?: number }) =>
      fetchApi<SequenceExperiment>(`/api/v1/sequences/experiments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),

    getExperimentAnalytics: (id: string) =>
      fetchApi<SequenceExperimentAnalytics>(`/api/v1/sequences/experiments/${id}/analytics`),

    enrollExperiment: (id: string, input: EnrollInput) =>
      fetchApi<{ enrolled: number; enrolledA: number; enrolledB: number; skipped: number; total: number }>(
        `/api/v1/sequences/experiments/${id}/enroll`,
        { method: "POST", body: JSON.stringify(input) },
      ),
  };
}

export interface SequenceEnrolledList {
  listId: string;
  listName: string;
  total: number;
  active: number;
  completed: number;
  enrolledAt: string;
}

export interface ListRunningSequence {
  sequenceId: string;
  sequenceName: string;
  sequenceStatus: string;
  total: number;
  active: number;
  completed: number;
  enrolledAt: string;
}
