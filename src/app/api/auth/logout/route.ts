/**
 * AUTH-FE-05 — POST /app/api/auth/logout (refresh cookie + x-csrf-token)
 * Revokes this session at the API (POST /api/v1/auth/logout) and clears the app cookies. The
 * cookies are cleared even if the API call fails, so the browser is always signed out locally.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  REFRESH_COOKIE,
  callAuthApi,
  clearSessionCookies,
  csrfRejected,
  hasValidCsrfToken,
  isCustomAuthMode,
  isSameOriginRequest,
  notFound,
} from "@/lib/auth/bff";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isCustomAuthMode()) return notFound();
  if (!isSameOriginRequest(request) || !hasValidCsrfToken(request)) return csrfRejected();

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await callAuthApi(request, "/api/v1/auth/logout", { refreshToken });
  }
  return clearSessionCookies(new NextResponse(null, { status: 204 }));
}
