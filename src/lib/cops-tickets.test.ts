import { describe, expect, it } from "vitest";
import { CopsRequestError } from "@/lib/cops-fetch";
import { diagnosticRows, higherSeverities, severityTone, TICKET_STATUSES, TICKET_TRANSITIONS, ticketErrorMessage } from "./cops-tickets";

describe("COPS-06 ticket helpers", () => {
  it("mirrors the backend state machine: the documented path is allowed and closed is final", () => {
    for (let i = 0; i < TICKET_STATUSES.length - 1; i++) {
      expect(TICKET_TRANSITIONS[TICKET_STATUSES[i]!]).toContain(TICKET_STATUSES[i + 1]);
    }
    expect(TICKET_TRANSITIONS.closed).toEqual([]);
    expect(TICKET_TRANSITIONS.new).not.toContain("resolved");
  });

  it("offers only higher severities for an escalation", () => {
    expect(higherSeverities("medium")).toEqual(["high", "critical"]);
    expect(higherSeverities("critical")).toEqual([]);
  });

  it("maps severity to a tone", () => {
    expect(severityTone("critical")).toBe("danger");
    expect(severityTone("high")).toBe("warning");
    expect(severityTone("low")).toBe("default");
  });

  it("renders diagnostics as rows", () => {
    expect(diagnosticRows({ activation_pct: 35, integrations: [{ key: "crm", status: "error" }], first_login_at: null })).toEqual([
      { label: "activation pct", value: "35" },
      { label: "integrations", value: '[{"key":"crm","status":"error"}]' },
      { label: "first login at", value: "—" },
    ]);
  });

  it("explains a refused publish", () => {
    const err = Object.assign(Object.create(CopsRequestError.prototype), {
      envelope: { code: "FORBIDDEN", message: "x", details: { required_permission: "tickets:send" } },
    });
    expect(ticketErrorMessage(err, "fallback")).toBe("Only Customer Success can publish updates to the customer.");
    expect(ticketErrorMessage(new Error("boom"), "fallback")).toBe("fallback");
  });
});
