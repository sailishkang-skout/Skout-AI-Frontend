import { describe, expect, it } from "vitest";
import { CopsRequestError } from "@/lib/cops-fetch";
import { emailProgress, emailStatusTone, evidenceText, onboardingErrorMessage, orderedMilestones, trialTimer, type EmailSend, type Milestone } from "./cops-onboarding";

const email = (over: Partial<EmailSend>): EmailSend => ({
  id: "e1",
  account_id: "a1",
  contact_id: null,
  to: "ada@c.test",
  template_key: "welcome_trial",
  template_version: 1,
  subject: "Welcome",
  status: "sent",
  is_resend: false,
  reason: null,
  error: null,
  opened_at: null,
  clicked_at: null,
  sent_at: null,
  created_at: "2026-10-08T00:00:00Z",
  ...over,
});

const ms = (over: Partial<Milestone>): Milestone => ({ key: "k", label: "K", weight: 0, required: false, source: "event", completed_at: null, evidence: null, ...over });

describe("cops-onboarding helpers", () => {
  it("shows the furthest tracking state an email reached", () => {
    expect(emailProgress(email({}))).toBe("sent");
    expect(emailProgress(email({ status: "delivered" }))).toBe("delivered");
    expect(emailProgress(email({ status: "delivered", opened_at: "x" }))).toBe("opened");
    expect(emailProgress(email({ status: "delivered", opened_at: "x", clicked_at: "y" }))).toBe("clicked");
    expect(emailProgress(email({ status: "bounced", opened_at: "x" }))).toBe("bounced");
    expect(emailStatusTone(email({ status: "failed" }))).toBe("danger");
    expect(emailStatusTone(email({ status: "delivered" }))).toBe("success");
  });

  it("counts the trial down in days and hours and never below zero", () => {
    const now = new Date("2026-10-08T00:00:00Z");
    expect(trialTimer("2026-10-10T06:00:00Z", now)).toEqual({ days: 2, hours: 6, ended: false });
    expect(trialTimer("2026-10-01T00:00:00Z", now)).toEqual({ days: 0, hours: 0, ended: true });
    expect(trialTimer(null, now)).toBeNull();
  });

  it("lists required milestones first, heaviest first", () => {
    const order = orderedMilestones([
      ms({ key: "first_login", label: "First login" }),
      ms({ key: "first_search", label: "First search", required: true, weight: 30 }),
      ms({ key: "crm", label: "CRM connected", required: true, weight: 35 }),
    ]).map((m) => m.key);
    expect(order).toEqual(["crm", "first_search", "first_login"]);
  });

  it("explains milestone evidence without personal data", () => {
    expect(evidenceText(ms({ completed_at: "x", evidence: { source_type: "integration.crm_connected", provider: "hubspot" } }))).toBe("hubspot connected");
    expect(evidenceText(ms({ completed_at: "x", evidence: { source_type: "manual", reason: "Review held" } }))).toBe("Marked done: Review held");
    expect(evidenceText(ms({ completed_at: null, evidence: { source_type: "manual" } }))).toBeNull();
  });

  it("turns COPS-05 error codes into plain language", () => {
    const err = (code: string, details?: Record<string, unknown>) =>
      new CopsRequestError(code, { code, message: code, request_id: "r", retryable: false, ...(details ? { details } : {}) }, null);
    expect(onboardingErrorMessage(err("CONTACT_BLOCKED", { reason: "hard_bounce" }), "x")).toMatch(/hard-bounced/);
    expect(onboardingErrorMessage(err("ALREADY_SENT"), "x")).toMatch(/Re-send it with a reason/);
    expect(onboardingErrorMessage(err("EMAIL_NOT_SENT"), "x")).toMatch(/will not be sent twice/);
    expect(onboardingErrorMessage(err("NOT_PROVISIONED"), "x")).toMatch(/Provision/);
    expect(onboardingErrorMessage(new Error("boom"), "fallback")).toBe("fallback");
  });
});
