import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/auth/callback",
  "/",
]);

/** Only protect known app routes — unknown paths fall through to Next.js 404. */
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/prospects(.*)",
  "/lists(.*)",
  "/smart-lists(.*)",
  "/enrichment(.*)",
  "/analytics(.*)",
  "/settings(.*)",
  "/onboarding(.*)",
  "/sequences(.*)",
  "/inbox(.*)",
  "/deliverability(.*)",
  "/ai(.*)",
]);

const useClerkMiddleware =
  process.env.E2E_AUTH_BYPASS !== "true" &&
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const clerkHandler = useClerkMiddleware
  ? clerkMiddleware(async (auth, request) => {
      if (isProtectedRoute(request)) {
        auth().protect();
      }
    })
  : null;

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (!clerkHandler) {
    return NextResponse.next();
  }
  return clerkHandler(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
