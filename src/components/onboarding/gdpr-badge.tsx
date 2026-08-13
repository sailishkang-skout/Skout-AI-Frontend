export function GdprBadge({ className }: { className?: string }) {
  return (
    <img
      src="/brand/gdpr-compliant.png"
      alt="GDPR Compliant"
      width={180}
      height={56}
      className={className ?? "h-10 w-auto"}
    />
  );
}
