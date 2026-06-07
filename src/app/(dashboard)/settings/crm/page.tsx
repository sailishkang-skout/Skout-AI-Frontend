import { PlaceholderPage } from "@/components/placeholder-page";

export default function CrmSettingsPage() {
  return (
    <PlaceholderPage
      title="CRM Sync Settings"
      description="Field mapping, conflict rules — HubSpot and Salesforce adapters."
      apiPath="/api/v1/crm/connections"
    />
  );
}
