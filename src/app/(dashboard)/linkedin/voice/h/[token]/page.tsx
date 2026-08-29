import React from "react";
import { LinkedinVoiceHandoffClient } from "@/components/linkedin/voice-handoff-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LinkedIn voice handoff | Skout AI",
};

export default function LinkedinVoiceHandoffPage() {
  return (
    <div className="container py-8 px-4">
      <LinkedinVoiceHandoffClient />
    </div>
  );
}
