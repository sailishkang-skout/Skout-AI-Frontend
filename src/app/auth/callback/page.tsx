import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isOnboardingComplete } from "@/lib/scoring";
import type { IcpConfig } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

export default async function AuthCallbackPage() {
  const { userId, getToken } = await auth();

  if (!userId) {
    redirect("/");
  }

  let destination = "/onboarding";
  try {
    const token = await getToken();
    const res = await fetch(`${API_URL}/api/v1/workspace/icp`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (res.ok) {
      const payload = (await res.json()) as { config?: IcpConfig };
      if (isOnboardingComplete(payload.config ?? {})) {
        destination = "/dashboard";
      }
    }
  } catch {
    // Fail closed: the dashboard gate will retry verification once the API recovers.
  }

  redirect(destination);
}
