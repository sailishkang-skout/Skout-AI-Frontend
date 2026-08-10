import { test, expect } from "@playwright/test";
import { crmApiURL, gotoAppPage, isCrmApiHealthy } from "./helpers";

test.describe("CRM Deals board", () => {
  test("board loads with default pipeline columns", async ({ page, request }) => {
    test.skip(!(await isCrmApiHealthy(request)), "CRM API not running");

    await gotoAppPage(page, "/crm/deals", "page-crm-deals");
    await expect(page.getByText("New", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Qualified", { exact: true })).toBeVisible();
    await expect(page.getByText("Closed Won", { exact: true })).toBeVisible();
    await expect(page.getByText("Closed Lost", { exact: true })).toBeVisible();
  });

  test("quick-create adds a deal to the clicked column", async ({ page, request }) => {
    test.skip(!(await isCrmApiHealthy(request)), "CRM API not running");

    // Seed a company via the API so the picker has something to select.
    const email = `e2e-crm-deals-quickcreate-${Date.now()}@test.com`;
    await request.post(`${crmApiURL}/api/v1/companies`, {
      headers: { "content-type": "application/json", "x-stub-user-email": email },
      data: { name: `Quick Create Co ${Date.now()}` },
    });

    // The UI test app runs with its own stub session (no shared workspace with the
    // API call above), so this just exercises the dialog open/close + submit wiring
    // against whatever company the UI's own session already has, via a UI-created one.
    await gotoAppPage(page, "/crm/companies", "page-crm-companies");
    const companyName = `Quick Create UI Co ${Date.now()}`;
    await page.getByTestId("create-company-button").click();
    await page.getByPlaceholder("Acme Corp").fill(companyName);
    await page.getByRole("button", { name: "Create company" }).click();
    await expect(page.getByText(companyName, { exact: true })).toBeVisible({ timeout: 15_000 });

    await gotoAppPage(page, "/crm/deals", "page-crm-deals");
    await page.getByLabel("Add deal to New").click();
    await expect(page.getByText("Add deal to New")).toBeVisible();

    const dealName = `Quick Deal ${Date.now()}`;
    await page.getByPlaceholder("Acme — Annual Contract").fill(dealName);
    await page.getByLabel("Company").selectOption({ label: companyName });
    await page.getByRole("button", { name: "Create deal" }).click();
    await expect(page.getByText(dealName, { exact: true })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("CRM Deals API (stub auth)", () => {
  test("default pipeline auto-seeds with 6 stages; deal lands in first stage", async ({ request }) => {
    test.skip(!(await isCrmApiHealthy(request)), "CRM API not running");

    const email = `e2e-crm-deals-api-${Date.now()}@test.com`;
    const headers = { "content-type": "application/json", "x-stub-user-email": email };

    const pipelinesRes = await request.get(`${crmApiURL}/api/v1/pipelines`, {
      headers: { "x-stub-user-email": email },
    });
    const pipelines = await pipelinesRes.json();
    expect(pipelines.total).toBe(1);
    expect(pipelines.data[0].stages).toHaveLength(6);
    const sortedStages = [...pipelines.data[0].stages].sort((a: { orderIndex: number }, b: { orderIndex: number }) => a.orderIndex - b.orderIndex);

    const companyRes = await request.post(`${crmApiURL}/api/v1/companies`, { headers, data: { name: "Deal Co" } });
    const company = await companyRes.json();

    const dealRes = await request.post(`${crmApiURL}/api/v1/deals`, {
      headers,
      data: { name: "API Deal", companyId: company.id, amount: 1000 },
    });
    const deal = await dealRes.json();
    expect(deal.stageId).toBe(sortedStages[0].id);

    // Move to the second stage — mirrors what the UI's drag-and-drop does.
    const patchRes = await request.patch(`${crmApiURL}/api/v1/deals/${deal.id}`, {
      headers,
      data: { stageId: sortedStages[1].id },
    });
    expect(patchRes.ok()).toBeTruthy();

    const activitiesRes = await request.get(
      `${crmApiURL}/api/v1/activities?entityType=deal&entityId=${deal.id}`,
      { headers: { "x-stub-user-email": email } }
    );
    const activities = await activitiesRes.json();
    expect(activities.data.some((a: { activityType: string }) => a.activityType === "stage_change")).toBeTruthy();

    const summaryRes = await request.get(`${crmApiURL}/api/v1/deals/summary`, {
      headers: { "x-stub-user-email": email },
    });
    const summary = await summaryRes.json();
    expect(summary.openDeals).toBe(1);
    expect(summary.pipelineValue).toBe(1000);
  });
});
