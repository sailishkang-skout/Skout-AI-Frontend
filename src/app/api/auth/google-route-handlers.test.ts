// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as googleStart } from "./google/start/route";
import { GET as googleCallback } from "./google/callback/route";
import { GOOGLE_ROUTE_PATH, GOOGLE_STATE_COOKIE, REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/auth/bff";

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

function req(path: string, opts: { method?: string; cookies?: Record<string, string> } = {}): NextRequest {
  const headers = new Headers({ origin: APP, "sec-fetch-site": "same-origin" });
  if (opts.cookies) {
    headers.set("cookie", Object.entries(opts.cookies).map(([k, v]) => `${k}=${v}`).join("; "));
  }
  return new NextRequest(`${APP}/app/api/auth/${path}`, { method: opts.method ?? "GET", headers });
}

function cookie(res: Response, name: string) {
  const raw = res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  if (!raw) return undefined;
  const [pair, ...attrs] = raw.split(";").map((s) => s.trim());
  const lower = attrs.map((a) => a.toLowerCase());
  return {
    value: pair!.slice(name.length + 1),
    httpOnly: lower.includes("httponly"),
    path: attrs.find((a) => a.toLowerCase().startsWith("path="))?.split("=")[1],
    maxAge: attrs.find((a) => a.toLowerCase().startsWith("max-age="))?.split("=")[1],
  };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "custom");
  vi.stubEnv("AUTH_API_URL", API);
  calls = [];
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
    expect((await googleStart(req("google/start"))).status).toBe(404);
    expect((await googleCallback(req("google/callback?code=c&state=s"))).status).toBe(404);
    expect(calls).toHaveLength(0);
  });
});

describe("google/start", () => {
  it("redirects to Google's authorization URL and sets the OAuth-state cookie", async () => {
    nextResponse = () =>
      apiResponse(200, { data: { authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?x=1" } }, [
        `${GOOGLE_STATE_COOKIE}=state-abc; Path=/api/v1/auth; HttpOnly; SameSite=Lax`,
      ]);
    const res = await googleStart(req("google/start"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://accounts.google.com/o/oauth2/v2/auth?x=1");
    expect(calls[0]!.url).toBe(`${API}/api/v1/auth/google/start`);

    const c = cookie(res, GOOGLE_STATE_COOKIE)!;
    expect(c.value).toBe("state-abc");
    expect(c.httpOnly).toBe(true);
    expect(c.path).toBe(GOOGLE_ROUTE_PATH);
  });

  it("forwards a next param to the API", async () => {
    nextResponse = () =>
      apiResponse(200, { data: { authorizationUrl: "https://accounts.google.com/x" } }, [`${GOOGLE_STATE_COOKIE}=s1`]);
    await googleStart(req("google/start?next=%2Fdashboard"));
    expect(calls[0]!.url).toBe(`${API}/api/v1/auth/google/start?next=%2Fdashboard`);
  });

  it("redirects to sign-in with a friendly error when the API refuses", async () => {
    nextResponse = () => apiResponse(503, { error: "Google sign-in is not configured", statusCode: 503 });
    const res = await googleStart(req("google/start"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/sign-in?error=");
  });
});

describe("google/callback", () => {
  const SESSION_OK = () =>
    apiResponse(200, {
      data: { accessToken: "access-1", expiresIn: 600, next: "/dashboard" },
    }, ["skout_refresh=rt-1; Path=/api/v1/auth; HttpOnly; SameSite=Lax", "skout_csrf=api-csrf; Path=/api/v1/auth"]);

  it("forwards code/state and the captured OAuth-state cookie, then redirects with session cookies set", async () => {
    nextResponse = SESSION_OK;
    const res = await googleCallback(
      req("google/callback?code=abc&state=xyz", { cookies: { [GOOGLE_STATE_COOKIE]: "state-abc" } })
    );

    expect(calls[0]!.url).toBe(`${API}/api/v1/auth/google/callback`);
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ code: "abc", state: "xyz" });
    expect((calls[0]!.init.headers as Record<string, string>).cookie).toContain(`${GOOGLE_STATE_COOKIE}=state-abc`);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${APP}/dashboard`);
    expect(cookie(res, REFRESH_COOKIE)?.value).toBe("rt-1");
    expect(cookie(res, SESSION_COOKIE)?.value).toBe("access-1");
    // The state cookie is single-use — cleared either way.
    expect(cookie(res, GOOGLE_STATE_COOKIE)?.maxAge).toBe("0");
  });

  it("falls back to /auth/callback when the API doesn't echo a next", async () => {
    nextResponse = () =>
      apiResponse(200, { data: { accessToken: "access-1", expiresIn: 600 } }, ["skout_refresh=rt-1"]);
    const res = await googleCallback(req("google/callback?code=abc&state=xyz"));
    expect(res.headers.get("location")).toBe(`${APP}/app/auth/callback`);
  });

  it("redirects to sign-in with a cancelled-consent message when Google reports access_denied", async () => {
    const res = await googleCallback(req("google/callback?error=access_denied"));
    expect(calls).toHaveLength(0);
    expect(res.headers.get("location")).toContain("/sign-in?error=");
    expect(decodeURIComponent(res.headers.get("location")!)).toContain("cancelled");
  });

  it("redirects to sign-in when code or state is missing, without calling the API", async () => {
    const res = await googleCallback(req("google/callback?code=abc"));
    expect(calls).toHaveLength(0);
    expect(res.headers.get("location")).toContain("/sign-in?error=");
  });

  it("maps AUTH_EMAIL_NOT_VERIFIED to a friendly message and clears the state cookie", async () => {
    nextResponse = () =>
      apiResponse(403, { error: "Email not verified", statusCode: 403, code: "AUTH_EMAIL_NOT_VERIFIED" });
    const res = await googleCallback(req("google/callback?code=abc&state=xyz"));
    expect(decodeURIComponent(res.headers.get("location")!)).toContain("email");
    expect(cookie(res, GOOGLE_STATE_COOKIE)?.maxAge).toBe("0");
  });
});
