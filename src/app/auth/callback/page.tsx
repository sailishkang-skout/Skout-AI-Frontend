import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

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
      const payload = (await res.json()) as {
        data?: { config?: Record<string, unknown> } | null;
      };
      const config = payload?.data?.config;
      const configured =
        Boolean(config) &&
        (Boolean(
          (config?.industries as string[] | undefined)?.length ||
            (config?.countries as string[] | undefined)?.length ||
            (config?.seniorities as string[] | undefined)?.length ||
            config?.minEmployees != null ||
            config?.maxEmployees != null
        ));
      if (!payload?.data || !configured) {
        redirect("/onboarding/icp");
      }
      redirect("/dashboard");
    }
  } catch {
    // Backend unreachable — continue to app; user can open Setup wizard from sidebar.
  }

  redirect("/dashboard");
}
