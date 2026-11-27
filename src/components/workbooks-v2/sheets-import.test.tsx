import { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GoogleSheetsSettingsPage from "@/app/(dashboard)/settings/google-sheets/page";
import { GoogleSheetsCard } from "@/components/settings/google-sheets-card";
import { ACCESS_QUERY_KEY } from "@/lib/access";
import { ApiError } from "@/lib/api-client";
import { sourceLabel } from "@/lib/workbooks-v2-grid";
import { identityProblem, suggestedIdColumn, type ImportPreview, type WorkbookImport } from "@/lib/workbooks-v2-import";
import { AddProspects } from "./add-prospects";

vi.mock("@/lib/api-client", async (original) => ({ ...(await original<typeof import("@/lib/api-client")>()), useAuthReady: () => true }));
const search = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search.value) }));
vi.mock("@/components/layout/page-header", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/lib/enrichment", () => ({ useEnrichmentApi: () => ({ listLists: vi.fn().mockResolvedValue({ data: [] }) }) }));
vi.mock("@/lib/smart-lists", () => ({ useSmartListApi: () => ({ list: vi.fn().mockResolvedValue({ data: [] }) }) }));
const google = vi.hoisted(() => ({ status: vi.fn(), start: vi.fn(), complete: vi.fn(), disconnect: vi.fn() }));
vi.mock("@/lib/google-sheets", async (original) => ({ ...(await original<typeof import("@/lib/google-sheets")>()), useGoogleSheetsApi: () => google }));
const sheets = vi.hoisted(() => ({ inspect: vi.fn(), preview: vi.fn(), sources: vi.fn(), pull: vi.fn(), forget: vi.fn() }));
vi.mock("@/lib/workbooks-v2-sheets", async (original) => ({ ...(await original<typeof import("@/lib/workbooks-v2-sheets")>()), useWorkbookSheetsApi: () => sheets }));
const imports = vi.hoisted(() => ({ get: vi.fn(), confirm: vi.fn(), cancel: vi.fn(), columns: vi.fn(), report: vi.fn() }));
vi.mock("@/lib/workbooks-v2-import", async (original) => ({ ...(await original<typeof import("@/lib/workbooks-v2-import")>()), useWorkbookImportApi: () => imports }));

const LINK = "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit#gid=5";
const connected = { configured: true, status: "connected" as const, connectedAt: "2026-11-27T10:00:00Z" };
const spreadsheet = {
  spreadsheetId: "1AbC",
  name: "Pipeline",
  linkedSheetId: 5,
  tabs: [
    { sheetId: 0, name: "Old", rows: 100, columns: 5, sourceId: null },
    { sheetId: 5, name: "Leads", rows: 200, columns: 5, sourceId: null },
  ],
};
const preview = (over: Partial<ImportPreview["sheet"]> = {}): ImportPreview => ({
  headers: [
    { index: 0, name: "Name", fits: ["text"], filled: 2 },
    { index: 1, name: "Email", fits: ["text", "email"], filled: 2 },
    { index: 2, name: "Record ID", fits: ["text"], filled: 2 },
  ],
  rows: [{ line: 2, values: ["Ada", "ada@example.com", "7"] }],
  suggestions: [
    { header: 0, target: { newColumn: { name: "Name", dataType: "text" } } },
    { header: 1, target: { newColumn: { name: "Email", dataType: "email" } } },
    { header: 2, target: { columnId: "c-1" } },
  ],
  sheet: { spreadsheetName: "Pipeline", tabName: "Leads", unique: [false, true, false], source: null, ...over },
});
const item = (over: Partial<WorkbookImport> = {}): WorkbookImport => ({
  id: "imp-1",
  workbookId: "wb-1",
  sourceType: "google_sheets",
  sourceName: "Leads",
  sheet: { sourceId: null, spreadsheetName: "Pipeline", tabName: "Leads", pull: false },
  truncated: null,
  status: "awaiting_confirmation",
  fileName: "Pipeline · Leads",
  fileBytes: 100,
  counts: { total: 45, processed: 0, imported: 0, duplicates: 0, skipped: 0, failed: 0 },
  progress: 0,
  background: false,
  error: null,
  report: { available: false, rows: 0 },
  preview: preview(),
  createdAt: "2026-11-27T00:00:00Z",
  ...over,
});
const pulledItem = (counts: Partial<WorkbookImport["counts"]> = {}, over: Partial<WorkbookImport> = {}) =>
  item({
    id: "imp-2",
    status: "completed",
    preview: null,
    progress: 100,
    sheet: { sourceId: "src-1", spreadsheetName: "Pipeline", tabName: "Leads", pull: true },
    counts: { total: 10, processed: 10, imported: 2, duplicates: 0, skipped: 0, failed: 0, alreadyImported: 8, ...counts },
    ...over,
  });
const source = (over: Record<string, unknown> = {}) => ({ id: "src-1", spreadsheetName: "Pipeline", tabName: "Leads", idColumn: null, rows: 10, lastPulledAt: "2026-11-27T10:00:00Z", runningImportId: null, ...over });
const refusal = (code: string, message: string, status = 409) => new ApiError(message, status, { code, message });
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const show = () =>
  render(
    <QueryClientProvider client={client()}>
      <AddProspects workbook={{ id: "wb-1", name: "Leads" }} />
    </QueryClientProvider>
  );
async function openSheets() {
  show();
  fireEvent.click(screen.getByRole("button", { name: "Add rows" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("tab", { name: "Google Sheets" }));
  return dialog;
}
const type = (value: string) => fireEvent.change(screen.getByLabelText("Spreadsheet link"), { target: { value } });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const button = (name: string | RegExp) => screen.getByRole("button", { name }) as HTMLButtonElement;
const radio = (name: string | RegExp) => screen.getByRole("radio", { name }) as HTMLInputElement;
async function openTabs() {
  const dialog = await openSheets();
  await within(dialog).findByLabelText("Spreadsheet link");
  type(`  ${LINK}  `);
  click("Open");
  await screen.findByText("Tab of “Pipeline”");
  return dialog;
}
async function mapping(over?: Partial<ImportPreview["sheet"]>) {
  const next = item({ preview: preview(over) });
  sheets.preview.mockResolvedValue(next);
  imports.get.mockResolvedValue(next);
  await openTabs();
  click("Preview rows");
  await screen.findByText("Map the columns");
}

beforeEach(() => {
  vi.resetAllMocks();
  search.value = "";
  google.status.mockResolvedValue(connected);
  sheets.inspect.mockResolvedValue(spreadsheet);
  sheets.preview.mockResolvedValue(item());
  sheets.sources.mockResolvedValue([]);
  imports.get.mockResolvedValue(item());
  imports.columns.mockResolvedValue([{ id: "c-1", name: "Record", type: "input", config: { dataType: "text" } }]);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Add rows from Google Sheets", () => {
  it("is a choice under Add rows, and checks the connection only once chosen", async () => {
    show();
    click("Add rows");
    expect(google.status).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "Google Sheets" }));
    await screen.findByLabelText("Spreadsheet link");
    expect(google.status).toHaveBeenCalled();
    expect(sheets.inspect).not.toHaveBeenCalled();
    expect(button("Open").disabled).toBe(true);
  });

  it.each([
    ["not_connected", "Connect Google Sheets", "Skout can’t change them"],
    ["needs_reauth", "Reconnect Google Sheets", "expired or was removed"],
  ])("connects through Google when %s", async (status, name, words) => {
    google.status.mockResolvedValue({ configured: true, status, connectedAt: null });
    google.start.mockResolvedValue({ authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?x=1" });
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    const dialog = await openSheets();
    expect((await within(dialog).findByRole("alert")).textContent).toContain(words);
    click(name);
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/v2/auth?x=1"));
    expect(within(dialog).queryByLabelText("Spreadsheet link")).toBeNull();
  });

  it("offers nothing to connect where the server isn't set up", async () => {
    google.status.mockResolvedValue({ configured: false, status: "not_connected", connectedAt: null });
    const dialog = await openSheets();
    expect((await within(dialog).findByRole("alert")).textContent).toContain("isn’t set up");
    expect(within(dialog).queryByRole("button", { name: /Connect/ })).toBeNull();
  });

  it("opens a pasted link, starts on the linked tab, and previews the chosen one", async () => {
    await openTabs();
    expect(sheets.inspect).toHaveBeenCalledWith("wb-1", LINK);
    expect(radio(/Leads/).checked).toBe(true);
    fireEvent.click(radio(/Old/));
    click("Preview rows");
    await waitFor(() => expect(sheets.preview).toHaveBeenCalled());
    expect(sheets.preview.mock.calls[0]!.slice(0, 2)).toEqual(["wb-1", { spreadsheet: LINK, sheetId: 0 }]);
    expect(sheets.preview.mock.calls[0]![2]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("forgets the opened spreadsheet when the link changes", async () => {
    await openTabs();
    type(`${LINK}x`);
    expect(screen.queryByText("Tab of “Pipeline”")).toBeNull();
    expect(screen.queryByRole("button", { name: "Preview rows" })).toBeNull();
  });

  it("marks tabs already in the workbook", async () => {
    sheets.inspect.mockResolvedValue({ ...spreadsheet, tabs: [{ ...spreadsheet.tabs[1]!, sourceId: "src-1" }] });
    const dialog = await openTabs();
    expect(dialog.textContent).toContain("In this workbook");
    expect(dialog.textContent).toContain("Pull new rows");
  });

  it.each([
    ["SHEETS_INVALID_LINK", 422, false],
    ["SHEETS_NO_ACCESS", 422, false],
    ["SHEETS_RECONNECT_REQUIRED", 409, true],
  ])("reports a link that can't be opened (%s)", async (code, status, settings) => {
    sheets.inspect.mockRejectedValue(refusal(code, `Refused: ${code}`, status));
    const dialog = await openSheets();
    await within(dialog).findByLabelText("Spreadsheet link");
    type(LINK);
    click("Open");
    expect(await within(dialog).findByText(`Refused: ${code}`)).toBeTruthy();
    expect(Boolean(within(dialog).queryByRole("link", { name: "Open Settings → Google Sheets" }))).toBe(settings);
  });

  it("sends a new key after a refusal, and the same one after a lost answer", async () => {
    sheets.preview.mockRejectedValueOnce(refusal("SHEETS_RATE_LIMITED", "Busy", 429)).mockRejectedValueOnce(new ApiError("Bad gateway", 502, {})).mockResolvedValue(item());
    await openTabs();
    for (let i = 1; i <= 3; i += 1) {
      await waitFor(() => expect(button("Preview rows").disabled).toBe(false));
      click("Preview rows");
      await waitFor(() => expect(sheets.preview).toHaveBeenCalledTimes(i));
    }
    const keys = sheets.preview.mock.calls.map((c) => c[2]);
    expect(keys[1]).not.toBe(keys[0]);
    expect(keys[2]).toBe(keys[1]);
  });

  it("closes the dialog, shows the spreadsheet and tab, suggests the unique ID, and confirms with it", async () => {
    imports.confirm.mockResolvedValue(pulledItem());
    await mapping();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.textContent).toContain("Pipeline · Leads");
    expect(document.body.textContent).toContain("as the tab held them when you previewed it");
    expect(screen.getByRole("columnheader", { name: "Row" })).toBeTruthy();
    const by = screen.getByLabelText("Recognise rows by") as HTMLSelectElement;
    expect(by.value).toBe("1");
    expect(document.body.textContent).toContain("A row is added once for each value in this column");
    fireEvent.click(radio("None (import every row)"));
    click(/^Import 45 rows$/);
    await waitFor(() => expect(imports.confirm).toHaveBeenCalled());
    expect(imports.confirm.mock.calls[0]![2]).toMatchObject({ idColumn: 1 });
    expect(imports.confirm.mock.calls[0]![2].columns).toHaveLength(3);
  });

  it("can go by contents or another column, saying what that means", async () => {
    imports.confirm.mockResolvedValue(pulledItem());
    await mapping();
    fireEvent.change(screen.getByLabelText("Recognise rows by"), { target: { value: "2" } });
    expect(document.body.textContent).toContain("Some rows share this value or have none");
    fireEvent.change(screen.getByLabelText("Recognise rows by"), { target: { value: "" } });
    expect(document.body.textContent).toContain("will be added again as a new row");
    fireEvent.click(radio("None (import every row)"));
    click(/^Import 45 rows$/);
    await waitFor(() => expect(imports.confirm.mock.calls[0]![2]).toMatchObject({ idColumn: null }));
  });

  it("keeps a known tab's way of recognising rows", async () => {
    imports.confirm.mockResolvedValue(pulledItem());
    await mapping({ source: { id: "src-1", idColumn: 2, idHeading: "Record ID", identityColumnIds: [] } });
    expect(screen.queryByLabelText("Recognise rows by")).toBeNull();
    expect(document.body.textContent).toContain("recognised by the column “Record ID”");
    fireEvent.click(radio("None (import every row)"));
    click(/^Import 45 rows$/);
    await waitFor(() => expect(imports.confirm.mock.calls[0]![2]).toMatchObject({ idColumn: 2 }));
  });

  it.each([
    ["its ID column is gone", { id: "s", idColumn: null, idHeading: "Old ID", identityColumnIds: [] }, "no longer has the column “Old ID”"],
    ["an identifying column isn't filled", { id: "s", idColumn: null, idHeading: null, identityColumnIds: ["c-1", "c-9"] }, "keep all of those mapped"],
  ])("blocks confirming a known tab when %s", async (_why, known, words) => {
    await mapping({ source: known });
    fireEvent.click(radio("None (import every row)"));
    expect(document.body.textContent).toContain(words);
    expect(button(/^Import 45 rows$/).disabled).toBe(true);
  });

  it("shows why a confirmation was refused", async () => {
    imports.confirm.mockRejectedValue(refusal("SHEET_IDENTITY_CHANGED", "Rows of this tab are recognised by their contents."));
    await mapping();
    fireEvent.click(radio("None (import every row)"));
    click(/^Import 45 rows$/);
    expect(await screen.findByText(/recognised by their contents\./)).toBeTruthy();
  });
});

describe("Pull new rows", () => {
  it("lists nothing when the workbook pulls from no sheet", async () => {
    show();
    await waitFor(() => expect(sheets.sources).toHaveBeenCalledWith("wb-1"));
    expect(screen.queryByText("Google Sheets in this workbook")).toBeNull();
  });

  it("pulls when asked, and says what was added and what was already there", async () => {
    sheets.sources.mockResolvedValue([source({ idColumn: "Email" })]);
    sheets.pull.mockResolvedValue({ data: pulledItem(), alreadyRunning: false });
    imports.get.mockResolvedValue(pulledItem());
    show();
    expect(await screen.findByText("Pipeline · Leads")).toBeTruthy();
    expect(document.body.textContent).toContain("recognised by “Email”");
    expect(document.body.textContent).toContain("Rows are added only when you pull");
    expect(sheets.pull).not.toHaveBeenCalled();
    click("Pull new rows from Pipeline · Leads");
    await screen.findByText("2 rows were added to the workbook.");
    expect(screen.getByText("Already imported").nextElementSibling!.textContent).toBe("8");
    expect(screen.getByText("Added").nextElementSibling!.textContent).toBe("2");
    expect(sheets.pull.mock.calls[0]!.slice(0, 2)).toEqual(["wb-1", "src-1"]);
  });

  it("says when there was nothing new", async () => {
    sheets.sources.mockResolvedValue([source()]);
    const nothing = pulledItem({ imported: 0, alreadyImported: 10 });
    sheets.pull.mockResolvedValue({ data: nothing, alreadyRunning: false });
    imports.get.mockResolvedValue(nothing);
    show();
    fireEvent.click(await screen.findByRole("button", { name: /^Pull new rows from/ }));
    expect(await screen.findByText(/No new rows: everything in the tab has already been added\./)).toBeTruthy();
  });

  it("warns when nothing was added because rows were skipped", async () => {
    sheets.sources.mockResolvedValue([source()]);
    const skipped = pulledItem({ imported: 0, alreadyImported: 8, duplicates: 2 });
    sheets.pull.mockResolvedValue({ data: skipped, alreadyRunning: false });
    imports.get.mockResolvedValue(skipped);
    show();
    fireEvent.click(await screen.findByRole("button", { name: /^Pull new rows from/ }));
    expect(await screen.findByText("No rows were added to the workbook.")).toBeTruthy();
  });

  it("reuses the key after a lost answer only", async () => {
    sheets.sources.mockResolvedValue([source()]);
    sheets.pull.mockRejectedValueOnce(new ApiError("Bad gateway", 502, {})).mockRejectedValueOnce(refusal("SHEETS_NO_ACCESS", "No access", 422)).mockResolvedValue({ data: pulledItem(), alreadyRunning: false });
    show();
    for (let i = 1; i <= 3; i += 1) {
      await waitFor(() => expect(button(/^Pull new rows from/).disabled).toBe(false));
      click(/^Pull new rows from/);
      await waitFor(() => expect(sheets.pull).toHaveBeenCalledTimes(i));
    }
    const keys = sheets.pull.mock.calls.map((c) => c[2]);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it("explains a refused pull, with the way to reconnect", async () => {
    sheets.sources.mockResolvedValue([source()]);
    sheets.pull.mockRejectedValue(refusal("SHEETS_NOT_CONNECTED", "Google Sheets isn't connected."));
    show();
    fireEvent.click(await screen.findByRole("button", { name: /^Pull new rows from/ }));
    expect(await screen.findByText("Google Sheets isn't connected.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Settings → Google Sheets" }).getAttribute("href")).toBe("/settings/google-sheets");
  });

  it("offers no second pull while a tab is being read", async () => {
    sheets.sources.mockResolvedValue([source({ runningImportId: "imp-9", lastPulledAt: null })]);
    show();
    expect(await screen.findByText("Being read now…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Pull new rows from/ })).toBeNull();
  });

  it("stops pulling from a tab only after asking", async () => {
    sheets.sources.mockResolvedValueOnce([source()]).mockResolvedValue([]);
    sheets.forget.mockResolvedValue({ data: { id: "src-1" } });
    show();
    fireEvent.click(await screen.findByRole("button", { name: /^Stop pulling from/ }));
    expect(document.body.textContent).toContain("can be added a second time");
    expect(sheets.forget).not.toHaveBeenCalled();
    click("Keep it");
    click(/^Stop pulling from/);
    click("Yes, stop");
    await waitFor(() => expect(screen.queryByText("Google Sheets in this workbook")).toBeNull());
    expect(sheets.forget).toHaveBeenCalledWith("wb-1", "src-1");
  });
});

describe("the Google Sheets connection in Settings", () => {
  const withClient = (node: React.ReactNode, features: Record<string, boolean> = { workbooks_v2: true }, strict = false) => {
    const query = client();
    query.setQueryData(ACCESS_QUERY_KEY, { status: "active", features });
    const tree = <QueryClientProvider client={query}>{node}</QueryClientProvider>;
    return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  };

  it("shows a connection and disconnects only after asking", async () => {
    google.disconnect.mockImplementation(async () => {
      google.status.mockResolvedValue({ configured: true, status: "not_connected", connectedAt: null });
      return { disconnected: true, revokedAtGoogle: true };
    });
    withClient(<GoogleSheetsCard />);
    expect(await screen.findByText("Connected")).toBeTruthy();
    expect(document.body.textContent).toContain("never to change them");
    click("Disconnect");
    expect(google.disconnect).not.toHaveBeenCalled();
    click("Yes, disconnect");
    expect(await screen.findByText(/access was withdrawn at Google\. Rows already imported are unchanged\./)).toBeTruthy();
    expect(await screen.findByText("Not connected")).toBeTruthy();
    expect(button("Connect Google Sheets")).toBeTruthy();
  });

  it("says when Google didn't confirm the withdrawal", async () => {
    google.disconnect.mockResolvedValue({ disconnected: true, revokedAtGoogle: false });
    withClient(<GoogleSheetsCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
    click("Yes, disconnect");
    expect(await screen.findByText(/remove Skout under Third-party access/)).toBeTruthy();
  });

  it("offers reconnecting and disconnecting when access expired", async () => {
    google.status.mockResolvedValue({ configured: true, status: "needs_reauth", connectedAt: null });
    withClient(<GoogleSheetsCard />);
    expect(await screen.findByRole("button", { name: "Reconnect Google Sheets" })).toBeTruthy();
    expect(button("Disconnect")).toBeTruthy();
  });

  it("is hidden without Workbooks V2, unless there is a connection to remove", async () => {
    google.status.mockResolvedValue({ configured: true, status: "not_connected", connectedAt: null });
    withClient(<GoogleSheetsCard />, {});
    await waitFor(() => expect(google.status).toHaveBeenCalled());
    expect(screen.queryByText("Google Sheets")).toBeNull();
    cleanup();
    google.status.mockResolvedValue(connected);
    withClient(<GoogleSheetsCard />, {});
    expect(await screen.findByRole("button", { name: "Disconnect" })).toBeTruthy();
  });

  it("finishes a sign-in once, takes the code out of the address, and says it worked", async () => {
    search.value = "code=abc&state=xyz";
    const replace = vi.spyOn(window.history, "replaceState");
    google.complete.mockResolvedValue(connected);
    withClient(<GoogleSheetsSettingsPage />, { workbooks_v2: true }, true);
    expect(await screen.findByText(/Google Sheets is connected\./)).toBeTruthy();
    expect(google.complete).toHaveBeenCalledTimes(1);
    expect(google.complete).toHaveBeenCalledWith("abc", "xyz");
    expect(replace).toHaveBeenCalledWith(window.history.state, "", window.location.pathname);
    replace.mockRestore();
  });

  it("explains a sign-in the person cancelled, and sends nothing", async () => {
    search.value = "error=access_denied&state=xyz";
    withClient(<GoogleSheetsSettingsPage />);
    expect(await screen.findByText(/cancelled or refused/)).toBeTruthy();
    expect(google.complete).not.toHaveBeenCalled();
  });

  it("shows why a sign-in couldn't be finished", async () => {
    search.value = "code=abc&state=old";
    google.complete.mockRejectedValue(refusal("invalid_oauth_state", "This sign-in link expired or was already used.", 400));
    withClient(<GoogleSheetsSettingsPage />);
    expect(await screen.findByText(/expired or was already used/)).toBeTruthy();
  });

  it("sends nothing when opened without a sign-in", async () => {
    withClient(<GoogleSheetsSettingsPage />);
    await screen.findByText("Connected");
    expect(google.complete).not.toHaveBeenCalled();
  });
});

describe("Google Sheets helpers", () => {
  it("suggest an ID only for a column that looks like one and never repeats", () => {
    expect(suggestedIdColumn(preview())).toBe(1);
    expect(suggestedIdColumn(preview({ unique: [true, false, false] }))).toBeNull();
    expect(suggestedIdColumn(preview({ unique: [false, false, true] }))).toBe(2);
    expect(suggestedIdColumn({ ...preview(), sheet: undefined })).toBeNull();
    expect(identityProblem(preview(), [])).toBeNull();
  });

  it("name where a row came from", () => {
    expect(sourceLabel({ type: "google_sheets", spreadsheetName: "Pipeline", tabName: "Leads" })).toBe("Google Sheets: Pipeline · Leads");
    expect(sourceLabel({ type: "google_sheets" })).toBe("Google Sheets");
  });
});
