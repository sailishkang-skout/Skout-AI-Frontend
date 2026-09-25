/**
 * AUTH-FE-05 — POST /app/api/auth/refresh (refresh cookie + x-csrf-token)
 * Rotates the refresh token through the API's POST /api/v1/auth/refresh and returns a fresh
 * { accessToken, expiresIn, csrfToken }. Any refusal (expired, revoked, reuse detected) clears
 * the app cookies so the client signs out cleanly instead of retrying.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  REFRESH_COOKIE,
  apiError,
  callAuthApi,
  clearSessionCookies,
  csrfRejected,
  hasValidCsrfToken,
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
  if (!isSameOriginRequest(request) || !hasValidCsrfToken(request)) return csrfRejected();

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return clearSessionCookies(
      NextResponse.json(
        { error: "Missing refresh cookie", statusCode: 401, code: "AUTH_MISSING_TOKEN" },
        { status: 401 }
      )
    );
  }

  const result = await callAuthApi(request, "/api/v1/auth/refresh", { refreshToken });
  if (!result.ok) {
    const res = apiError(result);
    // 401/403 from the API means the session is gone; a 5xx may be transient, keep the cookies.
    return result.status === 401 || result.status === 403 ? clearSessionCookies(res) : res;
  }

  const tokens = tokenPayload(result.body);
  const rotated = refreshTokenFromSetCookies(result.setCookies);
  if (!tokens || !rotated) {
    return NextResponse.json({ error: "Unexpected response from auth API", statusCode: 502 }, { status: 502 });
  }
  return sessionResponse(tokens, rotated);
}
