import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { INVITE_RETURN_COOKIE, isInviteToken } from "@/lib/auth/invite-return";
import { getServerSession } from "@/lib/auth/server";
import { isOnboardingComplete } from "@/lib/scoring";
import type { IcpConfig } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

export default async function AuthCallbackPage() {
  const { userId, getToken } = await getServerSession();

  if (!userId) {
    redirect("/sign-in");
  }

  // Signed in while accepting an invite (SSO or password): accept that invite first.
  const pendingInvite = (await cookies()).get(INVITE_RETURN_COOKIE)?.value ?? "";
  if (isInviteToken(pendingInvite)) {
    redirect("/api/auth/invite-accept");
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
