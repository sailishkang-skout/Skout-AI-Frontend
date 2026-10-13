import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000/app";
const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3001";
const crmApiURL = process.env.PLAYWRIGHT_CRM_API_URL ?? "http://127.0.0.1:3002";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            // --single-process gives a smaller footprint on a memory-constrained machine, but the
            // browser dies between tests (every other test fails with "browser has been closed"),
            // so it is opt-in: PLAYWRIGHT_SINGLE_PROCESS=true.
            ...(process.env.PLAYWRIGHT_SINGLE_PROCESS === "true" ? ["--single-process"] : []),
          ],
        },
      },
    },
    // Project for testing real token handling (no E2E_AUTH_BYPASS) - run locally with custom auth mode
    {
      name: "real-token-chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
      testIgnore: ["**/smoke.spec.ts", "**/*-bypass.spec.ts"], // Only run real-token tests here
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          // Use E2E_AUTH_BYPASS by default for all CI and standard tests
          E2E_AUTH_BYPASS: process.env.PLAYWRIGHT_REAL_TOKEN_TESTS === "true" ? "false" : "true",
          // Set auth mode to custom when running real token tests
          NEXT_PUBLIC_AUTH_MODE: process.env.PLAYWRIGHT_REAL_TOKEN_TESTS === "true" ? "custom" : "clerk",
          NEXT_PUBLIC_API_URL: apiURL,
          NEXT_PUBLIC_CRM_API_URL: crmApiURL,
          // Only blank Clerk keys when using stub auth bypass
          ...(process.env.PLAYWRIGHT_REAL_TOKEN_TESTS === "true" ? {} : {
            NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
            CLERK_SECRET_KEY: "",
          }),
        },
      },
  globalSetup: process.env.PLAYWRIGHT_SKIP_WEBSERVER ? undefined : "./e2e/global-setup.ts",
});