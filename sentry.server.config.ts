import * as Sentry from "@sentry/nextjs";
import { isConfiguredSecret } from "./src/lib/observability-keys";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (isConfiguredSecret(dsn)) {
  try {
    Sentry.init({
      dsn,
      enabled: true,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
  } catch {
    // Invalid/expired DSN — app runs without Sentry.
  }
}
