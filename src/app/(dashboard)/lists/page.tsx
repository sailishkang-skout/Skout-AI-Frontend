import { PlaceholderPage } from "@/components/placeholder-page";

export default function ListsPage() {
  return (
    <PlaceholderPage
      title="Lists"
      description="Saved segments and activated prospect lists (workspace-scoped PostgreSQL)."
      apiPath="/api/v1/lists"
    />
  );
}
