/**
 * AUTH-FE-10 — GET /app/api/auth/google/start
 * Calls the API's GET /api/v1/auth/google/start server-side to get the Google authorization
 * URL and the BE-16 OAuth-state cookie, re-sets that cookie on our own origin (so it survives
 * until the browser lands back on our /google/callback route after Google's redirect), then
 * 302s the browser straight to Google. The `next` query param is forwarded as-is — the API
 * validates it against its own allowlist (validateSafeNextUrl) and echoes the safe value back
 * from /google/callback, so there's nothing for this route to re-validate.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  GOOGLE_ROUTE_PATH,
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_TTL_SECONDS,
  authApiBase,
  callAuthApi,
  cookieValueFromSetCookies,
  isCustomAuthMode,
  notFound,
  publicOrigin,
} from "@/lib/auth/bff";
import { APP_BASE_PATH } from "@/lib/auth/routes";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isCustomAuthMode()) return notFound();
  if (!authApiBase()) {
    return NextResponse.json({ error: "Auth API is not configured", statusCode: 503 }, { status: 503 });
  }

  const next = request.nextUrl.searchParams.get("next");
  const qs = next ? `?next=${encodeURIComponent(next)}` : "";
  const result = await callAuthApi(request, `/api/v1/auth/google/start${qs}`, { method: "GET" });

  if (!result.ok) {
    const message = (result.body as { error?: string } | null)?.error ?? "Could not start Google sign-in.";
    return NextResponse.redirect(
      new URL(`${APP_BASE_PATH}/sign-in?error=${encodeURIComponent(message)}`, publicOrigin(request))
    );
  }

  const body = result.body as { data?: { authorizationUrl?: string } } | null;
  const authorizationUrl = body?.data?.authorizationUrl;
  const stateId = cookieValueFromSetCookies(result.setCookies, GOOGLE_STATE_COOKIE);
  if (!authorizationUrl || !stateId) {
    return NextResponse.redirect(new URL(`${APP_BASE_PATH}/sign-in?error=google_start_failed`, publicOrigin(request)));
  }

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(GOOGLE_STATE_COOKIE, stateId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: GOOGLE_ROUTE_PATH,
    maxAge: GOOGLE_STATE_TTL_SECONDS,
  });
  return response;
}
