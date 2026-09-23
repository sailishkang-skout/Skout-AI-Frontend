import type { SequenceLinkedinAction, SequenceStep } from "@/types/api";
import { CONDITION_LABELS } from "./step-drawer/condition-relevance";
import { formatDuration } from "./step-drawer/timing-row";

export interface StepSummary {
  title: string;
  detail: string | null;
  /** Nothing written yet — shown muted so unfinished steps stand out. */
  empty: boolean;
}

const ACTION_LABELS: Record<SequenceLinkedinAction, string> = {
  connect: "Connection request",
  message: "Direct message",
  inmail: "InMail",
  like: "Like recent posts",
  follow: "Follow profile",
  voice: "Voice note (manual handoff)",
};

function snippet(html: string | null, max = 140): string {
  const text = (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function summarizeStep(step: SequenceStep): StepSummary {
  switch (step.stepType) {
    case "email": {
      const subject = step.subject?.trim();
      const body = snippet(step.bodyTemplate);
      return { title: subject || "No subject yet", detail: body || null, empty: !subject && !body };
    }
    case "linkedin": {
      const action = step.linkedinAction ?? "connect";
      const body = snippet(step.bodyTemplate);
      const needsCopy = action === "message" || action === "inmail";
      return { title: ACTION_LABELS[action], detail: body || null, empty: needsCopy && !body };
    }
    case "whatsapp": {
      const body = snippet(step.bodyTemplate);
      return { title: "WhatsApp message", detail: body || null, empty: !body };
    }
    case "task": {
      const title = step.subject?.trim();
      return { title: title || "Untitled task", detail: null, empty: !title };
    }
    case "call":
      return { title: "Call task", detail: "Creates a CRM task and waits for the outcome.", empty: false };
    case "wait":
      return { title: `Wait ${formatDuration(step.delayDays, step.delayUnit ?? "days")}`, detail: null, empty: false };
    case "goal":
      return { title: step.goalLabel?.trim() || "Goal", detail: null, empty: false };
    case "condition": {
      const expr = step.conditionExpression;
      if (expr && "op" in expr) {
        return { title: `${expr.op === "and" ? "All" : "Any"} of ${expr.clauses.length} rules`, detail: null, empty: false };
      }
      const type = (expr && "type" in expr ? expr.type : step.conditionType) ?? null;
      return { title: type ? CONDITION_LABELS[type] : "Set a condition", detail: null, empty: !type };
    }
  }
}
