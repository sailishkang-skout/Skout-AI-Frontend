"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GATE_COOKIE_MAX_AGE_SECONDS, GATE_COOKIE_NAME, hashGateToken } from "@/lib/gate";

function safeNext(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function unlockGate(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/"));
  const expected = process.env.GATE_TOKEN;

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
