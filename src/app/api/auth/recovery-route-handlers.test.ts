// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as verifyEmail } from "./verify-email/route";
import { POST as otpVerify } from "./otp-verify/route";
import { CSRF_COOKIE, REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/auth/bff";

const APP = "http://localhost:3000";
const API = "http://api.test";

type FetchCall = { url: string; init: RequestInit };
let calls: FetchCall[];
let nextResponse: () => Response;

function apiResponse(status: number, body: unknown, setCookies: string[] = []): Response {
  const headers = new Headers({ "content-type": "application/json" });
  for (const c of setCookies) headers.append("set-cookie", c);
  return new Response(body === null ? null : JSON.stringify(body), { status, headers });
}

function req(
  path: string,
  opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): NextRequest {
  const headers = new Headers({ origin: APP, "sec-fetch-site": "same-origin", ...opts.headers });
  if (opts.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
  return new NextRequest(`${APP}/app/api/auth/${path}`, {
    method: opts.method ?? "POST",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

function cookie(res: Response, name: string) {
  const raw = res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  if (!raw) return undefined;
  const [pair] = raw.split(";").map((s) => s.trim());
  return pair!.slice(name.length + 1);
}

const SESSION_OK = () =>
  apiResponse(200, { data: { accessToken: "access-1", expiresIn: 600 } }, [
    "skout_refresh=rt-1; Path=/api/v1/auth; HttpOnly; SameSite=Lax",
    "skout_csrf=api-csrf; Path=/api/v1/auth; SameSite=Lax",
  ]);

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "custom");
  vi.stubEnv("AUTH_API_URL", API);
  calls = [];
  nextResponse = SESSION_OK;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return nextResponse();
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("flag off (NEXT_PUBLIC_AUTH_MODE != custom)", () => {
  it("both routes 404 and never call the API", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "clerk");
    expect((await verifyEmail(req("verify-email", { body: { token: "t" } }))).status).toBe(404);
    expect((await otpVerify(req("otp-verify", { body: { email: "a@b.c", code: "123456" } }))).status).toBe(404);
    expect(calls).toHaveLength(0);
  });
});

describe("verify-email", () => {
  it("forwards the token and establishes a session via the BFF cookies", async () => {
    const res = await verifyEmail(req("verify-email", { body: { token: "verify-tok" } }));
    expect(res.status).toBe(200);
    expect(calls[0]!.url).toBe(`${API}/api/v1/auth/verify-email/confirm`);
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ token: "verify-tok" });

    const body = await res.json();
    expect(body.data.accessToken).toBe("access-1");
    expect(cookie(res, REFRESH_COOKIE)).toBe("rt-1");
    expect(cookie(res, SESSION_COOKIE)).toBe("access-1");
    expect(cookie(res, CSRF_COOKIE)).toBe(body.data.csrfToken);
    expect(JSON.stringify(body)).not.toContain("rt-1");
  });

  it("rejects a missing token without calling the API", async () => {
    const res = await verifyEmail(req("verify-email", { body: {} }));
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("passes API errors through unchanged and sets no cookies", async () => {
    nextResponse = () => apiResponse(401, { error: "Invalid or expired token", statusCode: 401, code: "AUTH_TOKEN_INVALID" });
    const res = await verifyEmail(req("verify-email", { body: { token: "bad" } }));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("AUTH_TOKEN_INVALID");
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it("refuses cross-site requests without calling the API", async () => {
    const res = await verifyEmail(
      req("verify-email", { body: { token: "t" }, headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" } })
    );
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
});

describe("otp-verify", () => {
  it("forwards email+code and establishes a session via the BFF cookies", async () => {
    const res = await otpVerify(req("otp-verify", { body: { email: "a@b.c", code: "123456" } }));
    expect(res.status).toBe(200);
    expect(calls[0]!.url).toBe(`${API}/api/v1/auth/otp/verify`);
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ email: "a@b.c", code: "123456" });

    const body = await res.json();
    expect(cookie(res, REFRESH_COOKIE)).toBe("rt-1");
    expect(cookie(res, SESSION_COOKIE)).toBe("access-1");
  });

  it("rejects a missing code without calling the API", async () => {
    const res = await otpVerify(req("otp-verify", { body: { email: "a@b.c" } }));
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("passes API errors through unchanged", async () => {
    nextResponse = () => apiResponse(401, { error: "Invalid or expired code", statusCode: 401, code: "AUTH_TOKEN_INVALID" });
    const res = await otpVerify(req("otp-verify", { body: { email: "a@b.c", code: "000000" } }));
    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });
});
