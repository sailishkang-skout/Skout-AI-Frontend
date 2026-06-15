import { cn } from "@/lib/utils";

type AlertVariant = "default" | "warning" | "error" | "success";

const variants: Record<AlertVariant, string> = {
  default: "border-border bg-muted/50 text-foreground",
  warning:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100",
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100",
  success:
    "border-green-200 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-100",
};

export function Alert({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: AlertVariant;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", variants[variant], className)}>
      {children}
    </div>
  );
}
