import { OtpSignInForm } from "@/components/auth/otp-sign-in-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function OtpSignInPage() {
  return (
    <AuthShell>
      <OtpSignInForm />
    </AuthShell>
  );
}
