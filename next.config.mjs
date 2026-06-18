/** @type {import('next').NextConfig} */
import { withSentryConfig } from "@sentry/nextjs";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";

const nextConfig = {
  output: process.platform === "win32" ? undefined : "standalone",
  reactStrictMode: true,
  env: {
    // Production behind the shared ALB uses relative /api/* (same origin, no CORS).
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ??
      (process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:3001"),
    NEXT_PUBLIC_APP_URL: appUrl,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL:
      process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || (appUrl ? `${appUrl}/sign-in` : ""),
    NEXT_PUBLIC_CLERK_SIGN_UP_URL:
      process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || (appUrl ? `${appUrl}/sign-up` : ""),
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        ...(appUrl ? [new URL(appUrl).host] : []),
      ],
    },
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
});
