import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextFetchEvent } from "next/server";
import { NextResponse, NextRequest } from "next/server";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { PROTECTED_ROUTE_PATTERNS, APP_BASE_PATH } from "@/lib/auth/routes";
import { SESSION_COOKIE, authApiBase } from "@/lib/auth/bff";
import { GATE_COOKIE_NAME, hashGateToken, isGatePath, safeNextPath } from "@/lib/gate";
import { GATE_TOKEN_VALUE } from "@/lib/gate-token.generated";
import { appProxy } from "@/lib/app-proxy";

/**
 * Route tables live in `@/lib/auth/routes` (AUTH-FE-03). next.config.mjs sets basePath: "/app" —
 * Next does NOT strip that prefix from request.nextUrl.pathname inside middleware, so every
 * pattern must carry it too. CRITICAL BUG found while full-testing SP-11/SP-12: without this
 * prefix, `isProtectedRoute` silently matched nothing (pathname was always "/app/..." against
 * patterns starting "/dashboard", "/settings", etc.), so `auth().protect()` never ran and every
 * dashboard route was reachable signed-out at the middleware layer.
 */
const isProtectedRoute = createRouteMatcher(PROTECTED_ROUTE_PATTERNS);

// Determine auth mode once at module load
const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE;
const isClerkMode = AUTH_MODE !== "custom";
const useClerkMiddleware =
  isClerkMode &&
  process.env.E2E_AUTH_BYPASS !== "true" &&
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

// JWKS setup for custom mode
let remoteJwks: { base: string; keySet: JWTVerifyGetKey } | null = null;
function jwksFor(base: string): JWTVerifyGetKey {
  if (!remoteJwks || remoteJwks.base !== base) {
    remoteJwks = { base, keySet: createRemoteJWKSet(new URL(`${base}/.well-known/jwks.json`)) };
  }
  return remoteJwks.keySet;
}

// Custom session verification for custom mode
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
  const gateToken = GATE_TOKEN_VALUE || process.env.GATE_TOKEN;
  if (!gateToken) return null;
  if (isGatePath(request.nextUrl.pathname)) return null;

  const cookie = request.cookies.get(GATE_COOKIE_NAME)?.value;
  if (cookie && cookie === (await hashGateToken(gateToken))) return null;

  // .clone() (not `new URL(path, request.url)`) so basePath ("/app") is preserved.
  // Never copy Clerk handshake / other query params into `next` — that 431s proxies.
  const gateUrl = request.nextUrl.clone();
  gateUrl.pathname = "/gate";
  gateUrl.search = "";
  gateUrl.searchParams.set("next", safeNextPath(request.nextUrl.pathname));
  return NextResponse.redirect(gateUrl);
}

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  if (isHealthCheck(request)) {
    return NextResponse.next();
  }
  
  // Run app proxy logic first - handles Clerk path rewrites, sign-in redirects, oversized payloads
  const proxyResponse = await appProxy(request);
  // If the proxy returned a response (redirect or rewrite), use it
  if (proxyResponse && proxyResponse.headers.get("Location")) {
    return proxyResponse;
  }
  
  // Use the rewritten request from the proxy if it was modified - preserve all headers from the proxy's rewritten request
  let processedRequest = proxyResponse?.headers.get("x-skout-proxied") 
    ? new NextRequest(proxyResponse.headers.get("Location") || request.url, { 
        headers: new Headers(proxyResponse.headers) // Copy all headers including x-skout-proxied
      })
    : request;

  // Runs regardless of auth mode — the gate's whole point is to block access
  // before any auth check, so it must not get skipped.
  const gated = await gateCheck(processedRequest);
  if (gated) return gated;

  // Process with public origin header
  processedRequest = requestWithPublicOrigin(processedRequest);

  // Clerk mode - use existing clerk middleware
  if (clerkHandler) {
    return clerkHandler(processedRequest, event);
  }

  // Custom mode - implement our own auth check
  if (!isClerkMode) {
    // Check if this is a protected route
    if (isProtectedRoute(processedRequest)) {
      // Get session cookie
      const sessionToken = processedRequest.cookies.get(SESSION_COOKIE)?.value;
      const isAuthenticated = sessionToken ? await verifySessionCookie(sessionToken) : false;

      if (!isAuthenticated) {
        // Check if there's an existing Clerk session (any Clerk cookie exists)
        const hasClerkCookies = processedRequest.cookies.getAll().some(cookie => 
          cookie.name.startsWith('__clerk_') || cookie.name.startsWith('clerk_')
        );
        
        // Redirect to sign-in page with validated next parameter
        const signInUrl = processedRequest.nextUrl.clone();
        signInUrl.pathname = `${APP_BASE_PATH}/sign-in`;
        signInUrl.search = "";
        // Use safeNextPath to prevent open redirects
        const nextPath = safeNextPath(processedRequest.nextUrl.pathname);
        if (nextPath) {
          signInUrl.searchParams.set("next", nextPath);
        }
        // Add clerk_session_ended flag if we detected an existing Clerk session that needs migration
        if (hasClerkCookies) {
          signInUrl.searchParams.set("clerk_session_ended", "true");
        }
        return NextResponse.redirect(signInUrl);
      }
    }
  }

  return NextResponse.next();
}

// Matchers must be static for Next.js to analyze correctly
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};