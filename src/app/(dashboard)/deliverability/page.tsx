import { PlaceholderPage } from "@/components/placeholder-page";

export default function DeliverabilityPage() {
  return (
    <PlaceholderPage
      title="Deliverability Dashboard"
      description="Domain health, bounce rates, inbox pool status."
      apiPath="/api/v1/inboxes"
    />
  );
}
