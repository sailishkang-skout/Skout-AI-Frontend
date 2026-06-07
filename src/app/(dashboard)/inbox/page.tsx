import { PlaceholderPage } from "@/components/placeholder-page";

export default function InboxPage() {
  return (
    <PlaceholderPage
      title="Unified Inbox"
      description="Reply triage, thread view, manual override — inbound mail processor."
      apiPath="/api/v1/inbox/threads"
    />
  );
}
