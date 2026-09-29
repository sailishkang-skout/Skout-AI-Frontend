/**
 * AUTH-FE-10 — GET /app/api/auth/google/callback?code=...&state=...
 * Google redirects the browser here directly (full-page navigation). Forwards the code/state to
 * the API's POST /api/v1/auth/google/callback along with the BE-16 state cookie captured by
 * /google/start (the API reads it straight off the request, not as a body param), then — since
 * this is a full-page navigation, not a fetch() call — redirects onward with the session cookies
 * set via `sessionRedirect` rather than returning the tokens in a JSON body. Friendly errors go
 * to /sign-in with a generic, non-enumerating message; nothing from the API ever reaches the URL.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  GOOGLE_ROUTE_PATH,
  GOOGLE_STATE_COOKIE,
  callAuthApi,
  isCustomAuthMode,
  notFound,
  refreshTokenFromSetCookies,
  sessionRedirect,
} from "@/lib/auth/bff";
import { APP_BASE_PATH } from "@/lib/auth/routes";

export const dynamic = "force-dynamic";

function clearGoogleStateCookie(response: NextResponse): void {
  response.cookies.set(GOOGLE_STATE_COOKIE, "", { path: GOOGLE_ROUTE_PATH, maxAge: 0 });
}

type CallbackResponse = {
  data?: { accessToken: string; expiresIn: number; next?: string };
};

function errorRedirect(request: NextRequest, message: string): NextResponse {
  const url = new URL(`${APP_BASE_PATH}/sign-in`, request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  if (!isCustomAuthMode()) return notFound();

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");
  const stateId = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;

  if (oauthError) {
    return errorRedirect(request, oauthError === "access_denied" ? "Google sign-in was cancelled." : "Google sign-in failed.");
  }
  if (!code || !state) {
    return errorRedirect(request, "Missing Google sign-in response.");
  }

  const result = await callAuthApi(request, "/api/v1/auth/google/callback", {
    json: { code, state },
    extraCookies: stateId ? { [GOOGLE_STATE_COOKIE]: stateId } : undefined,
  });

  if (!result.ok) {
    const errorCode = (result.body as { code?: string } | null)?.code;
    const message =
      errorCode === "AUTH_EMAIL_NOT_VERIFIED"
        ? "Your Google account's email isn't verified."
        : errorCode === "AUTH_ACCOUNT_BLOCKED"
          ? "This account is inactive. Contact your workspace admin."
          : "Google sign-in link expired or was already used — please try again.";
    const response = errorRedirect(request, message);
    clearGoogleStateCookie(response);
    return response;
  }

  const body = result.body as CallbackResponse;
  // Issued by BE-14's issueOwnAuthSession, same as login — a Set-Cookie header on this same
  // response, not part of the JSON body.
  const refreshToken = refreshTokenFromSetCookies(result.setCookies);
  if (!body.data || !refreshToken) {
    const response = errorRedirect(request, "Unexpected response from Google sign-in.");
    clearGoogleStateCookie(response);
    return response;
  }

  // BE-16's next is validated server-side (validateSafeNextUrl) but is app-relative — it has no
  // idea this frontend is mounted under basePath "/app", so that prefix is added here, once.
  const safeNext = body.data.next && body.data.next.startsWith("/") ? body.data.next : "/auth/callback";
  const nextPath = safeNext.startsWith(APP_BASE_PATH) ? safeNext : `${APP_BASE_PATH}${safeNext}`;
  const destination = new URL(nextPath, request.url);
  const response = await sessionRedirect(
    { accessToken: body.data.accessToken, expiresIn: body.data.expiresIn },
    refreshToken,
    destination.toString()
  );
  clearGoogleStateCookie(response);
  return response;
}
