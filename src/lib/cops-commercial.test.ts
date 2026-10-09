import { describe, expect, it } from "vitest";
import { CopsRequestError } from "@/lib/cops-fetch";
import {
  deskRowStatus,
  commercialErrorMessage,
  commercialTimeline,
  formatMoney,
  minorToMajorInput,
  parseMajorToMinor,
  previewTotals,
  statusTone,
  type CommercialSummary,
} from "./cops-commercial";

describe("previewTotals", () => {
  // Same fixtures as the backend's packages/shared/src/cops-commercial.test.ts, so the preview
  // the user sees matches what the server stores.
  it("matches the backend on line discount, header discount and tax", () => {
    expect(
      previewTotals({
        line_items: [
          { kind: "seats", description: "Seats", quantity: 10, unit_amount_minor: 100_000, discount_pct: 10 },
          { kind: "fee", description: "Onboarding", quantity: 1, unit_amount_minor: 50_000, discount_pct: 0 },
        ],
        discount_pct: 5,
        tax_pct: 18,
      })
    ).toEqual({ subtotal_minor: 1_050_000, discount_minor: 147_500, tax_minor: 162_450, total_minor: 1_064_950 });
  });

  it("rounds half-up like the backend", () => {
    expect(
      previewTotals({
        line_items: [{ kind: "product", description: "x", quantity: 1, unit_amount_minor: 333, discount_pct: 12.5 }],
        discount_pct: 0,
        tax_pct: 0,
      })
    ).toEqual({ subtotal_minor: 333, discount_minor: 42, tax_minor: 0, total_minor: 291 });
  });

  it("treats a half-typed row as zero instead of failing", () => {
    const t = previewTotals({ line_items: [{ kind: "fee", description: "", quantity: 0, unit_amount_minor: Number.NaN, discount_pct: 0 }], discount_pct: 0, tax_pct: 18 });
    expect(t.total_minor).toBe(0);
  });
});

describe("money helpers", () => {
  it("parses major units into minor units per currency", () => {
    expect(parseMajorToMinor("1,234.5", "INR")).toBe(123_450);
    expect(parseMajorToMinor("12", "USD")).toBe(1_200);
    expect(parseMajorToMinor("500", "JPY")).toBe(500);
    expect(parseMajorToMinor("1.234", "USD")).toBeNull();
    expect(parseMajorToMinor("-1", "USD")).toBeNull();
    expect(parseMajorToMinor("abc", "USD")).toBeNull();
  });

  it("formats and round-trips", () => {
    expect(formatMoney(123_450, "INR")).toContain("1,234.50");
    expect(minorToMajorInput(123_450, "INR")).toBe("1234.50");
    expect(minorToMajorInput(500, "JPY")).toBe("500");
  });

  it("tones statuses", () => {
    expect(statusTone("paid")).toBe("success");
    expect(statusTone("failed")).toBe("danger");
    expect(statusTone("sent")).toBe("info");
    expect(statusTone("draft")).toBe("warning");
  });
});

describe("commercialTimeline", () => {
  it("lists sends, signatures, payments and the gate newest first", () => {
    const summary = {
      opportunity: { id: "o", name: "Deal", amount: null, currency: "INR", deal_type: null, status: "open", commercial_state: "complete" },
      proposals: [
        {
          id: "p",
          opportunity_id: "o",
          title: "Annual",
          status: "accepted",
          current_version: 1,
          status_reason: "ok",
          status_changed_at: "2026-10-02T00:00:00Z",
          created_at: "2026-10-01T00:00:00Z",
          versions: [{ version: 1, sent_at: "2026-10-01T10:00:00Z" }],
        },
      ],
      contracts: [
        {
          id: "c",
          kind: "msa",
          status: "signed",
          status_changed_at: "2026-10-03T00:00:00Z",
          signed_at: "2026-10-03T00:00:00Z",
          versions: [{ version: 1, sent_at: "2026-10-02T12:00:00Z" }],
        },
      ],
      payment_requests: [
        { amount_minor: 10_000, currency: "INR", status: "paid", created_at: "2026-10-03T01:00:00Z", paid_at: "2026-10-04T00:00:00Z", status_changed_at: "2026-10-04T00:00:00Z" },
      ],
      gate: { fired_at: "2026-10-04T00:00:01Z" },
    } as unknown as CommercialSummary;
    const items = commercialTimeline(summary);
    expect(items.map((i) => i.label)).toEqual([
      "Provisioning requested",
      expect.stringMatching(/^Payment of .* paid$/),
      expect.stringMatching(/^Payment link for .* created$/),
      "MSA signed",
      "MSA v1 sent",
      "Annual accepted",
      "Annual v1 sent",
    ]);
  });
});

describe("commercialErrorMessage", () => {
  const err = (code: string, details: Record<string, unknown> | undefined = undefined) =>
    new CopsRequestError("x", { code, message: `server says ${code}`, details, request_id: "r", retryable: false }, null);

  it("explains each envelope code", () => {
    expect(commercialErrorMessage(err("FORBIDDEN"), "f")).toMatch(/permission/);
    expect(commercialErrorMessage(err("VALIDATION_FAILED", { fields: [{ path: "reason", message: "reason is required" }] }), "f")).toBe("reason: reason is required");
    expect(commercialErrorMessage(err("PROVIDER_UNAVAILABLE"), "f")).toMatch(/not configured/);
    expect(commercialErrorMessage(err("BUSINESS_STATE_CONFLICT"), "f")).toBe("server says BUSINESS_STATE_CONFLICT");
    expect(commercialErrorMessage(new Error("boom"), "fallback")).toBe("fallback");
  });
});

describe("deskRowStatus", () => {
  const base = {
    opportunity: { id: "o1", name: "Deal", amount: "100", currency: "INR", deal_type: null, status: "open", commercial_state: null },
    proposals: [],
    contracts: [],
    payment_requests: [],
    gate: { open: false, fired_at: null },
  } as unknown as Parameters<typeof deskRowStatus>[0];

  it("shows the newest proposal, MSA and payment and the gate state", () => {
    const row = {
      ...base,
      proposals: [
        { status: "declined", created_at: "2026-10-01T00:00:00Z" },
        { status: "sent", created_at: "2026-10-05T00:00:00Z" },
      ],
      contracts: [
        { kind: "dpa", status: "signed", created_at: "2026-10-06T00:00:00Z" },
        { kind: "msa", status: "sent", created_at: "2026-10-02T00:00:00Z" },
      ],
      payment_requests: [{ status: "paid", created_at: "2026-10-07T00:00:00Z" }],
      gate: { open: true, fired_at: "2026-10-07T01:00:00Z" },
    } as unknown as Parameters<typeof deskRowStatus>[0];
    expect(deskRowStatus(row)).toEqual({ proposal: "sent", msa: "sent", payment: "paid", gate: "fired" });
  });

  it("reports nothing started and a waiting gate for a fresh opportunity", () => {
    expect(deskRowStatus(base)).toEqual({ proposal: null, msa: null, payment: null, gate: "waiting" });
  });
});
