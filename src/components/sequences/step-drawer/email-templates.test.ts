import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteTemplate, loadTemplates, saveTemplate, TEMPLATES_KEY } from "./email-templates";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("email templates", () => {
  it("starts empty", () => {
    expect(loadTemplates()).toEqual([]);
  });

  it("saves, loads and deletes", () => {
    const afterSave = saveTemplate({ name: "Intro", html: "<p>Hi</p>", subject: "Quick idea" });
    expect(afterSave).toHaveLength(1);
    expect(afterSave[0]).toMatchObject({ name: "Intro", html: "<p>Hi</p>", subject: "Quick idea" });
    expect(afterSave[0]!.id).toBeTruthy();
    expect(afterSave[0]!.createdAt).toBeTruthy();
    expect(loadTemplates()).toEqual(afterSave);

    expect(deleteTemplate(afterSave[0]!.id)).toEqual([]);
    expect(loadTemplates()).toEqual([]);
  });

  it("omits a blank subject", () => {
    expect(saveTemplate({ name: "No subject", html: "<p>x</p>", subject: "" })[0]!.subject).toBeUndefined();
  });

  it("reads templates the old editor saved (same key and shape)", () => {
    localStorage.setItem(
      TEMPLATES_KEY,
      JSON.stringify([{ id: "1", name: "Old", html: "<p>x</p>", createdAt: "2026-01-01T00:00:00Z" }])
    );
    expect(loadTemplates().map((t) => t.name)).toEqual(["Old"]);
  });

  it("survives corrupt or unexpected storage", () => {
    localStorage.setItem(TEMPLATES_KEY, "{not json");
    expect(loadTemplates()).toEqual([]);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify({ not: "an array" }));
    expect(loadTemplates()).toEqual([]);
  });

  it("survives blocked storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadTemplates()).toEqual([]);
  });
});
