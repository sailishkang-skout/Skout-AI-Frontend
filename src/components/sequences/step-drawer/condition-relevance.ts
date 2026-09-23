import type { SequenceConditionType, SequenceStep } from "@/types/api";

export const CONDITION_LABELS: Record<SequenceConditionType, string> = {
  linkedin_invite_accepted: "LinkedIn invite accepted",
  linkedin_connected: "LinkedIn connected",
  linkedin_invite_declined: "LinkedIn invite declined",
  email_opened: "Email opened",
  email_clicked: "Email clicked",
  email_opened_count_gte: "Email opened at least N times",
  email_clicked_count_gte: "Email clicked at least N times",
  email_replied: "Email replied",
  call_connected: "Call connected",
  icp_score_gte: "ICP score ≥",
  has_email: "Has email",
  has_linkedin: "Has LinkedIn URL",
  meeting_booked: "Meeting booked",
  account_has_positive_reply: "Another contact at this account replied positively",
};

/** Rules that carry a number, and the value the engine assumes when none is stored. */
export const CONDITION_VALUE_DEFAULTS: Partial<Record<SequenceConditionType, number>> = {
  icp_score_gte: 80,
  email_opened_count_gte: 3,
  email_clicked_count_gte: 3,
};

interface Prerequisite {
  test: (earlier: SequenceStep[]) => boolean;
  reason: string;
}

const LINKEDIN_CONNECT: Prerequisite = {
  // A LinkedIn step with no stored action is a connection request (the editor default).
  test: (earlier) => earlier.some((s) => s.stepType === "linkedin" && (s.linkedinAction ?? "connect") === "connect"),
  reason: "No earlier LinkedIn connection request step.",
};
const EARLIER_EMAIL: Prerequisite = {
  test: (earlier) => earlier.some((s) => s.stepType === "email"),
  reason: "No earlier email step.",
};
const EARLIER_CALL: Prerequisite = {
  test: (earlier) => earlier.some((s) => s.stepType === "call"),
  reason: "No earlier call step.",
};

const PREREQUISITES: Partial<Record<SequenceConditionType, Prerequisite>> = {
  linkedin_invite_accepted: LINKEDIN_CONNECT,
  linkedin_connected: LINKEDIN_CONNECT,
  linkedin_invite_declined: LINKEDIN_CONNECT,
  email_opened: EARLIER_EMAIL,
  email_clicked: EARLIER_EMAIL,
  email_opened_count_gte: EARLIER_EMAIL,
  email_clicked_count_gte: EARLIER_EMAIL,
  email_replied: EARLIER_EMAIL,
  call_connected: EARLIER_CALL,
};

/** Why a rule can never be met given the steps before it, or null when it can. */
export function unmetPrerequisite(type: SequenceConditionType, earlierSteps: SequenceStep[]): string | null {
  const prerequisite = PREREQUISITES[type];
  return prerequisite && !prerequisite.test(earlierSteps) ? prerequisite.reason : null;
}

export interface ConditionOption {
  type: SequenceConditionType;
  label: string;
  reason: string | null;
}

export function classifyConditions(earlierSteps: SequenceStep[]): {
  relevant: ConditionOption[];
  unavailable: ConditionOption[];
} {
  const relevant: ConditionOption[] = [];
  const unavailable: ConditionOption[] = [];
  for (const type of Object.keys(CONDITION_LABELS) as SequenceConditionType[]) {
    const reason = unmetPrerequisite(type, earlierSteps);
    (reason ? unavailable : relevant).push({ type, label: CONDITION_LABELS[type], reason });
  }
  return { relevant, unavailable };
}

export function earlierStepsOf(step: SequenceStep, all: SequenceStep[]): SequenceStep[] {
  return all.filter((s) => s.id !== step.id && s.stepOrder < step.stepOrder);
}
