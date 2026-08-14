import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000/app";
const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:3001";
const crmApiURL = process.env.PLAYWRIGHT_CRM_API_URL ?? "http://localhost:3002";

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
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: "pnpm dev",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            ...process.env,
            E2E_AUTH_BYPASS: "true",
            NEXT_PUBLIC_API_URL: apiURL,
            NEXT_PUBLIC_CRM_API_URL: crmApiURL,
            NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
            CLERK_SECRET_KEY: "",
          },
        },
      ],
  globalSetup: process.env.PLAYWRIGHT_SKIP_WEBSERVER ? undefined : "./e2e/global-setup.ts",
});
