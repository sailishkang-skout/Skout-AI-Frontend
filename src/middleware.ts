import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextFetchEvent } from "next/server";
import { NextResponse, NextRequest } from "next/server";
import { GATE_COOKIE_NAME, hashGateToken } from "@/lib/gate";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/signin(.*)",
  "/singin(.*)",
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
  // Pre-existing gap found while adding /intelligence below: CRM pages (companies, contacts,
  // deals, tasks, meetings, calendar) were never in this list, so Clerk never protected them.
  "/crm(.*)",
  "/intelligence(.*)",
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
    "https://www.skoutai.io/app";
  if (!publicOrigin) return request;

  try {
    const origin = new URL(publicOrigin.startsWith("http") ? publicOrigin : `https://${publicOrigin}`);
    const headers = new Headers(request.headers);
    headers.set("host", origin.host);
    headers.set("x-forwarded-host", origin.host);
    headers.set("x-forwarded-proto", origin.protocol.replace(":", "") || "https");
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

/**
 * Temporary shared-secret gate in front of the whole app (real users hitting sign-up while
 * we're not ready for them). Set GATE_TOKEN to enable; unset it to disable entirely — nothing
 * else changes. Runs before Clerk so it also blocks the sign-in/sign-up pages themselves.
 * See src/app/gate/ and src/lib/gate.ts.
 */
async function gateCheck(request: NextRequest): Promise<NextResponse | null> {
  const gateToken = process.env.GATE_TOKEN;
  if (!gateToken) return null;
  if (request.nextUrl.pathname.startsWith("/gate")) return null;

  const cookie = request.cookies.get(GATE_COOKIE_NAME)?.value;
  if (cookie && cookie === (await hashGateToken(gateToken))) return null;

  // .clone() (not `new URL(path, request.url)`) so basePath ("/app") is preserved.
  const gateUrl = request.nextUrl.clone();
  gateUrl.pathname = "/gate";
  gateUrl.search = "";
  gateUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(gateUrl);
}

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  if (isHealthCheck(request)) {
    return NextResponse.next();
  }
  // Runs regardless of Clerk's config state — the gate's whole point is to block access
  // before any auth check, so it must not get skipped just because Clerk is unconfigured.
  const gated = await gateCheck(request);
  if (gated) return gated;
  if (!clerkHandler) {
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
