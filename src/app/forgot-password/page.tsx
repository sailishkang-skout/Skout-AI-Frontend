import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
      <ForgotPasswordForm />
    </main>
  );
}
