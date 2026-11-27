import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import type { WorkbookColumn } from "@/lib/workbooks-v2-import";
import { exampleRequest, keyColumns, lastResultText, type WorkbookWebhook } from "@/lib/workbooks-v2-webhook";
import { WebhookCard } from "./webhook-card";

const api = vi.fn();
vi.mock("@/lib/api-client", async (original) => ({ ...(await original<typeof import("@/lib/api-client")>()), useApiFetch: () => api, useAuthReady: () => true }));

const TOKEN = "skwh_first-token-value";
const NEXT = "skwh_second-token-value";
const URL_ = "https://api.example.test/api/v1/webhooks/workbooks/h1";
const COLUMNS: WorkbookColumn[] = [
  { id: "name", name: "Name", type: "input", config: { dataType: "text" } },
  { id: "mail", name: "Work email", type: "input", config: { dataType: "email" } },
  { id: "size", name: "Employees", type: "input", config: { dataType: "number" } },
  { id: "site", name: "Website", type: "input", config: { dataType: "url" } },
  { id: "found", name: "Found", type: "enrichment", config: {} },
];
const HOOK: WorkbookWebhook = { id: "h1", url: URL_, enabled: true, dedupe: { key: "none" }, createdAt: "2026-11-01T10:00:00Z", tokenCreatedAt: "2026-11-01T10:00:00Z", lastUsedAt: null, lastResult: null };

let hook: WorkbookWebhook | null;
let columns: WorkbookColumn[];
let client: QueryClient;
let fail: Partial<Record<"get" | "create" | "regenerate" | "update", ApiError>>;
const sent = () => api.mock.calls.filter(([, init]) => init?.method).map(([path, init]) => [init.method, String(path).replace("/api/v1/workbooks-v2/w1", ""), JSON.parse(init.body)]);

beforeEach(() => {
  hook = { ...HOOK };
  columns = COLUMNS;
  fail = {};
  api.mockReset();
  api.mockImplementation(async (path: string, init?: { method?: string; body?: string }) => {
    if (path === "/api/v1/workbooks-v2/w1") return { data: { columns } };
    const action = !init?.method ? "get" : path.endsWith("/regenerate") ? "regenerate" : init.method === "POST" ? "create" : "update";
    if (fail[action]) throw fail[action];
    if (action === "get") return { data: hook };
    if (action === "update") {
      hook = { ...hook!, ...JSON.parse(init!.body!) };
      return { data: hook };
    }
    hook = action === "create" ? { ...HOOK } : { ...hook!, tokenCreatedAt: "2026-11-02T10:00:00Z" };
    return { data: { webhook: hook, token: action === "create" ? TOKEN : NEXT } };
  });
});
afterEach(() => cleanup());

function show(canEdit = true) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WebhookCard workbook={{ id: "w1", name: "Leads" }} canEdit={canEdit} />
    </QueryClientProvider>
  );
}
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const press = (name: string | RegExp) => fireEvent.click(button(name));
const shownToken = () => (screen.queryByLabelText("Webhook token") as HTMLInputElement | null)?.value ?? null;
const cached = () => JSON.stringify([client.getQueryCache().getAll().map((q) => q.state.data), client.getMutationCache().getAll().map((m) => m.state.data)]);

describe("webhook card", () => {
  it("creates a webhook and shows its token once, keeping it nowhere after it is dismissed", async () => {
    hook = null;
    const stored = vi.spyOn(Storage.prototype, "setItem");
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Create webhook" }));
    await screen.findByLabelText("Webhook token");
    expect(shownToken()).toBe(TOKEN);
    expect(screen.getByText("Copy this token now. It is shown only once.")).toBeTruthy();
    expect((await screen.findByLabelText("Webhook URL") as HTMLInputElement).value).toBe(URL_);
    expect(sent()).toEqual([["POST", "/webhook", {}]]);
    expect(document.querySelector("pre")!.textContent).not.toContain(TOKEN);

    press("I’ve saved it");
    await waitFor(() => expect(shownToken()).toBeNull());
    await waitFor(() => expect(cached()).not.toContain(TOKEN));
    expect(document.body.innerHTML).not.toContain(TOKEN);
    expect(JSON.stringify(stored.mock.calls)).not.toContain(TOKEN);
    expect(screen.queryByRole("button", { name: "Create webhook" })).toBeNull();
    stored.mockRestore();
  });

  it("forgets a token that is still on screen when the card goes away", async () => {
    hook = null;
    const view = show();
    fireEvent.click(await screen.findByRole("button", { name: "Create webhook" }));
    await screen.findByLabelText("Webhook token");
    view.unmount();
    await waitFor(() => expect(cached()).not.toContain(TOKEN));
  });

  it("copies the token and the address, and says when copying fails", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    hook = null;
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Create webhook" }));
    fireEvent.click(await screen.findByRole("button", { name: "Copy webhook token" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(TOKEN));
    press("Copy webhook url");
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(URL_));
    writeText.mockRejectedValue(new Error("denied"));
    press("Copy webhook token");
    expect(await screen.findByText(/couldn’t be copied/)).toBeTruthy();
    expect(shownToken()).toBe(TOKEN);
  });

  it("shows status, last use and what the last request did", async () => {
    hook = { ...HOOK, lastUsedAt: "2026-11-03T12:00:00Z", lastResult: { at: "2026-11-03T12:00:00Z", received: 1200, inserted: 1000, duplicates: 150, skipped: 20, rejected: 30 } };
    show();
    expect(await screen.findByText("Enabled")).toBeTruthy();
    expect(screen.getByText(/1,200 received: 1,000 added, 150 duplicate, 20 empty, 30 rejected\./)).toBeTruthy();
    expect(screen.queryByText("Never")).toBeNull();
    expect(screen.queryByLabelText("Webhook token")).toBeNull();
  });

  it("says a webhook has never been used", async () => {
    show();
    expect(await screen.findByText("Never")).toBeTruthy();
    expect(screen.queryByText("Last request")).toBeNull();
  });

  it("regenerates only after the person confirms", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Regenerate token" }));
    expect(screen.getByRole("dialog").textContent).toContain("stops working at once");
    press("Cancel");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(sent()).toEqual([]);

    press("Regenerate token");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Regenerate token" }));
    await waitFor(() => expect(shownToken()).toBe(NEXT));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(sent()).toEqual([["POST", "/webhook/regenerate", {}]]);
  });

  it("disables only after the person confirms, and enables at once", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Disable" }));
    expect(screen.getByRole("dialog").textContent).toContain("may stop working");
    press("Cancel");
    expect(sent()).toEqual([]);

    press("Disable");
    press("Disable webhook");
    expect(await screen.findByText("Disabled")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    press("Enable");
    expect(await screen.findByText("Enabled")).toBeTruthy();
    expect(sent()).toEqual([
      ["PATCH", "/webhook", { enabled: false }],
      ["PATCH", "/webhook", { enabled: true }],
    ]);
  });

  it("keeps a new token on screen through other changes", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Regenerate token" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Regenerate token" }));
    await waitFor(() => expect(shownToken()).toBe(NEXT));
    press("Disable");
    press("Disable webhook");
    expect(await screen.findByText("Disabled")).toBeTruthy();
    expect(shownToken()).toBe(NEXT);
  });

  it("saves a duplicate check on a column that can hold the key", async () => {
    show();
    const by = await screen.findByLabelText("Check duplicates by");
    expect((button("Save") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(by, { target: { value: "email" } });
    const column = screen.getByLabelText("Column to check") as HTMLSelectElement;
    expect(Array.from(column.options, (o) => o.text)).toEqual(["Name", "Work email"]);
    fireEvent.change(column, { target: { value: "mail" } });
    press("Save");
    await waitFor(() => expect(sent()).toEqual([["PATCH", "/webhook", { dedupe: { key: "email", columnId: "mail" } }]]));
    await waitFor(() => expect((button("Save") as HTMLButtonElement).disabled).toBe(true));
    expect((screen.getByLabelText("Column to check") as HTMLSelectElement).value).toBe("mail");

    fireEvent.change(screen.getByLabelText("Check duplicates by"), { target: { value: "none" } });
    expect(screen.queryByLabelText("Column to check")).toBeNull();
    press("Save");
    await waitFor(() => expect(sent().at(-1)).toEqual(["PATCH", "/webhook", { dedupe: { key: "none" } }]));
  });

  it("warns when the column it checks is gone, and doesn't save without a column", async () => {
    hook = { ...HOOK, dedupe: { key: "email", columnId: "deleted" } };
    show();
    expect(await screen.findByText(/missing or has changed\. Requests are refused/)).toBeTruthy();
    expect((screen.getByLabelText("Column to check") as HTMLSelectElement).value).toBe("");
    expect((button("Save") as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers no duplicate check the workbook has no column for", async () => {
    columns = [COLUMNS[2]!];
    show();
    fireEvent.change(await screen.findByLabelText("Check duplicates by"), { target: { value: "email" } });
    expect(screen.getByText(/No column in this workbook can hold that/)).toBeTruthy();
    expect((button("Save") as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows a viewer the status and nothing to change it with", async () => {
    show(false);
    expect(await screen.findByText("Enabled")).toBeTruthy();
    for (const name of ["Regenerate token", "Disable", "Enable", "Save", "Create webhook"]) expect(screen.queryByRole("button", { name })).toBeNull();
    expect(screen.queryByLabelText("Check duplicates by")).toBeNull();
  });

  it("explains how to send rows with the workbook's own column names", async () => {
    show();
    await screen.findByText("Enabled");
    await waitFor(() => expect(document.querySelector("pre")!.textContent).toContain("Work email"));
    const example = document.querySelector("pre")!.textContent!;
    expect(example).toContain(`curl -X POST '${URL_}'`);
    expect(example).toContain("Authorization: Bearer YOUR_TOKEN");
    expect(example).not.toContain("Found");
  });

  it("reads again when asked, along with the rows", async () => {
    show();
    await screen.findByText("Never");
    const invalidate = vi.spyOn(client, "invalidateQueries");
    hook = { ...HOOK, lastUsedAt: "2026-11-03T12:00:00Z" };
    press("Refresh");
    await waitFor(() => expect(screen.queryByText("Never")).toBeNull());
    expect(invalidate.mock.calls.map(([f]) => f!.queryKey)).toEqual(expect.arrayContaining([["workbooks-v2", "w1", "rows"], ["workbooks-v2"]]));
  });

  it("offers to try again when it can't be loaded", async () => {
    fail.get = new ApiError("x", 500, { message: "The database is unavailable." });
    show();
    expect(await screen.findByText("The database is unavailable.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create webhook" })).toBeNull();
    fail = {};
    press(/retry|try again/i);
    expect(await screen.findByText("Enabled")).toBeTruthy();
  });

  it("shows why a change was refused, and what is really saved", async () => {
    hook = null;
    fail.create = new ApiError("x", 409, { message: "This workbook already has a webhook. Regenerate its token to get a new one." });
    show();
    const create = await screen.findByRole("button", { name: "Create webhook" });
    hook = { ...HOOK };
    fireEvent.click(create);
    expect(await screen.findByText(/already has a webhook/)).toBeTruthy();
    // Someone else made it: the card shows it, with no token.
    expect(await screen.findByText("Enabled")).toBeTruthy();
    expect(shownToken()).toBeNull();
    fail = { update: new ApiError("x", 403, { message: "You can't edit this workbook." }) };
    press("Disable");
    press("Disable webhook");
    expect(await screen.findByText("You can't edit this workbook.")).toBeTruthy();
    expect(screen.queryByText(/already has a webhook/)).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Enabled")).toBeTruthy();
    // Doing something else clears it.
    press("Regenerate token");
    expect(screen.queryByText("You can't edit this workbook.")).toBeNull();
  });
});

describe("webhook helpers", () => {
  it("describes the last request", () => {
    expect(lastResultText({ at: "", received: 2, inserted: 2, duplicates: 0, skipped: 0, rejected: 0 })).toBe("2 received: 2 added.");
    expect(lastResultText({ at: "", refused: "TOO_MANY_ROWS" })).toBe("refused because it had more than 1,000 rows.");
    expect(lastResultText({ at: "", refused: "SOMETHING_NEW" })).toBe("refused because it couldn’t be accepted.");
  });

  it("offers only input columns of a type that can hold the key", () => {
    expect(keyColumns(COLUMNS, "none")).toEqual([]);
    expect(keyColumns(COLUMNS, "domain").map((c) => c.id)).toEqual(["name", "site"]);
  });

  it("quotes the example so that column names can't break out of it", () => {
    const example = exampleRequest(URL_, [{ id: "a", name: "Owner's name", type: "input", config: {} }]);
    expect(example).toContain(`--data '[{"Owner'\\''s name":"Example"}]'`);
    expect(exampleRequest(URL_, [])).toContain(`[{"Column name":"Value"}]`);
  });
});
