/**
 * AUTH-FE-05 — own-auth same-origin route-handler layer (ADR-0007 D2: BFF).
 *
 * The browser never talks to the API's auth endpoints directly. The route handlers under
 * `src/app/api/auth/*` (served at /app/api/auth/*) forward credentials to the API server-side,
 * keep the refresh token in a first-party HttpOnly cookie on the app origin, and hand the access
 * token back in the response body for the client to hold in memory only (never localStorage).
 *
 * Cookies (all on the app origin, all Secure in production):
 * - skout_app_refresh  HttpOnly, SameSite=Strict, Path=/app/api/auth — only these handlers see it.
 * - skout_app_session  HttpOnly, SameSite=Lax,    Path=/app — the short-lived access JWT, so
 *                      server components (getServerSession) and FE-07's middleware can verify it.
 * - skout_app_csrf     readable by JS, SameSite=Strict, Path=/app — double-submit CSRF token that
 *                      the client echoes in `x-csrf-token` on refresh/logout.
 *
 * Everything here is inert unless NEXT_PUBLIC_AUTH_MODE=custom.
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { APP_BASE_PATH } from "./routes";

export const REFRESH_COOKIE = "skout_app_refresh";
export const SESSION_COOKIE = "skout_app_session";
export const CSRF_COOKIE = "skout_app_csrf";
export const CSRF_HEADER = "x-csrf-token";

/** Name of the refresh / CSRF cookies the API sets on its own origin (BE-14). */
const API_REFRESH_COOKIE = "skout_refresh";
const API_CSRF_COOKIE = "skout_csrf";

const AUTH_ROUTE_PATH = `${APP_BASE_PATH}/api/auth`;
/** Matches the API's refresh absolute lifetime (§3: 60 days); the API remains the authority. */
const REFRESH_MAX_AGE_SECONDS = 60 * 24 * 60 * 60;
const API_TIMEOUT_MS = 10_000;

export function isCustomAuthMode(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_MODE === "custom";
}

export function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found", statusCode: 404 }, { status: 404 });
}

function secureCookies(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Absolute API origin for server-to-server calls. NEXT_PUBLIC_API_URL can be empty in production
 * (the browser reaches the API same-origin), so AUTH_API_URL takes precedence server-side.
 */
export function authApiBase(): string | null {
  const base = (process.env.AUTH_API_URL || process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (!/^https?:\/\//i.test(base)) return null;
  return base.replace(/\/+$/, "");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function originOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`).origin;
  } catch {
    return null;
  }
}

/** Origins this app is legitimately served from: its own host, the public origin the proxy
 *  reports, and NEXT_PUBLIC_APP_URL (www.skoutai.io/app behind the marketing proxy). */
function allowedOrigins(request: NextRequest): Set<string> {
  const origins = new Set<string>([request.nextUrl.origin]);
  const host = request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
    origins.add(`${proto}://${host}`);
  }
  for (const candidate of [request.headers.get("x-skout-public-origin"), process.env.NEXT_PUBLIC_APP_URL]) {
    const origin = originOf(candidate);
    if (origin) origins.add(origin);
  }
  return origins;
}

/**
 * Login-CSRF / cross-site guard for every state-changing handler: the request must come from
 * this app's own origin. Browsers always send Origin on POST fetches, and Sec-Fetch-Site when
 * they support it; either one proving same-origin is enough, anything cross-site is refused.
 */
export function isSameOriginRequest(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (origin) return allowedOrigins(request).has(origin);
  return fetchSite === "same-origin";
}

/** Double-submit check for the cookie-authenticated handlers (refresh, logout). */
export function hasValidCsrfToken(request: NextRequest): boolean {
  const cookie = request.cookies.get(CSRF_COOKIE)?.value;
  const header = request.headers.get(CSRF_HEADER);
  return Boolean(cookie && header && safeEqual(cookie, header));
}

export function csrfRejected(): NextResponse {
  return NextResponse.json({ error: "Missing or invalid CSRF token", statusCode: 403 }, { status: 403 });
}

export function newCsrfToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Headers that let the API rate-limit and lock out per real client, not per web server.
 *  Only honoured by the API when its TRUST_PROXY setting trusts this hop (AUTH-ADI-11). */
function forwardedHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  const xff = request.headers.get("x-forwarded-for");
  if (xff) headers["x-forwarded-for"] = xff;
  const ua = request.headers.get("user-agent");
  if (ua) headers["user-agent"] = ua;
  return headers;
}

export type ApiCallResult =
  | { ok: true; status: number; body: unknown; setCookies: string[] }
  | { ok: false; status: number; body: unknown; setCookies: string[] };

/**
 * Calls an API auth endpoint server-side. `refreshToken`, when given, is sent as the API's own
 * refresh cookie together with a fresh double-submit CSRF pair (the API only checks that the
 * cookie and header match, and this call never leaves the server).
 */
export async function callAuthApi(
  request: NextRequest,
  path: string,
  init: { method?: "GET" | "POST"; json?: unknown; refreshToken?: string; bearer?: string } = {}
): Promise<ApiCallResult> {
  const base = authApiBase();
  if (!base) {
    return { ok: false, status: 503, body: { error: "Auth API is not configured", statusCode: 503 }, setCookies: [] };
  }

  const headers: Record<string, string> = { ...forwardedHeaders(request), accept: "application/json" };
  if (init.json !== undefined) headers["content-type"] = "application/json";
  if (init.bearer) headers.authorization = `Bearer ${init.bearer}`;
  if (init.refreshToken) {
    const csrf = newCsrfToken();
    headers.cookie = `${API_REFRESH_COOKIE}=${init.refreshToken}; ${API_CSRF_COOKIE}=${csrf}`;
    headers[CSRF_HEADER] = csrf;
  }

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: init.method ?? "POST",
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, status: 502, body: { error: "Auth API unreachable", statusCode: 502 }, setCookies: [] };
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: "Unexpected response from auth API", statusCode: 502 };
    }
  }
  const setCookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  return { ok: response.ok, status: response.status, body, setCookies };
}

/** The raw refresh-token value from the API's Set-Cookie headers, if it set one. */
export function refreshTokenFromSetCookies(setCookies: string[]): string | null {
  for (const header of setCookies) {
    const [pair] = header.split(";");
    const eq = pair?.indexOf("=") ?? -1;
    if (pair && eq > 0 && pair.slice(0, eq).trim() === API_REFRESH_COOKIE) {
      const value = pair.slice(eq + 1).trim();
      return value || null;
    }
  }
  return null;
}

export type TokenPayload = { accessToken: string; expiresIn: number };

export function tokenPayload(body: unknown): TokenPayload | null {
  const data = (body as { data?: { accessToken?: unknown; expiresIn?: unknown } } | null)?.data;
  if (typeof data?.accessToken !== "string" || typeof data.expiresIn !== "number") return null;
  return { accessToken: data.accessToken, expiresIn: data.expiresIn };
}

/** Sets all three cookies and returns the body the client gets: the access token (to keep in
 *  memory), its lifetime, and the CSRF token — never the refresh token. */
export function sessionResponse(tokens: TokenPayload, refreshToken: string, status = 200): NextResponse {
  const csrf = newCsrfToken();
  const res = NextResponse.json(
    { data: { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn, csrfToken: csrf } },
    { status, headers: { "cache-control": "no-store" } }
  );
  const secure = secureCookies();
  res.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: AUTH_ROUTE_PATH,
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
  res.cookies.set(SESSION_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: APP_BASE_PATH,
    maxAge: tokens.expiresIn,
  });
  res.cookies.set(CSRF_COOKIE, csrf, {
    httpOnly: false,
    secure,
    sameSite: "strict",
    path: APP_BASE_PATH,
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
  return res;
}

export function clearSessionCookies(res: NextResponse): NextResponse {
  const secure = secureCookies();
  res.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, secure, sameSite: "strict", path: AUTH_ROUTE_PATH, maxAge: 0 });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure, sameSite: "lax", path: APP_BASE_PATH, maxAge: 0 });
  res.cookies.set(CSRF_COOKIE, "", { httpOnly: false, secure, sameSite: "strict", path: APP_BASE_PATH, maxAge: 0 });
  return res;
}

/** Passes an API error through with its status and body (the API's bodies carry no secrets). */
export function apiError(result: ApiCallResult): NextResponse {
  return NextResponse.json(result.body ?? { error: "Auth request failed", statusCode: result.status }, {
    status: result.status,
    headers: { "cache-control": "no-store" },
  });
}
