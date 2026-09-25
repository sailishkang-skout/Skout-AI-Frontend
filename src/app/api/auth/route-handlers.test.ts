// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as login } from "./login/route";
import { POST as refresh } from "./refresh/route";
import { POST as logout } from "./logout/route";
import { GET as session } from "./session/route";
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
  opts: { method?: string; body?: unknown; cookies?: Record<string, string>; headers?: Record<string, string> } = {}
): NextRequest {
  const headers = new Headers({ origin: APP, "sec-fetch-site": "same-origin", ...opts.headers });
  if (opts.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (opts.cookies) {
    headers.set("cookie", Object.entries(opts.cookies).map(([k, v]) => `${k}=${v}`).join("; "));
  }
  return new NextRequest(`${APP}/app/api/auth/${path}`, {
    method: opts.method ?? "POST",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

function cookie(res: Response, name: string) {
  const raw = res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  if (!raw) return undefined;
  const [pair, ...attrs] = raw.split(";").map((s) => s.trim());
  const lower = attrs.map((a) => a.toLowerCase());
  return {
    value: pair!.slice(name.length + 1),
    httpOnly: lower.includes("httponly"),
    secure: lower.includes("secure"),
    sameSite: lower.find((a) => a.startsWith("samesite="))?.split("=")[1],
    path: attrs.find((a) => a.toLowerCase().startsWith("path="))?.split("=")[1],
    maxAge: attrs.find((a) => a.toLowerCase().startsWith("max-age="))?.split("=")[1],
  };
}

const LOGIN_OK = () =>
  apiResponse(200, { data: { accessToken: "access-1", expiresIn: 600 } }, [
    "skout_refresh=rt-1; Path=/api/v1/auth; HttpOnly; SameSite=Lax",
    "skout_csrf=api-csrf; Path=/api/v1/auth; SameSite=Lax",
  ]);

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "custom");
  vi.stubEnv("AUTH_API_URL", API);
  calls = [];
  nextResponse = LOGIN_OK;
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
  it("every route 404s and never calls the API", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "clerk");
    expect((await login(req("login", { body: { email: "a@b.c", password: "x" } }))).status).toBe(404);
    expect((await refresh(req("refresh"))).status).toBe(404);
    expect((await logout(req("logout"))).status).toBe(404);
    expect((await session(req("session", { method: "GET" }))).status).toBe(404);
    expect(calls).toHaveLength(0);
  });
});

describe("login", () => {
  it("forwards credentials to the API and sets the three cookies with the right flags", async () => {
    const res = await login(
      req("login", {
        body: { email: "a@b.c", password: "pw" },
        headers: { "x-forwarded-for": "203.0.113.7", "user-agent": "ua-test" },
      })
    );
    expect(res.status).toBe(200);

    expect(calls[0]!.url).toBe(`${API}/api/v1/auth/login`);
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ email: "a@b.c", password: "pw" });
    const sent = calls[0]!.init.headers as Record<string, string>;
    expect(sent["x-forwarded-for"]).toBe("203.0.113.7");
    expect(sent["user-agent"]).toBe("ua-test");

    const body = await res.json();
    expect(body.data.accessToken).toBe("access-1");
    expect(body.data.expiresIn).toBe(600);
    expect(typeof body.data.csrfToken).toBe("string");
    expect(JSON.stringify(body)).not.toContain("rt-1"); // refresh token never reaches JS

    const rt = cookie(res, REFRESH_COOKIE)!;
    expect(rt).toMatchObject({ value: "rt-1", httpOnly: true, sameSite: "strict", path: "/app/api/auth" });
    const sess = cookie(res, SESSION_COOKIE)!;
    expect(sess).toMatchObject({ value: "access-1", httpOnly: true, sameSite: "lax", path: "/app", maxAge: "600" });
    const csrf = cookie(res, CSRF_COOKIE)!;
    expect(csrf).toMatchObject({ value: body.data.csrfToken, httpOnly: false, sameSite: "strict", path: "/app" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("marks every cookie Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await login(req("login", { body: { email: "a@b.c", password: "pw" } }));
    for (const name of [REFRESH_COOKIE, SESSION_COOKIE, CSRF_COOKIE]) {
      expect(cookie(res, name)!.secure).toBe(true);
    }
  });

  it("passes API auth errors through unchanged and sets no cookies", async () => {
    nextResponse = () =>
      apiResponse(401, { error: "Invalid email or password", statusCode: 401, code: "AUTH_INVALID_CREDENTIALS" });
    const res = await login(req("login", { body: { email: "a@b.c", password: "bad" } }));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("AUTH_INVALID_CREDENTIALS");
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it("refuses cross-site requests (login CSRF) without calling the API", async () => {
    const res = await login(
      req("login", {
        body: { email: "a@b.c", password: "pw" },
        headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
      })
    );
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("accepts the public origin behind the marketing proxy", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.skoutai.io/app");
    const res = await login(
      req("login", {
        body: { email: "a@b.c", password: "pw" },
        headers: { origin: "https://www.skoutai.io", "sec-fetch-site": "" },
      })
    );
    expect(res.status).toBe(200);
  });

  it("requires a JSON body", async () => {
    const res = await login(req("login", { body: "email=a", headers: { "content-type": "text/plain" } }));
    expect(res.status).toBe(415);
    expect(calls).toHaveLength(0);
  });

  it("returns 503 when no absolute API URL is configured", async () => {
    vi.stubEnv("AUTH_API_URL", "");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const res = await login(req("login", { body: { email: "a@b.c", password: "pw" } }));
    expect(res.status).toBe(503);
  });

  it("returns 502 when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    const res = await login(req("login", { body: { email: "a@b.c", password: "pw" } }));
    expect(res.status).toBe(502);
  });
});

describe("refresh", () => {
  const good = { cookies: { [REFRESH_COOKIE]: "rt-1", [CSRF_COOKIE]: "csrf-a" }, headers: { "x-csrf-token": "csrf-a" } };

  it("rotates the refresh token and returns a new access token", async () => {
    nextResponse = () =>
      apiResponse(200, { data: { accessToken: "access-2", expiresIn: 600 } }, [
        "skout_refresh=rt-2; Path=/api/v1/auth; HttpOnly",
      ]);
    const res = await refresh(req("refresh", good));
    expect(res.status).toBe(200);
    expect((await res.json()).data.accessToken).toBe("access-2");
    expect(cookie(res, REFRESH_COOKIE)!.value).toBe("rt-2");
    expect(cookie(res, SESSION_COOKIE)!.value).toBe("access-2");

    // The API gets its own refresh cookie plus a matching double-submit pair.
    const sent = calls[0]!.init.headers as Record<string, string>;
    expect(calls[0]!.url).toBe(`${API}/api/v1/auth/refresh`);
    expect(sent.cookie).toMatch(/^skout_refresh=rt-1; skout_csrf=([\w-]+)$/);
    expect(sent.cookie!.split("skout_csrf=")[1]).toBe(sent["x-csrf-token"]);
  });

  it("rejects a missing or mismatched CSRF token without calling the API", async () => {
    expect((await refresh(req("refresh", { cookies: good.cookies }))).status).toBe(403);
    expect((await refresh(req("refresh", { ...good, headers: { "x-csrf-token": "other" } }))).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("rejects a cross-site request even with a valid CSRF pair", async () => {
    const res = await refresh(
      req("refresh", { ...good, headers: { ...good.headers, origin: "https://evil.example", "sec-fetch-site": "cross-site" } })
    );
    expect(res.status).toBe(403);
  });

  it("returns 401 AUTH_MISSING_TOKEN when there is no refresh cookie", async () => {
    const res = await refresh(
      req("refresh", { cookies: { [CSRF_COOKIE]: "csrf-a" }, headers: { "x-csrf-token": "csrf-a" } })
    );
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("AUTH_MISSING_TOKEN");
    expect(calls).toHaveLength(0);
  });

  it("clears the app cookies when the API refuses the session", async () => {
    nextResponse = () => apiResponse(401, { error: "revoked", statusCode: 401, code: "AUTH_SESSION_REVOKED" });
    const res = await refresh(req("refresh", good));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("AUTH_SESSION_REVOKED");
    expect(cookie(res, REFRESH_COOKIE)).toMatchObject({ value: "", maxAge: "0" });
    expect(cookie(res, SESSION_COOKIE)).toMatchObject({ value: "", maxAge: "0" });
  });

  it("keeps the cookies on a transient API failure", async () => {
    nextResponse = () => apiResponse(503, { error: "Database unavailable", statusCode: 503 });
    const res = await refresh(req("refresh", good));
    expect(res.status).toBe(503);
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });
});

describe("logout", () => {
  it("revokes at the API and clears every app cookie", async () => {
    nextResponse = () => apiResponse(204, null);
    const res = await logout(
      req("logout", { cookies: { [REFRESH_COOKIE]: "rt-1", [CSRF_COOKIE]: "c" }, headers: { "x-csrf-token": "c" } })
    );
    expect(res.status).toBe(204);
    expect(calls[0]!.url).toBe(`${API}/api/v1/auth/logout`);
    for (const name of [REFRESH_COOKIE, SESSION_COOKIE, CSRF_COOKIE]) {
      expect(cookie(res, name)).toMatchObject({ value: "", maxAge: "0" });
    }
  });

  it("still clears cookies when the API call fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("down"))));
    const res = await logout(
      req("logout", { cookies: { [REFRESH_COOKIE]: "rt-1", [CSRF_COOKIE]: "c" }, headers: { "x-csrf-token": "c" } })
    );
    expect(res.status).toBe(204);
    expect(cookie(res, REFRESH_COOKIE)!.maxAge).toBe("0");
  });

  it("requires the CSRF token (no forced logout from another site)", async () => {
    const res = await logout(req("logout", { cookies: { [REFRESH_COOKIE]: "rt-1" } }));
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
});

describe("session", () => {
  it("returns the profile from /auth/me using the session cookie, never a token", async () => {
    nextResponse = () => apiResponse(200, { data: { userId: "u1", email: "a@b.c", workspaceId: "w1", role: "owner" } });
    const res = await session(req("session", { method: "GET", cookies: { [SESSION_COOKIE]: "access-1" } }));
    expect(res.status).toBe(200);
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe("Bearer access-1");
    const text = await res.text();
    expect(text).toContain("u1");
    expect(text).not.toContain("access-1");
  });

  it("returns 401 without calling the API when there is no session cookie", async () => {
    const res = await session(req("session", { method: "GET" }));
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });
});
