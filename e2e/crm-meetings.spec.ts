import { test, expect } from "@playwright/test";
import { crmApiURL, gotoAppPage, isCrmApiHealthy, waitForApiMutation } from "./helpers";

test.describe("CRM Meetings", () => {
  test("meetings index loads and create form is visible", async ({ page, request }) => {
    test.skip(!(await isCrmApiHealthy(request)), "CRM API not running");

    await gotoAppPage(page, "/crm/meetings", "page-crm-meetings");
    await expect(page.getByTestId("create-meeting-button")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Meetings" })).toBeVisible();
  });

  test("can create a meeting from the UI", async ({ page, request }) => {
    test.skip(!(await isCrmApiHealthy(request)), "CRM API not running");

    const title = `E2E Meeting ${Date.now()}`;
    await gotoAppPage(page, "/crm/meetings", "page-crm-meetings");
    await page.getByTestId("create-meeting-button").click();
    await page.getByPlaceholder("Discovery call").fill(title);
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);
    await page.locator('input[type="datetime-local"]').fill(scheduledAt.toISOString().slice(0, 16));
    await waitForApiMutation(page, "/api/v1/meetings", "POST", async () => {
      await page.getByRole("button", { name: "Create meeting" }).click();
    });
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("CRM Meetings API (stub auth)", () => {
  test("meeting linked to a deal logs a meeting activity on that deal's timeline", async ({ request }) => {
    test.skip(!(await isCrmApiHealthy(request)), "CRM API not running");

    const email = `e2e-crm-meetings-${Date.now()}@test.com`;
    const headers = { "content-type": "application/json", "x-stub-user-email": email };

    const companyRes = await request.post(`${crmApiURL}/api/v1/companies`, { headers, data: { name: "Meeting Co" } });
    const company = await companyRes.json();
    const dealRes = await request.post(`${crmApiURL}/api/v1/deals`, {
      headers,
      data: { name: "Meeting Deal", companyId: company.id },
    });
    const deal = await dealRes.json();

    const meetingRes = await request.post(`${crmApiURL}/api/v1/meetings`, {
      headers,
      data: { title: "Kickoff", scheduledAt: new Date(Date.now() + 3600_000).toISOString(), dealId: deal.id },
    });
    expect(meetingRes.status()).toBe(201);

    const activitiesRes = await request.get(
      `${crmApiURL}/api/v1/activities?entityType=deal&entityId=${deal.id}`,
      { headers: { "x-stub-user-email": email } }
    );
    const activities = await activitiesRes.json();
    expect(activities.data.some((a: { activityType: string }) => a.activityType === "meeting")).toBeTruthy();
  });
});
