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
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async redirects() {
    return [
      // Dev convenience only: with basePath="/app" configured, Next 404s on the bare root by
      // design — `basePath: false` here matches the literal "/" outside that basePath so
      // localhost:3000 alone lands on /app instead of a 404. Not applied in production, where
      // the root domain may be served by something other than this app.
      ...(process.env.NODE_ENV === "production"
        ? []
        : [{ source: "/", destination: "/app", basePath: false, permanent: false }]),
    ];
  },
  async rewrites() {
    // Rewrites (not redirects) so /app/signin serves Clerk without a 307 — avoids a proxy loop
    // on www.skoutai.io when the marketing site maps /app/sign-in ↔ /app/signin in Location.
    return [
      { source: "/signin", destination: "/sign-in" },
      { source: "/signin/:path*", destination: "/sign-in/:path*" },
      { source: "/login", destination: "/sign-in" },
      { source: "/login/:path*", destination: "/sign-in/:path*" },
      { source: "/sign-up", destination: "/sign-in" },
      { source: "/sign-up/:path*", destination: "/sign-in/:path*" },
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
      process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || `${appUrl.replace(/\/$/, "")}/sign-in`,
    NEXT_PUBLIC_CLERK_SIGN_UP_URL:
      process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || `${appUrl.replace(/\/$/, "")}/sign-in`,
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