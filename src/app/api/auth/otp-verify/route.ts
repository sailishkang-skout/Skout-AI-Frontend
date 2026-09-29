/**
 * AUTH-FE-09 — POST /app/api/auth/otp-verify {email, code}
 * Forwards to the API's POST /api/v1/auth/otp/verify. Issues a normal own-auth session (§3),
 * so — like verify-email confirm — it goes through the BFF layer (FE-05) to set the first-party
 * HttpOnly refresh cookie, unlike otp/send which has nothing to set and is called directly.
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
  const { email, code } = (body ?? {}) as { email?: unknown; code?: unknown };
  if (typeof email !== "string" || typeof code !== "string" || !email || !code) {
    return NextResponse.json({ error: "Invalid payload", statusCode: 400 }, { status: 400 });
  }

  const result = await callAuthApi(request, "/api/v1/auth/otp/verify", { json: { email, code } });
  if (!result.ok) return apiError(result);

  const tokens = tokenPayload(result.body);
  const refreshToken = refreshTokenFromSetCookies(result.setCookies);
  if (!tokens || !refreshToken) {
    return NextResponse.json({ error: "Unexpected response from auth API", statusCode: 502 }, { status: 502 });
  }
  return sessionResponse(tokens, refreshToken);
}
