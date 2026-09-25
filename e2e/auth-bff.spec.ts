import { test, expect, type Page } from "@playwright/test";

/**
 * AUTH-FE-05 — own-auth route-handler layer, exercised in a real browser against a real API.
 *
 * Needs: the web app running with NEXT_PUBLIC_AUTH_MODE=custom, the API running with
 * AUTH_CUSTOM_ENABLED=true, and a verified password user. Run with:
 *   PLAYWRIGHT_AUTH_BFF_TESTS=true PLAYWRIGHT_AUTH_EMAIL=... PLAYWRIGHT_AUTH_PASSWORD=... \
 *   pnpm playwright test e2e/auth-bff.spec.ts --project=real-token-chromium
 * Skipped otherwise (the default e2e run uses stub auth, where these routes 404 by design).
 */
const EMAIL = process.env.PLAYWRIGHT_AUTH_EMAIL ?? "";
const PASSWORD = process.env.PLAYWRIGHT_AUTH_PASSWORD ?? "";

test.skip(
  process.env.PLAYWRIGHT_AUTH_BFF_TESTS !== "true" || !EMAIL || !PASSWORD,
  "Set PLAYWRIGHT_AUTH_BFF_TESTS=true with PLAYWRIGHT_AUTH_EMAIL/PASSWORD to run"
);

type Json = Record<string, any>;

/** Runs fetch inside the page, so the browser applies its real cookie + Origin rules. */
async function call(page: Page, path: string, init: { method?: string; body?: unknown; csrf?: string } = {}) {
  return page.evaluate(
    async ({ path, init }) => {
      const headers: Record<string, string> = {};
      if (init.body !== undefined) headers["content-type"] = "application/json";
      if (init.csrf) headers["x-csrf-token"] = init.csrf;
      const res = await fetch(`/app/api/auth/${path}`, {
        method: init.method ?? "POST",
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        credentials: "same-origin",
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      return { status: res.status, json: json as Json | null, text };
    },
    { path, init }
  );
}

async function appCookies(page: Page) {
  const all = await page.context().cookies();
  const byName = (n: string) => all.find((c) => c.name === n);
  return {
    refresh: byName("skout_app_refresh"),
    session: byName("skout_app_session"),
    csrf: byName("skout_app_csrf"),
  };
}

test.describe("AUTH-FE-05 route handlers (login → refresh → logout)", () => {
  test.beforeEach(async ({ page }) => {
    // A real page under the app's basePath. NOTE: with `baseURL` set, Playwright resolves a
    // leading-slash path against the origin, not against baseURL's own path — "/foo" would land
    // outside "/app" entirely (and then Path=/app cookies wouldn't show in document.cookie).
    await page.goto("/app/sign-in");
  });

  test("login sets HttpOnly/SameSite cookies, token stays out of JS-readable storage", async ({ page }) => {
    const res = await call(page, "login", { body: { email: EMAIL, password: PASSWORD } });
    expect(res.status, res.text).toBe(200);
    const { accessToken, expiresIn, csrfToken } = res.json!.data;
    expect(accessToken.split(".")).toHaveLength(3); // a real JWT from the API
    expect(expiresIn).toBeGreaterThan(0);
    expect(typeof csrfToken).toBe("string");

    const { refresh, session, csrf } = await appCookies(page);
    expect(refresh).toMatchObject({ httpOnly: true, sameSite: "Strict", path: "/app/api/auth" });
    expect(session).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/app", value: accessToken });
    expect(csrf).toMatchObject({ httpOnly: false, sameSite: "Strict", path: "/app", value: csrfToken });
    expect(res.text).not.toContain(refresh!.value); // refresh token never in a response body

    // HttpOnly really hides them from scripts, and nothing is written to web storage.
    const visible = await page.evaluate(() => ({
      cookie: document.cookie,
      local: JSON.stringify({ ...localStorage }),
      session: JSON.stringify({ ...sessionStorage }),
    }));
    expect(visible.cookie).not.toContain("skout_app_refresh");
    expect(visible.cookie).not.toContain("skout_app_session");
    expect(visible.cookie).toContain(`skout_app_csrf=${csrfToken}`);
    for (const secret of [accessToken, refresh!.value]) {
      expect(visible.local).not.toContain(secret);
      expect(visible.session).not.toContain(secret);
    }

    const me = await call(page, "session", { method: "GET" });
    expect(me.status).toBe(200);
    expect(me.json!.data.email).toBe(EMAIL.toLowerCase());
    expect(me.text).not.toContain(accessToken);
  });

  test("refresh rotates the refresh cookie and needs the CSRF token", async ({ page }) => {
    const login = await call(page, "login", { body: { email: EMAIL, password: PASSWORD } });
    expect(login.status, login.text).toBe(200);
    const before = (await appCookies(page)).refresh!.value;

    expect((await call(page, "refresh")).status).toBe(403); // no CSRF header
    expect((await call(page, "refresh", { csrf: "wrong" })).status).toBe(403);

    const refreshed = await call(page, "refresh", { csrf: login.json!.data.csrfToken });
    expect(refreshed.status, refreshed.text).toBe(200);
    expect(refreshed.json!.data.accessToken).not.toBe(login.json!.data.accessToken);
    const after = (await appCookies(page)).refresh!.value;
    expect(after).not.toBe(before);
  });

  test("logout revokes the session and clears every app cookie", async ({ page }) => {
    const login = await call(page, "login", { body: { email: EMAIL, password: PASSWORD } });
    expect(login.status, login.text).toBe(200);

    const out = await call(page, "logout", { csrf: login.json!.data.csrfToken });
    expect(out.status).toBe(204);
    const { refresh, session, csrf } = await appCookies(page);
    expect(refresh).toBeUndefined();
    expect(session).toBeUndefined();
    expect(csrf).toBeUndefined();

    expect((await call(page, "session", { method: "GET" })).status).toBe(401);
  });

  test("a wrong password gets the API's generic error and no cookies", async ({ page }) => {
    const res = await call(page, "login", { body: { email: EMAIL, password: `${PASSWORD}-wrong` } });
    expect(res.status).toBe(401);
    expect(res.json!.code).toBe("AUTH_INVALID_CREDENTIALS");
    const { refresh, session } = await appCookies(page);
    expect(refresh).toBeUndefined();
    expect(session).toBeUndefined();
  });
});
