import { OtpSignInForm } from "@/components/auth/otp-sign-in-form";

export default function OtpSignInPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
      <OtpSignInForm />
    </main>
  );
}
