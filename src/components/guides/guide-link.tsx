import Link from "next/link";
import { BookOpen, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { guidePath, type GuideSlug } from "@/lib/guides";

export function GuideLink({
  slug,
  label = "Setup guide",
  className,
  compact,
}: {
  slug: GuideSlug;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={guidePath(slug)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline",
        compact && "text-xs",
        className
      )}
    >
      <BookOpen className={cn("shrink-0", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
      {label}
      <ExternalLink className={cn("shrink-0 opacity-70", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
    </Link>
  );
}
