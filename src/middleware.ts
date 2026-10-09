import type { NextFetchEvent } from "next/server";
import { NextResponse, NextRequest } from "next/server";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { PROTECTED_ROUTE_PATTERNS, APP_BASE_PATH } from "@/lib/auth/routes";
import { SESSION_COOKIE, authApiBase } from "@/lib/auth/bff";
import { GATE_COOKIE_NAME, hashGateToken, isGatePath, safeNextPath } from "@/lib/gate";
import { GATE_TOKEN_VALUE } from "@/lib/gate-token.generated";
import { appProxy, buildProcessedRequest } from "@/lib/app-proxy";

/**
 * Route tables live in `@/lib/auth/routes` (AUTH-FE-03). next.config.mjs sets basePath: "/app" —
 * Next does NOT strip that prefix from request.nextUrl.pathname inside middleware, so every
 * pattern must carry it too. CRITICAL BUG found while full-testing SP-11/SP-12: without this
 * prefix, `isProtectedRoute` silently matched nothing (pathname was always "/app/..." against
 * patterns starting "/dashboard", "/settings", etc.), so the own-auth check below never ran and
 * every dashboard route was reachable signed-out at the middleware layer.
 */
function isProtectedRoute(request: NextRequest): boolean {
  return PROTECTED_ROUTE_PATTERNS.some((p) => new RegExp(`^${p}$`).test(request.nextUrl.pathname));
}

/**
 * Playwright runs (`playwright.config.ts` sets E2E_AUTH_BYPASS=true on `pnpm dev`) use stub auth,
 * like `lib/api-client.ts` does. The Clerk middleware honoured this flag; AUTH-FE-18 dropped it, so
 * every protected e2e page bounced to sign-in. Never active in a production build.
 */
export function e2eAuthBypass(env: { E2E_AUTH_BYPASS?: string; NODE_ENV?: string } = process.env): boolean {
  return env.E2E_AUTH_BYPASS === "true" && env.NODE_ENV !== "production";
}

// JWKS setup for own-auth session verification
let remoteJwks: { base: string; keySet: JWTVerifyGetKey } | null = null;
function jwksFor(base: string): JWTVerifyGetKey {
  if (!remoteJwks || remoteJwks.base !== base) {
    remoteJwks = { base, keySet: createRemoteJWKSet(new URL(`${base}/.well-known/jwks.json`)) };
  }
  return remoteJwks.keySet;
}

async function verifySessionCookie(token: string): Promise<boolean> {
  const base = authApiBase();
  if (!base) return false;
  try {
    const { payload } = await jwtVerify(token, jwksFor(base), {
      issuer: process.env.AUTH_JWT_ISSUER || "https://auth.skoutai.io",
      audience: process.env.AUTH_JWT_AUDIENCE || "skout-api",
      algorithms: ["RS256"],
      clockTolerance: 30,
    });
    return typeof payload.sub === "string" && !!payload.sub;
  } catch {
    return false;
  }
}

/**
 * When behind API Gateway → ALB, own-auth's JWKS fetch and any redirect built from request.url
 * must use the public HTTPS origin, not the internal ALB host. We only override the forwarded
 * headers — we do NOT rewrite `nextUrl`, which would make Next.js try to proxy to an external
 * origin (causing request stalls / loops).
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

/** ALB health checks hit `/` with no cookies — never run auth checks for them. */
function isHealthCheck(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  return ua.startsWith("ELB-HealthChecker");
}

/**
 * Temporary shared-secret gate in front of the whole app (real users hitting sign-up while
 * we're not ready for them). Set GATE_TOKEN to enable; unset it to disable entirely — nothing
 * else changes. Runs before the auth check so it also blocks the sign-in/sign-up pages themselves.
 * See src/app/gate/ and src/lib/gate.ts.
 */
async function gateCheck(request: NextRequest): Promise<NextResponse | null> {
  const gateToken = GATE_TOKEN_VALUE || process.env.GATE_TOKEN;
  if (!gateToken) return null;
  if (isGatePath(request.nextUrl.pathname)) return null;

  const cookie = request.cookies.get(GATE_COOKIE_NAME)?.value;
  if (cookie && cookie === (await hashGateToken(gateToken))) return null;

  // .clone() (not `new URL(path, request.url)`) so basePath ("/app") is preserved.
  // Never copy a handshake or other oversized query params into `next` — that 431s proxies.
  const gateUrl = request.nextUrl.clone();
  gateUrl.pathname = "/gate";
  gateUrl.search = "";
  gateUrl.searchParams.set("next", safeNextPath(request.nextUrl.pathname));
  return NextResponse.redirect(gateUrl);
}

export default async function middleware(request: NextRequest, _event: NextFetchEvent) {
  if (isHealthCheck(request)) {
    return NextResponse.next();
  }

  // Run app proxy logic first - handles sign-in path redirects, oversized payloads
  const proxyResponse = await appProxy(request);
  // appProxy() overloads the "Location" header two ways: a real redirect (NextResponse.redirect,
  // status 3xx — oversized-payload workaround, /app/signin -> /app/sign-in loop avoidance) that
  // must be sent to the browser as-is, and an internal-only rewrite signal on a
  // NextResponse.next() (status 200) used further down to build `processedRequest`. Returning a
  // 200-with-Location response directly to the browser is not a real redirect — browsers only
  // follow Location on a 3xx status — so every request that hit the internal-signal path was
  // rendering blank (found via AUTH-ADI-14 rehearsal, 2026-09-30). Only return proxyResponse
  // as-is when it's an actual redirect.
  if (proxyResponse && proxyResponse.status >= 300 && proxyResponse.status < 400) {
    return proxyResponse;
  }

  // See buildProcessedRequest's own comment — it preserves the browser's real headers (cookies
  // included), which building this from `proxyResponse.headers` used to silently drop.
  let processedRequest = buildProcessedRequest(request, proxyResponse);

  // Runs regardless — the gate's whole point is to block access before any auth check, so it
  // must not get skipped.
  const gated = await gateCheck(processedRequest);
  if (gated) return gated;

  // Process with public origin header
  processedRequest = requestWithPublicOrigin(processedRequest);

  // Own-auth protected-route check (Clerk removed — AUTH-FE-18).
  if (!e2eAuthBypass() && isProtectedRoute(processedRequest)) {
    const sessionToken = processedRequest.cookies.get(SESSION_COOKIE)?.value;
    const isAuthenticated = sessionToken ? await verifySessionCookie(sessionToken) : false;

    if (!isAuthenticated) {
      // Any real user still carrying a pre-cutover Clerk cookie needs to be told their old
      // session ended, not just silently bounced to sign-in — kept for that transition window,
      // independent of the (now-removed) Clerk SDK itself.
      const hasStaleClerkCookies = processedRequest.cookies.getAll().some(
        (cookie) => cookie.name.startsWith("__clerk_") || cookie.name.startsWith("clerk_")
      );

      const signInUrl = processedRequest.nextUrl.clone();
      signInUrl.pathname = `${APP_BASE_PATH}/sign-in`;
      signInUrl.search = "";
      const nextPath = safeNextPath(processedRequest.nextUrl.pathname);
      if (nextPath) {
        signInUrl.searchParams.set("next", nextPath);
      }
      if (hasStaleClerkCookies) {
        signInUrl.searchParams.set("clerk_session_ended", "true");
      }
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.next();
}

// Matchers must be static for Next.js to analyze correctly
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
