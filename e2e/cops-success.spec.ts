import { test, expect, type Page, type Route } from "@playwright/test";
import { gotoAppPage } from "./helpers";

/**
 * COPS-11 golden flows: the Customer Success screen (distribution, at-risk list with reason and
 * next action, adoption milestones, expansion evidence, playbook install) and the health factor
 * breakdown drawer on Customer 360. The API is mocked with the shapes in
 * docs/api/copos-11-customer-success.openapi.yaml; backend behaviour is covered by its tests.
 */
const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const overview = {
  distribution: { healthy: 4, watch: 1, at_risk: 1, unscored: 2 },
  renewalExposure: [{ accountId: ACCOUNT, name: "Acme Ltd", termEnd: "2026-12-01T00:00:00Z", healthState: "at_risk", renewalRisk: "high" }],
  adoption: { total: 6, activated: 4, signedIn: 5, under50: 1, avgPct: 70, milestones: [{ key: "first_search", label: "First search", reached: 4, total: 6 }] },
  atRisk: [{ accountId: ACCOUNT, name: "Acme Ltd", score: 32, state: "at_risk", renewalRisk: "high", reasons: ["Subscription past due", "2 open ticket(s)"], csmId: null, ownerId: null, nextAction: null }],
  expansionSignals: [{ accountId: ACCOUNT, name: "Acme Ltd", evidence: ["New funding round signal on 2026-10-15"], at: "2026-10-16T00:00:00Z" }],
  playbooks: [],
};
const health = {
  id: "h1",
  score: 32,
  state: "at_risk",
  renewalRisk: "high",
  modelVersion: 0,
  computedAt: "2026-10-20T00:00:00Z",
  dimensions: { adoption: { score: 100, weight: 20 }, relationship: { score: 50, weight: 20 }, support: { score: 30, weight: 20 }, commercial: { score: 85, weight: 20 }, payment: { score: 0, weight: 20 } },
  factors: [
    { dimension: "support", key: "open_tickets", kind: "leading", value: 2, points: -30, reason: "2 open ticket(s)" },
    { dimension: "payment", key: "subscription_status", kind: "lagging", value: "past_due", points: -50, reason: "Subscription past due" },
  ],
};

async function mockApi(page: Page, permissions: string[]) {
  await page.route("**/api/v1/**", (route) => json(route, { data: [] }));
  await page.route("**/api/v1/me", (route) => json(route, { workspaceId: "ws", permissions }));
}

test.describe("COPS-11 customer success", () => {
  test("the screen shows the at-risk reason and next action, milestones and expansion evidence, and installs playbooks", async ({ page }) => {
    await mockApi(page, ["crm:read", "crm:manage", "workspace:manage"]);
    let installed = false;
    await page.route("**/api/v1/customer-success/overview", (route) => json(route, { data: overview }));
    await page.route("**/api/v1/customer-success/playbooks", (route) =>
      json(route, { data: [{ key: "cs_ticket_heavy", name: "Playbook: ticket-heavy account", description: "Technical success review.", automationId: installed ? "a1" : null, status: installed ? "active" : null }] })
    );
    await page.route("**/api/v1/customer-success/playbooks/install", (route) => {
      installed = true;
      return json(route, { data: { installed: ["cs_ticket_heavy"], total: 5 } });
    });
    await gotoAppPage(page, "/customer-success", "page-customer-success");
    await expect(page.getByTestId("cs-at-risk")).toContainText("Why: Subscription past due; 2 open ticket(s)");
    await expect(page.getByTestId("cs-at-risk")).toContainText("no open task: plan the next step");
    await expect(page.getByTestId("cs-milestones")).toContainText("First search");
    await expect(page.getByTestId("cs-expansion")).toContainText("New funding round signal");
    await page.getByTestId("cs-install-playbooks").click();
    await expect(page.getByTestId("cs-install-playbooks")).toHaveCount(0);
  });

  test("Customer 360 opens the health drawer with every factor", async ({ page }) => {
    await mockApi(page, ["crm:read", "crm:manage"]);
    await page.route(`**/api/v1/account-360/${ACCOUNT}`, (route) =>
      json(route, { data: { company: { id: ACCOUNT, name: "Acme Ltd", domain: "acme.test" }, deals: [], signals: [], buyingCommittee: [], regionalIntelligence: null } })
    );
    await page.route(`**/api/v1/accounts/${ACCOUNT}/360**`, (route) =>
      json(route, {
        data: {
          header: { id: ACCOUNT, name: "Acme Ltd", owner_id: null, lifecycle: { account: "paid", health: "at_risk", support: "open_ticket" }, health: "at_risk", commercial_state: null, onboarding_pct: 80, plan: "pro", provisioning: null, renewal_at: null },
          contacts: [],
          next_actions: [],
          risks: [],
        },
      })
    );
    await page.route(`**/api/v1/accounts/${ACCOUNT}/health`, (route) => json(route, { data: { health, csmId: null } }));
    await gotoAppPage(page, `/crm/360?mode=account&id=${ACCOUNT}`, "cops-customer-360");
    await page.getByTestId("open-health-drawer").click();
    await expect(page.getByTestId("health-score")).toHaveText("32");
    await expect(page.getByTestId("health-factor").filter({ hasText: "Subscription past due" })).toContainText("lagging");
  });
});
