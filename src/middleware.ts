import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextFetchEvent } from "next/server";
import { NextResponse, NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/login(.*)",
  "/sign-up(.*)",
  "/auth/callback",
  "/",
]);

/** Only protect known app routes — unknown paths fall through to Next.js 404. */
const isProtectedRoute = createRouteMatcher([
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
  "/ai(.*)",
  // R19.3 — CRO Copilot. Deliberately NOT "/admin(.*)" — /admin/import uses its own
  // static-secret auth (see docs/tickets) and must stay outside Clerk's protection.
  "/admin/cro(.*)",
]);

const useClerkMiddleware =
  process.env.E2E_AUTH_BYPASS !== "true" &&
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const clerkMiddlewareOptions = {
  signInUrl: process.env.CLERK_SIGN_IN_URL ?? process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
  signUpUrl: process.env.CLERK_SIGN_UP_URL ?? process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
};

const clerkHandler = useClerkMiddleware
  ? clerkMiddleware(async (auth, request) => {
      if (isProtectedRoute(request)) {
        auth().protect();
      }
    }, clerkMiddlewareOptions)
  : null;

/**
 * When behind API Gateway → ALB, Clerk must build handshake redirects against the
 * public HTTPS origin, not the internal ALB host. We only override the forwarded
 * headers Clerk reads — we do NOT rewrite `nextUrl`, which would make Next.js try to
 * proxy to an external origin (causing request stalls / loops).
 */
function requestWithPublicOrigin(request: NextRequest): NextRequest {
  const publicOrigin =
    request.headers.get("x-skout-public-origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.CLERK_SIGN_IN_URL?.replace(/\/(sign-in|login)$/, "");
  if (!publicOrigin) return request;

  try {
    const origin = new URL(publicOrigin);
    const headers = new Headers(request.headers);
    headers.set("host", origin.host);
    headers.set("x-forwarded-host", origin.host);
    headers.set("x-forwarded-proto", origin.protocol.replace(":", ""));
    return new NextRequest(request.nextUrl, { headers });
  } catch {
    return request;
  }
}

/** ALB health checks hit `/` with no cookies — never run Clerk for them. */
function isHealthCheck(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  return ua.startsWith("ELB-HealthChecker");
}

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (!clerkHandler || isHealthCheck(request)) {
    return NextResponse.next();
  }
  return clerkHandler(requestWithPublicOrigin(request), event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
