import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";

export default async function SignInPage() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (publishableKey) {
    const { userId } = await auth();
    if (userId) {
      redirect("/prospects/search");
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
      {publishableKey ? (
        <SignInForm />
      ) : (
        <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Clerk is not configured yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to your .env.local to enable Google SSO.
          </p>
        </div>
      )}
    </main>
  );
}
