import { test, expect, type Page, type Route } from "@playwright/test";
import { gotoAppPage } from "./helpers";

/**
 * COPS-06 golden flows: the Engineering Queue with its filters, the ticket drawer with separate
 * internal-note and customer-update composers, and Create ticket from the account Engineering tab.
 * The API is mocked with the shapes in docs/api/copos-06-tickets.openapi.yaml; the backend
 * behaviour is covered by its route and service tests.
 */
const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const TICKET = "66666666-6666-4666-8666-666666666666";

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const ticket = {
  id: TICKET,
  account_id: ACCOUNT,
  contact_id: null,
  opportunity_id: null,
  milestone_id: null,
  title: "CRM sync fails",
  description: "Sync stops after the first page",
  category: "integration",
  severity: "high",
  priority: "p2",
  impact: "Onboarding is blocked for this account",
  affected_feature: "CRM integration",
  environment: "production",
  repro_steps: null,
  log_refs: [],
  diagnostics: { activation_pct: 35 },
  status: "triage",
  team: "platform",
  assignee_id: null,
  account_tier: "enterprise",
  escalated_at: null,
  resolved_at: null,
  created_at: "2026-10-09T08:00:00Z",
  updated_at: "2026-10-09T08:00:00Z",
};
const listItem = { ...ticket, account_name: "Acme Ltd", assignee_email: null };

function detail(comments: unknown[]) {
  return {
    ...ticket,
    context: {
      account: { id: ACCOUNT, name: "Acme Ltd", domain: "acme.test", tier: "enterprise" },
      contact: { id: "c1", name: "Ada Lovelace", email: "ada@acme.test" },
      opportunity: null,
      milestone: null,
      summary: { open_count: 1, max_severity: "high" },
    },
    comments,
    history: [],
  };
}

async function mockApi(page: Page, permissions: string[]) {
  await page.route("**/api/v1/**", (route) => json(route, { data: [] }));
  await page.route("**/api/v1/me", (route) => json(route, { workspaceId: "ws", permissions }));
}

test.describe("CustomerOps engineering tickets (COPS-06)", () => {
  test("the queue filters by severity and tier, and the drawer keeps internal notes and customer updates apart", async ({ page }) => {
    await mockApi(page, ["crm:read", "tickets:read", "tickets:write", "tickets:send"]);
    const queries: string[] = [];
    const comments: { id: string; visibility: string; kind: string; body: string; ai_generated: boolean; created_at: string }[] = [];
    const posted: { body: string; visibility: string }[] = [];
    await page.route(
      (url) => url.pathname.endsWith("/api/v1/tickets"),
      (route) => {
        queries.push(new URL(route.request().url()).search);
        return json(route, { data: [listItem], next_cursor: null });
      }
    );
    await page.route(`**/api/v1/tickets/${TICKET}`, (route) => json(route, { data: detail(comments) }));
    await page.route(`**/api/v1/tickets/${TICKET}/comments`, async (route) => {
      const body = route.request().postDataJSON() as { body: string; visibility: string };
      posted.push(body);
      const c = { id: `c${comments.length + 1}`, visibility: body.visibility, kind: body.visibility === "customer" ? "update" : "note", body: body.body, ai_generated: false, created_at: new Date().toISOString() };
      comments.push(c);
      return json(route, { data: c }, 201);
    });

    await gotoAppPage(page, "/engineering", "page-cops-engineering");
    await expect(page.getByTestId("engineering-row")).toContainText("CRM sync fails");
    await expect(page.getByTestId("engineering-row")).toContainText("Acme Ltd");
    await page.getByLabel("Severity").selectOption("high");
    await page.getByLabel("Account tier").selectOption("enterprise");
    await expect.poll(() => queries.some((q) => q.includes("severity=high") && q.includes("tier=enterprise") && q.includes("open=true"))).toBe(true);

    await page.getByTestId("engineering-row").getByRole("button").click();
    const drawer = page.getByTestId("ticket-drawer");
    await expect(drawer.getByTestId("ticket-customer-context")).toContainText("Acme Ltd");
    await expect(drawer.getByTestId("ticket-diagnostics")).toContainText("activation pct");
    await expect(drawer.getByTestId("ticket-composer-internal")).toContainText("The customer never sees this");
    await expect(drawer.getByTestId("ticket-composer-customer")).toContainText("The customer can see this");

    await drawer.getByLabel("Internal note").fill("Root cause: token refresh");
    await drawer.getByTestId("ticket-composer-internal-submit").click();
    await expect(drawer.locator('[data-visibility="internal"]')).toContainText("Root cause: token refresh");
    await drawer.getByLabel("Customer update").fill("We found the cause and are fixing it");
    await drawer.getByTestId("ticket-composer-customer-submit").click();
    await expect(drawer.locator('[data-visibility="customer"]')).toContainText("Visible to customer");
    expect(posted).toEqual([
      { body: "Root cause: token refresh", visibility: "internal" },
      { body: "We found the cause and are fixing it", visibility: "customer" },
    ]);
  });

  test("without tickets:send the customer composer is disabled", async ({ page }) => {
    await mockApi(page, ["crm:read", "tickets:read", "tickets:write"]);
    await page.route(
      (url) => url.pathname.endsWith("/api/v1/tickets"),
      (route) => json(route, { data: [listItem], next_cursor: null })
    );
    await page.route(`**/api/v1/tickets/${TICKET}`, (route) => json(route, { data: detail([]) }));
    await gotoAppPage(page, "/engineering", "page-cops-engineering");
    await page.getByTestId("engineering-row").getByRole("button").click();
    const drawer = page.getByTestId("ticket-drawer");
    await expect(drawer.getByLabel("Customer update")).toBeDisabled();
    await expect(drawer.getByTestId("ticket-composer-customer")).toContainText("Only Customer Success can publish");
    await expect(drawer.getByLabel("Internal note")).toBeEnabled();
  });

  test("Create ticket from the account Engineering tab opens prefilled and submits in one click", async ({ page }) => {
    await mockApi(page, ["crm:read", "crm:write", "tickets:read"]);
    let created: Record<string, unknown> | null = null;
    await page.route(`**/api/v1/account-360/${ACCOUNT}`, (route) =>
      json(route, { data: { company: { id: ACCOUNT, name: "Acme Ltd", domain: "acme.test" }, deals: [], signals: [], buyingCommittee: [], regionalIntelligence: null } })
    );
    await page.route(`**/api/v1/accounts/${ACCOUNT}/360**`, (route) =>
      json(route, { data: { header: { id: ACCOUNT, name: "Acme Ltd", owner_id: null, lifecycle: { account: "trial", health: null, support: null }, health: null, commercial_state: null, onboarding_pct: 35, plan: "trial", renewal_at: null }, contacts: [], next_actions: [], risks: [] } })
    );
    await page.route(`**/api/v1/accounts/${ACCOUNT}/tickets`, (route) =>
      json(route, { data: created ? { summary: { open_count: 1, max_severity: "high" }, tickets: [listItem] } : { summary: { open_count: 0, max_severity: null }, tickets: [] } })
    );
    await page.route("**/api/v1/tickets/prefill**", (route) =>
      json(route, {
        data: { account_id: ACCOUNT, contact_id: null, milestone_id: null, title: "Acme Ltd: Issue", category: "bug", severity: "medium", priority: "p3", impact: null, affected_feature: null, environment: "production", diagnostics: { activation_pct: 35 } },
      })
    );
    await page.route(
      (url) => url.pathname.endsWith("/api/v1/tickets"),
      async (route) => {
        created = route.request().postDataJSON();
        expect(route.request().headers()["idempotency-key"]).toBeTruthy();
        return json(route, { data: ticket, summary: { open_count: 1, max_severity: "high" } }, 201);
      }
    );

    await gotoAppPage(page, `/crm/360?mode=account&id=${ACCOUNT}&tab=engineering`, "account-engineering-tab");
    await expect(page.getByTestId("empty-tab-engineering")).toContainText("No open tickets: this account is healthy");
    await page.getByTestId("account-create-ticket").click();
    const dialog = page.getByTestId("create-ticket-dialog");
    await expect(dialog.getByLabel("Title")).toHaveValue("Acme Ltd: Issue");
    await expect(dialog.getByTestId("ticket-safe-diagnostics")).toContainText("activation pct");
    await dialog.getByTestId("create-ticket-submit").click();
    await expect(page.getByTestId("account-ticket-summary")).toContainText("1 open ticket");
    expect(created).toMatchObject({ account_id: ACCOUNT, title: "Acme Ltd: Issue", severity: "medium", diagnostics: { activation_pct: 35 } });
  });
});
