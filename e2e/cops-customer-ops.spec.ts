import { test, expect, type Page, type Route } from "@playwright/test";
import { gotoAppPage } from "./helpers";

/**
 * CustomerOps golden flows on Customer 360 and the Commercial Desk (COPS-02, COPS-03, COPS-04).
 * The API is mocked per test with the contract shapes in docs/api/copos-0*.openapi.yaml, so the
 * flows run without a seeded backend; the backend behaviour itself is covered by its route tests.
 */

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const OPP = "22222222-2222-4222-8222-222222222222";
const ALL_PERMS = ["crm:read", "crm:manage", "commercial:read", "commercial:send", "onboarding:read", "onboarding:write", "credits:read", "credits:adjust"];

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const step = (name: string, status: string, error: string | null = null) => ({
  step: name,
  status,
  attempts: 1,
  error,
  duration_ms: 20,
  finished_at: status === "pending" ? null : "2026-10-08T10:00:00Z",
});
const STEPS = ["create_workspace", "default_roles", "entitlements", "credit_wallet", "integration_placeholders", "admin_invite", "link_crm"];

function provisioning(status: "failed" | "succeeded") {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    account_id: ACCOUNT,
    opportunity_id: OPP,
    status,
    plan: "trial",
    trial_starts_at: "2026-10-08T10:00:00Z",
    trial_ends_at: "2026-10-22T10:00:00Z",
    duration_ms: status === "succeeded" ? 4200 : null,
    within_target: status === "succeeded" ? true : null,
    last_error: status === "failed" ? "admin_invite" : null,
    provisioned_workspace_id: status === "succeeded" ? "44444444-4444-4444-8444-444444444444" : null,
    admin_invite: status === "succeeded" ? { email: "admin@acme.test", accepted_at: null, accept_url: null } : null,
    steps: STEPS.map((s, i) =>
      status === "succeeded" ? step(s, "succeeded") : i < 5 ? step(s, "succeeded") : i === 5 ? step(s, "failed", "SMTP timeout") : step(s, "pending")
    ),
  };
}

/** Catch-all first (Playwright runs the most recently added matching route first), then the CustomerOps reads. */
async function mockCustomerOps(page: Page, perms: string[] = ALL_PERMS) {
  await page.route("**/api/v1/**", (route) => json(route, { data: [] }));
  await page.route("**/api/v1/me", (route) => json(route, { workspaceId: "ws", permissions: perms }));
  await page.route(`**/api/v1/account-360/${ACCOUNT}`, (route) =>
    json(route, { data: { company: { id: ACCOUNT, name: "Acme Ltd", domain: "acme.test" }, deals: [], signals: [], buyingCommittee: [], regionalIntelligence: null } })
  );
  await page.route(`**/api/v1/accounts/${ACCOUNT}/360**`, (route) =>
    json(route, {
      data: {
        header: {
          id: ACCOUNT,
          name: "Acme Ltd",
          owner_id: null,
          lifecycle: { account: "trial", health: null, support: null },
          health: null,
          commercial_state: "payment_pending",
          onboarding_pct: null,
          plan: "trial",
          provisioning: null,
          renewal_at: null,
        },
        contacts: [],
        next_actions: [],
        risks: [],
      },
    })
  );
  await page.route(`**/api/v1/accounts/${ACCOUNT}/timeline**`, (route) =>
    json(route, {
      data: [
        { id: "t1", type: "payment", visibility: "public", occurred_at: "2026-10-08T09:00:00Z", actor: { type: "integration", id: "razorpay" }, source_event_id: "e1", summary: "Payment link paid" },
        { id: "t2", type: "note", visibility: "internal", occurred_at: "2026-10-08T08:00:00Z", actor: { type: "user", id: "u1" }, source_event_id: "e2", summary: "Champion wants a 30-day trial" },
      ],
      next_cursor: null,
    })
  );
}

const open360 = (page: Page, tab?: string) =>
  gotoAppPage(page, `/crm/360?mode=account&id=${ACCOUNT}${tab ? `&tab=${tab}` : ""}`, "cops-customer-360");

test.describe("CustomerOps golden flows (COPS-02..04)", () => {
  test("COPS-02: Customer 360 shows the header state and the account timeline", async ({ page }) => {
    await mockCustomerOps(page);
    await open360(page, "timeline");
    await expect(page.getByRole("tab", { name: "Timeline" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Payment link paid")).toBeVisible();
    await expect(page.getByText("Champion wants a 30-day trial")).toBeVisible();
  });

  test("COPS-04: a failed saga step shows on screen and Retry resumes it with the same Idempotency-Key", async ({ page }) => {
    await mockCustomerOps(page);
    let provisioned = false;
    let failing = true;
    const keys: string[] = [];
    await page.route(`**/api/v1/opportunities?company_id=${ACCOUNT}**`, (route) => json(route, { data: [{ id: OPP, name: "Acme annual", status: "open" }] }));
    await page.route(`**/api/v1/accounts/${ACCOUNT}/provisioning`, (route) => json(route, { data: provisioned ? [provisioning("succeeded")] : [] }));
    await page.route(`**/api/v1/accounts/${ACCOUNT}/provision`, async (route) => {
      keys.push(route.request().headers()["idempotency-key"] ?? "");
      if (failing) {
        // A failed step answers 502 with the provisioning next to the error envelope. The client
        // retries a retryable 502 itself (same key), so it keeps failing until the user retries.
        return json(route, { code: "PROVISIONING_STEP_FAILED", message: "admin_invite: SMTP timeout", request_id: "r1", retryable: true, data: provisioning("failed") }, 502);
      }
      provisioned = true;
      return json(route, { data: provisioning("succeeded") });
    });

    await open360(page, "onboarding");
    await expect(page.getByTestId("onboarding-empty")).toBeVisible();
    await page.getByTestId("open-provision").click();
    await page.getByLabel("Admin email").fill("admin@acme.test");
    await page.getByTestId("provision-submit").click();

    await expect(page.getByTestId("provision-dialog").getByTestId("provisioning-steps").first()).toContainText("SMTP timeout");
    await expect(page.getByTestId("provision-submit")).toHaveText(/Retry from failed step/);
    const attemptsBeforeRetry = keys.length;
    failing = false;
    await page.getByTestId("provision-submit").click();

    await expect(page.getByTestId("provision-dialog").getByText(/Workspace ready in .* Invitation sent to admin@acme.test/)).toBeVisible();
    expect(keys.length).toBeGreaterThan(attemptsBeforeRetry);
    expect(keys[0]).toBeTruthy();
    // Every attempt, automatic or the user's Retry, resumes the same provisioning.
    expect(new Set(keys).size).toBe(1);
  });

  test("COPS-04: a complimentary grant needs a reason and posts to the ledger", async ({ page }) => {
    await mockCustomerOps(page);
    let balance = 500;
    let posted: { amount?: number; reason?: string } = {};
    const wallet = () => ({
      data: {
        balance,
        trial_ends_at: "2026-10-22T10:00:00Z",
        usage: [],
        next_cursor: null,
        ledger: [{ id: "l1", kind: "grant", amount: 500, balance_after: 500, reason: "Trial credits", action: "provision", actor_type: "user", compensates_id: null, created_at: "2026-10-08T10:00:00Z" }],
      },
    });
    await page.route(`**/api/v1/accounts/${ACCOUNT}/credits`, (route) => json(route, wallet()));
    await page.route(`**/api/v1/accounts/${ACCOUNT}/credits/grants`, async (route) => {
      posted = route.request().postDataJSON();
      balance += posted.amount ?? 0;
      return json(route, { data: { id: "l2", kind: "grant", amount: posted.amount, balance } }, 201);
    });

    await open360(page, "billing");
    await expect(page.getByTestId("wallet-balance")).toHaveText("500");
    await page.getByTestId("open-grant").click();
    const dialog = page.getByTestId("amount-reason-dialog-grant");
    await dialog.getByLabel("Credits").fill("100");
    await expect(dialog.getByRole("button", { name: "Add credits" })).toBeDisabled();
    await dialog.getByLabel("Reason").fill("Pilot goodwill");
    await dialog.getByRole("button", { name: "Add credits" }).click();

    await expect(page.getByTestId("wallet-balance")).toHaveText("600");
    expect(posted).toEqual({ amount: 100, reason: "Pilot goodwill" });
  });

  test("COPS-03: the Commercial Desk lists opportunities, filters by state and links to the account", async ({ page }) => {
    await mockCustomerOps(page);
    const states: Array<string | null> = [];
    await page.route("**/api/v1/commercial/opportunities**", (route) => {
      states.push(new URL(route.request().url()).searchParams.get("state"));
      return json(route, {
        data: [
          {
            opportunity: { id: OPP, name: "Acme annual", amount: "120000", currency: "INR", deal_type: null, status: "open", commercial_state: "payment_pending" },
            account: { id: ACCOUNT, name: "Acme Ltd" },
            proposals: [{ status: "accepted", created_at: "2026-10-01T00:00:00Z" }],
            contracts: [{ kind: "msa", status: "signed", created_at: "2026-10-02T00:00:00Z" }],
            payment_requests: [{ status: "requested", created_at: "2026-10-03T00:00:00Z" }],
            gate: { open: false, fired_at: null },
          },
        ],
        next_cursor: null,
      });
    });

    await gotoAppPage(page, "/commercial", "page-cops-commercial");
    const row = page.getByTestId("commercial-desk-row");
    await expect(row).toContainText("Acme annual");
    await expect(row).toContainText("Acme Ltd");
    await expect(row).toContainText("Payment pending");
    await expect(row.getByRole("link", { name: "Acme annual" })).toHaveAttribute("href", new RegExp(`id=${ACCOUNT}&tab=commercial`));

    await page.getByLabel("Commercial state").selectOption("msa_pending");
    await expect.poll(() => states.includes("msa_pending")).toBe(true);
  });

  test("COPS-01/03: a role without commercial access sees a plain message and no Commercial nav entry", async ({ page }) => {
    await mockCustomerOps(page, ["crm:read"]);
    await page.route("**/api/v1/commercial/opportunities**", (route) =>
      json(route, { code: "FORBIDDEN", message: "Missing permission", request_id: "r", retryable: false, details: { required_permission: "commercial:read" } }, 403)
    );
    await gotoAppPage(page, "/commercial", "page-cops-commercial");
    await expect(page.getByText("The Commercial Desk is visible to roles with commercial access.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Commercial", exact: true })).toHaveCount(0);
  });
});
