// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Proposal } from "@/lib/cops-commercial";

const api = { createProposal: vi.fn(), addProposalVersion: vi.fn() };
vi.mock("@/lib/api-client", () => ({ useAuthReady: () => true, useApiFetch: () => vi.fn() }));
vi.mock("@/lib/cops-commercial", async (original) => ({ ...(await original<typeof import("@/lib/cops-commercial")>()), useCopsCommercialApi: () => api }));

import { ProposalBuilderDialog } from "./proposal-builder-dialog";

beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset().mockResolvedValue({ data: {} })));
afterEach(cleanup);

/**
 * COPS-08: the builder carries the terms the approval rules read. Without these fields a proposal
 * made in the UI could never trigger the payment-terms, free-credit, custom-clause or SLA rules,
 * and contract value could not tell a monthly price from a whole-term one.
 */
describe("ProposalBuilderDialog approval terms", () => {
  it("sends standard terms by default, with each line priced for the term", async () => {
    render(<ProposalBuilderDialog open onClose={() => {}} opportunityId="o1" defaultCurrency="USD" onSaved={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("e.g. Acme annual plan"), { target: { value: "Acme annual" } });
    fireEvent.change(screen.getByLabelText("Line 1 description"), { target: { value: "Seats" } });
    fireEvent.change(screen.getByLabelText("Line 1 unit price"), { target: { value: "948" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(api.createProposal).toHaveBeenCalled());
    const [, body] = api.createProposal.mock.calls[0]!;
    expect(body).toMatchObject({ payment_terms_net_days: 30, free_credits: 0, custom_clauses: false, non_standard_sla: false });
    expect(body.line_items[0]).toMatchObject({ unit_amount_minor: 94_800, price_basis: "per_term" });
  });

  it("sends a monthly price, longer payment terms, free credits, custom clauses and a non-standard SLA", async () => {
    render(<ProposalBuilderDialog open onClose={() => {}} opportunityId="o1" defaultCurrency="USD" onSaved={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("e.g. Acme annual plan"), { target: { value: "Acme monthly" } });
    fireEvent.change(screen.getByLabelText("Line 1 description"), { target: { value: "Seats" } });
    fireEvent.change(screen.getByLabelText("Line 1 unit price"), { target: { value: "79" } });
    fireEvent.change(screen.getByLabelText("Line 1 price covers"), { target: { value: "per_month" } });
    fireEvent.change(screen.getByLabelText("Payment terms in days"), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText("Free credits"), { target: { value: "1000" } });
    fireEvent.click(screen.getByLabelText("Custom clauses"));
    fireEvent.click(screen.getByLabelText("Non-standard SLA"));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(api.createProposal).toHaveBeenCalled());
    const [, body] = api.createProposal.mock.calls[0]!;
    expect(body).toMatchObject({ payment_terms_net_days: 60, free_credits: 1000, custom_clauses: true, non_standard_sla: true });
    expect(body.line_items[0]).toMatchObject({ unit_amount_minor: 7900, price_basis: "per_month" });
  });

  it("refuses payment terms or free credits that are not whole numbers in range", () => {
    render(<ProposalBuilderDialog open onClose={() => {}} opportunityId="o1" defaultCurrency="USD" onSaved={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("e.g. Acme annual plan"), { target: { value: "Acme" } });
    fireEvent.change(screen.getByLabelText("Line 1 description"), { target: { value: "Seats" } });
    fireEvent.change(screen.getByLabelText("Line 1 unit price"), { target: { value: "79" } });
    const save = screen.getByRole("button", { name: "Save draft" }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Payment terms in days"), { target: { value: "400" } });
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Payment terms in days"), { target: { value: "45" } });
    fireEvent.change(screen.getByLabelText("Free credits"), { target: { value: "-5" } });
    expect(save.disabled).toBe(true);
  });

  it("a new version starts from the terms of the last one, so an edit does not silently reset them", async () => {
    const proposal = {
      id: "p1",
      title: "Acme",
      status: "draft",
      versions: [
        {
          id: "v1",
          version: 1,
          currency: "USD",
          billing_cadence: "annual",
          term_months: 24,
          discount_pct: 0,
          tax_pct: 0,
          notes: null,
          payment_terms_net_days: 60,
          free_credits: 1000,
          custom_clauses: true,
          non_standard_sla: false,
          totals: { subtotal_minor: 79_000, discount_minor: 0, tax_minor: 0, total_minor: 79_000 },
          line_items: [{ id: "l1", position: 1, kind: "seats", description: "Seats", quantity: 10, unit_amount_minor: 7900, discount_pct: 0, price_basis: "per_month", gross_minor: 79_000, discount_minor: 0, net_minor: 79_000 }],
          sent_at: null,
          sent_by: null,
          content_hash: null,
          hash_valid: null,
          created_at: "2026-10-13T10:00:00Z",
        },
      ],
    } as unknown as Proposal;
    render(<ProposalBuilderDialog open onClose={() => {}} opportunityId="o1" defaultCurrency="USD" proposal={proposal} onSaved={() => {}} />);
    expect((screen.getByLabelText("Payment terms in days") as HTMLInputElement).value).toBe("60");
    expect((screen.getByLabelText("Line 1 price covers") as HTMLSelectElement).value).toBe("per_month");
    expect((screen.getByLabelText("Custom clauses") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Save new version" }));
    await waitFor(() => expect(api.addProposalVersion).toHaveBeenCalled());
    const [id, body] = api.addProposalVersion.mock.calls[0]!;
    expect(id).toBe("p1");
    expect(body).toMatchObject({ term_months: 24, payment_terms_net_days: 60, free_credits: 1000, custom_clauses: true, non_standard_sla: false });
    expect(body.line_items[0]).toMatchObject({ price_basis: "per_month" });
  });
});
