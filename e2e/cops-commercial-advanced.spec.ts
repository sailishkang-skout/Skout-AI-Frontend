import { test, expect, type Page, type Route } from "@playwright/test";
import { gotoAppPage } from "./helpers";

/**
 * COPS-08 approvals and Finance screens. The API is mocked with the shapes the backend returns
 * (Skout-AI-Backend docs/tickets/copos-08-audit.md, section 11); the rules themselves are covered
 * by the backend route tests. The approval and e-sign panels on the Commercial Desk and the
 * subscription panel on the Billing tab are covered by component tests.
 */
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function mockApi(page: Page, permissions: string[]) {
  await page.route("**/api/v1/**", (route) => json(route, { data: [] }));
  await page.route("**/api/v1/me", (route) => json(route, { workspaceId: "ws", permissions }));
  await page.route("**/api/v1/cops/modules", (route) => json(route, { data: { crm: true, commercial: true, provisioning: true, onboarding: true, tickets: true, admin: true } }));
}

const terms = { currency: "USD", discount_pct: 25, seats: 10, contract_value_minor: 711_000, term_months: 12, free_credits: 0, payment_terms_net_days: 30, custom_clauses: false, non_standard_sla: false };
const approval = (financeDecision: "pending" | "approved" | "rejected", status = "pending", comment: string | null = null) => ({
  id: "11111111-1111-4111-8111-111111111111",
  opportunity_id: "22222222-2222-4222-8222-222222222222",
  opportunity_name: "Acme annual",
  account_id: "33333333-3333-4333-8333-333333333333",
  account_name: "Acme Labs",
  proposal_id: "44444444-4444-4444-8444-444444444444",
  proposal_version: 2,
  status,
  required_approvers: ["sales_manager", "finance"],
  matched_rules: [{ rule: "discount_pct", value: 25, approvers: ["sales_manager", "finance"] }],
  terms,
  requested_at: "2026-10-13T10:00:00Z",
  expires_at: "2026-10-27T10:00:00Z",
  status_reason: null,
  decisions: [
    { role: "sales_manager", decision: "approved", decided_by: "u1", decided_at: "2026-10-13T11:00:00Z", comment: "Fine for this account" },
    { role: "finance", decision: financeDecision, decided_by: financeDecision === "pending" ? null : "u2", decided_at: null, comment },
  ],
});

const subscription = {
  id: "55555555-5555-4555-8555-555555555555",
  account_id: "33333333-3333-4333-8333-333333333333",
  opportunity_id: "22222222-2222-4222-8222-222222222222",
  status: "restricted",
  billing: "payment_link",
  currency: "USD",
  cadence: "monthly",
  term_months: 12,
  term_start: "2026-09-01T00:00:00Z",
  renews_at: "2027-09-01T00:00:00Z",
  renewal_opportunity_id: null,
  seats: 10,
  items: [{ id: "i1", kind: "seats", quantity: 10, unit_amount_minor: 9480 }],
  invoices: [{ id: "66666666-6666-4666-8666-666666666666", period_start: "2026-10-01T00:00:00Z", period_end: "2026-11-01T00:00:00Z", due_at: "2026-10-01T00:00:00Z", amount_minor: 94_800, currency: "USD", status: "open", payment_request_id: null, paid_at: null }],
  amendments: [],
  dunning: { overdue_invoice_id: "66666666-6666-4666-8666-666666666666", due_at: "2026-10-01T00:00:00Z", day: 9, next_status: "suspended", next_status_at: "2026-10-16T00:00:00Z" },
};

test.describe("CustomerOps approvals and finance (COPS-08)", () => {
  test("an approver sees what is being approved and approves their own part", async ({ page }) => {
    await mockApi(page, ["commercial:read", "commercial:approve"]);
    let decided: Record<string, unknown> | null = null;
    await page.route("**/api/v1/approvals?status=pending", (route) => json(route, { data: decided ? [] : [approval("pending")] }));
    await page.route("**/api/v1/approvals/*/decisions", async (route) => {
      decided = route.request().postDataJSON();
      expect(route.request().headers()["idempotency-key"]).toBeTruthy();
      return json(route, { data: approval("approved", "approved") });
    });

    await gotoAppPage(page, "/approvals", "page-cops-approvals");
    const row = page.getByTestId("approval-11111111-1111-4111-8111-111111111111");
    await expect(row).toContainText("Acme annual");
    await expect(row).toContainText("Acme Labs");
    await expect(row).toContainText("Discount 25%");
    // The Sales Manager has already decided: only the Finance part still has buttons.
    await expect(row.getByTestId("decision-sales_manager").getByRole("button")).toHaveCount(0);
    await row.getByTestId("decision-finance").getByRole("button", { name: "Approve" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
    await expect(page.getByTestId("approvals-empty")).toBeVisible();
    expect(decided).toEqual({ role: "finance", decision: "approved" });
  });

  test("a rejection needs a comment, and a refusal from the API is shown in its own words", async ({ page }) => {
    await mockApi(page, ["commercial:read", "commercial:approve"]);
    let attempts = 0;
    await page.route("**/api/v1/approvals?status=pending", (route) => json(route, { data: [approval("pending")] }));
    await page.route("**/api/v1/approvals/*/decisions", (route) => {
      attempts += 1;
      return json(route, { code: "FORBIDDEN", message: "Only the finance role can decide this approval", details: { role: "finance" }, request_id: "r1", retryable: false }, 403);
    });

    await gotoAppPage(page, "/approvals", "page-cops-approvals");
    await page.getByTestId("decision-finance").getByRole("button", { name: "Reject" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Reject" })).toBeDisabled();
    await dialog.getByLabel("Comment").fill("Too deep for a ten seat deal");
    await dialog.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByTestId("decision-error")).toHaveText(/Only the finance role can decide this approval/);
    expect(attempts).toBe(1);
  });

  test("a role that cannot approve gets an explanation, not a raw error", async ({ page }) => {
    await mockApi(page, ["commercial:read"]);
    await page.route("**/api/v1/approvals?status=pending", (route) => json(route, { code: "FORBIDDEN", message: "Forbidden", details: {}, request_id: "r1", retryable: false }, 403));
    await gotoAppPage(page, "/approvals", "page-cops-approvals");
    await expect(page.getByTestId("approvals-error")).toContainText("visible to roles that can approve");
  });

  test("Finance sees an unpaid bill with what happens next, marks it paid with a reason, and the reconciliation queue", async ({ page }) => {
    await mockApi(page, ["billing:read", "billing:write"]);
    let marked: Record<string, unknown> | null = null;
    await page.route("**/api/v1/finance/failed-payments", (route) => json(route, { data: marked ? [] : [subscription] }));
    await page.route("**/api/v1/subscription-invoices/*/mark-paid", async (route) => {
      marked = route.request().postDataJSON();
      return json(route, { data: { ok: true } });
    });
    await page.route("**/api/v1/finance/reconciliation", (route) =>
      json(route, {
        data: {
          generated_at: "2026-10-13T12:00:00Z",
          counts: { envelope_contract_mismatch: 1 },
          issues: [{ kind: "envelope_contract_mismatch", entity_type: "signature_envelope", entity_id: "e1", provider_state: "signed", skout_state: "sent", detail: "mock says the envelope is signed; contract c1 is sent", since: "2026-10-13T09:00:00Z" }],
        },
      })
    );

    await gotoAppPage(page, "/finance", "page-cops-finance");
    const row = page.getByTestId(`failed-${subscription.id}`);
    await expect(row).toContainText("Restricted");
    await expect(row).toContainText("9 days overdue");
    await expect(row).toContainText("suspended on");
    await row.getByRole("button", { name: "Mark paid" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Mark paid" })).toBeDisabled();
    await dialog.getByLabel("Reason").fill("Wire received, ref 4471");
    await dialog.getByRole("button", { name: "Mark paid" }).click();
    await expect(page.getByTestId("finance-failed-empty")).toBeVisible();
    expect(marked).toEqual({ reason: "Wire received, ref 4471" });

    const tab = page.getByTestId("finance-tab-reconciliation");
    await expect(async () => {
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true", { timeout: 2000 });
    }).toPass({ timeout: 30_000 });
    await expect(page.getByTestId("finance-reconciliation-list")).toContainText("E-sign and contract disagree");
    await expect(page.getByTestId("finance-reconciliation-list")).toContainText("Provider: signed");
  });

  test("a read-only Finance role sees the queue without the write actions", async ({ page }) => {
    await mockApi(page, ["billing:read"]);
    await page.route("**/api/v1/finance/failed-payments", (route) => json(route, { data: [subscription] }));
    await gotoAppPage(page, "/finance", "page-cops-finance");
    const row = page.getByTestId(`failed-${subscription.id}`);
    await expect(row).toContainText("Restricted");
    await expect(row.getByRole("button", { name: "Mark paid" })).toHaveCount(0);
    await expect(row.getByRole("button", { name: "Copy payment link" })).toHaveCount(0);
  });
});
