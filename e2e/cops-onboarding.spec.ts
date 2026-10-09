import { test, expect, type Page, type Route } from "@playwright/test";
import { gotoAppPage } from "./helpers";

/**
 * COPS-05 golden flows: Onboarding Control on Customer 360, the onboarding-email dialog, and the
 * Sales Follow-up queue. The API is mocked with the shapes in docs/api/copos-05-onboarding.openapi.yaml;
 * the backend behaviour is covered by its route and service tests.
 */
const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const ENROLLMENT = "55555555-5555-4555-8555-555555555555";
const PERMS = ["crm:read", "crm:write", "commercial:read", "commercial:send", "onboarding:read", "onboarding:write", "onboarding:send", "credits:read"];

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const provisioning = {
  id: "33333333-3333-4333-8333-333333333333",
  account_id: ACCOUNT,
  opportunity_id: "22222222-2222-4222-8222-222222222222",
  status: "succeeded",
  plan: "trial",
  trial_starts_at: "2026-10-08T10:00:00Z",
  trial_ends_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
  duration_ms: 4200,
  within_target: true,
  last_error: null,
  provisioned_workspace_id: "44444444-4444-4444-8444-444444444444",
  admin_invite: { email: "ada@acme.test", accepted_at: "2026-10-08T11:00:00Z", accept_url: null },
  integrations: ["crm", "email"],
  credits: 500,
  steps: [],
};

function onboardingState(enrollmentStatus = "active") {
  return {
    account_id: ACCOUNT,
    trial_ends_at: provisioning.trial_ends_at,
    trial_days_left: 5,
    activation: {
      instance_id: "i1",
      template_key: "default_trial",
      template_version: 1,
      activation_pct: 65,
      activated_at: null,
      first_login_at: "2026-10-08T12:00:00Z",
      milestones: [
        { key: "crm_connected", label: "CRM connected", weight: 35, required: true, source: "event", completed_at: "2026-10-08T13:00:00Z", evidence: { source_type: "integration.crm_connected", provider: "hubspot" } },
        { key: "first_search", label: "First search", weight: 30, required: true, source: "event", completed_at: "2026-10-08T14:00:00Z", evidence: { source_type: "product.search" } },
        { key: "first_export", label: "First export", weight: 35, required: true, source: "event", completed_at: null, evidence: null },
        { key: "success_review", label: "Success review completed", weight: 0, required: false, source: "manual", completed_at: null, evidence: null },
      ],
    },
    follow_up: {
      mode: "sequence",
      task_reason: null,
      enrollment: { id: ENROLLMENT, sequence_id: "s1", template_version: 1, status: enrollmentStatus, stop_reason: null, current_step: 3, next_action: { kind: "task", scheduled_at: new Date(Date.now() + 86_400_000).toISOString() } },
      task: null,
    },
    emails: [
      { id: "e1", account_id: ACCOUNT, contact_id: "c1", to: "ada@acme.test", template_key: "welcome_trial", template_version: 1, subject: "Your Skout AI trial is ready", status: "delivered", is_resend: false, reason: null, error: null, opened_at: "2026-10-08T11:30:00Z", clicked_at: null, sent_at: "2026-10-08T11:00:00Z", created_at: "2026-10-08T11:00:00Z" },
    ],
    blockers: [{ kind: "login_no_value", detail: "Signed in, no first result", since: "2026-10-08T15:00:00Z", task_id: "t9" }],
    handoff: null,
    integrations: [
      { key: "crm", status: "connected", detail: "hubspot" },
      { key: "email", status: "error", detail: "ada@acme.test paused" },
      { key: "calendar", status: "not_available", detail: "Calendar connections are not tracked yet" },
    ],
  };
}

async function mockApi(page: Page) {
  await page.route("**/api/v1/**", (route) => json(route, { data: [] }));
  await page.route("**/api/v1/me", (route) => json(route, { workspaceId: "ws", permissions: PERMS }));
  await page.route(`**/api/v1/account-360/${ACCOUNT}`, (route) =>
    json(route, { data: { company: { id: ACCOUNT, name: "Acme Ltd", domain: "acme.test" }, deals: [], signals: [], buyingCommittee: [], regionalIntelligence: null } })
  );
  await page.route(`**/api/v1/accounts/${ACCOUNT}/360**`, (route) =>
    json(route, { data: { header: { id: ACCOUNT, name: "Acme Ltd", owner_id: null, lifecycle: { account: "trial", health: null, support: null }, health: null, commercial_state: null, onboarding_pct: 65, plan: "trial", provisioning: null, renewal_at: null }, contacts: [], next_actions: [], risks: [] } })
  );
  await page.route(`**/api/v1/accounts/${ACCOUNT}/provisioning`, (route) => json(route, { data: [provisioning] }));
  await page.route(`**/api/v1/accounts/${ACCOUNT}/credits**`, (route) => json(route, { data: { balance: 430, trial_ends_at: provisioning.trial_ends_at, usage: [], ledger: [], next_cursor: null } }));
}

const openOnboarding = (page: Page) => gotoAppPage(page, `/crm/360?mode=account&id=${ACCOUNT}&tab=onboarding`, "onboarding-control");

test.describe("CustomerOps onboarding (COPS-05)", () => {
  test("Onboarding Control shows activation with evidence, the follow-up step, blockers and email tracking", async ({ page }) => {
    await mockApi(page);
    await page.route(`**/api/v1/accounts/${ACCOUNT}/onboarding`, (route) => json(route, { data: onboardingState() }));
    await openOnboarding(page);
    await expect(page.getByTestId("activation-pct")).toContainText("65%");
    await expect(page.getByTestId("trial-timer")).toContainText(/[45]/);
    await expect(page.getByTestId("milestone-crm_connected")).toContainText("hubspot connected");
    await expect(page.getByTestId("follow-up-status")).toHaveText("active");
    await expect(page.getByTestId("follow-up-card")).toContainText("Step 3");
    await expect(page.getByTestId("onboarding-blockers")).toContainText("Signed in, no first result");
    await expect(page.getByTestId("onboarding-emails")).toContainText("opened");
    await expect(page.getByTestId("integration-crm")).toContainText("connected");
    await expect(page.getByTestId("integration-email")).toContainText("needs attention");
    await expect(page.getByTestId("integration-calendar")).toContainText("not tracked yet");
  });

  test("pausing the follow-up needs a reason and is sent to the API", async ({ page }) => {
    await mockApi(page);
    let paused = false;
    let reason = "";
    await page.route(`**/api/v1/accounts/${ACCOUNT}/onboarding`, (route) => json(route, { data: onboardingState(paused ? "paused" : "active") }));
    await page.route(`**/api/v1/follow-up/enrollments/${ENROLLMENT}/pause`, async (route) => {
      reason = route.request().postDataJSON().reason;
      paused = true;
      return json(route, { data: { id: ENROLLMENT, action: "pause" } });
    });
    await openOnboarding(page);
    await page.getByTestId("follow-up-pause").click();
    const dialog = page.getByTestId("reason-dialog");
    await expect(dialog.getByRole("button", { name: "Pause" })).toBeDisabled();
    await dialog.getByLabel("Reason").fill("Customer on leave this week");
    await dialog.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByTestId("follow-up-status")).toHaveText("paused");
    expect(reason).toBe("Customer on leave this week");
  });

  test("the onboarding-email dialog previews the template and a re-send carries its reason", async ({ page }) => {
    await mockApi(page);
    let body: Record<string, unknown> = {};
    await page.route(`**/api/v1/accounts/${ACCOUNT}/onboarding`, (route) => json(route, { data: onboardingState() }));
    await page.route(`**/api/v1/accounts/${ACCOUNT}/onboarding/preview`, (route) =>
      json(route, { data: { template_key: "welcome_trial", template_version: 1, to: "ada@acme.test", subject: "Your Skout AI trial is ready", html: "<p>Open Acme</p>", text: "Open Acme", blocked: null } })
    );
    await page.route(`**/api/v1/accounts/${ACCOUNT}/onboarding/send`, async (route) => {
      body = route.request().postDataJSON();
      return json(route, { data: onboardingState().emails[0] }, 201);
    });
    await openOnboarding(page);
    await page.getByTestId("open-onboarding-email").click();
    const dialog = page.getByTestId("onboarding-email-dialog");
    await expect(dialog).toContainText("To ada@acme.test");
    await expect(page.frameLocator('[data-testid="onboarding-email-preview"]').getByText("Open Acme")).toBeVisible();
    await expect(page.getByTestId("onboarding-email-send")).toBeDisabled();
    await dialog.getByLabel("Reason for re-sending").fill("Customer could not find it");
    await page.getByTestId("onboarding-email-send").click();
    await expect(dialog).toBeHidden();
    expect(body).toEqual({ resend: true, reason: "Customer could not find it" });
  });

  test("Sales Follow-up lists the queue by urgency and a one-click call completes the queue item", async ({ page }) => {
    await mockApi(page);
    let action: Record<string, unknown> = {};
    await page.route("**/api/v1/follow-up/queue**", (route) =>
      json(route, {
        data: [
          { id: `reply:m1`, reason: "reply", priority: 1, account: { id: ACCOUNT, name: "Acme Ltd" }, contact: { id: "c1", name: "Ada", email: "ada@acme.test" }, active_sequence: { enrollment_id: ENROLLMENT, current_step: 3 }, last_touch_at: "2026-10-07T10:00:00Z", signals: ["reply", "due_task"], recommended_action: { kind: "email", label: "Reply to the customer" }, due_at: "2026-10-08T09:00:00Z", detail: "Question about SSO" },
          { id: `task:t1`, reason: "due_task", priority: 5, account: { id: ACCOUNT, name: "Acme Ltd" }, contact: { id: "c1", name: "Ada", email: "ada@acme.test" }, active_sequence: null, last_touch_at: null, signals: ["reply", "due_task"], recommended_action: { kind: "task", label: "Complete the due task" }, due_at: "2026-10-08T12:00:00Z", detail: "Send the security questionnaire" },
        ],
        next_cursor: null,
      })
    );
    await page.route("**/api/v1/follow-up/actions", async (route) => {
      action = route.request().postDataJSON();
      return json(route, { data: { activity_id: "act1", task_id: null, meeting_id: null } }, 201);
    });
    await gotoAppPage(page, "/follow-up", "page-cops-follow-up");
    const rows = page.getByTestId("follow-up-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Reply");
    await expect(rows.nth(0)).toContainText("Question about SSO");
    await expect(rows.nth(0)).toContainText("Also: Due task");
    await rows.nth(1).getByRole("button", { name: "call Acme Ltd" }).click();
    const dialog = page.getByTestId("follow-up-action-dialog");
    await dialog.getByLabel("Outcome").fill("Sent it over the call");
    await page.getByTestId("follow-up-action-submit").click();
    await expect(dialog).toBeHidden();
    expect(action).toMatchObject({ kind: "call", account_id: ACCOUNT, contact_id: "c1", queue_item_id: "task:t1", outcome: "Sent it over the call" });
  });
});
