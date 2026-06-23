import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isIcpConfigured } from "@/lib/scoring";
import type { IcpConfig } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

export default async function AuthCallbackPage() {
  const { userId, getToken } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

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
      if (!isIcpConfigured(payload.config ?? {})) {
        redirect("/onboarding/icp");
      }
      redirect("/dashboard");
    }
  } catch {
    // Backend unreachable — continue to app; user can open Setup wizard from sidebar.
  }

  redirect("/dashboard");
}
