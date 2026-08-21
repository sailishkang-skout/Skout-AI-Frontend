import { cn } from "@/lib/utils";

export function ListRow({
  children,
  actions,
  className,
  id,
}: {
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** DOM id — lets a caller deep-link to (and scroll/highlight) one specific row, e.g. from a
   * "Created list, open it" link elsewhere in the app. */
  id?: string;
}) {
  return (
    <li
      id={id}
      className={cn(
        "flex scroll-mt-20 flex-col gap-3 border-b py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      )}
    </li>
  );
}
