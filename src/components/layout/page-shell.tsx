import { cn } from "@/lib/utils";

type PageShellWidth = "default" | "narrow" | "full";

const widthClass: Record<PageShellWidth, string> = {
  default: "max-w-6xl",
  narrow: "max-w-2xl",
  full: "max-w-none",
};

export function PageShell({
  children,
  className,
  width = "default",
}: {
  children: React.ReactNode;
  className?: string;
  width?: PageShellWidth;
}) {
  return (
    <div className={cn("mx-auto w-full space-y-6", widthClass[width], className)}>{children}</div>
  );
}
