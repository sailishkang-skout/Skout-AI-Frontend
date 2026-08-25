import { createRequire } from "module";
/** @type {import('next').NextConfig} */
import { withSentryConfig } from "@sentry/nextjs";

const require = createRequire(import.meta.url);

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.NODE_ENV === "production" ? "https://www.skoutai.io/app" : "http://localhost:3000/app");

const nextConfig = {
  output: process.platform === "win32" ? undefined : "standalone",
  reactStrictMode: true,
  basePath: "/app",
  async redirects() {
    return [
      { source: "/sign-in", destination: "/signin", permanent: false },
      { source: "/sign-in/:path*", destination: "/signin/:path*", permanent: false },
      { source: "/login", destination: "/signin", permanent: false },
      { source: "/login/:path*", destination: "/signin/:path*", permanent: false },
      { source: "/singin", destination: "/signin", permanent: false },
      // Dev convenience only: with basePath="/app" configured, Next 404s on the bare root by
      // design — `basePath: false` here matches the literal "/" outside that basePath so
      // localhost:3000 alone lands on /app instead of a 404. Not applied in production, where
      // the root domain may be served by something other than this app.
      ...(process.env.NODE_ENV === "production"
        ? []
        : [{ source: "/", destination: "/app", basePath: false, permanent: false }]),
    ];
  },
  env: {
    // Exposed to client so E2E can skip Clerk + onboarding gates (see icp-enforcement.tsx).
    E2E_AUTH_BYPASS: process.env.E2E_AUTH_BYPASS ?? "",
    // Production behind the shared ALB uses relative /api/* (same origin, no CORS).
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ??
      (process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:3001"),
    NEXT_PUBLIC_APP_URL: appUrl,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL:
      process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || `${appUrl.replace(/\/$/, "")}/signin`,
    NEXT_PUBLIC_CLERK_SIGN_UP_URL:
      process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || (appUrl ? `${appUrl}/sign-up` : ""),
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "www.skoutai.io",
        "skoutai.io",
        ...(appUrl ? [new URL(appUrl).host] : []),
      ],
    },
  },
  webpack: (config) => {
    // pnpm can fail to resolve Next.js internal flight loaders from the project root.
    const loaderDir = "next/dist/build/webpack/loaders";
    config.resolveLoader = {
      ...config.resolveLoader,
      alias: {
        ...(config.resolveLoader?.alias ?? {}),
        "next-flight-client-entry-loader": require.resolve(`${loaderDir}/next-flight-client-entry-loader`),
        "next-flight-action-entry-loader": require.resolve(`${loaderDir}/next-flight-action-entry-loader`),
        "next-flight-client-module-loader": require.resolve(`${loaderDir}/next-flight-client-module-loader`),
      },
    };
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
});
