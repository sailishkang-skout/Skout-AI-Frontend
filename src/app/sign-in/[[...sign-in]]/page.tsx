import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { CustomSignInForm } from "@/components/auth/custom-sign-in-form";
import { getServerSession } from "@/lib/auth/server";
import { isCustomAuthMode } from "@/lib/auth/bff";
type SearchParams = { [key: string]: string | string[] | undefined };
type Props = {
  searchParams: Promise<SearchParams>;
};

export default async function SignInPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const isCustomMode = isCustomAuthMode();
  
  // Check if user is already signed in
  const { userId } = await getServerSession();
  if (userId) {
    // If there's a valid next parameter, redirect there, otherwise go to default
    if (typeof next === "string" && next.startsWith("/")) {
      redirect(`${process.env.NEXT_PUBLIC_APP_URL || ""}${next}`);
    }
    redirect("/prospects/search");
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
      {publishableKey && !isCustomMode ? (
        <SignInForm path="/sign-in" />
      ) : isCustomMode ? (
        <CustomSignInForm next={typeof next === "string" ? next : undefined} />
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