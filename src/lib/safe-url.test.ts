import { describe, expect, it } from "vitest";
import { safeWebUrl, websiteLabel } from "./safe-url";

describe("safeWebUrl", () => {
  it("accepts http and https addresses only", () => {
    expect(safeWebUrl("https://jane.dev/work")).toBe("https://jane.dev/work");
    expect(safeWebUrl(" http://jane.dev ")).toBe("http://jane.dev/");
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "mailto:a@b.co", "jane.dev", "", null, undefined, 5]) {
      expect(safeWebUrl(bad)).toBeNull();
    }
  });

  it("shortens a website for display", () => {
    expect(websiteLabel("https://www.jane.dev/")).toBe("jane.dev");
    expect(websiteLabel("http://blog.jane.dev/posts")).toBe("blog.jane.dev/posts");
  });
});
