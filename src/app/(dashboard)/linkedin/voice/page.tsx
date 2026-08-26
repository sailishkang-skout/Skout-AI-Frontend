import React from "react";
import { LinkedinVoiceWizard } from "@/components/linkedin/voice-wizard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LinkedIn Voice Studio | Skout AI",
  description: "AI-powered LinkedIn Voice message drafting, regional intelligence alignment, and mobile handoff.",
};

export default function LinkedinVoicePage() {
  return (
    <div className="container py-8 px-4 sm:px-6 lg:px-8">
      <LinkedinVoiceWizard />
    </div>
  );
}
