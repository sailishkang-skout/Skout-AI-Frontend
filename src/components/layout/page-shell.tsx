import { cn } from "@/lib/utils";

type PageShellWidth = "default" | "narrow" | "wide" | "full";

const widthClass: Record<PageShellWidth, string> = {
  default: "max-w-6xl",
  narrow: "max-w-2xl",
  wide: "max-w-7xl",
  full: "max-w-none",
};

export function PageShell({
  children,
  className,
  width = "default",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  width?: PageShellWidth;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full space-y-6", widthClass[width], className)}
      {...props}
    >
      {children}
    </div>
  );
}
