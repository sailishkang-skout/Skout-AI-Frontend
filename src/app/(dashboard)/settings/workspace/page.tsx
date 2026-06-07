import { PlaceholderPage } from "@/components/placeholder-page";

export default function WorkspaceSettingsPage() {
  return (
    <PlaceholderPage
      title="Workspace Settings"
      description="Organization, RBAC roles (Owner, Admin, Operator, Viewer)."
      apiPath="/api/v1/workspaces"
    />
  );
}
