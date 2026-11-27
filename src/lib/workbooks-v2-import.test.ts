// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./api-client";
import { IMPORT_MAX_BYTES, checkMapping, confirmBody, fileProblem, useWorkbookImportApi, type CsvHeader, type WorkbookColumn } from "./workbooks-v2-import";

const respond = () => vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ data: {} }), { status: 200 }));

describe("what the browser sends", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the file itself as CSV with its name in a header", async () => {
    const fetched = respond();
    vi.stubGlobal("fetch", fetched);
    const { result } = renderHook(() => useWorkbookImportApi());
    const file = new File(["a\n1\n"], "Q4 leads (é).csv", { type: "application/vnd.ms-excel" });
    await result.current.upload("wb-1", file);
    const [url, init] = fetched.mock.calls[0]!;
    expect(url).toContain("/api/v1/workbooks-v2/wb-1/imports");
    expect(url).not.toContain("leads");
    expect(init!.method).toBe("POST");
    expect(init!.body).toBe(file);
    const headers = init!.headers as Headers;
    expect(headers.get("Content-Type")).toBe("text/csv");
    expect(headers.get("X-File-Name")).toBe("Q4%20leads%20(%C3%A9).csv");
  });

  it("still sends JSON requests as JSON", async () => {
    const fetched = respond();
    vi.stubGlobal("fetch", fetched);
    await apiFetch("/x", { method: "POST", body: JSON.stringify({ a: 1 }) });
    expect((fetched.mock.calls[0]![1]!.headers as Headers).get("Content-Type")).toBe("application/json");
  });
});

describe("checking a file before upload", () => {
  it("allows exactly 50 MB and any letter case of .csv", () => {
    expect(fileProblem({ name: "A.CSV", size: IMPORT_MAX_BYTES })).toBeNull();
    expect(fileProblem({ name: "a.csv", size: IMPORT_MAX_BYTES + 1 })).toMatch(/50 MB/);
    expect(fileProblem({ name: "a.csv.exe", size: 1 })).toMatch(/Only CSV/);
  });
});

describe("the deduplication column", () => {
  const headers: CsvHeader[] = [
    { index: 0, name: "Work", fits: ["text", "email"], filled: 1 },
    { index: 1, name: "Home", fits: ["text", "email"], filled: 1 },
  ];
  const columns: WorkbookColumn[] = [
    { id: "w", name: "Work", type: "input", config: { dataType: "email" } },
    { id: "h", name: "Home", type: "input", config: { dataType: "email" } },
  ];
  const choices = [
    { kind: "existing", columnId: "w" },
    { kind: "existing", columnId: "h" },
  ] as const;

  it("must be chosen when two columns could be it", () => {
    const open = checkMapping(headers, [...choices], columns, { key: "email" });
    expect(open).toMatchObject({ keyHeader: null, keyHeaders: [0, 1], blocker: "Choose which column holds the Email." });
    const chosen = checkMapping(headers, [...choices], columns, { key: "email", header: 1 });
    expect(chosen).toMatchObject({ keyHeader: 1, blocker: null });
    expect(confirmBody([...choices], { key: "email", header: 1 }, chosen.keyHeader)).toEqual({
      columns: [
        { header: 0, columnId: "w" },
        { header: 1, columnId: "h" },
      ],
      dedupe: { key: "email", header: 1 },
    });
  });

  it("needs at least one imported column and a name for each new one", () => {
    expect(checkMapping(headers, [{ kind: "skip" }, { kind: "skip" }], columns, { key: "none" }).blocker).toBe("Choose at least one column to import.");
    const blank = checkMapping(headers, [{ kind: "new", name: " ", dataType: "text" }, { kind: "skip" }], columns, { key: "none" });
    expect(blank.columnErrors[0]).toBe("Name the new column.");
    expect(blank.blocker).not.toBeNull();
  });
});
