import { test, expect } from "@playwright/test";

/**
 * §8.15 SP-16 — manual verification of the GTM-learning report against real logged-in data.
 * NOT part of the regular CI suite (no E2E_AUTH_BYPASS possible here — the backend endpoint
 * needs a real, authenticated workspace with actual gtm_learning_outcomes rows). Run this one
 * test file by itself, headed, from the Playwright extension (or `npx playwright test
 * sp16-gtm-learning-manual --headed --project=chromium`) so you can see the real browser and
 * type the 2FA email code yourself when Clerk asks for it — that's the one step this can't
 * automate blindly.
 */
test("GTM-learning report renders real data after manual login", async ({ page }) => {
  await page.goto("/");

  // Fill in the real Clerk sign-in form yourself if this pauses before you're done —
  // this only pre-fills email/password so you don't have to type them.
  const identifier = page.locator('input[name="identifier"]').first();
  if (await identifier.isVisible({ timeout: 10000 }).catch(() => false)) {
    await identifier.fill(process.env.SKOUT_TEST_EMAIL ?? "");
    const password = page.locator('input[name="password"]').first();
    if (await password.isVisible({ timeout: 5000 }).catch(() => false)) {
      await password.fill(process.env.SKOUT_TEST_PASSWORD ?? "");
    }
  }

  // Pauses here with the Playwright Inspector open. Click through (or type the 6-digit email
  // code Clerk just sent) in the actual browser window, then hit "Resume" in the Inspector
  // toolbar to let the test continue.
  await page.pause();

  // Relative URL resolution against a baseURL with no trailing slash ("http://127.0.0.1:3000/app")
  // drops the "/app" segment entirely either way (leading "/" replaces from the origin; no
  // leading "/" replaces the last path segment, same result) — hardcode the full path instead of
  // fighting WHATWG URL-joining rules.
  await page.goto("http://127.0.0.1:3000/app/admin/gtm-learning");

  // The product tour modal can cover the page on a fresh login — dismiss it if present.
  const skipTour = page.getByRole("button", { name: "Skip for now" });
  if (await skipTour.isVisible({ timeout: 5000 }).catch(() => false)) {
    await skipTour.click();
  }

  // "Checking workspace setup…" is the ICP-onboarding gate settling after a real login — give it
  // real time rather than the tight 15s default, since this is a genuine network round trip, not
  // a stub.
  await expect(page.getByText("GTM-learning report")).toBeVisible({ timeout: 30000 });

  // Whatever real data exists, these should always be present.
  await expect(page.getByText("Qualified pipeline")).toBeVisible();
  await expect(page.getByText("Revenue (closed-won)")).toBeVisible();
  await expect(page.getByRole("button", { name: "By channel" })).toBeVisible();
  await expect(page.getByRole("button", { name: "By signal type" })).toBeVisible();
  await expect(page.getByRole("button", { name: "By ICP priority" })).toBeVisible();

  // Exercise the slice switch and refresh without asserting specific numbers — those depend on
  // whatever's actually in this workspace right now.
  await page.getByRole("button", { name: "By signal type" }).click();
  await page.getByRole("button", { name: "By ICP priority" }).click();
  await page.getByRole("button", { name: "By channel" }).click();

  await page.getByRole("button", { name: /Refresh/ }).click();
  await page.waitForTimeout(3000);

  await page.screenshot({ path: "test-results/sp16-gtm-learning-real.png", fullPage: true });
});
