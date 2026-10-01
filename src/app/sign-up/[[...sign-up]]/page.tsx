import { redirect } from "next/navigation";
import { OwnAuthSignupForm } from "@/components/auth/own-auth-signup-form";
import { getServerSession } from "@/lib/auth/server";

export default async function SignUpPage() {
  const { userId } = await getServerSession();
  if (userId) {
    redirect("/prospects/search");
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
      <OwnAuthSignupForm />
    </main>
  );
}
