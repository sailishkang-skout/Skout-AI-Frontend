import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { SESSION_COOKIE, authApiBase } from "./bff";

type ClerkAuth = Awaited<ReturnType<typeof auth>>;

export type ServerSession = {
  userId: string | null;
  getToken: ClerkAuth["getToken"];
};

let remoteJwks: { base: string; keySet: JWTVerifyGetKey } | null = null;
let testKeySet: JWTVerifyGetKey | null = null;

function jwksFor(base: string): JWTVerifyGetKey {
  if (testKeySet) return testKeySet;
  if (!remoteJwks || remoteJwks.base !== base) {
    remoteJwks = { base, keySet: createRemoteJWKSet(new URL(`${base}/.well-known/jwks.json`)) };
  }
  return remoteJwks.keySet;
}

/** Test hook: verify against a local key set instead of fetching the API's JWKS. */
export function setSessionKeySetForTesting(keySet: JWTVerifyGetKey | null): void {
  testKeySet = keySet;
}

/**
 * AUTH-FE-05 — verifies the app-origin session cookie (the own-auth access JWT) against the API's
 * public JWKS, with the same issuer / audience / algorithm rules as the API (BE-12). Returns the
 * user id (`sub`) or null. Session revocation is still enforced by the API on every call; this
 * only decides what a server component renders.
 */
async function verifySessionCookie(token: string): Promise<string | null> {
  const base = authApiBase();
  if (!base) return null;
  try {
    const { payload } = await jwtVerify(token, jwksFor(base), {
      issuer: process.env.AUTH_JWT_ISSUER || "https://auth.skoutai.io",
      audience: process.env.AUTH_JWT_AUDIENCE || "skout-api",
      algorithms: ["RS256"],
      clockTolerance: 30,
    });
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Server session for App Router server components: Clerk today, own-auth when
 *  NEXT_PUBLIC_AUTH_MODE=custom (reads the cookie set by the /api/auth route handlers). */
export async function getServerSession(): Promise<ServerSession> {
  if (process.env.NEXT_PUBLIC_AUTH_MODE === "custom") {
    const token = cookies().get(SESSION_COOKIE)?.value ?? null;
    const userId = token ? await verifySessionCookie(token) : null;
    const getToken = (async () => (userId ? token : null)) as ClerkAuth["getToken"];
    return { userId, getToken };
  }

  const { userId, getToken } = await auth();
  return {
    userId: userId ?? null,
    getToken,
  };
}
