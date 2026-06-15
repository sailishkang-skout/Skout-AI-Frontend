import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./api-client";

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

describe("apiFetch", () => {
  it("sends Content-Type: application/json", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, {}));
    await apiFetch("/api/v1/test");
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
  });

  it("builds the URL from NEXT_PUBLIC_API_URL + path", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, {}));
    await apiFetch("/api/v1/test");
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/test$/);
  });

  it("sets Authorization: Bearer when authToken provided", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, {}));
    await apiFetch("/api/v1/test", { authToken: "tok_abc" });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok_abc");
  });

  it("does not set Authorization when authToken omitted", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, {}));
    await apiFetch("/api/v1/test");
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBeNull();
  });

  it("sets X-Workspace-Id when workspaceId provided", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, {}));
    await apiFetch("/api/v1/test", { workspaceId: "ws-123" });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("X-Workspace-Id")).toBe("ws-123");
  });

  it("returns parsed JSON on 200", async () => {
    const payload = { data: { id: "1", name: "Acme" } };
    mockFetch.mockResolvedValue(makeResponse(200, payload));
    const result = await apiFetch<typeof payload>("/api/v1/test");
    expect(result).toEqual(payload);
  });

  it("returns undefined on 204 without calling json()", async () => {
    const jsonSpy = vi.fn().mockRejectedValue(new Error("no body"));
    mockFetch.mockResolvedValue({ ok: true, status: 204, json: jsonSpy } as unknown as Response);
    const result = await apiFetch<undefined>("/api/v1/test");
    expect(result).toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it("throws ApiError on 401", async () => {
    mockFetch.mockResolvedValue(makeResponse(401, { error: "Unauthorized" }, false));
    await expect(apiFetch("/api/v1/test")).rejects.toBeInstanceOf(ApiError);
  });

  it("throws ApiError on 403", async () => {
    mockFetch.mockResolvedValue(makeResponse(403, { error: "Forbidden" }, false));
    await expect(apiFetch("/api/v1/test")).rejects.toBeInstanceOf(ApiError);
  });

  it("includes the HTTP status code in the thrown ApiError", async () => {
    mockFetch.mockResolvedValue(makeResponse(404, { error: "Not Found" }, false));
    const err = (await apiFetch("/api/v1/test").catch((e) => e)) as ApiError;
    expect(err.status).toBe(404);
  });

  it("includes the response body in the thrown ApiError", async () => {
    const body = { error: "Forbidden", detail: "no access" };
    mockFetch.mockResolvedValue(makeResponse(403, body, false));
    const err = (await apiFetch("/api/v1/test").catch((e) => e)) as ApiError;
    expect(err.body).toEqual(body);
  });

  it("sets body on ApiError to undefined when JSON parse fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new SyntaxError("bad json")),
    } as unknown as Response);
    const err = (await apiFetch("/api/v1/test").catch((e) => e)) as ApiError;
    expect(err.status).toBe(500);
    expect(err.body).toBeUndefined();
  });

  it("forwards method and body to fetch", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, {}));
    await apiFetch("/api/v1/test", { method: "POST", body: JSON.stringify({ x: 1 }) });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ x: 1 }));
  });
});

describe("ApiError", () => {
  it("is an instance of Error", () => {
    const err = new ApiError("not found", 404);
    expect(err).toBeInstanceOf(Error);
  });

  it("has name ApiError", () => {
    expect(new ApiError("x", 400).name).toBe("ApiError");
  });

  it("stores message and status", () => {
    const err = new ApiError("oops", 500);
    expect(err.message).toBe("oops");
    expect(err.status).toBe(500);
  });

  it("stores optional body", () => {
    const err = new ApiError("oops", 400, { field: "email" });
    expect(err.body).toEqual({ field: "email" });
  });

  it("body is undefined when not provided", () => {
    expect(new ApiError("oops", 400).body).toBeUndefined();
  });
});
