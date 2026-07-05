import { expect, type Page } from "@playwright/test";

const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3001";

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
