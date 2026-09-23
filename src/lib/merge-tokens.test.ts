import { describe, expect, it } from "vitest";
import {
  FALLBACK_MAX,
  MERGE_TOKENS,
  TOKEN_PATTERN,
  formatToken,
  resolveTokens,
  validateFallback,
} from "./merge-tokens";

describe("MERGE_TOKENS", () => {
  it("lists exactly the nine tokens the API accepts, in order", () => {
    expect(MERGE_TOKENS.map((t) => t.name)).toEqual([
      "firstName",
      "lastName",
      "fullName",
      "companyName",
      "companyDomain",
      "title",
      "senderName",
      "senderEmail",
      "unsubscribeUrl",
    ]);
  });

  it("suggests default fallbacks only for the tokens that are often blank", () => {
    const defaults = Object.fromEntries(
      MERGE_TOKENS.filter((t) => t.defaultFallback).map((t) => [t.name, t.defaultFallback])
    );
    expect(defaults).toEqual({
      firstName: "there",
      fullName: "there",
      companyName: "your company",
      title: "your role",
    });
  });

  it("forbids a fallback on the unsubscribe link and warns that companyDomain is a web address", () => {
    const byName = (name: string) => MERGE_TOKENS.find((t) => t.name === name)!;
    expect(byName("unsubscribeUrl").allowFallback).toBe(false);
    expect(byName("unsubscribeUrl").note).toMatch(/can't have a fallback/);
    expect(byName("companyDomain").note).toMatch(/web address/i);
    expect(MERGE_TOKENS.filter((t) => t.allowFallback)).toHaveLength(8);
  });

  it("gives every token a label, description and sample", () => {
    for (const t of MERGE_TOKENS) {
      expect(t.label).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.sample).toBeTruthy();
    }
  });
});

describe("formatToken", () => {
  it("writes a plain token, or one with a trimmed fallback", () => {
    expect(formatToken("firstName")).toBe("{{firstName}}");
    expect(formatToken("firstName", "there")).toBe("{{firstName|there}}");
    expect(formatToken("title", "  your role ")).toBe("{{title|your role}}");
  });

  it("drops a blank fallback", () => {
    expect(formatToken("firstName", "")).toBe("{{firstName}}");
    expect(formatToken("firstName", "   ")).toBe("{{firstName}}");
    expect(formatToken("firstName", null)).toBe("{{firstName}}");
  });
});

describe("validateFallback", () => {
  it("accepts ordinary text, up to the limit", () => {
    expect(validateFallback("there")).toBeNull();
    expect(validateFallback("x".repeat(FALLBACK_MAX))).toBeNull();
  });

  it("rejects blank text", () => {
    expect(validateFallback("")).toMatch(/enter a fallback/i);
    expect(validateFallback("   ")).toMatch(/enter a fallback/i);
  });

  it("rejects text over the limit", () => {
    expect(validateFallback("x".repeat(FALLBACK_MAX + 1))).toMatch(/60/);
  });

  it("rejects characters the syntax can't carry", () => {
    for (const bad of ["a|b", "a{b", "a}b", "a\nb"]) {
      expect(validateFallback(bad)).toMatch(/can't contain/);
    }
  });
});

describe("resolveTokens", () => {
  const values = { firstName: "Ada", companyName: "" };

  it("uses the real value, then the fallback, else leaves the token", () => {
    expect(resolveTokens("Hi {{firstName|there}}", values)).toBe("Hi Ada");
    expect(resolveTokens("At {{companyName|your company}}", values)).toBe("At your company");
    expect(resolveTokens("At {{companyName}}", values)).toBe("At {{companyName}}");
    expect(resolveTokens("{{title|your role}}", values)).toBe("your role");
    expect(resolveTokens("{{title}}", values)).toBe("{{title}}");
  });

  it("treats a whitespace value as blank and trims the fallback", () => {
    expect(resolveTokens("{{firstName| there }}", { firstName: "  " })).toBe("there");
  });

  it("leaves malformed placeholders alone", () => {
    expect(resolveTokens("{{ firstName }} {{a|b|c}}", values)).toBe("{{ firstName }} {{a|b|c}}");
  });
});

describe("TOKEN_PATTERN", () => {
  it("matches plain and fallback tokens, but not malformed ones", () => {
    const found = "{{a}} {{b|c d}} {{ e }} {{f|g|h}}".match(new RegExp(TOKEN_PATTERN, "g"));
    expect(found).toEqual(["{{a}}", "{{b|c d}}"]);
  });
});
