/**
 * AUTH-FE-05 — GET /app/api/auth/session
 * Who is signed in, from the app-origin session cookie: proxies the API's GET /api/v1/auth/me
 * with that access token. Returns the user profile only — never a token. 401 when there is no
 * live session; the client then calls /refresh (which needs the CSRF token) to get a new one.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, apiError, callAuthApi, isCustomAuthMode, notFound } from "@/lib/auth/bff";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isCustomAuthMode()) return notFound();

  const accessToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json(
      { error: "No active session", statusCode: 401, code: "AUTH_MISSING_TOKEN" },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  const result = await callAuthApi(request, "/api/v1/auth/me", { method: "GET", bearer: accessToken });
  if (!result.ok) return apiError(result);
  return NextResponse.json(result.body, { headers: { "cache-control": "no-store" } });
}
