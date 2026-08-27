import { describe, expect, it } from "vitest";
import { COUNTRIES } from "./search-constants";
import { PHONE_GEO_BY_COUNTRY, phoneAreaCodesFor, phoneCitiesFor, usesLocalGeo } from "./phone-geo";

describe("phone-geo", () => {
  it("covers every COUNTRIES ISO code used in TAM/prospect filters", () => {
    for (const country of COUNTRIES) {
      expect(PHONE_GEO_BY_COUNTRY[country.value], country.value).toBeDefined();
    }
  });

  it("lists US area codes and filters cities by NPA", () => {
    const codes = phoneAreaCodesFor("US", "local");
    expect(codes.some((c) => c.code === "415")).toBe(true);
    expect(phoneCitiesFor("US", "415", "local").map((c) => c.name)).toEqual(["San Francisco"]);
    expect(phoneCitiesFor("US", "", "local").length).toBeGreaterThan(1);
  });

  it("uses toll-free prefixes instead of local NPAs", () => {
    expect(phoneAreaCodesFor("US", "toll_free").map((c) => c.code)).toContain("800");
    expect(phoneCitiesFor("US", "800", "toll_free")).toEqual([]);
    expect(usesLocalGeo("mobile")).toBe(false);
  });
});
