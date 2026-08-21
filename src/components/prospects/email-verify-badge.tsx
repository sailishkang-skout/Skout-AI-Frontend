import { Badge } from "@/components/ui/badge";
import type { EmailVerifyStatus } from "@/types/api";

export const EMAIL_VERIFY_BADGE: Record<
  EmailVerifyStatus,
  { tone: "success" | "warning" | "danger" | "muted"; label: string }
> = {
  valid: { tone: "success", label: "Valid" },
  catch_all: { tone: "warning", label: "Catch-all" },
  risky: { tone: "warning", label: "Risky" },
  invalid: { tone: "danger", label: "Invalid" },
  unknown: { tone: "muted", label: "Unknown" },
  no_email: { tone: "muted", label: "No email" },
};

/** Same badge shown on list rows and in the prospect detail drawer — one source of truth. */
export function EmailVerifyBadge({
  status,
  deliverabilityScore,
  provider,
}: {
  status: EmailVerifyStatus;
  deliverabilityScore?: number;
  provider?: string;
}) {
  const { tone, label } = EMAIL_VERIFY_BADGE[status];
  const title =
    deliverabilityScore != null
      ? `Deliverability ${deliverabilityScore}/100${provider ? ` · ${provider}` : ""}`
      : undefined;
  return (
    <Badge tone={tone} title={title}>
      {label}
    </Badge>
  );
}
