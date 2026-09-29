/**
 * AUTH-FE-09 — POST /app/api/auth/verify-email {token}
 * Forwards to the API's POST /api/v1/auth/verify-email/confirm. Unlike verify-email/send
 * (no session created — called directly from the browser to the API, like signup), confirm
 * issues a normal own-auth session (§3), so it must go through the BFF layer (FE-05) to set the
 * first-party HttpOnly refresh cookie.
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
    return NextResponse.json({ error: "Invalid payload", statusCode: 400 }, { status: 400 });
  }
  const { token } = (body ?? {}) as { token?: unknown };
  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "Invalid payload", statusCode: 400 }, { status: 400 });
  }

  const result = await callAuthApi(request, "/api/v1/auth/verify-email/confirm", { json: { token } });
  if (!result.ok) return apiError(result);

  const tokens = tokenPayload(result.body);
  const refreshToken = refreshTokenFromSetCookies(result.setCookies);
  if (!tokens || !refreshToken) {
    return NextResponse.json({ error: "Unexpected response from auth API", statusCode: 502 }, { status: 502 });
  }
  return sessionResponse(tokens, refreshToken);
}
