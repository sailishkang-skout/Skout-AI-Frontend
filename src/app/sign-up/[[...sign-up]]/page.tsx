import { redirect } from "next/navigation";
import { OwnAuthSignupForm } from "@/components/auth/own-auth-signup-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getServerSession } from "@/lib/auth/server";

export default async function SignUpPage() {
  const { userId } = await getServerSession();
  if (userId) {
    redirect("/prospects/search");
  }

  return (
    <AuthShell>
      <OwnAuthSignupForm />
    </AuthShell>
  );
}
