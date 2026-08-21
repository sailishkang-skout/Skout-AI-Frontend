import { APP_BASE_PATH } from "@/lib/app-url";

export function GdprBadge({ className }: { className?: string }) {
  return (
    <img
      src={`${APP_BASE_PATH}/brand/gdpr-compliant.png`}
      alt="GDPR Compliant"
      width={216}
      height={104}
      className={className ?? "h-10 w-auto"}
    />
  );
}
