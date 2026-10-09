import { test, expect, type Page, type Route } from "@playwright/test";
import { gotoAppPage } from "./helpers";

/**
 * COPS-07 Phase 1 golden paths in the browser (Bible p.90): free trial, paid deal, failed payment,
 * stalled onboarding, ticket escalation. Each test walks the screens a rep uses, in order.
 *
 * The API is mocked with the contract shapes, and the mock keeps state between calls so a step's
 * result is what the next screen reads. The same five paths run against the real API and database
 * in the backend (apps/api/src/routes/cops-golden-paths.routes.test.ts).
 */
const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const OPP = "22222222-2222-4222-8222-222222222222";
const TICKET = "66666666-6666-4666-8666-666666666666";
const PERMS = [
  "crm:read", "crm:write", "commercial:read", "commercial:send", "commercial:approve", "onboarding:read", "onboarding:write", "onboarding:send",
  "credits:read", "tickets:read", "tickets:write", "tickets:send",
];

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

type Policy = "trial_approval_only" | "payment";
interface World {
  policy: Policy;
  firedAt: string | null;
  payments: Record<string, unknown>[];
  provisioned: boolean;
  emails: Record<string, unknown>[];
  blockers: Record<string, unknown>[];
  ticket: Record<string, unknown> | null;
  calls: Record<string, unknown[]>;
}

const newWorld = (policy: Policy): World => ({ policy, firedAt: null, payments: [], provisioned: false, emails: [], blockers: [], ticket: null, calls: {} });

const paymentRequest = (status: string) => ({
  id: "77777777-7777-4777-8777-777777777777",
  opportunity_id: OPP,
  proposal_id: null,
  amount_minor: 50_000,
  currency: "INR",
  description: "Annual plan",
  status,
  provider: "razorpay",
  provider_ref: "plink_golden",
  checkout_url: "https://rzp.io/i/plink_golden",
  paid_at: status === "paid" ? "2026-10-09T10:05:00Z" : null,
  expires_at: null,
  status_changed_at: "2026-10-09T10:05:00Z",
  created_at: "2026-10-09T10:00:00Z",
});

const provisioning = () => ({
  id: "33333333-3333-4333-8333-333333333333",
  account_id: ACCOUNT,
  opportunity_id: OPP,
  status: "succeeded",
  plan: "trial",
  trial_starts_at: "2026-10-09T10:00:00Z",
  trial_ends_at: new Date(Date.now() + 12 * 86_400_000).toISOString(),
  duration_ms: 4200,
  within_target: true,
  last_error: null,
  provisioned_workspace_id: "44444444-4444-4444-8444-444444444444",
  admin_invite: { email: "admin@acme.test", accepted_at: null, accept_url: null, email_sent: true },
  integrations: ["crm", "email"],
  credits: 500,
  steps: ["create_workspace", "default_roles", "entitlements", "credit_wallet", "integration_placeholders", "admin_invite", "link_crm"].map((s) => ({
    step: s,
    status: "succeeded",
    attempts: 1,
    error: null,
    duration_ms: 20,
    finished_at: "2026-10-09T10:00:05Z",
  })),
});

const email = () => ({
  id: "e1",
  account_id: ACCOUNT,
  contact_id: "c1",
  to: "admin@acme.test",
  template_key: "welcome_trial",
  template_version: 1,
  subject: "Your Skout AI trial is ready",
  status: "sent",
  is_resend: false,
  reason: null,
  error: null,
  opened_at: null,
  clicked_at: null,
  sent_at: "2026-10-09T10:10:00Z",
  created_at: "2026-10-09T10:10:00Z",
});

const ticket = (severity: string, status = "new") => ({
  id: TICKET,
  account_id: ACCOUNT,
  contact_id: null,
  opportunity_id: null,
  milestone_id: null,
  title: "Acme Ltd: customer has not signed in",
  description: null,
  category: "onboarding",
  severity,
  priority: "p2",
  impact: "Onboarding is blocked for this account",
  affected_feature: null,
  environment: "production",
  repro_steps: null,
  log_refs: [],
  diagnostics: { blocker: "delivered_no_login", activation_pct: 0 },
  status,
  team: null,
  assignee_id: null,
  account_tier: "smb",
  escalated_at: severity === "critical" ? "2026-10-11T09:00:00Z" : null,
  resolved_at: null,
  created_at: "2026-10-11T08:00:00Z",
  updated_at: "2026-10-11T08:00:00Z",
});

/** One stateful mock of the CustomerOps API. The catch-all goes first; later routes win. */
async function mockWorld(page: Page, w: World) {
  /** Records the body. Create-style writes must carry an Idempotency-Key; escalate is not keyed by design. */
  const record = (name: string, route: Route, keyed = true) => {
    (w.calls[name] ??= []).push(route.request().postDataJSON());
    if (keyed) expect(route.request().headers()["idempotency-key"], `${name} sends an Idempotency-Key`).toBeTruthy();
  };
  const gate = () => ({
    opportunity_id: OPP,
    deal_type: w.policy === "payment" ? "paid" : "trial",
    policy: w.policy,
    policy_source: "deal_type",
    conditions: { trial_approved: w.policy === "trial_approval_only" && Boolean(w.firedAt), signature_complete: false, payment_complete: w.payments.some((p) => p.status === "paid"), overridden: false },
    open: Boolean(w.firedAt),
    fired_at: w.firedAt,
    trial_approved_at: w.policy === "trial_approval_only" ? w.firedAt : null,
    override: null,
  });
  const summary = () => ({
    opportunity: { id: OPP, name: "Acme annual", amount: "500", currency: "INR", deal_type: gate().deal_type, status: "open", commercial_state: w.payments.length ? (w.firedAt ? "complete" : "payment_pending") : null },
    proposals: [],
    contracts: [],
    payment_requests: w.payments,
    gate: gate(),
  });
  const onboarding = () => ({
    account_id: ACCOUNT,
    trial_ends_at: provisioning().trial_ends_at,
    trial_days_left: 12,
    activation: {
      instance_id: "i1",
      template_key: "default_trial",
      template_version: 1,
      activation_pct: 0,
      activated_at: null,
      first_login_at: null,
      milestones: [
        { key: "crm_connected", label: "CRM connected", weight: 35, required: true, source: "event", completed_at: null, evidence: null },
        { key: "first_search", label: "First search", weight: 30, required: true, source: "event", completed_at: null, evidence: null },
        { key: "first_export", label: "First export", weight: 35, required: true, source: "event", completed_at: null, evidence: null },
      ],
    },
    follow_up: w.emails.length
      ? { mode: "task", task_reason: "no_default_sequence", enrollment: null, task: { id: "t1", title: "Follow up on the onboarding email", due_at: new Date(Date.now() + 86_400_000).toISOString(), status: "open" } }
      : null,
    emails: w.emails,
    blockers: w.blockers,
    handoff: null,
    integrations: [
      { key: "crm", status: "not_connected", detail: null },
      { key: "email", status: "not_connected", detail: null },
      { key: "calendar", status: "not_available", detail: "Calendar connections are not tracked yet" },
    ],
  });

  await page.route("**/api/v1/**", (route) => json(route, { data: [] }));
  await page.route("**/api/v1/me", (route) => json(route, { workspaceId: "ws", permissions: PERMS }));
  await page.route("**/api/v1/cops/modules", (route) => json(route, { data: { crm: true, commercial: true, provisioning: true, onboarding: true, tickets: true, admin: true } }));
  await page.route(`**/api/v1/account-360/${ACCOUNT}`, (route) =>
    json(route, { data: { company: { id: ACCOUNT, name: "Acme Ltd", domain: "acme.test" }, deals: [], signals: [], buyingCommittee: [], regionalIntelligence: null } })
  );
  await page.route(`**/api/v1/accounts/${ACCOUNT}/360**`, (route) =>
    json(route, {
      data: {
        header: { id: ACCOUNT, name: "Acme Ltd", owner_id: null, lifecycle: { account: "trial", health: null, support: null }, health: null, commercial_state: summary().opportunity.commercial_state, onboarding_pct: w.provisioned ? 0 : null, plan: "trial", provisioning: null, renewal_at: null },
        contacts: [],
        next_actions: [],
        risks: [],
      },
    })
  );
  await page.route(`**/api/v1/accounts/${ACCOUNT}/commercial`, (route) => json(route, { data: [summary()] }));
  await page.route(`**/api/v1/opportunities/${OPP}/commercial`, (route) => json(route, { data: summary() }));
  await page.route(`**/api/v1/opportunities?company_id=${ACCOUNT}**`, (route) => json(route, { data: [{ id: OPP, name: "Acme annual", status: "open" }] }));
  await page.route(`**/api/v1/opportunities/${OPP}/gate/approve-trial`, (route) => {
    record("approve-trial", route);
    w.firedAt = "2026-10-09T10:01:00Z";
    return json(route, { data: { ...gate(), fired_now: true } });
  });
  await page.route("**/api/v1/payment-requests", (route) => {
    record("payment-request", route);
    w.payments = [paymentRequest("requested")];
    return json(route, { data: w.payments[0] }, 201);
  });
  await page.route(`**/api/v1/accounts/${ACCOUNT}/provisioning`, (route) => json(route, { data: w.provisioned ? [provisioning()] : [] }));
  await page.route(`**/api/v1/accounts/${ACCOUNT}/provision`, (route) => {
    record("provision", route);
    if (!w.firedAt) {
      return json(route, { code: "GATE_CLOSED", message: "The commercial gate for this opportunity has not opened yet", details: {}, request_id: "r1", retryable: false }, 409);
    }
    w.provisioned = true;
    return json(route, { data: provisioning() }, 201);
  });
  await page.route(`**/api/v1/accounts/${ACCOUNT}/credits**`, (route) => json(route, { data: { balance: 500, trial_ends_at: provisioning().trial_ends_at, usage: [], ledger: [], next_cursor: null } }));
  await page.route(`**/api/v1/accounts/${ACCOUNT}/onboarding`, (route) => json(route, { data: onboarding() }));
  await page.route(`**/api/v1/accounts/${ACCOUNT}/onboarding/preview`, (route) =>
    json(route, { data: { template_key: "welcome_trial", template_version: 1, to: "admin@acme.test", subject: "Your Skout AI trial is ready", html: "<p>Open your workspace</p>", text: "Open your workspace", blocked: null } })
  );
  await page.route(`**/api/v1/accounts/${ACCOUNT}/onboarding/send`, (route) => {
    record("onboarding-send", route);
    w.emails = [email()];
    return json(route, { data: w.emails[0] }, 201);
  });
  await page.route(`**/api/v1/accounts/${ACCOUNT}/tickets`, (route) =>
    json(route, { data: w.ticket ? { summary: { open_count: 1, max_severity: w.ticket.severity }, tickets: [{ ...w.ticket, account_name: "Acme Ltd", assignee_email: null }] } : { summary: { open_count: 0, max_severity: null }, tickets: [] } })
  );
  await page.route("**/api/v1/tickets/prefill**", (route) => {
    (w.calls.prefill ??= []).push(new URL(route.request().url()).search);
    return json(route, {
      data: { account_id: ACCOUNT, contact_id: null, milestone_id: null, title: "Acme Ltd: customer has not signed in", category: "onboarding", severity: "high", priority: "p2", impact: "Onboarding is blocked for this account", affected_feature: null, environment: "production", diagnostics: { blocker: "delivered_no_login", activation_pct: 0 } },
    });
  });
  await page.route(
    (url) => url.pathname.endsWith("/api/v1/tickets"),
    (route) => {
      if (route.request().method() !== "POST") return json(route, { data: w.ticket ? [{ ...w.ticket, account_name: "Acme Ltd", assignee_email: null }] : [], next_cursor: null });
      record("ticket-create", route);
      w.ticket = ticket("high");
      return json(route, { data: w.ticket, summary: { open_count: 1, max_severity: "high" } }, 201);
    }
  );
  await page.route(`**/api/v1/tickets/${TICKET}`, (route) =>
    json(route, {
      data: {
        ...(w.ticket ?? ticket("high")),
        context: { account: { id: ACCOUNT, name: "Acme Ltd", domain: "acme.test", tier: "smb" }, contact: null, opportunity: null, milestone: null, summary: { open_count: 1, max_severity: w.ticket?.severity ?? "high" } },
        comments: [],
        history: [],
      },
    })
  );
  await page.route(`**/api/v1/tickets/${TICKET}/escalate`, (route) => {
    record("ticket-escalate", route, false);
    w.ticket = ticket("critical", "triage");
    return json(route, { data: w.ticket, summary: { open_count: 1, max_severity: "critical" } });
  });
}

const open360 = (page: Page, tab: string, ready: string) => gotoAppPage(page, `/crm/360?mode=account&id=${ACCOUNT}&tab=${tab}`, ready);

async function provisionFromOnboardingTab(page: Page) {
  await open360(page, "onboarding", "cops-customer-360");
  await page.getByTestId("open-provision").click();
  await page.getByLabel("Admin email").fill("admin@acme.test");
  await page.getByTestId("provision-submit").click();
}

test.describe("CustomerOps Phase 1 golden paths (COPS-07)", () => {
  test("free trial: approve, provision, send the onboarding email, and a next action exists", async ({ page }) => {
    const w = newWorld("trial_approval_only");
    await mockWorld(page, w);

    await open360(page, "commercial", "commercial-tab-commercial");
    await expect(page.getByTestId("gate-status")).toHaveText("Waiting");
    await page.getByTestId("gate-card").getByRole("button", { name: "Approve trial" }).click();
    await page.getByLabel("Reason").fill("Pilot approved by the sales manager");
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByTestId("gate-status")).toHaveText("Provisioning requested");
    expect(w.calls["approve-trial"]).toEqual([{ reason: "Pilot approved by the sales manager" }]);

    await provisionFromOnboardingTab(page);
    await expect(page.getByTestId("provision-dialog").getByText(/Workspace ready in .* Invitation sent to admin@acme.test/)).toBeVisible();
    expect(w.calls.provision).toHaveLength(1);

    await open360(page, "onboarding", "onboarding-control");
    await expect(page.getByTestId("activation-pct")).toContainText("0%");
    await page.getByTestId("open-onboarding-email").click();
    const dialog = page.getByTestId("onboarding-email-dialog");
    await expect(dialog).toContainText("To admin@acme.test");
    await page.getByTestId("onboarding-email-send").click();
    await expect(dialog).toBeHidden();
    expect(w.calls["onboarding-send"]).toHaveLength(1);
    expect((w.calls["onboarding-send"]![0] as { resend?: boolean }).resend).toBeUndefined();
    // The onboarding email always leaves a next action behind.
    await expect(page.getByTestId("follow-up-card")).toContainText("Follow up on the onboarding email");
    await expect(page.getByTestId("onboarding-emails")).toContainText("Your Skout AI trial is ready");
  });

  test("paid deal: a payment link is created, and when it is paid the gate opens on screen without a reload", async ({ page }) => {
    const w = newWorld("payment");
    await mockWorld(page, w);

    await open360(page, "commercial", "commercial-tab-commercial");
    await expect(page.getByTestId("gate-status")).toHaveText("Waiting");
    await page.getByRole("button", { name: "Payment link" }).click();
    await page.getByLabel("Amount").fill("500");
    await page.getByRole("button", { name: "Create link" }).click();
    await expect(page.getByTestId("payment-link-created")).toContainText("Link created");
    await page.getByRole("button", { name: "Done" }).click();
    expect(w.calls["payment-request"]![0]).toMatchObject({ opportunity_id: OPP, amount_minor: 50_000 });
    await expect(page.getByTestId("commercial-tab-commercial")).toContainText("requested");

    // The provider's webhook marks it paid on the server; the tab picks that up by polling.
    w.payments = [paymentRequest("paid")];
    w.firedAt = "2026-10-09T10:05:00Z";
    await expect(page.getByTestId("gate-status")).toHaveText("Provisioning requested", { timeout: 25_000 });
    await expect(page.getByTestId("commercial-tab-commercial")).toContainText("paid");

    await provisionFromOnboardingTab(page);
    await expect(page.getByTestId("provision-dialog").getByText(/Workspace ready/)).toBeVisible();
  });

  test("failed payment: the payment shows as failed, the gate stays closed and provisioning is refused", async ({ page }) => {
    const w = newWorld("payment");
    w.payments = [paymentRequest("failed")];
    await mockWorld(page, w);

    await open360(page, "commercial", "commercial-tab-commercial");
    await expect(page.getByTestId("gate-status")).toHaveText("Waiting");
    await expect(page.getByTestId("commercial-tab-commercial")).toContainText("failed");
    await expect(page.getByTestId("gate-card")).not.toContainText("Provisioning requested");

    await provisionFromOnboardingTab(page);
    await expect(page.getByTestId("provision-dialog")).toContainText("commercial gate has not opened yet");
    await expect(page.getByTestId("provision-dialog").getByText(/Workspace ready/)).toHaveCount(0);
    expect(w.provisioned).toBe(false);
  });

  test("stalled onboarding: the blocker is on the account, and the rep's queue shows who to call", async ({ page }) => {
    const w = newWorld("trial_approval_only");
    Object.assign(w, { firedAt: "2026-10-09T10:01:00Z", provisioned: true, emails: [email()], blockers: [{ kind: "delivered_no_login", detail: "Delivered, no sign-in for 24 hours", since: "2026-10-10T10:10:00Z", task_id: "t2" }] });
    await mockWorld(page, w);
    let action: Record<string, unknown> = {};
    await page.route("**/api/v1/follow-up/queue**", (route) =>
      json(route, {
        data: [
          { id: "signal:s1", reason: "stalled_milestone", priority: 2, account: { id: ACCOUNT, name: "Acme Ltd" }, contact: { id: "c1", name: "Ada", email: "admin@acme.test" }, active_sequence: null, last_touch_at: "2026-10-09T10:10:00Z", signals: ["stalled_milestone"], recommended_action: { kind: "call", label: "Call: no sign-in since the welcome email" }, due_at: "2026-10-10T10:10:00Z", detail: "Delivered, no sign-in for 24 hours" },
        ],
        next_cursor: null,
      })
    );
    await page.route("**/api/v1/follow-up/actions", (route) => {
      action = route.request().postDataJSON();
      return json(route, { data: { activity_id: "act1", task_id: null, meeting_id: null } }, 201);
    });

    await open360(page, "onboarding", "onboarding-control");
    await expect(page.getByTestId("activation-pct")).toContainText("0%");
    await expect(page.getByTestId("onboarding-blockers")).toContainText("No sign-in after the email");

    await gotoAppPage(page, "/follow-up", "page-cops-follow-up");
    const row = page.getByTestId("follow-up-row");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Acme Ltd");
    // The queue recommends the action; the rep takes it in one click.
    await expect(row.getByTestId("follow-up-recommended")).toContainText("Call: no sign-in since the welcome email");
    await row.getByTestId("follow-up-recommended").click();
    await page.getByTestId("follow-up-action-dialog").getByLabel("Outcome").fill("Left a voicemail");
    await page.getByTestId("follow-up-action-submit").click();
    await expect(page.getByTestId("follow-up-action-dialog")).toBeHidden();
    expect(action).toMatchObject({ kind: "call", account_id: ACCOUNT, queue_item_id: "signal:s1", outcome: "Left a voicemail" });
  });

  test("ticket escalation: a ticket from the onboarding blocker reaches the queue and is escalated to critical", async ({ page }) => {
    const w = newWorld("trial_approval_only");
    Object.assign(w, { firedAt: "2026-10-09T10:01:00Z", provisioned: true, emails: [email()], blockers: [{ kind: "delivered_no_login", detail: "Delivered, no sign-in for 24 hours", since: "2026-10-10T10:10:00Z", task_id: "t2" }] });
    await mockWorld(page, w);

    await open360(page, "onboarding", "onboarding-control");
    await page.getByTestId("escalate-engineering").first().click();
    const create = page.getByTestId("create-ticket-dialog");
    await expect(create.getByLabel("Title")).toHaveValue("Acme Ltd: customer has not signed in");
    await expect(create.getByTestId("ticket-safe-diagnostics")).toContainText("blocker");
    await create.getByTestId("create-ticket-submit").click();
    await expect(create).toBeHidden();
    expect(w.calls["ticket-create"]![0]).toMatchObject({ account_id: ACCOUNT, severity: "high", diagnostics: { blocker: "delivered_no_login" } });

    await gotoAppPage(page, "/engineering", "page-cops-engineering");
    await expect(page.getByTestId("engineering-row")).toContainText("customer has not signed in");
    await page.getByTestId("engineering-row").getByRole("button").click();
    const drawer = page.getByTestId("ticket-drawer");
    await expect(drawer.getByTestId("ticket-customer-context")).toContainText("Acme Ltd");
    await drawer.getByLabel("Escalate to").selectOption("critical");
    await drawer.getByLabel("Escalation reason").fill("Go-live is blocked");
    await drawer.getByTestId("ticket-escalate").click();
    await expect.poll(() => w.calls["ticket-escalate"]?.length ?? 0).toBe(1);
    expect(w.calls["ticket-escalate"]![0]).toEqual({ severity: "critical", reason: "Go-live is blocked" });
    await expect(drawer).toContainText(/critical/i);
  });
});
