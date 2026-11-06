/**
 * GET /app/api/auth/invite-accept — finishes an invite after the person signs in another way (SSO
 * or email and password). The invite page leaves the invite token in a short-lived cookie; this
 * accepts that exact invite for the signed-in user, clears the cookie, and goes to the dashboard.
 * When the API refuses (signed in with a different email, expired, already used), the person is sent
 * back to the invite page with the API's message instead of silently landing in another workspace.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server";
import { APP_BASE_PATH } from "@/lib/app-url";
import { INVITE_RETURN_COOKIE, isInviteToken } from "@/lib/auth/invite-return";

export const dynamic = "force-dynamic";

const API_URL = process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

function go(request: NextRequest, pathname: string, error?: string) {
  // Build from the Host the browser used and the /app base path: nextUrl in a route handler drops
  // the base path and, in dev, reports localhost, which sent people to a 404.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const url = new URL(`${APP_BASE_PATH}${pathname}`, `${proto}://${host}`);
  if (error) url.searchParams.set("error", error);
  const res = NextResponse.redirect(url);
  res.cookies.set(INVITE_RETURN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(INVITE_RETURN_COOKIE)?.value ?? "";
  if (!isInviteToken(token)) return go(request, "/dashboard");

  const { userId, getToken } = await getServerSession();
  if (!userId) return go(request, `/invite/${token}`, "Sign in to accept this invite.");

  let message: string | undefined;
  try {
    const res = await fetch(`${API_URL}/api/v1/team/invites/${token}/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await getToken()}`, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
      message = body?.message ?? body?.error ?? "This invite could not be accepted.";
    }
  } catch {
    message = "We couldn't reach Skout to accept the invite. Please try again.";
  }
  return message ? go(request, `/invite/${token}`, message) : go(request, "/dashboard");
}
