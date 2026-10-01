/**
 * AUTH-FE-11 fix — POST /app/api/auth/invite-set-password {sessionToken, password}
 * Forwards to the API's POST /api/v1/invite-auth/set-password (Bearer: sessionToken). With
 * AUTH_CUSTOM_ENABLED on, that endpoint issues a normal own-auth session (§3), so — like login
 * and FE-09's verify-email/otp routes — it must go through the BFF layer (FE-05) to set the
 * first-party HttpOnly refresh cookie.
 *
 * Bug this fixes: the invite page used to call the API directly and stash the returned access
 * token in memory only (setCustomSession). That never set the FE-05 refresh cookie, so FE-07's
 * middleware (which only trusts the cookie) treated the immediately-following
 * router.replace("/dashboard") as signed-out and bounced the user to /sign-in — the user had to
 * log in a second time for it to work.
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
  const { sessionToken, password } = (body ?? {}) as { sessionToken?: unknown; password?: unknown };
  if (typeof sessionToken !== "string" || typeof password !== "string" || !sessionToken || !password) {
    return NextResponse.json({ error: "Invalid payload", statusCode: 400 }, { status: 400 });
  }

  const result = await callAuthApi(request, "/api/v1/invite-auth/set-password", {
    json: { password },
    bearer: sessionToken,
  });
  if (!result.ok) return apiError(result);

  const tokens = tokenPayload(result.body);
  const refreshToken = refreshTokenFromSetCookies(result.setCookies);
  if (!tokens || !refreshToken) {
    return NextResponse.json({ error: "Unexpected response from auth API", statusCode: 502 }, { status: 502 });
  }
  return sessionResponse(tokens, refreshToken);
}
