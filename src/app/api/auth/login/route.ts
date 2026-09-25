/**
 * AUTH-FE-05 — POST /app/api/auth/login {email, password}
 * Forwards to the API's POST /api/v1/auth/login; on success stores the refresh token in the
 * app-origin HttpOnly cookie and returns { accessToken, expiresIn, csrfToken }. API errors
 * (AUTH_INVALID_CREDENTIALS, AUTH_EMAIL_NOT_VERIFIED, AUTH_RATE_LIMITED, …) pass through as-is.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  apiError,
  callAuthApi,
  csrfRejected,
  isCustomAuthMode,
  isSameOriginRequest,
  notFound,
  refreshTokenFromSetCookies,
  sessionResponse,
  tokenPayload,
} from "@/lib/auth/bff";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isCustomAuthMode()) return notFound();
  if (!isSameOriginRequest(request)) return csrfRejected();
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Expected application/json", statusCode: 415 }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid login payload", statusCode: 400 }, { status: 400 });
  }
  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Invalid login payload", statusCode: 400 }, { status: 400 });
  }

  const result = await callAuthApi(request, "/api/v1/auth/login", { json: { email, password } });
  if (!result.ok) return apiError(result);

  const tokens = tokenPayload(result.body);
  const refreshToken = refreshTokenFromSetCookies(result.setCookies);
  if (!tokens || !refreshToken) {
    return NextResponse.json({ error: "Unexpected response from auth API", statusCode: 502 }, { status: 502 });
  }
  return sessionResponse(tokens, refreshToken);
}
