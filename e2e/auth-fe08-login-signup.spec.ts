import { test, expect } from "@playwright/test";

/**
 * AUTH-FE-08 — own-auth login/signup UI, exercised in a real browser against a real API.
 *
 * Needs: the web app with NEXT_PUBLIC_AUTH_MODE=custom, the API with AUTH_CUSTOM_ENABLED=true.
 * Run with:
 *   PLAYWRIGHT_AUTH_BFF_TESTS=true PLAYWRIGHT_AUTH_EMAIL=... PLAYWRIGHT_AUTH_PASSWORD=... \
 *   pnpm playwright test e2e/auth-fe08-login-signup.spec.ts --project=real-token-chromium
 * Skipped otherwise (same gate as e2e/auth-bff.spec.ts).
 */
const EMAIL = process.env.PLAYWRIGHT_AUTH_EMAIL ?? "";
const PASSWORD = process.env.PLAYWRIGHT_AUTH_PASSWORD ?? "";

test.skip(
  process.env.PLAYWRIGHT_AUTH_BFF_TESTS !== "true" || !EMAIL || !PASSWORD,
  "Set PLAYWRIGHT_AUTH_BFF_TESTS=true with PLAYWRIGHT_AUTH_EMAIL/PASSWORD to run"
);

test.describe("AUTH-FE-08 login/signup UI", () => {
  test("identifier-first login: email step, then password step, lands signed in", async ({ page }) => {
    await page.goto("/app/sign-in");
    await expect(page.getByLabel(/^email$/i)).toBeVisible();
    // Password field isn't shown yet — identifier-first.
    await expect(page.getByLabel(/^password$/i)).toHaveCount(0);

    await page.getByLabel(/^email$/i).fill(EMAIL);
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    await page.getByLabel(/^password$/i).fill(PASSWORD);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    // auth/callback decides onboarding vs dashboard — either way we've left the sign-in page.
    await page.waitForURL(/\/app\/(onboarding|dashboard)/, { timeout: 15000 });

    // The access token must never land in web storage.
    const storage = await page.evaluate(() => ({
      local: JSON.stringify({ ...localStorage }),
      session: JSON.stringify({ ...sessionStorage }),
    }));
    expect(storage.local).not.toMatch(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/); // no JWT-shaped value
    expect(storage.session).not.toMatch(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);
  });

  test("wrong password shows the same generic message a nonexistent account would", async ({ page }) => {
    await page.goto("/app/sign-in");
    await page.getByLabel(/^email$/i).fill(EMAIL);
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByLabel(/^password$/i).fill(`${PASSWORD}-wrong`);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page.getByRole("alert")).toContainText(/invalid email or password/i);
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("signup reaches the check-your-email state without signing the user in", async ({ page }) => {
    const uniqueEmail = `fe08-e2e-${Date.now()}@example.test`;
    await page.goto("/app/sign-up");

    await page.getByLabel(/full name/i).fill("FE-08 E2E");
    await page.getByLabel(/^email$/i).fill(uniqueEmail);
    await page.getByLabel(/^password$/i).fill("correct horse battery staple");
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByText(/check your email/i)).toBeVisible();
    await expect(page.getByText(uniqueEmail)).toBeVisible();

    // Signup must not establish a session — going to sign-in should still show a fresh sign-in form.
    await page.getByRole("link", { name: /back to sign in/i }).click();
    await expect(page.getByLabel(/^email$/i)).toBeVisible();
  });
});
