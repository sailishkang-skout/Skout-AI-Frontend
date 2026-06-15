import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default async function AuthCallbackPage() {
  const { userId, getToken } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  try {
    const token = await getToken();
    const res = await fetch(`${API_URL}/api/v1/icp`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (res.ok) {
      const data = (await res.json()) as { data: unknown | null };
      if (!data?.data) {
        redirect("/onboarding/icp");
      }
    }
  } catch {
    // Backend unreachable — fall through to search; UserProvisioner will retry
  }

  redirect("/prospects/search");
}
