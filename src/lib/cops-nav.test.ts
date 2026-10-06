import { describe, expect, it } from "vitest";
import { auditQueryString, hasNavPermission } from "./cops-nav";

describe("hasNavPermission", () => {
  it("keeps public dashboard links and hides unauthorized admin links", () => {
    expect(hasNavPermission(undefined, [])).toBe(true);
    expect(hasNavPermission("admin:read", ["crm:read"])).toBe(false);
    expect(hasNavPermission("admin:read", ["admin:read"])).toBe(true);
  });

  it("accepts any one of several keys", () => {
    const crm = ["crm:read", "crm:manage"];
    expect(hasNavPermission(crm, ["crm:manage"])).toBe(true);
    expect(hasNavPermission(crm, ["sequences:send"])).toBe(false);
  });
});

describe("auditQueryString", () => {
  it("drops empty filters and sets a default limit", () => {
    expect(auditQueryString({ search: "  Alex  ", entityType: " ", limit: undefined })).toBe(
      "search=Alex&limit=25"
    );
  });

  it("clamps the limit to 1..100", () => {
    expect(auditQueryString({ limit: 500 })).toBe("limit=100");
    expect(auditQueryString({ limit: 0 })).toBe("limit=1");
  });
});
