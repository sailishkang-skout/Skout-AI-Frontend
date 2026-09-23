import { createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";

/**
 * next.config.mjs sets basePath: "/app" — Next does NOT strip that prefix from
 * request.nextUrl.pathname inside middleware, so every pattern below must carry it too.
 */
export const APP_BASE_PATH = "/app";

export const PUBLIC_ROUTE_SUFFIXES = [
  "/sign-in(.*)",
  "/signin(.*)",
  "/singin(.*)",
  "/login(.*)",
  "/sign-up(.*)",
  "/auth/callback",
  "",
];

/** Only protect known app routes — unknown paths fall through to Next.js 404. */
export const PROTECTED_ROUTE_SUFFIXES = [
  "/dashboard(.*)",
  "/prospects(.*)",
  "/lists(.*)",
  "/smart-lists(.*)",
  "/enrichment(.*)",
  "/analytics(.*)",
  "/settings(.*)",
  "/onboarding(.*)",
  "/sequences(.*)",
  "/inbox(.*)",
  "/deliverability(.*)",
  "/warmup(.*)",
  "/ai(.*)",
  "/crm(.*)",
  "/intelligence(.*)",
  "/signals(.*)",
  // R19.3 — CRO Copilot. Deliberately NOT "/admin(.*)" — /admin/import uses its own
  // static-secret auth (see docs/tickets) and must stay outside Clerk's protection.
  "/admin/cro(.*)",
  "/admin/control-plane(.*)",
  // Found missing while full-testing SP-11/SP-12: these rendered the dashboard shell for
  // signed-out visitors (client-side gates only fail the API calls, they never redirect).
  "/dexter(.*)",
  "/decisions(.*)",
  "/workflows(.*)",
  "/tam(.*)",
  "/guides(.*)",
  "/linkedin(.*)",
  "/import(.*)",
  "/admin/competitive(.*)",
  "/admin/gtm-learning(.*)",
  "/admin/incidents(.*)",
  "/admin/model-performance(.*)",
  "/admin/reporting(.*)",
  "/admin/revenue(.*)",
];

/** Top-level segments under `src/app/(dashboard)/` — kept in sync with the app tree for tests. */
export const DASHBOARD_ROUTE_GROUPS = [
  "admin",
  "ai",
  "analytics",
  "crm",
  "dashboard",
  "decisions",
  "deliverability",
  "dexter",
  "enrichment",
  "guides",
  "import",
  "inbox",
  "intelligence",
  "linkedin",
  "lists",
  "onboarding",
  "prospects",
  "sequences",
  "settings",
  "signals",
  "smart-lists",
  "tam",
  "warmup",
  "workflows",
] as const;

export function withAppBasePath(paths: string[]): string[] {
  return paths.map((p) => `${APP_BASE_PATH}${p}`);
}

export const PUBLIC_ROUTE_PATTERNS = withAppBasePath(PUBLIC_ROUTE_SUFFIXES);
export const PROTECTED_ROUTE_PATTERNS = withAppBasePath(PROTECTED_ROUTE_SUFFIXES);

const isPublicRouteMatcher = createRouteMatcher(PUBLIC_ROUTE_PATTERNS);
const isProtectedRouteMatcher = createRouteMatcher(PROTECTED_ROUTE_PATTERNS);

export function requestForPathname(pathname: string): NextRequest {
  return new NextRequest(new URL(`http://localhost${pathname}`));
}

export function isPublicPathname(pathname: string): boolean {
  return isPublicRouteMatcher(requestForPathname(pathname));
}

export function isProtectedPathname(pathname: string): boolean {
  return isProtectedRouteMatcher(requestForPathname(pathname));
}
