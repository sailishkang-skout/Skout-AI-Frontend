import { test, expect, type Page, type Route } from "@playwright/test";
import { gotoAppPage } from "./helpers";

/**
 * COPS-12 golden flows: the queue shows each ticket's SLA and filters to SLA risk, the drawer
 * refuses Verified without evidence and asks for a reopen reason, and an incident publishes one
 * customer update to every linked ticket. The API is mocked with the shapes in
 * docs/api/copos-12-ticket-sla.openapi.yaml; the backend behaviour is covered by its tests.
 */
const TICKET = "66666666-6666-4666-8666-666666666666";
const OTHER = "77777777-7777-4777-8777-777777777777";
const INCIDENT = "88888888-8888-4888-8888-888888888888";
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const soon = () => new Date(Date.now() + 10 * 60_000).toISOString();

const base = {
  account_id: "a1",
  contact_id: null,
  opportunity_id: null,
  milestone_id: null,
  description: null,
  category: "bug",
  severity: "high",
  priority: "p2",
  impact: null,
  affected_feature: null,
  environment: "production",
  repro_steps: null,
  log_refs: [],
  diagnostics: {},
  team: null,
  assignee_id: null,
  account_tier: "enterprise",
  escalated_at: null,
  resolved_at: null,
  created_at: "2026-10-20T08:00:00Z",
  updated_at: "2026-10-20T08:00:00Z",
  account_name: "Acme Ltd",
  assignee_email: null,
};
const release = {
  release_id: null,
  fixed_in_version: null,
  deployed_at: null,
  qa_verified_at: null,
  qa_verified_by: null,
  qa_evidence: null,
  customer_verified_at: null,
  customer_verified_by: null,
  customer_evidence: null,
};

async function mockApi(page: Page, permissions: string[]) {
  await page.route("**/api/v1/**", (route) => json(route, { data: [] }));
  await page.route("**/api/v1/me", (route) => json(route, { workspaceId: "ws", permissions }));
  await page.route("**/api/v1/tickets/metrics**", (route) =>
    json(route, {
      data: { window_days: 30, open: 2, aged: 0, mtta_minutes: 35, mttr_minutes: 600, reopen_rate: 0, breach_rate: 0.5, incident_linked: 1, at_risk: 1, definitions: { breach_rate: "SLA clocks breached / finished" } },
    })
  );
}

test.describe("COPS-12 ticket SLA, verification and incidents", () => {
  test("the queue shows SLA state, filters to risk, and the drawer enforces the Verified gate and the reopen reason", async ({ page }) => {
    await mockApi(page, ["tickets:read", "tickets:write"]);
    const transitions: unknown[] = [];
    await page.route(
      (url) => url.pathname.endsWith("/api/v1/tickets"),
      (route) =>
        json(route, {
          data: [
            { ...base, id: TICKET, title: "Export broken", status: "resolved", sla: { state: "at_risk", due_at: soon() } },
            { ...base, id: OTHER, title: "Typo in footer", severity: "low", status: "triage", sla: { state: "running", due_at: soon() } },
          ],
          next_cursor: null,
        })
    );
    await page.route(`**/api/v1/tickets/${TICKET}`, (route) =>
      json(route, {
        data: {
          ...base,
          id: TICKET,
          title: "Export broken",
          status: "resolved",
          context: { account: { id: "a1", name: "Acme Ltd", domain: null, tier: "enterprise" }, contact: null, opportunity: null, milestone: null, summary: { open_count: 2, max_severity: "high" } },
          comments: [],
          history: [],
          release,
          incident: null,
          sla: {
            priority: "p2",
            tier: "enterprise",
            clocks: [{ kind: "response", target_minutes: 60, calendar: "business", started_at: "2026-10-20T08:00:00Z", due_at: null, paused: false, used_minutes: 20, state: "met", met_at: "2026-10-20T08:20:00Z", breached_at: null, policy_version: 0 }],
          },
        },
      })
    );
    await page.route(`**/api/v1/tickets/${TICKET}/transition`, (route) => {
      const body = route.request().postDataJSON() as { to: string; reason?: string };
      transitions.push(body);
      if (body.to === "verified") {
        return json(route, { code: "VERIFICATION_REQUIRED", message: "Verify first", details: { missing: ["qa_verification", "customer_verification"] }, request_id: "r1", retryable: false }, 422);
      }
      return json(route, { data: { ...base, id: TICKET, status: body.to } });
    });

    await gotoAppPage(page, "/engineering", "page-cops-engineering");
    await expect(page.getByTestId("engineering-dashboard")).toContainText("Breach rate");
    await expect(page.getByTestId("engineering-row")).toHaveCount(2);
    await expect(page.getByTestId("engineering-row").first().getByTestId("sla-chip")).toContainText("SLA at risk");
    await page.getByTestId("filter-sla-risk").check();
    await expect(page.getByTestId("engineering-row")).toHaveCount(1);

    await page.getByTestId("engineering-row").getByRole("button").click();
    const drawer = page.getByTestId("ticket-drawer");
    await expect(drawer.getByTestId("ticket-sla")).toContainText("First response");
    await drawer.getByTestId("ticket-move-verified").click();
    await expect(drawer).toContainText("Record QA and customer verification");
    await expect(drawer.getByTestId("ticket-move-in_progress")).toBeDisabled();
    await drawer.getByTestId("ticket-reopen-reason").fill("Customer still sees the error");
    await drawer.getByTestId("ticket-move-in_progress").click();
    await expect.poll(() => transitions).toContainEqual({ to: "in_progress", reason: "Customer still sees the error" });
  });

  test("an incident shows its linked tickets and posts one customer update to all of them", async ({ page }) => {
    await mockApi(page, ["tickets:read", "tickets:write", "tickets:send"]);
    let published: unknown = null;
    await page.route(
      (url) => url.pathname.endsWith("/api/v1/incidents"),
      (route) => json(route, { data: [{ id: INCIDENT, title: "Export outage", severity: "high", status: "investigating" }] })
    );
    await page.route(`**/api/v1/incidents/${INCIDENT}/detail`, (route) =>
      json(route, {
        data: {
          id: INCIDENT,
          title: "Export outage",
          severity: "high",
          status: "investigating",
          owner_id: null,
          started_at: "2026-10-20T08:00:00Z",
          ended_at: null,
          workaround: "Export as CSV",
          root_cause: null,
          follow_ups: [],
          customer_update: null,
          customer_update_at: null,
          tickets: [
            { id: TICKET, title: "Export broken", status: "in_progress", severity: "high", assignee_id: null, account_id: "a1", account_name: "Acme Ltd" },
            { id: OTHER, title: "Cannot export", status: "triage", severity: "medium", assignee_id: null, account_id: "a2", account_name: "Beta Inc" },
          ],
          affected_accounts: [
            { id: "a1", name: "Acme Ltd" },
            { id: "a2", name: "Beta Inc" },
          ],
        },
      })
    );
    await page.route(`**/api/v1/incidents/${INCIDENT}/customer-update`, (route) => {
      published = route.request().postDataJSON();
      return json(route, { data: { ticketsUpdated: 2 } });
    });
    await gotoAppPage(page, `/engineering/incidents?id=${INCIDENT}`, "page-cops-incidents");
    const detail = page.getByTestId("incident-detail");
    await expect(detail).toContainText("2 affected customers");
    await expect(detail.getByTestId("incident-tickets")).toContainText("Beta Inc");
    await detail.getByLabel("Customer update").fill("A fix is rolling out today");
    await detail.getByTestId("incident-publish").click();
    await expect(detail).toContainText("Posted to 2 linked ticket(s).");
    expect(published).toEqual({ body: "A fix is rolling out today" });
  });
});
