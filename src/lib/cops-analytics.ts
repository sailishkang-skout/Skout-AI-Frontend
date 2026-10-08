import posthog from "posthog-js";

/**
 * Product analytics for CustomerOps (Definition of Done: "analytics instrumentation added").
 *
 * Event names are canonical and versioned (Bible p.87): one name per business action, past tense,
 * `cops.` prefix, and every event carries `schema_version`. Properties are ids, enums and counts
 * only: no emails, names, free-text reasons or document contents, so nothing personal leaves the app.
 * The server-side record of the same actions is the domain event outbox (COPS-01); these client
 * events add the UI funnel (which surface, how often an action is retried).
 *
 * When PostHog is not configured (local, tests) every call is a no-op.
 */
export const COPS_ANALYTICS_SCHEMA_VERSION = 1;

export const COPS_ANALYTICS_EVENTS = [
  // COPS-01
  "cops.audit_log_searched",
  "cops.notification_routes_saved",
  // COPS-02
  "cops.opportunity_stage_moved",
  "cops.opportunity_stage_move_refused",
  "cops.saved_view_saved",
  "cops.records_bulk_reassigned",
  // COPS-03
  "cops.proposal_created",
  "cops.proposal_sent",
  "cops.contract_created",
  "cops.contract_sent",
  "cops.payment_link_created",
  "cops.gate_trial_approved",
  "cops.gate_overridden",
  // COPS-04
  "cops.trial_provisioned",
  "cops.trial_provisioning_failed",
  "cops.trial_provisioning_retried",
  "cops.credits_granted",
  "cops.credits_adjusted",
  "cops.trial_extended",
  // COPS-05
  "cops.onboarding_email_sent",
  "cops.onboarding_email_resent",
  "cops.follow_up_paused",
  "cops.follow_up_resumed",
  "cops.follow_up_stopped",
  "cops.milestone_completed",
  "cops.follow_up_action_logged",
] as const;

export type CopsAnalyticsEvent = (typeof COPS_ANALYTICS_EVENTS)[number];

export type CopsAnalyticsProps = Record<string, string | number | boolean | null | undefined>;

export function trackCops(event: CopsAnalyticsEvent, props: CopsAnalyticsProps = {}): void {
  try {
    if (!posthog.__loaded) return;
    posthog.capture(event, { ...props, schema_version: COPS_ANALYTICS_SCHEMA_VERSION, surface: "web" });
  } catch {
    // Analytics must never break the action it describes.
  }
}

/** Runs a write and records `event` once it succeeds. Props may be derived from the result. */
export async function withCopsTracking<T>(
  event: CopsAnalyticsEvent,
  run: () => Promise<T>,
  props: CopsAnalyticsProps | ((result: T) => CopsAnalyticsProps) = {}
): Promise<T> {
  const result = await run();
  trackCops(event, typeof props === "function" ? props(result) : props);
  return result;
}
