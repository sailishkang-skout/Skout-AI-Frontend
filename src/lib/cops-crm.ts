import { useApiFetch } from "@/lib/api-client";
import { copsFetch, CopsRequestError } from "@/lib/cops-fetch";

/** COPS-02 CRM writes that go through the backend transition service and idempotency keys. */

function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `web-${crypto.randomUUID()}`
    : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface StageMoveResult {
  opportunity_id: string;
  stage_id: string;
  state: string;
}

export function useCopsCrmApi() {
  const request = useApiFetch();
  return {
    /** Moves a deal to a stage. Illegal lifecycle moves come back as CopsRequestError (409). */
    moveOpportunityStage(dealId: string, stageId: string, reason: string) {
      return copsFetch<{ data: StageMoveResult }>(
        `/api/v1/opportunities/${dealId}/stage`,
        {
          method: "POST",
          headers: { "Idempotency-Key": newIdempotencyKey() },
          body: JSON.stringify({ stage_id: stageId, reason, source: "web" }),
        },
        { request }
      );
    },
  };
}

const STATE_LABELS: Record<string, string> = {
  qualified: "Qualified",
  demo: "Demo",
  commercial: "Commercial",
  won: "Won",
  lost: "Lost",
};

const label = (state: unknown) => (typeof state === "string" ? STATE_LABELS[state] ?? state : "this stage");

/**
 * Plain-language message for a failed stage move. A 409 BUSINESS_STATE_CONFLICT names the current
 * state and the moves that are allowed from it, so the user sees the rule instead of a raw error.
 */
export function stageMoveErrorMessage(error: unknown, dealName?: string): string {
  const who = dealName ? `"${dealName}"` : "This deal";
  if (error instanceof CopsRequestError && error.envelope) {
    const env = error.envelope;
    if (env.code === "BUSINESS_STATE_CONFLICT") {
      const d = (env.details ?? {}) as { current_state?: { state?: string }; requested_state?: string; allowed_transitions?: string[] };
      const allowed = d.allowed_transitions ?? [];
      const next = allowed.length ? `It can move to ${allowed.map(label).join(" or ")} next.` : "It is closed and cannot move.";
      return `${who} can't go from ${label(d.current_state?.state)} to ${label(d.requested_state)}. ${next}`;
    }
    if (env.code === "FORBIDDEN") return `You don't have permission to move ${dealName ? who : "deals"}.`;
    if (env.code === "VALIDATION_FAILED") return env.message;
    return env.message;
  }
  return "Could not move this deal. Please try again.";
}
