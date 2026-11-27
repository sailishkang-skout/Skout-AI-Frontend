import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { ACCESS_QUERY_KEY } from "@/lib/access";
import { importBody, operatorLabel, selectionProblem } from "@/lib/workbooks-v2-crm";
import { checkMapping, importTitle, type WorkbookImport } from "@/lib/workbooks-v2-import";
import { sourceLabel } from "@/lib/workbooks-v2-grid";
import { CrmImport } from "./crm-import";

vi.mock("@/lib/api-client", async (original) => ({ ...(await original<typeof import("@/lib/api-client")>()), useAuthReady: () => true }));
const crmApi = vi.hoisted(() => ({ sources: vi.fn(), describe: vi.fn(), preview: vi.fn() }));
vi.mock("@/lib/workbooks-v2-crm", async (original) => ({ ...(await original<typeof import("@/lib/workbooks-v2-crm")>()), useWorkbookCrmApi: () => crmApi }));
const imports = vi.hoisted(() => ({ get: vi.fn(), confirm: vi.fn(), cancel: vi.fn(), columns: vi.fn(), report: vi.fn() }));
vi.mock("@/lib/workbooks-v2-import", async (original) => ({ ...(await original<typeof import("@/lib/workbooks-v2-import")>()), useWorkbookImportApi: () => imports }));
const connectHubSpot = vi.hoisted(() => vi.fn());
vi.mock("@/lib/crm", () => ({ useCrmApi: () => ({ connectHubSpot }) }));

const providers = (hubspot = "connected") => [
  { provider: "hubspot", label: "HubSpot", status: hubspot, objects: ["contact", "company"] },
  { provider: "salesforce", label: "Salesforce", status: "not_available", objects: [] },
  { provider: "pipedrive", label: "Pipedrive", status: "not_available", objects: [] },
];
const STRING = ["equals", "contains", "has_value", "is_empty"];
const info = (object = "contact", over: Record<string, unknown> = {}) => ({
  provider: "hubspot",
  object,
  fields: [
    { name: "email", label: "Email", type: "string", operators: STRING },
    { name: "firstname", label: object === "contact" ? "First name" : "Company name", type: "string", operators: STRING },
    { name: "score", label: "Lead score", type: "number", operators: ["greater_than", "has_value"] },
    { name: "subscribed", label: "Subscribed", type: "bool", operators: ["equals"] },
    { name: "signed_up", label: "Signed up", type: "date", operators: ["at_least"] },
  ],
  defaultFields: ["firstname", "email"],
  views: { label: "HubSpot list", note: "Saved views can't be read.", available: true, reason: null, items: [{ id: "7", name: "Pipeline", count: 1200 }] },
  filters: { max: 2 },
  ...over,
});

const item = (over: Partial<WorkbookImport> = {}): WorkbookImport => ({
  id: "imp-1",
  workbookId: "wb-1",
  sourceType: "hubspot",
  sourceName: null,
  truncated: null,
  status: "awaiting_confirmation",
  fileName: "HubSpot contacts",
  fileBytes: 0,
  counts: { total: 45, processed: 0, imported: 0, duplicates: 0, skipped: 0, failed: 0 },
  progress: 0,
  background: false,
  error: null,
  report: { available: false, rows: 0 },
  preview: {
    headers: [
      { index: 0, name: "Email", fits: ["text", "email"], filled: 1 },
      { index: 1, name: "Lead score", fits: ["text", "number"], filled: 1 },
    ],
    rows: [{ line: 1, values: ["a@x.com", "7"] }],
    suggestions: [
      { header: 0, target: { newColumn: { name: "Email", dataType: "email" } } },
      { header: 1, target: { newColumn: { name: "Lead score", dataType: "number" } } },
    ],
  },
  createdAt: "2026-11-27T00:00:00Z",
  ...over,
});

const refusal = (code: string, message: string, status = 409) => new ApiError(message, status, { code, message });

function show({ crm = true } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(ACCESS_QUERY_KEY, { status: "active", features: { crm } });
  return render(
    <QueryClientProvider client={client}>
      <CrmImport workbook={{ id: "wb-1", name: "Leads" }} />
    </QueryClientProvider>
  );
}
const openCard = () => fireEvent.click(screen.getByRole("button", { name: "Import from a CRM" }));
const pickHubSpot = async () => {
  openCard();
  fireEvent.click(await screen.findByRole("radio", { name: /HubSpot/ }));
};
const ready = async () => {
  await pickHubSpot();
  await screen.findByText("Fields to import");
};
const previewButton = () => screen.getByRole("button", { name: "Preview records" }) as HTMLButtonElement;
const sentBody = (call = 0) => crmApi.preview.mock.calls[call]![1];
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("Import from your CRM", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    crmApi.sources.mockResolvedValue(providers());
    crmApi.describe.mockImplementation(async (_wb: string, _p: string, object: string) => info(object));
    crmApi.preview.mockResolvedValue(item());
    imports.get.mockResolvedValue(item());
    imports.columns.mockResolvedValue([{ id: "c-num", name: "Count", type: "input", config: { dataType: "number" } }]);
  });
  afterEach(() => cleanup());

  it("is not offered where CRM isn't in the plan", () => {
    show({ crm: false });
    expect(screen.queryByText("Import from your CRM")).toBeNull();
    expect(crmApi.sources).not.toHaveBeenCalled();
  });

  it("asks nothing until opened, then shows each CRM and how it stands", async () => {
    show();
    expect(crmApi.sources).not.toHaveBeenCalled();
    openCard();
    expect(await screen.findByText("Connected")).toBeTruthy();
    expect(screen.getAllByText("Not available yet")).toHaveLength(2);
    expect((screen.getByRole("radio", { name: /Salesforce/ }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("radio", { name: /Pipedrive/ }) as HTMLInputElement).disabled).toBe(true);
    expect(crmApi.describe).not.toHaveBeenCalled();
  });

  it.each([
    ["not_connected", "Connect HubSpot", "isn’t connected yet"],
    ["needs_reauth", "Reconnect HubSpot", "expired or was revoked"],
  ])("offers the existing connection flow when HubSpot is %s", async (status, button, words) => {
    crmApi.sources.mockResolvedValue(providers(status));
    connectHubSpot.mockResolvedValue({ authorizationUrl: "https://app.hubspot.com/oauth/authorize?x=1" });
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    show();
    await pickHubSpot();
    expect((await screen.findByRole("alert")).textContent).toContain(words);
    fireEvent.click(screen.getByRole("button", { name: button }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://app.hubspot.com/oauth/authorize?x=1"));
    expect(crmApi.describe).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("has nothing to connect when HubSpot isn't set up on the server", async () => {
    crmApi.sources.mockResolvedValue(providers("not_configured"));
    show();
    await pickHubSpot();
    expect((await screen.findByRole("alert")).textContent).toContain("hasn’t been set up");
    expect(screen.queryByRole("button", { name: /Connect HubSpot/ })).toBeNull();
  });

  it("previews the default fields of every record, and says nothing is added yet", async () => {
    show();
    await ready();
    expect(screen.getByText("2 of 5 chosen (up to 50)")).toBeTruthy();
    expect(screen.getByText("Nothing is added until you confirm.")).toBeTruthy();
    fireEvent.click(previewButton());
    await waitFor(() => expect(crmApi.preview).toHaveBeenCalled());
    expect(sentBody()).toEqual({ provider: "hubspot", object: "contact", fields: ["firstname", "email"] });
    expect(crmApi.preview.mock.calls[0]![2]).toEqual(expect.any(String));
    await screen.findByText("Map the columns");
  });

  it("reads companies when chosen, with their own fields", async () => {
    show();
    await ready();
    fireEvent.click(screen.getByRole("radio", { name: "Companies" }));
    await screen.findByRole("checkbox", { name: "Company name" });
    expect(crmApi.describe).toHaveBeenLastCalledWith("wb-1", "hubspot", "company");
    fireEvent.click(screen.getByRole("checkbox", { name: "Lead score" }));
    fireEvent.click(previewButton());
    await waitFor(() => expect(crmApi.preview).toHaveBeenCalled());
    expect(sentBody()).toMatchObject({ object: "company", fields: ["firstname", "email", "score"] });
  });

  it("takes a list", async () => {
    show();
    await ready();
    fireEvent.click(screen.getByRole("radio", { name: "A HubSpot list" }));
    expect(previewButton().disabled).toBe(true);
    expect(screen.getByText("Choose a list.")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Pipeline (1,200)" })).toBeTruthy();
    change("HubSpot list", "7");
    fireEvent.click(previewButton());
    await waitFor(() => expect(crmApi.preview).toHaveBeenCalled());
    expect(sentBody()).toEqual({ provider: "hubspot", object: "contact", fields: ["firstname", "email"], viewId: "7" });
  });

  it("builds filters from what each field allows, and stops at the limit", async () => {
    show();
    await ready();
    fireEvent.click(screen.getByRole("radio", { name: "Filtered records" }));
    expect(screen.getByText("Add a filter, or choose all records.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    change("Filter 1 field", "score");
    expect(within(screen.getByLabelText("Filter 1 condition")).getAllByRole("option").map((o) => o.textContent)).toEqual(["is more than", "has a value"]);
    expect(screen.getByLabelText("Filter 1 value").getAttribute("type")).toBe("number");
    expect(previewButton().disabled).toBe(true);
    change("Filter 1 value", "10");
    // A value typed for one field is not carried over to another.
    change("Filter 1 field", "email");
    expect((screen.getByLabelText("Filter 1 value") as HTMLInputElement).value).toBe("");
    change("Filter 1 field", "score");
    change("Filter 1 value", "10");
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    expect((screen.getByRole("button", { name: "Add filter" }) as HTMLButtonElement).disabled).toBe(true);
    change("Filter 2 field", "email");
    change("Filter 2 condition", "has_value");
    expect(screen.queryByLabelText("Filter 2 value")).toBeNull();
    fireEvent.click(previewButton());
    await waitFor(() => expect(crmApi.preview).toHaveBeenCalled());
    expect(sentBody().filters).toEqual([
      { field: "score", operator: "greater_than", value: "10" },
      { field: "email", operator: "has_value" },
    ]);
    expect(sentBody().viewId).toBeUndefined();
  });

  it("asks yes or no for a yes-or-no field, and a date for a date", async () => {
    show();
    await ready();
    fireEvent.click(screen.getByRole("radio", { name: "Filtered records" }));
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    change("Filter 1 field", "subscribed");
    change("Filter 1 value", "true");
    change("Filter 1 field", "signed_up");
    expect(screen.getByLabelText("Filter 1 value").getAttribute("type")).toBe("date");
    expect((screen.getByLabelText("Filter 1 value") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("option", { name: "is on or after" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove filter 1" }));
    expect(screen.queryByLabelText("Filter 1 field")).toBeNull();
  });

  it("says why lists can't be chosen", async () => {
    crmApi.describe.mockResolvedValue(info("contact", { views: { label: "HubSpot list", note: "", available: false, reason: "The HubSpot connection doesn't have permission to read this.", items: [] } }));
    show();
    await ready();
    expect((screen.getByRole("radio", { name: "A HubSpot list" }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/doesn't have permission/)).toBeTruthy();
  });

  it("needs a field, and finds one by name", async () => {
    show();
    await ready();
    fireEvent.click(screen.getByRole("checkbox", { name: "First name" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Email" }));
    expect(previewButton().disabled).toBe(true);
    change("Search fields", "score");
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    change("Search fields", "zzz");
    expect(screen.getByText("No field matches “zzz”.")).toBeTruthy();
  });

  it("confirms the mapping, offering only column types a field fits, then follows the import", async () => {
    const done = item({ status: "completed", preview: null, progress: 100, counts: { total: 45, processed: 45, imported: 40, duplicates: 3, skipped: 1, failed: 1 }, report: { available: true, rows: 5 } });
    imports.confirm.mockResolvedValue(done);
    show();
    await ready();
    fireEvent.click(previewButton());
    await screen.findByText("Map the columns");
    expect(screen.getByText(/has about/).textContent).toContain("HubSpot contacts has about 45 records");
    expect(screen.getByText("First 1 of 45 records")).toBeTruthy();
    expect(within(screen.getByLabelText("Type of the new column for “Email”")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Text", "Email"]);
    expect((within(screen.getByLabelText("Import “Email” into")).getByRole("option", { name: "Count" }) as HTMLOptionElement).disabled).toBe(true);
    expect((within(screen.getByLabelText("Import “Lead score” into")).getByRole("option", { name: "Count" }) as HTMLOptionElement).disabled).toBe(false);
    expect(imports.confirm).not.toHaveBeenCalled();
    imports.get.mockResolvedValue(done);
    fireEvent.click(screen.getByRole("radio", { name: "Email" }));
    fireEvent.click(screen.getByRole("button", { name: "Import 45 records" }));
    await screen.findByText("40 rows were added to the workbook.");
    expect(imports.confirm).toHaveBeenCalledWith("wb-1", "imp-1", {
      columns: [
        { header: 0, newColumn: { name: "Email", dataType: "email" } },
        { header: 1, newColumn: { name: "Lead score", dataType: "number" } },
      ],
      dedupe: { key: "email", header: 0 },
    });
    for (const label of ["In the selection", "Duplicates skipped", "Invalid or over the limit", "Empty or no longer there"]) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download skipped rows (5)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Import more" }));
    await screen.findByText("Fields to import");
  });

  it("does not let a column that no longer fits the field be confirmed", async () => {
    // The column the preview suggested has since become a number column.
    const stale = item();
    stale.preview!.suggestions[0] = { header: 0, target: { columnId: "c-num" } };
    crmApi.preview.mockResolvedValue(stale);
    imports.get.mockResolvedValue(stale);
    show();
    await ready();
    fireEvent.click(previewButton());
    await screen.findByText("Map the columns");
    expect(screen.getByText(/can’t go into a number column/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "None (import every row)" }));
    expect((screen.getByRole("button", { name: "Import 45 records" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("can cancel a preview", async () => {
    imports.cancel.mockResolvedValue(item({ status: "cancelled" }));
    show();
    await ready();
    fireEvent.click(previewButton());
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await screen.findByText("Fields to import");
    expect(imports.cancel).toHaveBeenCalledWith("wb-1", "imp-1");
  });

  it("says when the workbook filled up, and why a failed import stopped", async () => {
    crmApi.preview.mockResolvedValue(item({ status: "failed", preview: null, truncated: { matched: 3000, considered: 1000 }, error: { code: "CRM_RECONNECT_REQUIRED", message: "HubSpot access expired. Rows already imported are in the workbook." } }));
    imports.get.mockImplementation(async () => crmApi.preview.mock.results[0]!.value);
    show();
    await ready();
    fireEvent.click(previewButton());
    expect(await screen.findByText(/Rows already imported/)).toBeTruthy();
    expect(screen.getByText("The workbook filled up: the first 1,000 of about 3,000 records were read.")).toBeTruthy();
    await waitFor(() => expect(crmApi.sources.mock.calls.length).toBeGreaterThan(1));
  });

  it("shows why the records can't be read, with a way to reconnect, without asking twice", async () => {
    crmApi.describe.mockRejectedValue(refusal("CRM_SCOPE_MISSING", "The HubSpot connection doesn't have permission to read this."));
    show();
    await pickHubSpot();
    expect((await screen.findByRole("alert")).textContent).toContain("permission");
    expect(screen.getByRole("button", { name: "Reconnect HubSpot" })).toBeTruthy();
    expect(crmApi.describe).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["CRM_RECONNECT_REQUIRED", "HubSpot access expired or was revoked.", 409, true],
    ["CRM_RATE_LIMITED", "HubSpot is limiting requests right now.", 429, false],
    ["CRM_UNKNOWN_VIEW", "That HubSpot list doesn't exist.", 422, false],
  ])("reports a refused preview (%s)", async (code, message, status, offersReconnect) => {
    crmApi.preview.mockRejectedValue(refusal(code, message, status));
    show();
    await ready();
    fireEvent.click(previewButton());
    expect(await screen.findByText(message)).toBeTruthy();
    expect(Boolean(screen.queryByRole("button", { name: "Reconnect HubSpot" }))).toBe(offersReconnect);
    expect(screen.queryByText("Map the columns")).toBeNull();
    if (offersReconnect) await waitFor(() => expect(crmApi.sources.mock.calls.length).toBeGreaterThan(1));
  });

  it("sends the same key when an unanswered preview is asked again, and a new one for a new question", async () => {
    crmApi.preview.mockRejectedValue(new TypeError("Failed to fetch"));
    show();
    await ready();
    const ask = async (calls: number) => {
      await act(async () => void fireEvent.click(previewButton()));
      await waitFor(() => expect(crmApi.preview).toHaveBeenCalledTimes(calls));
      await waitFor(() => expect(previewButton().disabled).toBe(false));
    };
    await ask(1);
    await ask(2);
    expect(crmApi.preview.mock.calls[1]![2]).toBe(crmApi.preview.mock.calls[0]![2]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Lead score" }));
    await ask(3);
    expect(crmApi.preview.mock.calls[2]![2]).not.toBe(crmApi.preview.mock.calls[0]![2]);
  });

  it("keeps a refused confirmation on screen with the server's reasons", async () => {
    imports.confirm.mockRejectedValue(new ApiError("x", 422, { details: { errors: [{ message: "“Email” can't be imported into a number column." }] } }));
    show();
    await ready();
    fireEvent.click(previewButton());
    await screen.findByText("Map the columns");
    fireEvent.click(screen.getByRole("radio", { name: "None (import every row)" }));
    fireEvent.click(screen.getByRole("button", { name: "Import 45 records" }));
    expect(await screen.findByText("“Email” can't be imported into a number column.")).toBeTruthy();
    expect(screen.getByText("Map the columns")).toBeTruthy();
  });
});

describe("CRM import helpers", () => {
  it("refuses a column a CRM field doesn't fit, but only warns for a file", () => {
    const headers = [{ index: 0, name: "Email", fits: ["text", "email"] as never, filled: 1 }];
    const choice = [{ kind: "new" as const, name: "N", dataType: "number" as const }];
    expect(checkMapping(headers, choice, [], { key: "none" }, true).blocker).toBe("Fix the highlighted columns.");
    const file = checkMapping(headers, choice, [], { key: "none" });
    expect(file.blocker).toBeNull();
    expect(file.warnings[0]).toBeTruthy();
  });

  it("says why a preview can't be asked for", () => {
    expect(selectionProblem([], { kind: "all" })).toContain("at least one field");
    expect(selectionProblem(Array.from({ length: 51 }, (_, i) => `${i}`), { kind: "all" })).toContain("at most 50");
    expect(selectionProblem(["a"], { kind: "filters", filters: [{ field: "", operator: "equals", value: "" }] })).toContain("field");
    expect(selectionProblem(["a"], { kind: "filters", filters: [{ field: "a", operator: "equals", value: "  " }] })).toContain("value");
    expect(selectionProblem(["a"], { kind: "filters", filters: [{ field: "a", operator: "is_empty", value: "" }] })).toBeNull();
  });

  it("sends only what the choice needs", () => {
    expect(importBody("hubspot", "contact", ["a"], { kind: "filters", filters: [{ field: "a", operator: "has_value", value: "left over" }] }).filters).toEqual([{ field: "a", operator: "has_value" }]);
    expect(operatorLabel("greater_than", "number")).toBe("is more than");
    expect(operatorLabel("greater_than", "datetime")).toBe("is after");
  });

  it("names a CRM import and its rows", () => {
    expect(importTitle({ sourceType: "hubspot", sourceName: "Pipeline", fileName: "HubSpot contacts · Pipeline" })).toBe("HubSpot contacts · Pipeline");
    expect(sourceLabel({ type: "hubspot" })).toBe("HubSpot");
    expect(sourceLabel({ type: "hubspot", viewName: "Pipeline" })).toBe("HubSpot: Pipeline");
  });
});
