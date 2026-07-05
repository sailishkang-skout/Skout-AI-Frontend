import type { FullConfig } from "@playwright/test";

const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3001";

export default async function globalSetup(_config: FullConfig) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const res = await fetch(`${apiURL}/api/v1/health`);
      if (res.ok) return;
    } catch {
      // API still starting in CI workflow step
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`API health check failed at ${apiURL}/api/v1/health`);
}
