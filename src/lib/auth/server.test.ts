// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type KeyLike } from "jose";

const authMock = vi.fn();
const cookieStore = new Map<string, string>();

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
  createRouteMatcher: () => () => false,
}));

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined),
  }),
}));

import { getServerSession, setSessionKeySetForTesting } from "./server";
import { SESSION_COOKIE } from "./bff";

describe("getServerSession (clerk mode)", () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  it("returns Clerk userId and getToken", async () => {
    const getToken = vi.fn().mockResolvedValue("jwt");
    authMock.mockResolvedValue({ userId: "user_1", getToken });

    const session = await getServerSession();
    expect(session.userId).toBe("user_1");
    await expect(session.getToken()).resolves.toBe("jwt");
  });

  it("normalizes missing userId to null", async () => {
    authMock.mockResolvedValue({ userId: undefined, getToken: vi.fn() });
    const session = await getServerSession();
    expect(session.userId).toBeNull();
  });
});

describe("getServerSession (custom mode, AUTH-FE-05)", () => {
  let key: KeyLike;
  let otherKey: KeyLike;

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256", { extractable: true });
    key = pair.privateKey;
    otherKey = (await generateKeyPair("RS256")).privateKey;
    const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
    setSessionKeySetForTesting(createLocalJWKSet({ keys: [jwk] }));
  });

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "custom");
    vi.stubEnv("AUTH_API_URL", "http://api.test");
    cookieStore.clear();
    authMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function token(opts: { sub?: string; iss?: string; aud?: string; exp?: string; signWith?: KeyLike } = {}) {
    return new SignJWT({ sid: "s1" })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setSubject(opts.sub ?? "user-uuid-1")
      .setIssuer(opts.iss ?? "https://auth.skoutai.io")
      .setAudience(opts.aud ?? "skout-api")
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? "10m")
      .sign(opts.signWith ?? key);
  }

  it("returns the user id from a valid session cookie and never touches Clerk", async () => {
    const jwt = await token();
    cookieStore.set(SESSION_COOKIE, jwt);
    const session = await getServerSession();
    expect(session.userId).toBe("user-uuid-1");
    await expect(session.getToken()).resolves.toBe(jwt);
    expect(authMock).not.toHaveBeenCalled();
  });

  it("is signed out with no cookie", async () => {
    const session = await getServerSession();
    expect(session.userId).toBeNull();
    await expect(session.getToken()).resolves.toBeNull();
  });

  it.each([
    ["expired", { exp: "-1m" }],
    ["wrong issuer", { iss: "https://evil.example" }],
    ["wrong audience", { aud: "other-api" }],
    ["unknown signing key", { useOtherKey: true }],
  ])("rejects a %s token", async (_label, opts) => {
    const { useOtherKey, ...rest } = opts as { useOtherKey?: boolean; exp?: string; iss?: string; aud?: string };
    const jwt = await token(useOtherKey ? { signWith: otherKey } : rest);
    cookieStore.set(SESSION_COOKIE, jwt);
    const session = await getServerSession();
    expect(session.userId).toBeNull();
    await expect(session.getToken()).resolves.toBeNull();
  });

  it("rejects a tampered token", async () => {
    const jwt = await token();
    const [h, , s] = jwt.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "someone-else", iss: "https://auth.skoutai.io", aud: "skout-api", exp: 9999999999 })).toString("base64url");
    cookieStore.set(SESSION_COOKIE, `${h}.${forged}.${s}`);
    expect((await getServerSession()).userId).toBeNull();
  });
});
