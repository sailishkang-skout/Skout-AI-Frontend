"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

const labels: Record<"light" | "dark" | "system", string> = {
  light: "Light mode",
  dark: "Dark mode",
  system: "System theme",
};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, cycleTheme } = useTheme();

  const Icon = theme === "system" ? Monitor : theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border",
        "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        className
      )}
      aria-label={labels[theme]}
      title={labels[theme]}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}
