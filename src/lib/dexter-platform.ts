import { useApiFetch } from "./api-client";

export type AutomationMode = "ask" | "auto" | "draft" | "approve";

export type LinkedinVoiceEligibility = {
  eligible: boolean;
  status: "accepted" | "pending" | "unknown";
  reason?: string;
  prospectName: string;
  linkedinUrl?: string | null;
  location?: string | null;
};

export type LinkedinVoiceHandoff = {
  id: string;
  handoffToken: string;
  status: string;
  evidenceId?: string | null;
  voiceChoice: string;
  syntheticProfile: string | null;
  prospectName?: string | null;
  linkedinUrl?: string | null;
  expiresAt?: string | null;
  mobileUrl: string;
  note: string;
  scriptText?: string;
  prospectId?: string;
};

export function useDexterPlatformApi() {
  const fetchApi = useApiFetch();
  return {
    listPolicies: () =>
      fetchApi<{
        data: {
          policies: Array<{ actionKey: string; mode: string; source: string }>;
          defaults: Array<{ actionKey: string; mode: string; source: string }>;
        };
      }>("/api/v1/automation-policy"),

    setPolicy: (actionKey: string, mode: AutomationMode) =>
      fetchApi<{ data: unknown }>("/api/v1/automation-policy", {
        method: "PUT",
        body: JSON.stringify({ actionKey, mode }),
      }),

    listPolicyDecisions: () => fetchApi<{ data: unknown[] }>("/api/v1/policy/decisions"),

    classify: (actionKey: string, priorApproval?: boolean) =>
      fetchApi<{ data: { mode: string; outcome: string; decisionId: string } }>("/api/v1/policy/classify", {
        method: "POST",
        body: JSON.stringify({ actionKey, priorApproval }),
      }),

    listDecisions: (status?: string) =>
      fetchApi<{ data: Array<Record<string, unknown>> }>(
        status ? `/api/v1/decisions?status=${encodeURIComponent(status)}` : "/api/v1/decisions"
      ),

    createDecisionFromNba: (entityType: "contact" | "deal", entityId: string) =>
      fetchApi<{ data: Record<string, unknown> }>("/api/v1/decisions/from-nba", {
        method: "POST",
        body: JSON.stringify({ entityType, entityId }),
      }),

    decide: (id: string, choice: "decided" | "dismissed") =>
      fetchApi<{ data: Record<string, unknown> }>(`/api/v1/decisions/${id}/decide`, {
        method: "POST",
        body: JSON.stringify({ choice }),
      }),

    listWorkflowRuns: () => fetchApi<{ data: Array<Record<string, unknown>> }>("/api/v1/workflows/runs"),

    startWorkflowRun: (name: string, steps?: Array<{ name: string }>) =>
      fetchApi<{ data: Record<string, unknown> }>("/api/v1/workflows/runs", {
        method: "POST",
        body: JSON.stringify({ name, steps }),
      }),

    completeWorkflowRun: (id: string, status: "completed" | "failed" | "cancelled") =>
      fetchApi<{ data: Record<string, unknown> }>(`/api/v1/workflows/runs/${id}/complete`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),

    proposePlan: (brief: string) =>
      fetchApi<{ data: { plan: Record<string, unknown>; policy: Record<string, unknown> } }>(
        "/api/v1/dexter/plans",
        { method: "POST", body: JSON.stringify({ brief }) }
      ),

    approvePlan: (id: string) =>
      fetchApi<{ data: Record<string, unknown> }>(`/api/v1/dexter/plans/${id}/approve`, { method: "POST" }),

    invokePlan: (id: string) =>
      fetchApi<{ data: { plan: Record<string, unknown> } }>(`/api/v1/dexter/plans/${id}/invoke`, {
        method: "POST",
      }),

    learnPlan: (id: string, learning: Record<string, unknown>) =>
      fetchApi<{ data: Record<string, unknown> }>(`/api/v1/dexter/plans/${id}/learn`, {
        method: "POST",
        body: JSON.stringify({ learning }),
      }),

    getAccount360: (companyId: string) =>
      fetchApi<{ data: Record<string, unknown> }>(`/api/v1/account-360/${companyId}`),

    getPerson360: (contactId: string) =>
      fetchApi<{ data: Record<string, unknown> }>(`/api/v1/person-360/${contactId}`),

    getLinkedinVoiceEligibility: (prospectId: string, linkedinUrl?: string) => {
      const params = new URLSearchParams({ prospectId });
      if (linkedinUrl) params.set("linkedinUrl", linkedinUrl);
      return fetchApi<{ data: LinkedinVoiceEligibility }>(
        `/api/v1/linkedin/voice/eligibility?${params.toString()}`
      );
    },

    draftLinkedinVoiceScript: (params: {
      prospectId: string;
      goal?: string;
      tone?: string;
      customNotes?: string;
      language?: string;
    }) =>
      fetchApi<{
        data: {
          scriptText: string;
          regionalBriefPreview: string;
          estimatedDurationSeconds: number;
          language: string;
          evidence: { unverified: boolean; location: string; tone: string; citations: string[] };
          prospect: {
            id: string;
            name: string;
            title?: string;
            company?: string;
            linkedinUrl?: string | null;
          };
        };
      }>("/api/v1/linkedin/voice/draft-script", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    synthesizeVoiceAudio: (params: { scriptText: string; voice?: string }) =>
      fetchApi<{
        data: {
          audioBase64: string;
          mimeType: string;
          voice: string;
          durationEstimateSeconds: number;
          previewOnly: boolean;
        };
      }>("/api/v1/linkedin/voice/synthesize", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    listLinkedinVoiceHandoffs: () =>
      fetchApi<{ data: Array<Record<string, unknown>> }>("/api/v1/linkedin/voice/handoffs"),

    getLinkedinVoiceHandoff: (token: string) =>
      fetchApi<{ data: LinkedinVoiceHandoff }>(`/api/v1/linkedin/voice/handoffs/${encodeURIComponent(token)}`),

    createLinkedinVoiceHandoff: (params: {
      prospectId: string;
      scriptText: string;
      voiceChoice?: string;
      regionalBriefPreview?: string;
      language?: string;
      linkedinUrl?: string;
    }) =>
      fetchApi<{ data: LinkedinVoiceHandoff }>("/api/v1/linkedin/voice/handoff", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    confirmLinkedinVoiceSent: (handoffToken: string, outcomeNote?: string) =>
      fetchApi<{ data: { id: string; status: string; confirmedAt: string | null } }>(
        "/api/v1/linkedin/voice/confirm-sent",
        {
          method: "POST",
          body: JSON.stringify({ handoffToken, outcomeNote }),
        }
      ),
  };
}
