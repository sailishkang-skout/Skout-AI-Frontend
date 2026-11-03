import { describe, expect, it } from "vitest";
import { hasNavPermission } from "./nav-permissions";

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
