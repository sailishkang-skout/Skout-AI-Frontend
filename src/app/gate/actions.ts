"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GATE_COOKIE_MAX_AGE_SECONDS, GATE_COOKIE_NAME, hashGateToken, safeNextPath } from "@/lib/gate";
import { GATE_TOKEN_VALUE } from "@/lib/gate-token.generated";

export async function unlockGate(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "/"));
  const expected = GATE_TOKEN_VALUE || process.env.GATE_TOKEN;

  if (!expected || token !== expected) {
    redirect(`/gate?error=1&next=${encodeURIComponent(next)}`);
  }

  cookies().set(GATE_COOKIE_NAME, await hashGateToken(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GATE_COOKIE_MAX_AGE_SECONDS,
  });

  redirect(next);
}
