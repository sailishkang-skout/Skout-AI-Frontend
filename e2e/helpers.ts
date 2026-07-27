import { expect, type Page } from "@playwright/test";

const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3001";
export const crmApiURL = process.env.PLAYWRIGHT_CRM_API_URL ?? "http://127.0.0.1:3002";

/** Wait for a dashboard page shell and its primary data load. */
export async function gotoAppPage(page: Page, path: string, testId: string) {
  await page.goto(path);
  await expect(page.getByTestId(testId)).toBeVisible({ timeout: 30_000 });
}

/** Wait for a successful API mutation before asserting UI updates. */
export async function waitForApiMutation(
  page: Page,
  pathFragment: string,
  method: string,
  action: () => Promise<void>
) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(pathFragment) &&
      response.request().method() === method &&
      response.status() >= 200 &&
      response.status() < 300,
    { timeout: 30_000 }
  );
  await action();
  await responsePromise;
}

export async function waitForApiHealth(request: import("@playwright/test").APIRequestContext) {
  const res = await request.get(`${apiURL}/api/v1/health`);
  expect(res.ok()).toBeTruthy();
}

export async function waitForCrmApiHealth(request: import("@playwright/test").APIRequestContext) {
  const res = await request.get(`${crmApiURL}/api/v1/crm/health`);
  expect(res.ok()).toBeTruthy();
}

/** Non-asserting health check — used to self-skip crm-*.spec.ts in environments
 * that don't run apps/crm (e.g. CI until it's wired up there too). */
export async function isCrmApiHealthy(request: import("@playwright/test").APIRequestContext): Promise<boolean> {
  try {
    const res = await request.get(`${crmApiURL}/api/v1/crm/health`);
    return res.ok();
  } catch {
    return false;
  }
}
