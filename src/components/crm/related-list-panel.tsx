"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Small reusable "related records" mini-list — used on Company/Contact/Deal detail
 * pages for contacts-at-company, deals-at-company/contact, tasks, and meetings. */
export function RelatedListPanel<T extends { id: string }>({
  title,
  items,
  loading,
  renderItem,
  emptyLabel,
  onAdd,
  addLabel,
}: {
  title: string;
  items: T[] | undefined;
  loading: boolean;
  renderItem: (item: T) => React.ReactNode;
  emptyLabel: string;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {onAdd && (
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" />
            {addLabel ?? "Add"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-md" />
            ))}
          </div>
        ) : !items || items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((item) => (
              <li key={item.id}>{renderItem(item)}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Row helper matching the app's `Link`-as-row-item convention. */
export function RelatedItemRow({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm hover:border-border hover:bg-accent"
    >
      {children}
    </Link>
  );
}
