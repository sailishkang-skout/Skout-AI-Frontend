import { test, expect, type Page, type Route } from "@playwright/test";
import { gotoAppPage } from "./helpers";

/**
 * COPS-07 CustomerOps admin: versioned config edits, module switches, retention dry-run-first and
 * the operations metrics. The API is mocked with the shapes in docs/api/copos-07-admin.openapi.yaml;
 * the backend behaviour is covered by its route and service tests.
 */
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const version = (kind: string, key: string, v: number, value: Record<string, unknown>) => ({
  kind,
  key,
  version: v,
  value,
  reason: v === 0 ? null : "Initial",
  restored_from_version: null,
  created_by: null,
  created_at: v === 0 ? null : "2026-10-09T08:00:00Z",
  is_system_default: v === 0,
});

async function mockApi(page: Page, permissions: string[]) {
  await page.route("**/api/v1/**", (route) => json(route, { data: [] }));
  await page.route("**/api/v1/me", (route) => json(route, { workspaceId: "ws", permissions }));
  await page.route("**/api/v1/cops/modules", (route) => json(route, { data: { crm: true, commercial: true, provisioning: true, onboarding: true, tickets: true, admin: true } }));
}

/** Clicks a tab until it is selected: a click that lands before hydration is simply repeated. */
async function openTab(page: Page, id: string) {
  const tab = page.getByTestId(`admin-tab-${id}`);
  await expect(async () => {
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true", { timeout: 2000 });
  }).toPass({ timeout: 30_000 });
}

test.describe("CustomerOps admin (COPS-07)", () => {
  test("editing a trial template saves a new version with a reason", async ({ page }) => {
    await mockApi(page, ["admin:read", "admin:admin"]);
    let current = 0;
    let saved: Record<string, unknown> | null = null;
    await page.route("**/api/v1/admin/config/trial_template", (route) =>
      json(route, { data: [version("trial_template", "standard", current, { name: "Standard trial", plan: "trial", trial_days: current ? 21 : 14, credits: 500, integrations: ["crm", "email"] })] })
    );
    await page.route("**/api/v1/admin/config/trial_template/standard", async (route) => {
      saved = route.request().postDataJSON();
      expect(route.request().headers()["idempotency-key"]).toBeTruthy();
      current = 1;
      return json(route, { data: version("trial_template", "standard", 1, {}) }, 201);
    });

    await gotoAppPage(page, "/cops/admin", "page-cops-admin");
    await expect(page.getByTestId("config-row-standard")).toContainText("built-in default");
    await page.getByTestId("config-edit-standard").click();
    await page.getByLabel("Trial length (days)").fill("21");
    await expect(page.getByTestId("config-save")).toBeDisabled();
    await page.getByLabel("Reason for this change").fill("Longer trials for Q4");
    await page.getByTestId("config-save").click();
    await expect(page.getByTestId("config-row-standard")).toContainText("v1");
    expect(saved).toMatchObject({ value: { trial_days: 21, credits: 500 }, reason: "Longer trials for Q4", expected_version: 0 });
  });

  test("a reader sees the configuration but no edit controls", async ({ page }) => {
    await mockApi(page, ["admin:read"]);
    await page.route("**/api/v1/admin/config/trial_template", (route) => json(route, { data: [version("trial_template", "standard", 2, { name: "Standard trial", plan: "trial", trial_days: 14, credits: 500, integrations: [] })] }));
    await gotoAppPage(page, "/cops/admin", "page-cops-admin");
    await expect(page.getByTestId("config-row-standard")).toContainText("v2");
    await expect(page.getByTestId("config-edit-standard")).toHaveCount(0);
    await expect(page.getByTestId("config-new-trial_template")).toHaveCount(0);
    await expect(page.getByTestId("page-cops-admin")).toContainText("Only a workspace admin can change it");
  });

  test("retention deletes only after a dry run and with a reason", async ({ page }) => {
    await mockApi(page, ["admin:read", "admin:admin"]);
    const runs: { mode: string; dry_run_id?: string; reason?: string }[] = [];
    await page.route("**/api/v1/admin/config/retention_policy", (route) => json(route, { data: [version("retention_policy", "default", 1, { categories: { diagnostics: { days: 30 } } })] }));
    await page.route("**/api/v1/admin/data-inventory", (route) => json(route, { data: [{ table: "contacts", category: "core_records", tags: ["tenant_scoped", "personal_data"], retention: "dsar_only" }] }));
    await page.route("**/api/v1/admin/retention/runs", async (route) => {
      if (route.request().method() !== "POST") return json(route, { data: [], targets: [{ table: "cops_outbox", category: "diagnostics" }, { table: "audit_logs", category: "audit_logs" }] });
      const body = route.request().postDataJSON();
      runs.push(body);
      return json(route, { data: { id: "dry-1", mode: body.mode, policy_version: 1, counts: {}, total_rows: 12, dry_run_id: body.dry_run_id ?? null, reason: body.reason ?? null, created_at: new Date().toISOString() } }, 201);
    });

    await gotoAppPage(page, "/cops/admin", "page-cops-admin");
    await openTab(page, "privacy");
    await expect(page.getByLabel("diagnostics days")).toHaveValue("30");
    await expect(page.getByLabel("core records days")).toBeDisabled();
    await expect(page.getByTestId("retention-apply")).toHaveCount(0);
    await page.getByTestId("retention-dry-run").click();
    await expect(page.getByTestId("retention-dry-result")).toContainText("12 rows");
    await expect(page.getByTestId("retention-apply")).toBeDisabled();
    await page.getByTestId("admin-retention-runs").getByLabel("Reason").fill("Quarterly cleanup");
    await page.getByTestId("retention-apply").click();
    await expect.poll(() => runs.length).toBe(2);
    expect(runs).toEqual([{ mode: "dry_run" }, { mode: "apply", dry_run_id: "dry-1", reason: "Quarterly cleanup" }]);
    await expect(page.getByTestId("admin-inventory")).toContainText("contacts");
  });

  test("a module turned off disappears from the navigation, and operations shows a critical metric with its runbook", async ({ page }) => {
    await mockApi(page, ["admin:read", "admin:admin", "tickets:read", "commercial:read"]);
    await page.route("**/api/v1/cops/modules", (route) => json(route, { data: { crm: true, commercial: true, provisioning: true, onboarding: true, tickets: false, admin: true } }));
    await page.route("**/api/v1/admin/ops/metrics", (route) =>
      json(route, {
        data: {
          generated_at: "",
          metrics: [
            { key: "outbox_lag_seconds", label: "Outbox lag (oldest unpublished event)", value: 900, unit: "seconds", warn_at: 60, critical_at: 300, status: "critical", runbook: "docs/runbooks/cops-platform.md" },
            { key: "provisioning_p95_ms", label: "Provisioning latency p95 (30 days)", value: 5900, unit: "ms", warn_at: 120000, critical_at: 240000, status: "ok", runbook: "docs/runbooks/cops-commercial-credits.md" },
          ],
        },
      })
    );
    await gotoAppPage(page, "/cops/admin", "page-cops-admin");
    await expect(page.getByRole("link", { name: "Commercial", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Engineering", exact: true })).toHaveCount(0);
    await openTab(page, "modules");
    await expect(page.getByLabel("tickets module")).not.toBeChecked();
    await openTab(page, "ops");
    await expect(page.getByTestId("metric-outbox_lag_seconds")).toContainText("Critical");
    await expect(page.getByTestId("metric-outbox_lag_seconds")).toContainText("cops-platform.md");
    await expect(page.getByTestId("metric-provisioning_p95_ms")).toContainText("5.9 s");
  });

  test("an activation definition is edited as milestones and saves only when the weights add up to 100", async ({ page }) => {
    await mockApi(page, ["admin:read", "admin:admin"]);
    let saved: { milestones: { key: string; weight: number }[]; reason: string } | null = null;
    const milestones = [
      { key: "first_search", label: "First search", weight: 60, required: true, source: "event", event_types: ["product.search"] },
      { key: "first_export", label: "First export", weight: 40, required: true, source: "event", event_types: ["product.export"] },
    ];
    await page.route("**/api/v1/admin/activation-templates", (route) =>
      json(route, { data: [{ id: "a1", key: "default_trial", version: 1, segment: null, milestones, is_system_default: true, created_at: "2026-10-08T00:00:00Z" }] })
    );
    await page.route("**/api/v1/admin/activation-templates/default_trial/versions", (route) => {
      saved = route.request().postDataJSON();
      return json(route, { data: { id: "a2", key: "default_trial", version: 2, segment: null, milestones: saved!.milestones } }, 201);
    });

    await gotoAppPage(page, "/cops/admin", "page-cops-admin");
    await openTab(page, "activation");
    await page.getByRole("button", { name: "New version from this" }).click();
    await page.getByLabel("Reason").fill("Search matters more");
    await page.getByLabel("Milestone 1 weight").fill("70");
    await expect(page.getByTestId("activation-total")).toContainText("110%");
    await expect(page.getByTestId("activation-save")).toBeDisabled();
    await page.getByLabel("Milestone 2 weight").fill("30");
    await expect(page.getByTestId("activation-total")).toContainText("100%");
    await page.getByTestId("activation-save").click();
    await expect.poll(() => saved?.reason).toBe("Search matters more");
    expect(saved!.milestones.map((m) => m.weight)).toEqual([70, 30]);
  });

  test("pipelines: a stage is added at the end and an existing stage is renamed", async ({ page }) => {
    await mockApi(page, ["admin:read", "admin:admin"]);
    const stages = [
      { id: "s1", pipelineId: "p1", name: "Qualified", orderIndex: 0, probability: 10, isClosedWon: false, isClosedLost: false },
      { id: "s2", pipelineId: "p1", name: "Demo", orderIndex: 1, probability: 40, isClosedWon: false, isClosedLost: false },
    ];
    const writes: { method: string; path: string; body: Record<string, unknown> }[] = [];
    await page.route("**/api/v1/pipelines**", (route) => {
      const req = route.request();
      if (req.method() === "GET") return json(route, { data: [{ id: "p1", workspaceId: "ws", name: "Sales", isDefault: true, createdAt: "", updatedAt: "", stages }], total: 1 });
      const body = req.postDataJSON() as Record<string, unknown>;
      writes.push({ method: req.method(), path: new URL(req.url()).pathname, body });
      if (req.method() === "POST") stages.push({ id: "s3", pipelineId: "p1", isClosedLost: false, ...(body as { name: string; orderIndex: number; probability: number; isClosedWon: boolean }) });
      else Object.assign(stages[1]!, body);
      return json(route, body, req.method() === "POST" ? 201 : 200);
    });

    await gotoAppPage(page, "/cops/admin", "page-cops-admin");
    await openTab(page, "pipelines");
    await expect(page.getByTestId("pipeline-p1")).toContainText("Qualified");
    await page.getByTestId("pipeline-add-stage-p1").click();
    await page.getByLabel("Stage name").fill("Closed won");
    await page.getByLabel("Stage type").selectOption("won");
    await page.getByTestId("pipeline-stage-save").click();
    await expect(page.getByTestId("stage-s3")).toContainText("Closed won");

    await page.getByTestId("stage-s2").click();
    await page.getByLabel("Edit stage name").fill("Product demo");
    await page.getByLabel("Edit win probability").fill("45");
    await page.getByTestId("stage-edit-save").click();
    await expect(page.getByTestId("stage-s2")).toContainText("Product demo");
    expect(writes).toEqual([
      { method: "POST", path: "/api/v1/pipelines/p1/stages", body: { name: "Closed won", orderIndex: 2, probability: 0, isClosedWon: true, isClosedLost: false } },
      { method: "PATCH", path: "/api/v1/pipelines/p1/stages/s2", body: { name: "Product demo", probability: 45 } },
    ]);
  });

  test("a page of a module that is turned off says so instead of blaming the role", async ({ page }) => {
    await mockApi(page, ["tickets:read", "crm:read"]);
    await page.route(
      (url) => url.pathname.endsWith("/api/v1/tickets"),
      (route) => json(route, { code: "FORBIDDEN", message: "This module is turned off for the workspace", details: { reason: "module_disabled", module: "tickets" }, request_id: "r1", retryable: false }, 403)
    );
    await gotoAppPage(page, "/engineering", "page-cops-engineering");
    await expect(page.getByTestId("page-cops-engineering")).toContainText("Engineering tickets are turned off for this workspace");
    await expect(page.getByTestId("page-cops-engineering")).not.toContainText("is for Engineering, Customer Success and Product roles");
  });
});
