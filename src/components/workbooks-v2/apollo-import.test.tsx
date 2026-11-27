import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { apolloBody, apolloProblem } from "@/lib/workbooks-v2-apollo";
import { sourceLabel } from "@/lib/workbooks-v2-grid";
import { checkMapping, importTitle, isRecordImport, type WorkbookImport } from "@/lib/workbooks-v2-import";
import { AddProspects } from "./add-prospects";

vi.mock("@/lib/api-client", async (original) => ({ ...(await original<typeof import("@/lib/api-client")>()), useAuthReady: () => true }));
const lists = vi.hoisted(() => vi.fn());
vi.mock("@/lib/enrichment", () => ({ useEnrichmentApi: () => ({ listLists: lists }) }));
vi.mock("@/lib/smart-lists", () => ({ useSmartListApi: () => ({ list: vi.fn().mockResolvedValue({ data: [] }) }) }));
const prospects = vi.hoisted(() => ({ browse: vi.fn(), add: vi.fn() }));
vi.mock("@/lib/workbooks-v2-prospects", async (original) => ({ ...(await original<typeof import("@/lib/workbooks-v2-prospects")>()), useWorkbookProspectsApi: () => prospects }));
const apollo = vi.hoisted(() => ({ source: vi.fn(), preview: vi.fn() }));
vi.mock("@/lib/workbooks-v2-apollo", async (original) => ({ ...(await original<typeof import("@/lib/workbooks-v2-apollo")>()), useWorkbookApolloApi: () => apollo }));
const imports = vi.hoisted(() => ({ get: vi.fn(), confirm: vi.fn(), cancel: vi.fn(), columns: vi.fn(), report: vi.fn() }));
vi.mock("@/lib/workbooks-v2-import", async (original) => ({ ...(await original<typeof import("@/lib/workbooks-v2-import")>()), useWorkbookImportApi: () => imports }));

const source = (over: Record<string, unknown> = {}) => ({
  connection: { status: "connected" },
  fields: [
    { name: "name", label: "Full name" },
    { name: "email", label: "Email" },
    { name: "title", label: "Title" },
    { name: "phone", label: "Phone" },
  ],
  defaultFields: ["name", "email"],
  lists: { available: true, reason: null, items: [{ id: "l-1", name: "Prospects", count: 1200 }, { id: "l-2", name: "One", count: 1 }] },
  stages: { available: true, reason: null, items: [{ id: "s-1", name: "Cold" }, { id: "s-2", name: "Approaching" }] },
  note: "Apollo's saved searches aren't available through its API.",
  maxRecords: 50000,
  ...over,
});

const item = (over: Partial<WorkbookImport> = {}): WorkbookImport => ({
  id: "imp-1",
  workbookId: "wb-1",
  sourceType: "apollo",
  sourceName: null,
  truncated: null,
  status: "awaiting_confirmation",
  fileName: "Apollo contacts · search",
  fileBytes: 0,
  counts: { total: 45, processed: 0, imported: 0, duplicates: 0, skipped: 0, failed: 0 },
  progress: 0,
  background: false,
  error: null,
  report: { available: false, rows: 0 },
  preview: {
    headers: [
      { index: 0, name: "Full name", fits: ["text"], filled: 1 },
      { index: 1, name: "Email", fits: ["text", "email"], filled: 1 },
    ],
    rows: [{ line: 1, values: ["Ada Lovelace", "ada@example.com"] }],
    suggestions: [
      { header: 0, target: { newColumn: { name: "Full name", dataType: "text" } } },
      { header: 1, target: { newColumn: { name: "Email", dataType: "email" } } },
    ],
  },
  createdAt: "2026-11-27T00:00:00Z",
  ...over,
});

const refusal = (code: string, message: string, status = 409) => new ApiError(message, status, { code, message });

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AddProspects workbook={{ id: "wb-1", name: "Leads" }} />
    </QueryClientProvider>
  );
async function openApollo() {
  show();
  fireEvent.click(screen.getByRole("button", { name: "Add rows" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("tab", { name: "Apollo" }));
  return dialog;
}
async function ready() {
  const dialog = await openApollo();
  await within(dialog).findByText("Fields to import");
  return dialog;
}
const previewButton = () => screen.getByRole("button", { name: "Preview contacts" }) as HTMLButtonElement;
const radio = (name: string | RegExp) => screen.getByRole("radio", { name }) as HTMLInputElement;
const sent = (call = 0) => ({ body: apollo.preview.mock.calls[call]![1], key: apollo.preview.mock.calls[call]![2] });

describe("Add rows from Apollo", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    lists.mockResolvedValue({ data: [] });
    apollo.source.mockResolvedValue(source());
    apollo.preview.mockResolvedValue(item());
    imports.get.mockResolvedValue(item());
    imports.columns.mockResolvedValue([{ id: "c-num", name: "Count", type: "input", config: { dataType: "number" } }]);
  });
  afterEach(() => cleanup());

  it("is a choice under Add rows, and asks about Apollo only once it is chosen", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Add rows" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Lists", "Smart lists", "Apollo", "Google Sheets"]);
    expect(apollo.source).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("tab", { name: "Apollo" }));
    expect(within(dialog).getByRole("tab", { name: "Apollo" }).getAttribute("aria-selected")).toBe("true");
    await within(dialog).findByText("Fields to import");
    expect(apollo.source).toHaveBeenCalledWith("wb-1");
    expect(radio(/Your workspace’s Apollo API key/).checked).toBe(true);
    expect(within(dialog).getByText("Connected")).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: "Manage" }).getAttribute("href")).toBe("/settings/integrations");
    expect(prospects.browse).not.toHaveBeenCalled();
    // Back to the lists.
    fireEvent.click(within(dialog).getByRole("tab", { name: "Lists" }));
    expect(within(dialog).queryByText("Fields to import")).toBeNull();
  });

  it.each([
    ["not_connected", "Apollo isn’t connected"],
    ["needs_reauth", "can’t be used"],
  ])("points to Settings when Apollo is %s", async (status, words) => {
    apollo.source.mockResolvedValue(source({ connection: { status }, lists: null, stages: null }));
    const dialog = await openApollo();
    expect((await within(dialog).findByRole("alert")).textContent).toContain(words);
    expect(within(dialog).getByRole("link", { name: "Open Settings → Integrations" }).getAttribute("href")).toBe("/settings/integrations");
    expect(within(dialog).queryByRole("button", { name: "Preview contacts" })).toBeNull();
  });

  it("shows why Apollo can't be read, without asking again by itself", async () => {
    apollo.source.mockRejectedValue(refusal("APOLLO_RECONNECT_REQUIRED", "Apollo rejected the saved API key."));
    const dialog = await openApollo();
    expect((await within(dialog).findByRole("alert")).textContent).toContain("rejected the saved API key");
    expect(within(dialog).getByRole("link", { name: "Open Settings → Integrations" })).toBeTruthy();
    expect(apollo.source).toHaveBeenCalledTimes(1);
    apollo.source.mockResolvedValue(source());
    fireEvent.click(within(dialog).getByRole("button", { name: /retry|try again/i }));
    await within(dialog).findByText("Fields to import");
  });

  it("searches saved contacts, saying that it isn't Apollo's database", async () => {
    const dialog = await ready();
    expect(radio("A search of saved contacts").checked).toBe(true);
    expect(dialog.textContent).toContain("not Apollo’s whole database");
    expect(dialog.textContent).toContain("saved searches aren't available");
    expect(dialog.textContent).toContain("At most 50,000 contacts");
    fireEvent.change(screen.getByLabelText("Keywords"), { target: { value: "  engineer " } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Cold" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Approaching" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Cold" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Title" }));
    fireEvent.click(previewButton());
    await waitFor(() => expect(apollo.preview).toHaveBeenCalled());
    expect(apollo.preview.mock.calls[0]![0]).toBe("wb-1");
    expect(sent().body).toEqual({ fields: ["name", "email", "title"], search: { keywords: "engineer", stageIds: ["s-2"] } });
    expect(sent().key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("takes every saved contact when the search is left empty", async () => {
    await ready();
    fireEvent.click(previewButton());
    await waitFor(() => expect(sent().body).toEqual({ fields: ["name", "email"], search: {} }));
  });

  it("takes one saved list", async () => {
    const dialog = await ready();
    fireEvent.click(radio("A saved list"));
    expect(previewButton().disabled).toBe(true);
    expect(dialog.textContent).toContain("Choose a list.");
    expect(dialog.textContent).toContain("1,200 contacts");
    expect(dialog.textContent).toContain("1 contact");
    expect(screen.queryByLabelText("Keywords")).toBeNull();
    fireEvent.click(radio(/Prospects/));
    fireEvent.click(previewButton());
    await waitFor(() => expect(sent().body).toEqual({ fields: ["name", "email"], listId: "l-1" }));
  });

  it("says why lists and stages can't be chosen", async () => {
    apollo.source.mockResolvedValue(
      source({ lists: { available: false, reason: "The key isn't allowed to read lists.", items: [] }, stages: { available: false, reason: "The key isn't allowed to read stages.", items: [] } })
    );
    const dialog = await ready();
    expect(radio("A saved list").disabled).toBe(true);
    expect(dialog.textContent).toContain("isn't allowed to read lists");
    expect(dialog.textContent).toContain("isn't allowed to read stages");
    expect(previewButton().disabled).toBe(false);
  });

  it("says when the account has no lists", async () => {
    apollo.source.mockResolvedValue(source({ lists: { available: true, reason: null, items: [] } }));
    const dialog = await ready();
    expect(radio("A saved list").disabled).toBe(true);
    expect(dialog.textContent).toContain("no contact lists");
  });

  it("needs a field", async () => {
    const dialog = await ready();
    fireEvent.click(screen.getByRole("checkbox", { name: "Full name" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Email" }));
    expect(previewButton().disabled).toBe(true);
    expect(dialog.textContent).toContain("Choose at least one field");
  });

  it("closes the dialog on a preview, maps with only fitting types, confirms and follows the import", async () => {
    imports.confirm.mockResolvedValue(item({ status: "completed", preview: null, progress: 100, counts: { total: 45, processed: 45, imported: 43, duplicates: 2, skipped: 0, failed: 0 }, report: { available: true, rows: 2 } }));
    await ready();
    fireEvent.click(previewButton());
    await screen.findByText("Map the columns");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText(/Nothing is added until you confirm/).textContent).toContain("about 45 records");
    const types = within(screen.getByLabelText("Type of the new column for “Full name”")).getAllByRole("option").map((o) => o.textContent);
    expect(types).toEqual(["Text"]);
    // A number column cannot take either field.
    expect((within(screen.getByLabelText("Import “Email” into")).getByRole("option", { name: "Count" }) as HTMLOptionElement).disabled).toBe(true);
    expect(imports.confirm).not.toHaveBeenCalled();
    fireEvent.click(radio("Email"));
    imports.get.mockResolvedValue(item({ status: "completed", preview: null, progress: 100, counts: { total: 45, processed: 45, imported: 43, duplicates: 2, skipped: 0, failed: 0 }, report: { available: true, rows: 2 } }));
    fireEvent.click(screen.getByRole("button", { name: /^Import/ }));
    await screen.findByText("43 rows were added to the workbook.");
    expect(imports.confirm).toHaveBeenCalledWith("wb-1", "imp-1", {
      columns: [{ header: 0, newColumn: { name: "Full name", dataType: "text" } }, { header: 1, newColumn: { name: "Email", dataType: "email" } }],
      dedupe: { key: "email", header: 1 },
    });
    expect(screen.getByText("Duplicates skipped").nextElementSibling!.textContent).toBe("2");
    expect(screen.getByRole("button", { name: "Download skipped rows (2)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("can cancel a preview, and shows why a confirmation was refused", async () => {
    imports.confirm.mockRejectedValue(refusal("APOLLO_CONNECTION_CHANGED", "The Apollo API key was saved again since this preview."));
    imports.cancel.mockResolvedValue(item({ status: "cancelled", preview: null }));
    await ready();
    fireEvent.click(previewButton());
    await screen.findByText("Map the columns");
    fireEvent.click(radio("None (import every row)"));
    fireEvent.click(screen.getByRole("button", { name: /^Import/ }));
    expect(await screen.findByText(/saved again since this preview/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText("Map the columns")).toBeNull());
    expect(imports.cancel).toHaveBeenCalledWith("wb-1", "imp-1");
  });

  it("keeps showing progress while it runs in the background", async () => {
    const running = item({ status: "processing", preview: null, background: true, progress: 40, counts: { total: 2350, processed: 940, imported: 940, duplicates: 0, skipped: 0, failed: 0 } });
    apollo.preview.mockResolvedValue(running);
    imports.get.mockResolvedValue(running);
    await ready();
    fireEvent.click(previewButton());
    expect((await screen.findByRole("progressbar")).getAttribute("aria-valuenow")).toBe("40");
    expect(screen.getByText(/You can keep working/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add rows" })).toBeTruthy();
  });

  it.each([
    [{ matched: 60000, considered: 50000, reason: "source_limit" as const }, "Apollo lets only the first 50,000 of about 60,000 contacts be read"],
    [{ matched: 3000, considered: 1000 }, "The workbook filled up: the first 1,000 of about 3,000 records were read"],
  ])("says why not everything was read", async (truncated, words) => {
    const done = item({ status: "completed", preview: null, truncated, progress: 100, counts: { total: 1000, processed: 1000, imported: 1000, duplicates: 0, skipped: 0, failed: 0 } });
    apollo.preview.mockResolvedValue(done);
    imports.get.mockResolvedValue(done);
    await ready();
    fireEvent.click(previewButton());
    await waitFor(() => expect(document.body.textContent).toContain(words));
  });

  it("shows why a failed import stopped", async () => {
    const failed = item({ status: "failed", preview: null, error: { code: "APOLLO_RECONNECT_REQUIRED", message: "Apollo rejected the saved API key. Rows already imported are in the workbook." } });
    apollo.preview.mockResolvedValue(failed);
    imports.get.mockResolvedValue(failed);
    await ready();
    fireEvent.click(previewButton());
    expect(await screen.findByText(/rejected the saved API key/)).toBeTruthy();
  });

  it.each([
    ["APOLLO_RATE_LIMITED", 429, false],
    ["APOLLO_SCOPE_MISSING", 409, true],
    ["APOLLO_UNKNOWN_LIST", 422, false],
    ["NOTHING_TO_ADD", 422, false],
  ])("reports a refused preview (%s) and stays in the dialog", async (code, status, settings) => {
    apollo.preview.mockRejectedValue(refusal(code, `Refused: ${code}`, status));
    const dialog = await ready();
    fireEvent.click(previewButton());
    expect(await within(dialog).findByText(`Refused: ${code}`)).toBeTruthy();
    expect(Boolean(within(dialog).queryByRole("link", { name: "Open Settings → Integrations" }))).toBe(settings);
    // The next attempt is a new request.
    fireEvent.click(previewButton());
    await waitFor(() => expect(apollo.preview).toHaveBeenCalledTimes(2));
    expect(sent(1).key).not.toBe(sent(0).key);
  });

  it("repeats a request that may have reached the server with the same key", async () => {
    apollo.preview.mockRejectedValueOnce(new ApiError("Bad gateway", 502, {})).mockResolvedValue(item());
    await ready();
    fireEvent.click(previewButton());
    await waitFor(() => expect(previewButton().disabled).toBe(false));
    await screen.findByRole("alert");
    fireEvent.click(previewButton());
    await waitFor(() => expect(apollo.preview).toHaveBeenCalledTimes(2));
    expect(sent(1).key).toBe(sent(0).key);
  });
});

describe("Apollo helpers", () => {
  it("say what is missing before a preview", () => {
    expect(apolloProblem(["name"], { kind: "list", listId: "" })).toBe("Choose a list.");
    expect(apolloProblem([], { kind: "search", keywords: "", stageIds: [] })).toContain("at least one field");
    expect(apolloProblem(Array.from({ length: 51 }, (_, i) => `f${i}`), { kind: "list", listId: "l" })).toContain("at most 50");
    expect(apolloProblem(["name"], { kind: "search", keywords: "", stageIds: Array.from({ length: 21 }, (_, i) => `s${i}`) })).toContain("at most 20");
    expect(apolloBody(["name"], { kind: "search", keywords: "   ", stageIds: [] })).toEqual({ fields: ["name"], search: {} });
  });

  it("treat an Apollo import as records, and name its rows", () => {
    expect(isRecordImport({ sourceType: "apollo" })).toBe(true);
    expect(importTitle(item({ fileName: "Apollo contacts · Prospects" }))).toBe("Apollo contacts · Prospects");
    expect(sourceLabel({ type: "apollo", viewName: "Prospects" })).toBe("Apollo: Prospects");
    expect(sourceLabel({ type: "apollo", searchStages: "Cold" })).toBe("Apollo search");
    expect(sourceLabel({ type: "apollo" })).toBe("Apollo");
    const headers = item().preview!.headers;
    // A field that cannot go into a column type blocks confirming.
    const check = checkMapping(headers, [{ kind: "new", name: "N", dataType: "number" }, { kind: "skip" }], [], { key: "none" }, true);
    expect(check.columnErrors[0]).toContain("can’t go into a number column");
    expect(check.blocker).toBe("Fix the highlighted columns.");
  });
});
