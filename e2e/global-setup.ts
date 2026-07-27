import type { FullConfig } from "@playwright/test";

const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3001";
const crmApiURL = process.env.PLAYWRIGHT_CRM_API_URL ?? "http://127.0.0.1:3002";

async function waitForHealth(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

export default async function globalSetup(_config: FullConfig) {
  const apiHealthy = await waitForHealth(`${apiURL}/api/v1/health`);
  if (!apiHealthy) {
    throw new Error(`API health check failed at ${apiURL}/api/v1/health`);
  }

  // The CRM service (apps/crm) is a separate process from the main API. It's only
  // required for the crm-*.spec.ts specs (which each skip themselves via
  // waitForCrmApiHealth if it's unreachable) — not asserted here, so environments
  // that don't yet run apps/crm (see CI) don't fail every other spec.
  const crmHealthy = await waitForHealth(`${crmApiURL}/api/v1/crm/health`);
  if (!crmHealthy) {
    console.warn(
      `CRM API not reachable at ${crmApiURL} — crm-*.spec.ts tests will skip themselves.`
    );
  }
}
