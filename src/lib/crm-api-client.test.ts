import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crmApiFetch, getCrmApiBase } from "./crm-api-client";
import { ApiError } from "./api-client";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function makeResponse(status: number, body: unknown, ok = status >= 200 && status < 300) {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: () => Promise.resolve(body),
  } as Response;
}

describe("getCrmApiBase", () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
  });

  it("returns the configured http URL when the page itself is http (local dev)", () => {
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, protocol: "http:" },
      writable: true,
    });
    expect(getCrmApiBase()).toBe("http://127.0.0.1:3002");
  });

  it("downgrades to relative/same-origin when the page is https but the configured URL is http (mixed content)", () => {
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, protocol: "https:" },
      writable: true,
    });
    expect(getCrmApiBase()).toBe("");
  });
});

describe("crmApiFetch", () => {
  it("does not set X-Workspace-Id (CRM service resolves workspace server-side)", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, {}));
    await crmApiFetch("/api/v1/companies");
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("X-Workspace-Id")).toBeNull();
  });

  it("sets Content-Type and empty JSON body on POST without a body", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, {}));
    await crmApiFetch("/api/v1/companies", { method: "POST" });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(init.body).toBe("{}");
  });

  it("sets Authorization: Bearer when authToken provided", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, {}));
    await crmApiFetch("/api/v1/companies", { authToken: "tok_abc" });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok_abc");
  });

  it("returns parsed JSON on 200", async () => {
    const payload = { data: [{ id: "1", name: "Acme" }], total: 1, workspaceId: "ws" };
    mockFetch.mockResolvedValue(makeResponse(200, payload));
    const result = await crmApiFetch<typeof payload>("/api/v1/companies");
    expect(result).toEqual(payload);
  });

  it("returns undefined on 204", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204, json: vi.fn() } as unknown as Response);
    const result = await crmApiFetch<undefined>("/api/v1/companies/1");
    expect(result).toBeUndefined();
  });

  it("throws ApiError with status on non-2xx", async () => {
    mockFetch.mockResolvedValue(makeResponse(404, { error: "company_not_found" }, false));
    const err = (await crmApiFetch("/api/v1/companies/1").catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
  });

  it("throws ApiError on 403 (forbidden — role-based delete guard)", async () => {
    mockFetch.mockResolvedValue(makeResponse(403, { error: "forbidden" }, false));
    await expect(crmApiFetch("/api/v1/companies/1", { method: "DELETE" })).rejects.toMatchObject({ status: 403 });
  });
});
