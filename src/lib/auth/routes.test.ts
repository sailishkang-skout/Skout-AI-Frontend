import { describe, expect, it } from "vitest";
import {
  APP_BASE_PATH,
  DASHBOARD_ROUTE_GROUPS,
  PROTECTED_ROUTE_PATTERNS,
  PROTECTED_ROUTE_SUFFIXES,
  PUBLIC_ROUTE_PATTERNS,
  isProtectedPathname,
  isPublicPathname,
  withAppBasePath,
} from "./routes";

describe("auth route tables", () => {
  it("prefixes every matcher pattern with the app basePath (middleware pathname bug guard)", () => {
    for (const pattern of [...PUBLIC_ROUTE_PATTERNS, ...PROTECTED_ROUTE_PATTERNS]) {
      expect(pattern.startsWith(APP_BASE_PATH), `pattern missing basePath: ${pattern}`).toBe(true);
    }
    expect(withAppBasePath(["/settings(.*)"])).toEqual(["/app/settings(.*)"]);
  });

  it("does not protect dashboard routes when the /app prefix is omitted", () => {
    expect(isProtectedPathname("/settings/compliance")).toBe(false);
    expect(isProtectedPathname("/dashboard")).toBe(false);
    expect(isProtectedPathname("/app/settings/compliance")).toBe(true);
  });

  it("marks auth entry paths public and does not protect gate, invites, or static admin import", () => {
    expect(isPublicPathname("/app/sign-in")).toBe(true);
    expect(isPublicPathname("/app/sign-in/factor-one")).toBe(true);
    expect(isPublicPathname("/app/auth/callback")).toBe(true);

    expect(isProtectedPathname("/app/sign-in")).toBe(false);
    expect(isProtectedPathname("/app/auth/callback")).toBe(false);
    expect(isProtectedPathname("/app/invite/workspace-token")).toBe(false);
    expect(isProtectedPathname("/app/gate")).toBe(false);
    expect(isProtectedPathname("/app/admin/import")).toBe(false);
  });

  it("protects every dashboard route group (with /app prefix)", () => {
    const sampleForGroup = (group: string): string => {
      if (group === "admin") return `${APP_BASE_PATH}/admin/revenue`;
      if (group === "import") return `${APP_BASE_PATH}/import`;
      return `${APP_BASE_PATH}/${group}`;
    };

    for (const group of DASHBOARD_ROUTE_GROUPS) {
      const sample = sampleForGroup(group);
      expect(
        isProtectedPathname(sample),
        `expected ${sample} to be protected (group: ${group})`
      ).toBe(true);
    }
  });

  it("requires middleware to apply withAppBasePath — raw suffixes must not be used as matchers", () => {
    expect(PROTECTED_ROUTE_SUFFIXES.some((p) => p.startsWith("/dashboard"))).toBe(true);
    expect(PROTECTED_ROUTE_SUFFIXES.some((p) => p.startsWith(`${APP_BASE_PATH}/dashboard`))).toBe(
      false
    );
    expect(withAppBasePath(PROTECTED_ROUTE_SUFFIXES)).toEqual(PROTECTED_ROUTE_PATTERNS);
  });
});
