import { test, expect, type Page, type Route } from "@playwright/test";
import { gotoAppPage } from "./helpers";

/**
 * COPS-08 approvals and Finance screens. The API is mocked with the shapes the backend returns
 * (Skout-AI-Backend docs/tickets/copos-08-audit.md, section 11); the rules themselves are covered
 * by the backend route tests. The second block walks the approval and e-sign panels on the
 * Commercial Desk and the subscription panel on the Billing tab, inside the account 360.
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

const ACCOUNT = "33333333-3333-4333-8333-333333333333";
const OPP = "22222222-2222-4222-8222-222222222222";
const PROPOSAL = "44444444-4444-4444-8444-444444444444";
const CONTRACT = "77777777-7777-4777-8777-777777777777";
const APPROVERS = ["sales_manager", "finance"];

/** The account 360 around the Commercial and Billing tabs. `documents` is read on every poll. */
async function mockAccount(page: Page, permissions: string[], documents: () => { proposals?: unknown[]; contracts?: unknown[] } = () => ({})) {
  await mockApi(page, permissions);
  const summary = () => ({
    opportunity: { id: OPP, name: "Acme annual", amount: "7110", currency: "USD", deal_type: "paid", status: "open", commercial_state: null },
    proposals: documents().proposals ?? [],
    contracts: documents().contracts ?? [],
    payment_requests: [],
    gate: { opportunity_id: OPP, deal_type: "paid", policy: "signature", policy_source: "deal_type", conditions: { trial_approved: false, signature_complete: false, payment_complete: false, overridden: false }, open: false, fired_at: null, trial_approved_at: null, override: null },
  });
  await page.route(`**/api/v1/account-360/${ACCOUNT}`, (route) => json(route, { data: { company: { id: ACCOUNT, name: "Acme Labs", domain: "acme.test" }, deals: [], signals: [], buyingCommittee: [], regionalIntelligence: null } }));
  await page.route(`**/api/v1/accounts/${ACCOUNT}/360**`, (route) =>
    json(route, {
      data: {
        header: { id: ACCOUNT, name: "Acme Labs", owner_id: null, lifecycle: { account: "customer", health: null, support: null }, health: null, commercial_state: null, onboarding_pct: null, plan: "paid", provisioning: null, renewal_at: null },
        contacts: [],
        next_actions: [],
        risks: [],
      },
    })
  );
  // The credit wallet shares the Billing tab with the subscription.
  await page.route(`**/api/v1/accounts/${ACCOUNT}/credits`, (route) => json(route, { data: { balance: 0, trial_ends_at: null, usage: [], next_cursor: null, ledger: [] } }));
  await page.route(`**/api/v1/accounts/${ACCOUNT}/commercial`, (route) => json(route, { data: [summary()] }));
  await page.route(`**/api/v1/opportunities/${OPP}/commercial`, (route) => json(route, { data: summary() }));
  await page.route(`**/api/v1/opportunities?company_id=${ACCOUNT}**`, (route) => json(route, { data: [{ id: OPP, name: "Acme annual", status: "open" }] }));
}

const open360 = (page: Page, tab: string, ready: string) => gotoAppPage(page, `/crm/360?mode=account&id=${ACCOUNT}&tab=${tab}`, ready);

test.describe("CustomerOps Commercial Desk and Billing tab (COPS-08)", () => {
  test("a proposal over a threshold cannot be sent until it is approved, and the decision shows without a reload", async ({ page }) => {
    let state: "needed" | "pending" | "approved" = "needed";
    let sent = false;
    const requests: unknown[] = [];
    const proposal = () => ({
      id: PROPOSAL,
      opportunity_id: OPP,
      title: "Acme annual plan",
      status: sent ? "sent" : "draft",
      current_version: 1,
      status_reason: null,
      status_changed_at: null,
      created_at: "2026-10-13T09:00:00Z",
      versions: [
        {
          id: "v1",
          version: 1,
          currency: "USD",
          billing_cadence: "annual",
          term_months: 12,
          discount_pct: 25,
          tax_pct: 0,
          notes: null,
          totals: { subtotal_minor: 948_000, discount_minor: 237_000, tax_minor: 0, total_minor: 711_000 },
          line_items: [],
          sent_at: sent ? "2026-10-13T12:00:00Z" : null,
          sent_by: null,
          content_hash: null,
          hash_valid: null,
          created_at: "2026-10-13T09:00:00Z",
        },
      ],
    });
    await mockAccount(page, ["crm:read", "commercial:read", "commercial:send"], () => ({ proposals: [proposal()] }));
    await page.route(`**/api/v1/proposals/${PROPOSAL}/approvals/evaluate`, (route) =>
      json(route, {
        data: {
          proposal_id: PROPOSAL,
          proposal_version: 1,
          currency: "USD",
          terms,
          required_approvers: APPROVERS,
          matched_rules: [{ rule: "discount_pct", value: 25, approvers: APPROVERS }],
          unevaluated: [],
          grandfathered: false,
          required: true,
          satisfied: state === "approved",
          approval: state === "needed" ? null : approval(state === "approved" ? "approved" : "pending", state === "approved" ? "approved" : "pending"),
        },
      })
    );
    await page.route(`**/api/v1/proposals/${PROPOSAL}/approvals`, (route) => {
      requests.push(route.request().postDataJSON());
      state = "pending";
      return json(route, { data: approval("pending") }, 201);
    });
    await page.route(`**/api/v1/proposals/${PROPOSAL}/send`, (route) => {
      if (state !== "approved") {
        return json(route, { code: "BUSINESS_STATE_CONFLICT", message: "This proposal needs approval before it can be sent", details: { required_approvers: APPROVERS, approval_status: state === "pending" ? "pending" : "none" }, request_id: "r1", retryable: false }, 409);
      }
      sent = true;
      return json(route, { data: proposal() });
    });

    await open360(page, "commercial", "commercial-documents");
    const panel = page.getByTestId(`approval-panel-${PROPOSAL}`);
    await expect(panel).toHaveAttribute("data-state", "needed");
    await expect(panel).toContainText("Needs approval from Sales Manager, Finance");

    // Sending anyway is refused by the API, and the refusal says who has to approve.
    await page.getByRole("button", { name: "Send v1" }).click();
    await expect(page.getByText("Needs approval from Sales Manager, Finance first.")).toBeVisible();

    await panel.getByRole("button", { name: "Request approval" }).click();
    await expect(panel).toHaveAttribute("data-state", "pending");
    await expect(panel).toContainText("Waiting for Finance");
    await expect(panel).toContainText("Approved by Sales Manager");
    expect(requests).toHaveLength(1);

    // Finance approves somewhere else; the desk picks it up on its own poll.
    state = "approved";
    await expect(panel).toHaveAttribute("data-state", "approved", { timeout: 30_000 });
    await page.getByRole("button", { name: "Send v1" }).click();
    await expect(page.getByText("Proposal sent")).toBeVisible();
  });

  test("a contract is sent for signature and the signature arrives on its own", async ({ page }) => {
    let envelope: "none" | "sent" | "signed" = "none";
    let body: unknown = null;
    const signers = [{ name: "Priya Rao", email: "priya@acme.test" }];
    const contract = () => ({
      id: CONTRACT,
      opportunity_id: OPP,
      proposal_id: null,
      kind: "msa",
      title: "Acme MSA",
      status: envelope === "signed" ? "signed" : "sent",
      current_version: 2,
      status_reason: null,
      redline_status: "agreed",
      status_changed_at: "2026-10-13T12:00:00Z",
      signed_at: envelope === "signed" ? "2026-10-13T15:00:00Z" : null,
      created_at: "2026-10-12T09:00:00Z",
      versions: [
        { id: "cv1", version: 1, document_url: "https://files.test/msa-v1.pdf", file_name: "msa-v1.pdf", file_sha256: "a".repeat(64), sent_at: null, created_at: "2026-10-12T09:00:00Z" },
        { id: "cv2", version: 2, document_url: "https://files.test/msa-v2.pdf", file_name: "msa-v2.pdf", file_sha256: "b".repeat(64), sent_at: "2026-10-13T12:00:00Z", created_at: "2026-10-13T11:00:00Z" },
      ],
    });
    const event = (status: string, at: string) => ({ event_type: `signature_request_${status}`, status, occurred_at: at, received_at: at, outcome: "applied" });
    const envelopeRow = () => ({
      id: "88888888-8888-4888-8888-888888888888",
      contract_id: CONTRACT,
      contract_version: 2,
      provider: "mock",
      status: envelope,
      template_key: null,
      signers,
      sent_at: "2026-10-13T12:05:00Z",
      status_changed_at: "2026-10-13T12:05:00Z",
      events: envelope === "signed" ? [event("sent", "2026-10-13T12:05:00Z"), event("signed", "2026-10-13T15:00:00Z")] : [event("sent", "2026-10-13T12:05:00Z")],
    });
    await mockAccount(page, ["crm:read", "commercial:read", "commercial:send"], () => ({ contracts: [contract()] }));
    await page.route(`**/api/v1/contracts/${CONTRACT}/envelopes`, (route) => {
      if (route.request().method() === "POST") {
        body = route.request().postDataJSON();
        envelope = "sent";
        return json(route, { data: envelopeRow() }, 201);
      }
      return json(route, { data: envelope === "none" ? [] : [envelopeRow()] });
    });

    await open360(page, "commercial", "commercial-documents");
    const panel = page.getByTestId(`envelope-panel-${CONTRACT}`);
    await expect(panel).toContainText("Not sent for signature yet");
    await expect(page.getByTestId("redline-status")).toBeVisible();

    await panel.getByRole("button", { name: "Send for signature" }).click();
    const dialog = page.getByRole("dialog");
    // The version being signed is named, so nobody sends an older draft by mistake.
    await expect(dialog).toContainText("v2 for signature");
    const submit = dialog.getByRole("button", { name: "Send for signature" });
    await expect(submit).toBeDisabled();
    await dialog.getByRole("textbox", { name: "Signer 1 name" }).fill("Priya Rao");
    await dialog.getByRole("textbox", { name: "Signer 1 email" }).fill("priya-at-acme");
    await expect(submit).toBeDisabled();
    await dialog.getByRole("textbox", { name: "Signer 1 email" }).fill("priya@acme.test");
    await submit.click();
    await expect(dialog).toBeHidden();
    expect(body).toEqual({ signers });

    await expect(panel.getByTestId("envelope-status")).toHaveText("Out for signature");
    await expect(panel).toContainText("v2 · Priya Rao");
    // One envelope at a time: it cannot be sent again while it is out.
    await expect(panel.getByRole("button", { name: "Send for signature" })).toHaveCount(0);

    // The customer signs; the provider's event reaches the screen on the next poll.
    envelope = "signed";
    await expect(panel.getByTestId("envelope-timeline")).toContainText("Signed", { timeout: 30_000 });
    await expect(panel.getByTestId("envelope-status")).not.toHaveText("Out for signature");
  });

  test("the Billing tab shows an unpaid subscription with what happens next, and a seat change is recorded as an amendment", async ({ page }) => {
    let amended: Record<string, unknown> | null = null;
    const starts = new Date(Date.now() + 20 * 86_400_000).toISOString();
    const current = () => ({
      ...subscription,
      amendments: amended
        ? [{ id: "a1", seq: 1, seats: 15, term_months: null, reason: amended.reason, effective_at: starts, before: { seats: 10, term_months: 12, renews_at: subscription.renews_at }, after: { seats: 15, term_months: 12, renews_at: subscription.renews_at }, created_at: new Date().toISOString() }]
        : [],
    });
    await mockAccount(page, ["crm:read", "commercial:read", "billing:read", "billing:write"]);
    await page.route(`**/api/v1/accounts/${ACCOUNT}/subscription`, (route) => json(route, { data: current() }));
    await page.route(`**/api/v1/subscriptions/${subscription.id}/amendments`, (route) => {
      amended = route.request().postDataJSON();
      return json(route, { data: current() }, 201);
    });

    await open360(page, "billing", "subscription-panel");
    const panel = page.getByTestId("subscription-panel");
    await expect(panel.getByTestId("subscription-status")).toHaveText("Restricted");
    await expect(panel.getByTestId("subscription-dunning")).toContainText("9 days overdue · suspended on");
    await expect(panel.getByTestId("subscription-invoices").getByRole("button", { name: "Mark paid" })).toBeVisible();

    await panel.getByRole("button", { name: "Change seats or term" }).click();
    const dialog = page.getByRole("dialog");
    const record = dialog.getByRole("button", { name: "Record amendment" });
    await dialog.getByRole("textbox", { name: "New seat count" }).fill("15");
    // A change with no reason cannot be recorded.
    await expect(record).toBeDisabled();
    await dialog.getByRole("textbox", { name: "Reason" }).fill("Five more reps from November");
    await record.click();
    await expect(dialog).toBeHidden();
    expect(amended).toEqual({ seats: 15, reason: "Five more reps from November" });

    // It starts with the next period: shown as pending, and added to the history.
    await expect(panel.getByTestId("subscription-pending-change")).toContainText("15 seats from");
    await expect(panel.getByTestId("subscription-amendments")).toContainText("10 to 15 seats");
  });

  test("a role that can only read billing sees the subscription without the write actions", async ({ page }) => {
    await mockAccount(page, ["crm:read", "commercial:read", "billing:read"]);
    await page.route(`**/api/v1/accounts/${ACCOUNT}/subscription`, (route) => json(route, { data: subscription }));
    await open360(page, "billing", "subscription-panel");
    const panel = page.getByTestId("subscription-panel");
    await expect(panel.getByTestId("subscription-invoices")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Change seats or term" })).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Mark paid" })).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Copy payment link" })).toHaveCount(0);
  });
});
