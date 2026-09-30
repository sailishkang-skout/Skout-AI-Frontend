/**
 * website/src/lib/app-proxy.ts - reverse-proxies /app/* to the product app
 * Handles both Clerk and own-auth cookies, maintains all required attributes while fixing proxy issues
 */
import { NextResponse, NextRequest, type NextRequest as NextRequestType } from "next/server";

/**
 * Builds the request middleware.ts continues processing with, after appProxy() has run.
 *
 * appProxy()'s catch-all branch (the common case for any first-touch page) signals "this
 * request was rewritten" by setting `x-skout-proxied` and `Location` on its NextResponse.next()
 * — it does not carry the browser's real headers, including `cookie`. Building the continuation
 * request from `proxyResponse.headers` instead of the ORIGINAL `request.headers` silently drops
 * every cookie (Clerk's session cookie included), so downstream auth (clerkMiddleware,
 * getServerSession) always sees a signed-out request server-side even when the browser has a
 * valid session — a split-brain that produces a same-page redirect loop. Always base headers on
 * the original request; only the URL and the proxied marker come from the signal.
 */
export function buildProcessedRequest(request: NextRequestType, proxyResponse: NextResponse | null): NextRequestType {
  const proxiedMarker = proxyResponse?.headers.get("x-skout-proxied");
  if (!proxiedMarker) return request;

  const url = proxyResponse?.headers.get("Location") || request.url;
  const processed = new NextRequest(url, { headers: new Headers(request.headers) });
  processed.headers.set("x-skout-proxied", proxiedMarker);
  return processed;
}

/**
 * oversizedWorkspaceRedirect - works around Clerk handshake JWTs blowing up header limits (HTTP 431)
 * When Clerk's workspace token is too large to fit in headers, this cleans up the query parameters
 * to prevent header overflow
 */
export function oversizedWorkspaceRedirect(request: NextRequest): NextResponse | null {
  const searchParams = request.nextUrl.searchParams;
  // Check if we have Clerk's oversized handshake parameters
  if (searchParams.has("__clerk_ticket") || searchParams.has("__clerk_redirect")) {
    // Create a clean URL with minimal query params to prevent header bloat
    const url = request.nextUrl.clone();
    url.search = "";
    // Pass only the essential parameter
    const ticket = searchParams.get("__clerk_ticket");
    if (ticket) {
      url.searchParams.set("__clerk_ticket", ticket);
    }
    return NextResponse.redirect(url);
  }
  return null;
}

/**
 * stripDomainFromSetCookie - removes Domain= attribute from every Set-Cookie header
 * This ensures cookies work correctly when served from the proxy origin instead of the app origin
 * Preserves all other attributes: Secure, HttpOnly, SameSite, Path, Max-Age, etc.
 */
export function stripDomainFromSetCookie(setCookie: string): string {
  // Remove any Domain= attribute regardless of its value
  return setCookie
    .split(";")
    .filter(part => !part.trim().startsWith("Domain="))
    .join(";");
}

/**
 * processResponseCookies - processes all Set-Cookie headers from the proxied response
 * Ensures all cookies maintain their attributes while fixing domain issues for proxying
 */
export function processResponseCookies(response: NextResponse): NextResponse {
  const setCookies = response.headers.getSetCookie();
  // Clear existing Set-Cookie headers to rebuild them
  response.headers.delete("Set-Cookie");
  
  for (const cookie of setCookies) {
    const processedCookie = stripDomainFromSetCookie(cookie);
    response.headers.append("Set-Cookie", processedCookie);
  }
  
  return response;
}

/**
 * handleSignInPathMapping - maps /app/signin ↔ /app/sign-in with loop-avoidance
 * Prevents redirect loops when proxying between the marketing site and product app
 * Critical for Safari ITP compatibility - ensures proper cookie domain stripping
 */
export function handleSignInPathMapping(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  
  // If someone hits /app/signin (without hyphen) AND we haven't proxied this yet
  // Redirect to /app/sign-in to match Next.js basePath expectations
  if (pathname === "/app/signin" && !request.headers.get("x-skout-proxied")) {
    const url = request.nextUrl.clone();
    url.pathname = "/app/sign-in";
    const response = NextResponse.redirect(url);
    // Add marker to prevent loops - this is CRITICAL for Safari
    response.headers.set("x-skout-proxied", "true");
    return processResponseCookies(response); // Ensure any cookies already have Domain stripped
  }
  
  // If someone hits /app/signin but already has the proxy header, don't redirect again
  if (pathname === "/app/signin" && request.headers.get("x-skout-proxied")) {
    return null;
  }
  
  // If someone hits /app/sign-in and doesn't have the proxy header, add it to ensure consistent processing
  if (pathname === "/app/sign-in" && !request.headers.get("x-skout-proxied")) {
    const headers = new Headers(request.headers);
    headers.set("x-skout-proxied", "true");
    const proxiedRequest = new NextRequest(request.url, { headers });
    // Return null to continue processing, but we'll add the header in the main appProxy flow
    return null;
  }
  
  // All other cases - already proxied, do nothing
  return null;
}

/**
 * rewriteClerkPaths - rewrites /__clerk/ paths to ensure they're correctly proxied
 * Maintains Clerk's functionality while behind the marketing site proxy
 */
export function rewriteClerkPaths(request: NextRequestType): NextRequest | null {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/__clerk/")) {
    // Rewrite to ensure Clerk paths work correctly from the app's basePath
    const url = request.nextUrl.clone();
    url.pathname = `/app${pathname}`;
    const headers = new Headers(request.headers);
    headers.set("x-skout-proxied", "true");
    return new NextRequest(url, {
      headers
    });
  }
  return null;
}

/**
 * validateOwnAuthCookies - ensures own-auth cookies maintain all required attributes when proxied
 * Checks that Secure, HttpOnly, SameSite, and Path attributes are preserved
 */
export function validateOwnAuthCookies(setCookies: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const requiredCookies = ["skout_app_refresh", "skout_app_session", "skout_app_csrf"];
  
  for (const cookieName of requiredCookies) {
    const cookie = setCookies.find(c => c.startsWith(`${cookieName}=`));
    if (!cookie) {
      errors.push(`Missing required cookie: ${cookieName}`);
      continue;
    }
    
    // Verify required attributes are present
    if (!cookie.includes("HttpOnly") && cookieName !== "skout_app_csrf") { // CSRF cookie is not HttpOnly
      errors.push(`Cookie ${cookieName} missing HttpOnly attribute`);
    }
    if (!cookie.includes("Secure") && process.env.NODE_ENV === "production") {
      errors.push(`Cookie ${cookieName} missing Secure attribute in production`);
    }
    if (!cookie.includes("SameSite=")) {
      errors.push(`Cookie ${cookieName} missing SameSite attribute`);
    }
    if (!cookie.includes("Path=")) {
      errors.push(`Cookie ${cookieName} missing Path attribute`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * main app proxy handler - orchestrates all proxy functionality
 * Handles both Clerk and own-auth while maintaining backward compatibility
 * Returns a response if a redirect is needed, otherwise continues processing with the rewritten request
 */
export async function appProxy(request: NextRequest): Promise<NextResponse> {
  // First handle any oversized Clerk redirects to prevent 431 errors
  const oversizedRedirect = oversizedWorkspaceRedirect(request);
  if (oversizedRedirect) return oversizedRedirect;
  
  // Handle sign-in path mapping to prevent loops
  const signInRedirect = handleSignInPathMapping(request);
  if (signInRedirect) return signInRedirect;
  
  // Rewrite Clerk paths if needed
  const rewrittenRequest = rewriteClerkPaths(request);
  
  // If we rewrote the request, return a response that indicates the new path
  if (rewrittenRequest) {
    const response = NextResponse.next({
      request: rewrittenRequest
    });
    // Copy ALL headers from the rewritten request to the response, not just x-skout-proxied
    const proxiedHeader = rewrittenRequest.headers.get("x-skout-proxied");
    if (proxiedHeader) {
      response.headers.set("x-skout-proxied", proxiedHeader);
      response.headers.set("Location", rewrittenRequest.nextUrl.toString());
      // Also copy all other headers from the rewritten request to ensure complete propagation
      rewrittenRequest.headers.forEach((value, key) => {
        if (!response.headers.has(key)) {
          response.headers.set(key, value);
        }
      });
    }
    // Process all Set-Cookie headers to strip Domain attributes while preserving others
    return processResponseCookies(response);
  }
  
  // No rewrite needed, but check if we should add x-skout-proxied for this request
  // This ensures that even non-Clerk paths get the loop prevention header when proxied
  if (!request.headers.get("x-skout-proxied")) {
    const headers = new Headers(request.headers);
    headers.set("x-skout-proxied", "true");
    const proxiedRequest = new NextRequest(request.url, { headers });
    const response = NextResponse.next({ request: proxiedRequest });
    response.headers.set("x-skout-proxied", "true");
    response.headers.set("Location", request.nextUrl.toString());
    return processResponseCookies(response);
  }
  
  // Original request already has the proxy header, process normally
  const response = NextResponse.next({
    request
  });
  return processResponseCookies(response);
}