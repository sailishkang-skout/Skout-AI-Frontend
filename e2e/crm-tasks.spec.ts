import { test, expect } from "@playwright/test";
import { crmApiURL, gotoAppPage, isCrmApiHealthy, waitForApiMutation } from "./helpers";

test.describe("CRM Tasks", () => {
  test("tasks index loads and create form is visible", async ({ page, request }) => {
    test.skip(!(await isCrmApiHealthy(request)), "CRM API not running");

    await gotoAppPage(page, "/crm/tasks", "page-crm-tasks");
    await expect(page.getByTestId("create-task-button")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  });

  test("can create and complete a task from the UI", async ({ page, request }) => {
    test.skip(!(await isCrmApiHealthy(request)), "CRM API not running");

    const title = `E2E Task ${Date.now()}`;
    await gotoAppPage(page, "/crm/tasks", "page-crm-tasks");
    await page.getByTestId("create-task-button").click();
    await page.getByPlaceholder("Send updated proposal").fill(title);
    await waitForApiMutation(page, "/api/v1/tasks", "POST", async () => {
      await page.getByRole("button", { name: "Create task" }).click();
    });
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15_000 });

    await waitForApiMutation(page, "/complete", "POST", async () => {
      await page.getByLabel("Mark complete").first().click();
    });
  });
});

test.describe("CRM Tasks API (stub auth)", () => {
  test("POST /tasks then complete flips status to done", async ({ request }) => {
    test.skip(!(await isCrmApiHealthy(request)), "CRM API not running");

    const email = `e2e-crm-tasks-${Date.now()}@test.com`;
    const headers = { "content-type": "application/json", "x-stub-user-email": email };

    const createRes = await request.post(`${crmApiURL}/api/v1/tasks`, {
      headers,
      data: { title: "API Task" },
    });
    expect(createRes.status()).toBe(201);
    const task = await createRes.json();
    expect(task.status).toBe("open");

    const completeRes = await request.post(`${crmApiURL}/api/v1/tasks/${task.id}/complete`, {
      headers: { "x-stub-user-email": email },
    });
    expect(completeRes.ok()).toBeTruthy();
    const completed = await completeRes.json();
    expect(completed.status).toBe("done");
  });
});
