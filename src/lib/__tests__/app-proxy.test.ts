// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  oversizedWorkspaceRedirect,
  stripDomainFromSetCookie,
  processResponseCookies,
  handleSignInPathMapping,
  rewriteClerkPaths,
  validateOwnAuthCookies
} from "../app-proxy";

describe("app-proxy", () => {
  describe("stripDomainFromSetCookie", () => {
    it("removes Domain attribute from Set-Cookie while preserving others", () => {
      const originalCookie = "skout_app_refresh=abc123; Domain=skoutai.io; HttpOnly; Secure; SameSite=Strict; Path=/app/api/auth";
      const processed = stripDomainFromSetCookie(originalCookie);
      
      expect(processed).not.toContain("Domain=");
      expect(processed).toContain("HttpOnly");
      expect(processed).toContain("Secure");
      expect(processed).toContain("SameSite=Strict");
      expect(processed).toContain("Path=/app/api/auth");
    });

    it("handles cookies without Domain attribute gracefully", () => {
      const originalCookie = "skout_app_session=xyz789; HttpOnly; Secure; SameSite=Lax; Path=/app";
      const processed = stripDomainFromSetCookie(originalCookie);
      
      expect(processed).toBe(originalCookie);
    });
  });

  describe("handleSignInPathMapping", () => {
    it("redirects /app/signin to /app/sign-in and adds loop prevention header", () => {
      const request = new NextRequest("https://www.skoutai.io/app/signin");
      const response = handleSignInPathMapping(request);
      
      expect(response).not.toBeNull();
      expect(response?.status).toBe(307); // Next.js uses 307 for redirects in middleware
      expect(response?.headers.get("Location")).toContain("/app/sign-in");
      expect(response?.headers.get("x-skout-proxied")).toBe("true");
    });

    it("prevents loops by not redirecting if x-skout-proxied header is present", () => {
      const request = new NextRequest("https://www.skoutai.io/app/signin", {
        headers: { "x-skout-proxied": "true" }
      });
      const response = handleSignInPathMapping(request);
      
      expect(response).toBeNull();
    });
  });

  describe("rewriteClerkPaths", () => {
    it("rewrites /__clerk/ paths to /app/__clerk/", () => {
      const request = new NextRequest("https://www.skoutai.io/__clerk/handshake");
      const rewritten = rewriteClerkPaths(request);
      
      expect(rewritten).not.toBeNull();
      expect(rewritten?.nextUrl.pathname).toBe("/app/__clerk/handshake");
      expect(rewritten?.headers.get("x-skout-proxied")).toBe("true");
    });

    it("does not modify non-Clerk paths", () => {
      const request = new NextRequest("https://www.skoutai.io/app/dashboard");
      const rewritten = rewriteClerkPaths(request);
      
      expect(rewritten).toBeNull();
    });
  });

  describe("oversizedWorkspaceRedirect", () => {
    it("cleans up query parameters when __clerk_ticket is present to prevent 431 errors", () => {
      const request = new NextRequest("https://www.skoutai.io/app?__clerk_ticket=abc123&__clerk_redirect=https://example.com/long/path");
      const response = oversizedWorkspaceRedirect(request);
      
      expect(response).not.toBeNull();
      const location = response?.headers.get("Location");
      expect(location).toContain("__clerk_ticket=abc123");
      expect(location).not.toContain("__clerk_redirect");
    });

    it("returns null for requests without Clerk handshake parameters", () => {
      const request = new NextRequest("https://www.skoutai.io/app/dashboard");
      const response = oversizedWorkspaceRedirect(request);
      
      expect(response).toBeNull();
    });
  });

  describe("validateOwnAuthCookies", () => {
    const validCookies = [
      "skout_app_refresh=abc123; HttpOnly; Secure; SameSite=Strict; Path=/app/api/auth",
      "skout_app_session=xyz789; HttpOnly; Secure; SameSite=Lax; Path=/app",
      "skout_app_csrf=def456; Secure; SameSite=Strict; Path=/app"
    ];

    it("validates correctly formed own-auth cookies", () => {
      const result = validateOwnAuthCookies(validCookies);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("detects missing HttpOnly on session cookie", () => {
      const badCookies = [...validCookies];
      badCookies[1] = "skout_app_session=xyz789; Secure; SameSite=Lax; Path=/app"; // missing HttpOnly
      
      const result = validateOwnAuthCookies(badCookies);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Cookie skout_app_session missing HttpOnly attribute");
    });

    it("detects missing Secure attribute in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      
      const badCookies = [...validCookies];
      badCookies[0] = "skout_app_refresh=abc123; HttpOnly; SameSite=Strict; Path=/app/api/auth"; // missing Secure
      
      const result = validateOwnAuthCookies(badCookies);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Cookie skout_app_refresh missing Secure attribute in production");
      
      vi.unstubAllEnvs();
    });

    it("detects missing cookies", () => {
      const result = validateOwnAuthCookies([validCookies[0]]); // only send refresh cookie
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required cookie: skout_app_session");
      expect(result.errors).toContain("Missing required cookie: skout_app_csrf");
    });
  });
});