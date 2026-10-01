import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OwnAuthLoginForm } from "@/components/auth/own-auth-login-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getServerSession } from "@/lib/auth/server";

export default async function SignInPage() {
  const { userId } = await getServerSession();
  if (userId) {
    redirect("/prospects/search");
  }

  return (
    <AuthShell>
      <Suspense>
        <OwnAuthLoginForm />
      </Suspense>
    </AuthShell>
  );
}
