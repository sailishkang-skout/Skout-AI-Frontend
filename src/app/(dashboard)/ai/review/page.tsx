import { PlaceholderPage } from "@/components/placeholder-page";

export default function AiReviewPage() {
  return (
    <PlaceholderPage
      title="AI Review Queue"
      description="HITL approve / edit / reject for AI-generated reply drafts."
      apiPath="/api/v1/ai/drafts"
    />
  );
}
