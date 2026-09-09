import { expect, type Page } from "@playwright/test";

const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3001";
export const crmApiURL = process.env.PLAYWRIGHT_CRM_API_URL ?? "http://127.0.0.1:3002";

/** Wait for a dashboard page shell and its primary data load. */
export async function gotoAppPage(page: Page, path: string, testId: string) {
  // Pre-seed localStorage to dismiss product tour so modal never blocks testing
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem(
        "skout.productTour.v2",
        JSON.stringify({ welcomeSeen: true, dismissed: true, completed: true })
      );
    } catch {}
  });

  // Next.js uses basePath="/app", so ensure path routes under /app
  const target = path.startsWith("/app") ? path : `/app${path.startsWith("/") ? path : `/${path}`}`;
  await page.goto(target, { 
    waitUntil: "domcontentloaded",
    timeout: 45_000
  });

  // If tour modal appears, dismiss it immediately
  const skipBtn = page.getByRole("button", { name: /Skip for now/i });
  if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipBtn.click().catch(() => {});
  }
  
  // First check if we hit an error state ("Something went wrong")
  const errorElement = page.getByText("Something went wrong");
  if (await errorElement.isVisible({ timeout: 1000 }).catch(() => false)) {
    throw new Error(`Page loaded but showed error state: "${await errorElement.textContent()}"`);
  }
  
  // Add screenshot for debugging if element not found
  try {
    await expect(page.getByTestId(testId)).toBeVisible({ timeout: 45_000 });
  } catch (e) {
    await page.screenshot({ path: `test-failure-${testId}.png`, fullPage: true });
    throw e;
  }
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