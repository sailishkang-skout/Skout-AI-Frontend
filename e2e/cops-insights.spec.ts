import { test, expect, type Page, type Route } from "@playwright/test";
import { gotoAppPage } from "./helpers";

/**
 * COPS-13 golden flows: the executive dashboard shows each KPI with its window, locks the numbers
 * the viewer may not see, and opens the records behind a number; the Customer 360 rail shows an AI
 * recommendation with its evidence and confidence, and approve runs its action. The API is mocked
 * with the shapes in docs/api/copos-13-analytics-ai.openapi.yaml; the backend is covered by its tests.
 */
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const window = { from: "2026-09-21T00:00:00.000Z", to: "2026-10-21T00:00:00.000Z" };
const ACCOUNT = "11111111-1111-4111-8111-111111111111";

async function mockApi(page: Page, permissions: string[]) {
  await page.route("**/api/v1/**", (route) => json(route, { data: [] }));
  await page.route("**/api/v1/me", (route) => json(route, { workspaceId: "ws", permissions }));
}

test.describe("COPS-13 dashboards and recommendations", () => {
  test("the executive dashboard shows KPIs, locks restricted ones and drills to the records", async ({ page }) => {
    await mockApi(page, ["analytics:read", "tickets:read"]);
    await page.route("**/api/v1/cops/metrics/catalog", (route) =>
      json(route, { data: [{ id: "engineering.critical_open", version: 1, label: "Open critical escalations", definition: "Open P1 and P2 tickets, as of now.", unit: "count", resource: "tickets", source: "state", sourceEvents: [], drill: "accounts", dashboards: ["leadership"] }] })
    );
    await page.route("**/api/v1/cops/dashboards/leadership**", (route) =>
      json(route, {
        data: {
          dashboard: "leadership",
          window,
          filters: {},
          kpis: [
            { metric_id: "revenue.arr", metric_version: 1, label: "ARR", unit: "money", value: null, restricted: true, window },
            { metric_id: "engineering.critical_open", metric_version: 1, label: "Open critical escalations", unit: "count", value: 1, restricted: false, window },
            { metric_id: "activation.rate", metric_version: 1, label: "Activation", unit: "percent", value: 0.5, numerator: 1, denominator: 2, restricted: true, window },
          ],
        },
      })
    );
    await page.route("**/api/v1/cops/dashboards/kpis/engineering.critical_open/drill**", (route) =>
      json(route, {
        data: {
          metric_id: "engineering.critical_open",
          metric_version: 1,
          window,
          total: 1,
          rows: [{ account_id: ACCOUNT, account_name: "Acme Ltd", record: { kind: "ticket", id: "t1" }, value: null, currency: null, occurred_at: "2026-10-20T00:00:00Z", source_event_ids: ["e1", "e2"] }],
          next_cursor: null,
        },
      })
    );
    await page.route("**/api/v1/cops/funnel**", (route) => json(route, { data: { window, stages: ["qualified", "commercial", "provisioned", "first_login", "activated", "paid", "renewed"], cohorts: [{ cohort: "2026-10", counts: { qualified: 4, commercial: 2, provisioned: 2, first_login: 1, activated: 1, paid: 1, renewed: 0 } }] } }));

    await gotoAppPage(page, "/executive", "page-executive");
    await expect(page.getByTestId("kpi-revenue.arr")).toContainText("Restricted");
    await expect(page.getByTestId("kpi-revenue.arr")).toBeDisabled();
    await expect(page.getByTestId("kpi-engineering.critical_open").getByTestId("kpi-value")).toHaveText("1");
    await expect(page.getByTestId("funnel-row")).toContainText("50%");

    await page.getByTestId("kpi-engineering.critical_open").click();
    const drill = page.getByTestId("kpi-drill");
    await expect(drill).toContainText("Open P1 and P2 tickets, as of now.");
    await expect(page.getByTestId("kpi-drill-total")).toContainText("1 record(s)");
    await expect(page.getByTestId("kpi-drill-row")).toContainText("Acme Ltd");
    await expect(page.getByTestId("kpi-drill-row")).toContainText("2 source event(s)");
  });

  test("the Customer 360 rail shows an evidence-linked recommendation and approves it", async ({ page }) => {
    await mockApi(page, ["crm:read", "crm:write"]);
    let approved = false;
    await page.route(`**/api/v1/accounts/${ACCOUNT}/recommendations**`, (route) =>
      json(route, {
        data: approved
          ? []
          : [
              {
                id: "r1",
                account_id: ACCOUNT,
                type: "renewal_risk",
                headline: "Renewal in 30 days with at-risk health",
                rationale: "INR 12,000 ARR renews in 30 days and the account's health is 30.",
                evidence_refs: [{ kind: "subscription", id: "s1", label: "INR 12,000 ARR, term ends 2026-11-20" }],
                suggested_action: { kind: "start_playbook", params: { title: "Renewal approaching", priority: "high", due_in_hours: 120, assign_to: "csm" } },
                confidence: 0.82,
                status: "pending",
                source: "llm",
                evidence_id: "e1",
                decided_by: null,
                decided_at: null,
                decision_reason: null,
                effect: null,
                created_at: "2026-10-21T00:00:00Z",
              },
            ],
      })
    );
    await page.route("**/api/v1/recommendations/r1/approve", (route) => {
      approved = true;
      return json(route, { data: { id: "r1", status: "approved", effect: { kind: "workflow_run", id: "run1" } } });
    });
    await page.route(`**/api/v1/account-360/${ACCOUNT}`, (route) =>
      json(route, { data: { company: { id: ACCOUNT, name: "Acme Ltd", domain: "acme.test" }, deals: [], signals: [], buyingCommittee: [], regionalIntelligence: null } })
    );
    await page.route(`**/api/v1/accounts/${ACCOUNT}/360**`, (route) =>
      json(route, {
        data: {
          header: { id: ACCOUNT, name: "Acme Ltd", owner_id: null, lifecycle: { account: "paid", health: "at_risk", support: "no_issue" }, health: "at_risk", commercial_state: null, onboarding_pct: 80, plan: "pro", provisioning: null, renewal_at: null },
          contacts: [],
          next_actions: [],
          risks: [],
        },
      })
    );

    await gotoAppPage(page, `/crm/360?mode=account&id=${ACCOUNT}`, "cops-customer-360");
    const rec = page.getByTestId("recommendation");
    await expect(rec).toContainText("Renewal in 30 days with at-risk health");
    await expect(page.getByTestId("recommendation-confidence")).toHaveText("82% confidence");
    await expect(page.getByTestId("recommendation-evidence").getByRole("link")).toHaveAttribute("href", /tab=billing/);
    await page.getByTestId("recommendation-approve").click();
    await expect(page.getByTestId("recommendations-empty")).toBeVisible();
  });
});
